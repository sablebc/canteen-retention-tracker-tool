import { useMemo, useState } from 'react'

import { useCalls } from '../../hooks/useCalls'
import { useSites } from '../../hooks/useSites'
import {
  CURRENT_REP,
  dispatchAssetSelected,
  getAppCalledSiteIds,
  getLatestAnnualRevenue,
  getLatestCallBySite,
} from '../../lib/sites'
import OutcomeLegend from '../OutcomeLegend'
import { ASC, nextSortState, sortSites } from '../Grid/sorting'
import CallsTable from './CallsTable'
import { CALL_COLUMNS } from './callColumns'

const CALLED = 'Called'
const PENDING = 'Pending'

const SELECT_CLASSES =
  'h-6 border border-line bg-white px-1.5 text-[11px] focus:border-accent ' +
  'focus:outline focus:outline-1 focus:outline-accent'

// The filter bar sits on the light #F8F9FA surface, so its text stays dark;
// `text-body` rather than `text-muted` keeps these 11px labels well clear of
// the contrast floor.
const FILTER_LABEL_CLASSES =
  'text-[11px] font-semibold uppercase tracking-[0.06em] text-body'

/** Count sites per key, biggest first, for the breakdown line. */
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

function breakdownText(counts) {
  return counts.map(([key, count]) => `${key} ${count}`).join(' · ')
}

/**
 * My Calls — the current rep's assigned sites and their call progress.
 *
 * "Called" means at least one call logged through this tool (source "app");
 * rows carried over from the tracker import do not count. Called rows are
 * hidden by default so the list reads as a to-do list.
 */
export default function MyAssignments() {
  const { sites, isLoading: isLoadingSites, loadError } = useSites()
  const { calls, isLoading: isLoadingCalls, loadError: callsError } = useCalls()

  const [showCalled, setShowCalled] = useState(false)
  const [branch, setBranch] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState({ key: 'call_state', direction: ASC })

  const calledSiteIds = useMemo(() => getAppCalledSiteIds(calls), [calls])
  const latestCallBySite = useMemo(() => getLatestCallBySite(calls), [calls])

  const myAssignments = useMemo(
    () =>
      sites
        .filter(
          (site) => site.rep_assignment?.rep_initials === CURRENT_REP.initials,
        )
        .map((site) => ({
          ...site,
          call_state: calledSiteIds.has(site.id) ? CALLED : PENDING,
          annual_revenue: getLatestAnnualRevenue(site),
          last_call_date: latestCallBySite.get(site.id)?.call_date ?? null,
        })),
    [sites, calledSiteIds, latestCallBySite],
  )

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

  // The dropdown-filtered list. The breakdown and legend summarise this, so
  // they keep counting called sites even while the toggle hides them.
  const filtered = useMemo(
    () =>
      myAssignments.filter(
        (site) =>
          (branch === '' || site.branch === branch) &&
          (status === '' || site.account_status === status),
      ),
    [myAssignments, branch, status],
  )

  const visibleSites = useMemo(() => {
    const shown = showCalled
      ? filtered
      : filtered.filter((site) => site.call_state === PENDING)

    // Default view: pending first, then by account status. Once the user
    // picks a column, that choice wins outright.
    if (sort.key === 'call_state') {
      const byStatus = sortSites(shown, CALL_COLUMNS, {
        key: 'account_status',
        direction: ASC,
      })
      return sortSites(byStatus, CALL_COLUMNS, sort)
    }
    return sortSites(shown, CALL_COLUMNS, sort)
  }, [filtered, showCalled, sort])

  const total = myAssignments.length
  const completed = myAssignments.filter((site) => site.call_state === CALLED).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  const branchCounts = useMemo(
    () => countBy(filtered, (site) => site.branch || 'No branch'),
    [filtered],
  )
  const statusCounts = useMemo(
    () => countBy(filtered, (site) => site.account_status || 'Unknown'),
    [filtered],
  )

  if (isLoadingSites || isLoadingCalls) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        Loading assignments…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="border border-line bg-white px-3 py-2 text-[#8A1616]">
          Could not load sites: {loadError}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/*
        Dark teal band with white text throughout. Both the background and the
        foreground are stated explicitly here rather than inherited, so the
        summary stays legible no matter what surrounds it.
      */}
      <div className="flex-none border-b border-teal-deep bg-teal-header px-3.5 pb-2.5 pt-3 text-white">
        <div className="mb-[7px] flex items-baseline gap-2.5">
          <span className="text-[13px] font-semibold text-white">My Calls</span>
          <span className="text-[11px] text-white tabular-nums">
            {completed} / {total} calls completed
          </span>
          <span className="text-[11px] text-white tabular-nums">{percent}%</span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Calls completed"
          // Light track on the teal band: the unfilled portion has to stay
          // distinguishable from the header behind it, not just from the fill.
          className="h-2.5 max-w-[620px] border border-line-light bg-surface"
        >
          <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
        </div>

        <div className="mt-[7px] text-[11px] leading-[1.6] text-white">
          <span className="font-semibold">Branch:</span> {breakdownText(branchCounts)}
          <span className="px-2 text-white">|</span>
          <span className="font-semibold">Status:</span> {breakdownText(statusCounts)}
        </div>
      </div>

      <div className="flex h-9 flex-none items-center gap-3.5 border-b border-toolbar-line bg-surface px-3.5">
        <label className="flex items-center gap-1.5">
          <span className={FILTER_LABEL_CLASSES}>Branch</span>
          <select
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
            aria-label="Filter by branch"
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

        <label className="flex items-center gap-1.5">
          <span className={FILTER_LABEL_CLASSES}>Account Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by account status"
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

        <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-[11px] text-body">
          <input
            type="checkbox"
            checked={showCalled}
            onChange={(event) => setShowCalled(event.target.checked)}
            className="h-[13px] w-[13px] flex-none accent-[#7AC143]"
          />
          Show already called
        </label>

        <span className="ml-auto whitespace-nowrap text-[11px] text-body tabular-nums">
          {visibleSites.length} of {total} shown
        </span>
      </div>

      <OutcomeLegend sites={filtered} label={`${CURRENT_REP.initials} outcomes`} />

      {callsError && (
        <p className="flex-none border-b border-toolbar-line bg-[#FFF8E6] px-2.5 py-1.5 text-[11px] text-warning-text">
          Call history unavailable, so every site shows as pending: {callsError}
        </p>
      )}

      <CallsTable
        sites={visibleSites}
        sort={sort}
        onSortChange={(key) => setSort((current) => nextSortState(current, key))}
        onRowClick={dispatchAssetSelected}
      />
    </div>
  )
}
