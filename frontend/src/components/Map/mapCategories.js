/**
 * Marker categories for the site map: who owns the site crossed with whether
 * it has been called through this tool.
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
