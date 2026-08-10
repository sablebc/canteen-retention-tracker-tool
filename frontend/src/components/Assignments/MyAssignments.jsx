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
  format: (site) => (site.call_state === CALLED ? '[Called]' : '[Pending]'),
  cellClassName: 'font-medium',
}

// The call-state column leads, since it is what this view is organised around.
const ASSIGNMENT_COLUMNS = [CALL_STATE_COLUMN, ...COLUMNS]

const SELECT_CLASSES =
  'rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 ' +
  'shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

/** Labels for sites missing a value, kept in step with the status badges. */
const NO_BRANCH = 'No branch'
const NO_STATUS = 'Unknown'

/** Count sites per key, returned as [key, count] pairs, biggest first. */
function countBy(sites, getKey) {
  const counts = new Map()
  sites.forEach((site) => {
    const key = getKey(site)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
}

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

/** One compact `label: n | label: n | …` summary line. */
function BreakdownLine({ label, counts }) {
  const text = counts.map(([key, count]) => `${key}: ${count}`).join('  |  ')
  return (
    <p className="truncate text-xs text-gray-600" title={text}>
      <span className="font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>{' '}
      <span className="tabular-nums">{text}</span>
    </p>
  )
}

/**
 * The current rep's assigned sites, with call progress.
 *
 * "Called" means the site has at least one call logged through this tool
 * (source "app"); rows carried over from the tracker import don't count.
 * Called rows are hidden by default so the list reads as a to-do; a toggle
 * brings them back. The branch/status dropdowns narrow the list, and the
 * breakdown lines summarise whatever the dropdowns currently select
 * (regardless of the called toggle).
 */
export default function MyAssignments() {
  const { sites, isLoading: isLoadingSites, loadError } = useSites()
  const { calls, isLoading: isLoadingCalls, loadError: callsError } = useCalls()

  const [showCalled, setShowCalled] = useState(false)
  const [branch, setBranch] = useState('')
  const [status, setStatus] = useState('')
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

  // Options come from the data so a new branch or status shows up without a
  // code change.
  const branchOptions = useMemo(
    () =>
      [...new Set(myAssignments.map((site) => site.branch).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [myAssignments],
  )
  const statusOptions = useMemo(
    () =>
      [
        ...new Set(myAssignments.map((site) => site.account_status).filter(Boolean)),
      ].sort((a, b) => a.localeCompare(b)),
    [myAssignments],
  )

  // The dropdown-filtered list; the breakdown summarises this, so it keeps
  // counting called sites even while the toggle hides them from the table.
  const filteredAssignments = useMemo(
    () =>
      myAssignments.filter(
        (site) =>
          (branch === '' || site.branch === branch) &&
          (status === '' || site.account_status === status),
      ),
    [myAssignments, branch, status],
  )

  const branchBreakdown = useMemo(
    () => countBy(filteredAssignments, (site) => site.branch || NO_BRANCH),
    [filteredAssignments],
  )
  const statusBreakdown = useMemo(
    () => countBy(filteredAssignments, (site) => site.account_status || NO_STATUS),
    [filteredAssignments],
  )

  const visibleSites = useMemo(() => {
    const shown = showCalled
      ? filteredAssignments
      : filteredAssignments.filter((site) => site.call_state === PENDING)

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
  }, [filteredAssignments, showCalled, sort])

  const completed = myAssignments.filter((site) => site.call_state === CALLED).length
  const hiddenCalled = filteredAssignments.length - visibleSites.length

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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 bg-white px-3 py-2">
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <span className="sr-only">Filter by branch</span>
          <select
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            className={SELECT_CLASSES}
          >
            <option value="">All branches</option>
            {branchOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <span className="sr-only">Filter by account status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className={SELECT_CLASSES}
          >
            <option value="">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {(branch !== '' || status !== '') && (
          <button
            type="button"
            onClick={() => {
              setBranch('')
              setStatus('')
            }}
            className="rounded-md px-2 py-1 text-sm text-blue-700 hover:bg-blue-50"
          >
            Clear filters
          </button>
        )}

        <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showCalled}
            onChange={(event) => setShowCalled(event.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show already called
          {!showCalled && hiddenCalled > 0 && (
            <span className="text-gray-400">({hiddenCalled} hidden)</span>
          )}
        </label>

        <span className="ml-auto whitespace-nowrap text-sm text-gray-500 tabular-nums">
          {filteredAssignments.length === myAssignments.length
            ? `${myAssignments.length} sites`
            : `${filteredAssignments.length} of ${myAssignments.length} sites`}
        </span>
      </div>

      <div className="space-y-0.5 border-b border-gray-200 bg-gray-50 px-3 py-1.5">
        <BreakdownLine label="Branch" counts={branchBreakdown} />
        <BreakdownLine label="Status" counts={statusBreakdown} />
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
