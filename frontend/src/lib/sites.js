/**
 * Shared helpers for reading the shape the sites API returns.
 *
 * The serializer nests `rep_assignment` (nullable one-to-one) and
 * `revenue_snapshots` (a list), so every consumer needs the same small set of
 * accessors to flatten a site into displayable values.
 */

/** Placeholder shown wherever a site has no value for a column. */
export const EM_DASH = '—'

/**
 * Every rep in the tracker, in the order the filters list them.
 *
 * These are the complete set the ingest finds in the export's RS column. Which
 * of them *you* are is a runtime choice rather than a constant — see
 * `useCurrentRep` — so one deployment can serve the whole team.
 */
export const REP_ORDER = ['BC', 'AJ', 'CM', 'WH']

/**
 * True for calls logged through this tool, as opposed to rows carried over
 * from the tracker import. Only app-sourced calls count as "called".
 */
export function isAppCall(call) {
  return call.source === 'app'
}

/** IDs of sites with at least one call logged through this tool. */
export function getAppCalledSiteIds(calls) {
  return new Set(calls.filter(isAppCall).map((call) => call.site))
}

/**
 * Map of site ID -> that site's most recent call record.
 *
 * Relies on the call list arriving newest first (the API's ordering, which
 * `useCalls` preserves), so the first record met per site wins.
 */
export function getLatestCallBySite(calls) {
  const latest = new Map()
  calls.forEach((call) => {
    if (!latest.has(call.site)) latest.set(call.site, call)
  })
  return latest
}

/** Broadcast a site selection so sibling panels can react without prop drilling. */
export function dispatchAssetSelected(site) {
  window.dispatchEvent(new CustomEvent('assetSelected', { detail: site }))
}

/** Fired after a site is saved, so open list views can refresh their copy. */
export const SITE_UPDATED_EVENT = 'siteUpdated'

/** Fired after a call is logged, so the assignments view can recount progress. */
export const CALL_LOGGED_EVENT = 'callLogged'

/**
 * Fired after a tracker import replaces the underlying data, so every view
 * refetches instead of showing figures from before the refresh.
 */
export const DATA_REFRESHED_EVENT = 'dataRefreshed'

export function dispatchDataRefreshed() {
  window.dispatchEvent(new CustomEvent(DATA_REFRESHED_EVENT))
}

export function dispatchSiteUpdated(site) {
  window.dispatchEvent(new CustomEvent(SITE_UPDATED_EVENT, { detail: site }))
}

export function dispatchCallLogged(call) {
  window.dispatchEvent(new CustomEvent(CALL_LOGGED_EVENT, { detail: call }))
}

/** DRF returns a bare array unless pagination is enabled; tolerate both shapes. */
export function toSiteArray(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.results)) return payload.results
  return []
}

/** True for values that should sort last and render as an em dash. */
export function isBlank(value) {
  return value === null || value === undefined || value === ''
}

/** Rep initials for a site, or null when no rep is assigned. */
export function getRepInitials(site) {
  return site.rep_assignment?.rep_initials ?? null
}

/**
 * Read one revenue figure from the most recent snapshot that records it.
 *
 * Snapshots arrive newest-first, but the order is re-derived here rather than
 * assumed so the value stays correct if the API's ordering ever changes.
 * Returns a Number, or null when no snapshot carries that figure.
 */
function getLatestRevenue(site, key) {
  const snapshots = site.revenue_snapshots
  if (!Array.isArray(snapshots) || snapshots.length === 0) return null

  const withRevenue = snapshots.filter((snapshot) => !isBlank(snapshot[key]))
  if (withRevenue.length === 0) return null

  const latest = withRevenue.reduce((newest, candidate) =>
    String(candidate.snapshot_date) > String(newest.snapshot_date) ? candidate : newest,
  )
  const amount = Number(latest[key])
  return Number.isFinite(amount) ? amount : null
}

/** Annual revenue from the most recent snapshot that records one. */
export function getLatestAnnualRevenue(site) {
  return getLatestRevenue(site, 'annual_revenue')
}

/** F25 revenue from the most recent snapshot that records one. */
export function getLatestF25Revenue(site) {
  return getLatestRevenue(site, 'f25_revenue')
}

/**
 * The most recent revenue-snapshot date across every site.
 *
 * Each ingest run writes one snapshot per site, so the newest snapshot date
 * is when the tracker was last imported — what the grid's status bar reports
 * as "Last sync". Returns null before any site has a snapshot.
 */
export function getLastSyncDate(sites) {
  let latest = null
  sites.forEach((site) => {
    const snapshots = site.revenue_snapshots
    if (!Array.isArray(snapshots)) return
    snapshots.forEach(({ snapshot_date: date }) => {
      if (!isBlank(date) && (latest === null || String(date) > latest)) {
        latest = String(date)
      }
    })
  })
  return latest
}

const CURRENCY_FORMAT = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
})

/** Format a number as whole Canadian dollars, or the em dash when blank. */
export function formatCurrency(value) {
  return isBlank(value) ? EM_DASH : CURRENCY_FORMAT.format(value)
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/**
 * Format an ISO `YYYY-MM-DD` date as `10 Aug 2026`.
 *
 * The string is split rather than passed to `new Date()`, which would read a
 * bare date as UTC midnight and render the previous day in western timezones.
 */
export function formatIsoDate(value) {
  if (isBlank(value)) return EM_DASH

  const [year, month, day] = String(value).split('-')
  const monthName = MONTH_NAMES[Number(month) - 1]
  if (!monthName || !year || !day) return String(value)

  return `${Number(day)} ${monthName} ${year}`
}

/** Render any plain cell value, substituting the em dash when blank. */
export function formatText(value) {
  return isBlank(value) ? EM_DASH : String(value)
}

/**
 * Whole calendar days between an ISO `YYYY-MM-DD` and today.
 *
 * Both dates are reduced to a UTC midnight before subtracting, so the answer
 * counts calendar days rather than elapsed hours: a straight millisecond
 * difference drifts by one across a daylight-saving boundary, which is exactly
 * where an "89 days" threshold would flip for no reason.
 *
 * Returns null when the date is blank or unparseable, and a negative number
 * for a date in the future.
 */
export function daysSince(value, today = new Date()) {
  if (isBlank(value)) return null

  const [year, month, day] = String(value).split('-').map(Number)
  if (!year || !month || !day) return null

  const then = Date.UTC(year, month - 1, day)
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((now - then) / 86_400_000)
}

/** The same figure as a phrase: "today", "1 day ago", "366 days ago". */
export function formatDaysSince(value, today = new Date()) {
  const days = daysSince(value, today)
  if (days === null) return EM_DASH
  if (days === 0) return 'today'

  const magnitude = Math.abs(days)
  const unit = magnitude === 1 ? 'day' : 'days'
  return days < 0 ? `in ${magnitude} ${unit}` : `${magnitude} ${unit} ago`
}
