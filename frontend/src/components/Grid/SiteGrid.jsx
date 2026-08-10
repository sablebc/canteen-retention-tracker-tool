import { useMemo, useState } from 'react'

import { useSites } from '../../hooks/useSites'
import { dispatchAssetSelected } from '../../lib/sites'
import GridFilters from './GridFilters'
import SiteTable from './SiteTable'
import { COLUMNS, UNASSIGNED } from './columns'
import { ASC, nextSortState, sortSites } from './sorting'

/** Reps are listed in a fixed order so the dropdown does not reshuffle. */
const REP_ORDER = ['AJ', 'BC', 'CM', 'WH']

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

/**
 * Sortable, filterable spreadsheet view of every tracked site.
 *
 * Clicking a row dispatches the same window-level `assetSelected` event the map
 * markers use, which opens the shared site detail panel.
 */
export default function SiteGrid() {
  const { sites, isLoading, loadError } = useSites()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [rep, setRep] = useState('')
  const [sort, setSort] = useState({ key: 'name', direction: ASC })

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
    return sortSites(filtered, COLUMNS, sort)
  }, [sites, search, status, rep, sort])

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

      <SiteTable
        sites={visibleSites}
        columns={COLUMNS}
        sort={sort}
        onSortChange={(key) => setSort((current) => nextSortState(current, key))}
        onRowClick={dispatchAssetSelected}
      />
    </div>
  )
}
