import { useMemo, useState } from 'react'

import { useCalls } from '../../hooks/useCalls'
import { useSites } from '../../hooks/useSites'
import {
  MY_REP_INITIALS,
  dispatchAssetSelected,
  getAppCalledSiteIds,
} from '../../lib/sites'
import SiteTable from '../Grid/SiteTable'
import { COLUMNS } from '../Grid/columns'
import { ASC, nextSortState, sortSites } from '../Grid/sorting'

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
    <div className="min-w-0 flex-1">
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
 * "Called" means the site has at least one call logged through this tool
 * (source "app"). Rows carried over from the tracker import don't count —
 * they are legacy data, not calls actually made here. Called rows are hidden
 * by default so the list reads as a to-do; a toggle brings them back.
 */
export default function MyAssignments() {
  const { sites, isLoading: isLoadingSites, loadError } = useSites()
  const { calls, isLoading: isLoadingCalls, loadError: callsError } = useCalls()

  const [showCalled, setShowCalled] = useState(false)
  const [sort, setSort] = useState({ key: 'call_state', direction: ASC })

  const calledSiteIds = useMemo(() => getAppCalledSiteIds(calls), [calls])

  const myAssignments = useMemo(
    () =>
      sites
        .filter((site) => site.rep_assignment?.rep_initials === MY_REP_INITIALS)
        .map((site) => ({
          ...site,
          call_state: calledSiteIds.has(site.id) ? CALLED : PENDING,
        })),
    [sites, calledSiteIds],
  )

  const completed = myAssignments.filter((site) => site.call_state === CALLED).length

  const visibleSites = useMemo(() => {
    const shown = showCalled
      ? myAssignments
      : myAssignments.filter((site) => site.call_state === PENDING)

    // Default view: pending first, then by account status. Once the user picks
    // a column, that choice wins outright.
    if (sort.key === 'call_state') {
      const byStatus = sortSites(shown, ASSIGNMENT_COLUMNS, {
        key: 'account_status',
        direction: ASC,
      })
      return sortSites(byStatus, ASSIGNMENT_COLUMNS, sort)
    }
    return sortSites(shown, ASSIGNMENT_COLUMNS, sort)
  }, [myAssignments, showCalled, sort])

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
      <div className="flex items-end gap-6 border-b border-gray-200 bg-white px-3 py-2.5">
        <ProgressBar completed={completed} total={myAssignments.length} />

        <label className="flex shrink-0 cursor-pointer items-center gap-2 pb-0.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showCalled}
            onChange={(event) => setShowCalled(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show already called
          {!showCalled && completed > 0 && (
            <span className="text-gray-400">({completed} hidden)</span>
          )}
        </label>
      </div>

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
