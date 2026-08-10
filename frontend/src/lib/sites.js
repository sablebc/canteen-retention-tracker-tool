/**
 * Shared helpers for reading the shape the sites API returns.
 *
 * The serializer nests `rep_assignment` (nullable one-to-one) and
 * `revenue_snapshots` (a list), so every consumer needs the same small set of
 * accessors to flatten a site into displayable values.
 */

/** Placeholder shown wherever a site has no value for a column. */
export const EM_DASH = '—'

/** Broadcast a site selection so sibling panels can react without prop drilling. */
export function dispatchAssetSelected(site) {
  window.dispatchEvent(new CustomEvent('assetSelected', { detail: site }))
}

/** Fired after a site is saved, so open list views can refresh their copy. */
export const SITE_UPDATED_EVENT = 'siteUpdated'

/** Fired after a call is logged, so the assignments view can recount progress. */
export const CALL_LOGGED_EVENT = 'callLogged'

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
