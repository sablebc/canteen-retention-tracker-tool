/**
 * Marker categories and rep filtering for the site map: who owns the site
 * crossed with whether it has been called through this tool.
 */
import { MY_REP_INITIALS, getRepInitials } from '../../lib/sites'

/**
 * Categories in legend order. Colors are hex rather than Tailwind classes
 * because marker elements and legend swatches share them via inline style.
 */
export const MAP_CATEGORIES = [
  { id: 'mine-uncalled', label: 'My sites — not yet called', color: '#f97316' },
  { id: 'mine-called', label: 'My sites — called', color: '#10b981' },
  { id: 'other-rep', label: "Other rep's sites", color: '#2563eb' },
  { id: 'unassigned', label: 'Unassigned sites', color: '#9ca3af' },
]

export const CATEGORY_COLORS = Object.fromEntries(
  MAP_CATEGORIES.map(({ id, color }) => [id, color]),
)

/**
 * Classify a site for the map.
 *
 * "Called" uses the same rule as My Calls: at least one call record with
 * source "app". Imported tracker rows don't count.
 */
export function categorizeSite(site, appCalledSiteIds) {
  const rep = getRepInitials(site)
  if (rep === MY_REP_INITIALS) {
    return appCalledSiteIds.has(site.id) ? 'mine-called' : 'mine-uncalled'
  }
  return rep ? 'other-rep' : 'unassigned'
}

/** Sentinel value for the rep dropdown's "Unassigned" choice. */
export const REP_FILTER_UNASSIGNED = 'unassigned'

/** Rep dropdown choices; '' means every site. Defaults to my own list. */
export const REP_FILTER_OPTIONS = [
  { value: '', label: 'All sites' },
  { value: MY_REP_INITIALS, label: `My sites (${MY_REP_INITIALS})` },
  { value: 'AJ', label: 'AJ' },
  { value: 'CM', label: 'CM' },
  { value: 'WH', label: 'WH' },
  { value: REP_FILTER_UNASSIGNED, label: 'Unassigned' },
]

export const DEFAULT_REP_FILTER = MY_REP_INITIALS

/** True when a site passes the rep dropdown's current selection. */
export function matchesRepFilter(site, repFilter) {
  if (repFilter === '') return true
  const rep = getRepInitials(site)
  if (repFilter === REP_FILTER_UNASSIGNED) return rep === null
  return rep === repFilter
}
