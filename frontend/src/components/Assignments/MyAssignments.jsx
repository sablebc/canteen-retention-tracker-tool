import { useCallback, useEffect, useMemo, useState } from 'react'

import { getCalls } from '../../api/client'
import { useSites } from '../../hooks/useSites'
import { CALL_LOGGED_EVENT, dispatchAssetSelected } from '../../lib/sites'
import SiteTable from '../Grid/SiteTable'
import { COLUMNS } from '../Grid/columns'
import { ASC, nextSortState, sortSites } from '../Grid/sorting'

/** Until auth lands, "my" assignments means this rep's. */
const MY_INITIALS = 'BC'

const CALLED = 'Called'
const PENDING = 'Pending'

/** Pending sorts before Called, which is the point of the view. */
const CALL_STATE_ORDER = { [PENDING]: 0, [CALLED]: 1 }

const CALL_STATE_COLUMN = {
  key: 'call_state',
  label: 'Status',
  type: 'number',
  sortValue: (site) => CALL_STATE_ORDER[site.call_state],
  format: (site) => (site.call_state === CALLED ? '✅ Called' : '⏳ Pending'),
}

// The call-state column leads, since it is what this view is organised around.
const ASSIGNMENT_COLUMNS = [CALL_STATE_COLUMN, ...COLUMNS]

function ProgressBar({ completed, total }) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div className="border-b border-gray-200 bg-white px-3 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-gray-900">
          {completed} / {total} calls completed
        </span>
        <span className="text-sm text-gray-500 tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Calls completed"
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

/**
 * The current rep's assigned sites, with call progress.
 *
 * Whether a site has been called is derived from the call records rather than
 * stored on the site, so a call logged from the detail panel flips the row
 * without a reload.
 */
export default function MyAssignments() {
  const { sites, isLoading: isLoadingSites, loadError } = useSites()

  const [calledSiteIds, setCalledSiteIds] = useState(() => new Set())
  const [isLoadingCalls, setIsLoadingCalls] = useState(true)
  const [callsError, setCallsError] = useState(null)
  const [sort, setSort] = useState({ key: 'call_state', direction: ASC })

  const loadCalls = useCallback(async () => {
    try {
      const payload = await getCalls()
      const rows = Array.isArray(payload) ? payload : (payload?.results ?? [])
      setCalledSiteIds(new Set(rows.map((call) => call.site)))
    } catch (error) {
      setCallsError(error.message)
    } finally {
      setIsLoadingCalls(false)
    }
  }, [])

  useEffect(() => {
    loadCalls()
  }, [loadCalls])

  // A call logged in the panel marks its site as called straight away, rather
  // than waiting for a refetch.
  useEffect(() => {
    const handleCallLogged = (event) => {
      const siteId = event.detail?.site
      if (siteId === undefined) return
      setCalledSiteIds((current) => new Set(current).add(siteId))
    }

    window.addEventListener(CALL_LOGGED_EVENT, handleCallLogged)
    return () => window.removeEventListener(CALL_LOGGED_EVENT, handleCallLogged)
  }, [])

  const myAssignments = useMemo(
    () =>
      sites
        .filter((site) => site.rep_assignment?.rep_initials === MY_INITIALS)
        .map((site) => ({
          ...site,
          call_state: calledSiteIds.has(site.id) ? CALLED : PENDING,
        })),
    [sites, calledSiteIds],
  )

  const visibleSites = useMemo(() => {
    // Default view: pending first, then by account status. Once the user picks
    // a column, that choice wins outright.
    if (sort.key === 'call_state') {
      const byStatus = sortSites(myAssignments, ASSIGNMENT_COLUMNS, {
        key: 'account_status',
        direction: ASC,
      })
      return sortSites(byStatus, ASSIGNMENT_COLUMNS, sort)
    }
    return sortSites(myAssignments, ASSIGNMENT_COLUMNS, sort)
  }, [myAssignments, sort])

  const completed = myAssignments.filter((site) => site.call_state === CALLED).length

  if (isLoadingSites || isLoadingCalls) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Loading assignments…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not load sites: {loadError}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <ProgressBar completed={completed} total={myAssignments.length} />

      {callsError && (
        <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Call history unavailable, so every site shows as pending: {callsError}
        </p>
      )}

      <SiteTable
        sites={visibleSites}
        columns={ASSIGNMENT_COLUMNS}
        sort={sort}
        onSortChange={(key) => setSort((current) => nextSortState(current, key))}
        onRowClick={dispatchAssetSelected}
      />
    </div>
  )
}
