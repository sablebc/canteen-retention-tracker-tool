/** Sort helpers shared by the grid and the assignments views. */
// Extension included so this module also resolves under plain Node, which does
// not do Vite's extensionless lookup — it keeps the sort rules directly runnable.
import { isBlank } from '../../lib/sites.js'

export const ASC = 'asc'
export const DESC = 'desc'

/**
 * Compare two sites on one column, always sorting blanks to the bottom.
 *
 * Blanks are placed last in both directions on purpose: a descending sort that
 * leads with 400 empty cells hides the data the user asked to see.
 */
export function makeComparator(column, direction) {
  const sign = direction === ASC ? 1 : -1

  return (siteA, siteB) => {
    const a = column.sortValue(siteA)
    const b = column.sortValue(siteB)

    if (isBlank(a) && isBlank(b)) return 0
    if (isBlank(a)) return 1
    if (isBlank(b)) return -1

    if (column.type === 'number') return sign * (a - b)
    // ISO dates compare correctly as plain strings.
    if (column.type === 'date') return sign * String(a).localeCompare(String(b))
    return sign * String(a).localeCompare(String(b), 'en', { sensitivity: 'base' })
  }
}

/** Toggle direction when re-sorting the same column, else start ascending. */
export function nextSortState(current, key) {
  if (current.key !== key) return { key, direction: ASC }
  return { key, direction: current.direction === ASC ? DESC : ASC }
}

/** Sort a list of sites without mutating the input. */
export function sortSites(sites, columns, sort) {
  const column = columns.find((candidate) => candidate.key === sort.key)
  if (!column) return sites
  return [...sites].sort(makeComparator(column, sort.direction))
}
