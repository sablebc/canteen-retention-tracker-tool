import { useEffect, useMemo, useState } from 'react'

import { getSites } from '../../api/client'
import { dispatchAssetSelected, isBlank, toSiteArray } from '../../lib/sites'
import GridFilters from './GridFilters'
import { COLUMNS, UNASSIGNED, statusClasses } from './columns'

const ASC = 'asc'
const DESC = 'desc'

/** Reps are listed in a fixed order so the dropdown does not reshuffle. */
const REP_ORDER = ['AJ', 'BC', 'CM', 'WH']

/**
 * Compare two sites on one column, always sorting blanks to the bottom.
 *
 * Blanks are placed last in both directions on purpose: a descending sort that
 * leads with 400 empty cells hides the data the user asked to see.
 */
function makeComparator(column, direction) {
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

function matchesSearch(site, needle) {
  if (needle === '') return true
  const haystack = [site.name, site.branch, site.lob].filter(Boolean).join(' ')
  return haystack.toLowerCase().includes(needle)
}

function matchesRep(site, rep) {
  if (rep === '') return true
  const initials = site.rep_assignment?.rep_initials ?? null
  if (rep === UNASSIGNED) return initials === null
  return initials === rep
}

/** Sort direction indicator; renders a stable-width caret so headers don't jump. */
function SortCaret({ active, direction }) {
  if (!active) return <span className="text-gray-300">↕</span>
  return <span className="text-gray-700">{direction === ASC ? '↑' : '↓'}</span>
}

/**
 * Sortable, filterable spreadsheet view of every tracked site.
 *
 * Clicking a row dispatches the same window-level `assetSelected` event the map
 * markers use, so either view can drive a future detail panel.
 */
export default function SiteGrid() {
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [rep, setRep] = useState('')
  const [sort, setSort] = useState({ key: 'name', direction: ASC })

  useEffect(() => {
    let isCancelled = false

    const loadSites = async () => {
      try {
        const payload = await getSites()
        if (!isCancelled) setSites(toSiteArray(payload))
      } catch (error) {
        if (!isCancelled) setLoadError(error.message)
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    loadSites()
    return () => {
      isCancelled = true
    }
  }, [])

  // Options come from the data so a status the tracker starts using shows up
  // without a code change.
  const statusOptions = useMemo(() => {
    const present = new Set(sites.map((site) => site.account_status).filter(Boolean))
    return [...present].sort((a, b) => a.localeCompare(b))
  }, [sites])

  const repOptions = useMemo(() => {
    const present = new Set(
      sites.map((site) => site.rep_assignment?.rep_initials).filter(Boolean),
    )
    const known = REP_ORDER.filter((initials) => present.has(initials))
    const extra = [...present].filter((initials) => !REP_ORDER.includes(initials)).sort()
    return [...known, ...extra, UNASSIGNED]
  }, [sites])

  const visibleSites = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const filtered = sites.filter(
      (site) =>
        matchesSearch(site, needle) &&
        (status === '' || site.account_status === status) &&
        matchesRep(site, rep),
    )

    const column = COLUMNS.find((candidate) => candidate.key === sort.key)
    if (!column) return filtered
    return [...filtered].sort(makeComparator(column, sort.direction))
  }, [sites, search, status, rep, sort])

  const handleSort = (key) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === ASC ? DESC : ASC }
        : { key, direction: ASC },
    )
  }

  const resetFilters = () => {
    setSearch('')
    setStatus('')
    setRep('')
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        Loading sites…
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
      <GridFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        statusOptions={statusOptions}
        rep={rep}
        onRepChange={setRep}
        repOptions={repOptions}
        shownCount={visibleSites.length}
        totalCount={sites.length}
        onReset={resetFilters}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100 shadow-[inset_0_-1px_0_0_rgb(209_213_219)]">
              {COLUMNS.map((column) => {
                const isActive = sort.key === column.key
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      isActive
                        ? sort.direction === ASC
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    className={`px-3 py-2 font-semibold text-gray-700 ${
                      column.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className={`inline-flex w-full items-center gap-1 hover:text-blue-700 ${
                        column.align === 'right' ? 'justify-end' : ''
                      }`}
                    >
                      {column.label}
                      <SortCaret active={isActive} direction={sort.direction} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {visibleSites.map((site) => (
              <tr
                key={site.id}
                tabIndex={0}
                onClick={() => dispatchAssetSelected(site)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    dispatchAssetSelected(site)
                  }
                }}
                className="cursor-pointer odd:bg-white even:bg-gray-50 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
              >
                {COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    className={`whitespace-nowrap px-3 py-1.5 text-gray-600 ${
                      column.align === 'right' ? 'text-right' : ''
                    } ${column.cellClassName ?? ''}`}
                  >
                    {column.isStatus ? (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(
                          site.account_status,
                        )}`}
                      >
                        {site.account_status || 'Unknown'}
                      </span>
                    ) : (
                      column.format(site)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {visibleSites.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-gray-500">
            No sites match the current filters.
          </p>
        )}
      </div>
    </div>
  )
}
