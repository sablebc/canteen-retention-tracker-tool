import { useCallback, useMemo, useRef, useState } from 'react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

import { patchSite } from '../../api/client'
import { useCalls } from '../../hooks/useCalls'
import { useRevenueRisk } from '../../hooks/useRevenueRisk'
import { useSites } from '../../hooks/useSites'
import { splitCityProvince } from '../../lib/address'
import {
  CURRENT_REP,
  dispatchAssetSelected,
  dispatchSiteUpdated,
  formatIsoDate,
  getLastSyncDate,
  getLatestAnnualRevenue,
  getLatestF25Revenue,
  getRepInitials,
} from '../../lib/sites'
import { FONT_STACK, HEADER_HEIGHT, ROW_HEIGHT, TOKENS } from '../../lib/tokens'
import { COLUMN_COUNT, PINNED_COUNT, SITE_COLUMN_DEFS } from './agGridColumns'
import GridToolbar from './GridToolbar'

ModuleRegistry.registerModules([AllCommunityModule])

/**
 * The handoff's table treatment expressed as AG Grid theming parameters:
 * teal 30px header with hairline dividers, 26px alternating body rows, and
 * square corners throughout.
 */
const GRID_THEME = themeQuartz.withParams({
  fontFamily: FONT_STACK,
  fontSize: 12,
  foregroundColor: TOKENS.body,
  backgroundColor: TOKENS.white,
  oddRowBackgroundColor: TOKENS.surface,
  borderColor: TOKENS.lineLight,
  borderRadius: 0,
  wrapperBorderRadius: 0,
  wrapperBorder: false,
  cellHorizontalPadding: 6,

  headerBackgroundColor: TOKENS.tealHeader,
  headerTextColor: TOKENS.white,
  headerFontSize: 11,
  headerFontWeight: 600,
  headerColumnBorder: { style: 'solid', width: 1, color: TOKENS.tealHairline },
  headerColumnBorderHeight: '100%',

  rowBorder: { style: 'solid', width: 1, color: TOKENS.rowDivider },
  columnBorder: { style: 'solid', width: 1, color: TOKENS.lineLight },
  // The design fixes the row backgrounds; a hover tint would fight the
  // alternating pattern, so the editable-cell outline is the only hover cue.
  rowHoverColor: 'transparent',
  selectedRowBackgroundColor: 'transparent',
  accentColor: TOKENS.accent,
})

/** The 8×8 funnel from the handoff, used for every column's filter button. */
const FUNNEL_ICON =
  '<svg viewBox="0 0 10 10" style="width:8px;height:8px;fill:#9FB4BF">' +
  '<path d="M0 1h10L6 5.2V10L4 8.4V5.2z"></path></svg>'

const GRID_ICONS = {
  menu: FUNNEL_ICON,
  menuAlt: FUNNEL_ICON,
  filter: FUNNEL_ICON,
  filterActive: FUNNEL_ICON,
}

/**
 * Flatten a site plus its call and risk data into one row object.
 *
 * Pre-computing here keeps the column definitions free of value getters,
 * which matters at 905 rows: AG Grid would otherwise re-run the address
 * parser and revenue reducer on every sort, filter, and scroll.
 */
function toGridRow(site, { latestCall, callCount, revenueRisk }) {
  const { city, province } = splitCityProvince(site.address)

  return {
    ...site,
    rep_initials: getRepInitials(site) ?? '',
    city,
    province,
    f25_revenue: getLatestF25Revenue(site),
    annual_revenue: getLatestAnnualRevenue(site),
    revenue_risk: revenueRisk ?? null,
    call_count: callCount,
    last_call_date: latestCall?.call_date ?? null,
    latest_rating: latestCall?.rating ?? null,
    latest_actions: latestCall?.actions_required ?? '',
  }
}

/**
 * Grid view — every tracked site as a Smartsheet-density spreadsheet.
 *
 * Sorting, multi-column sort, filtering, resizing, and reordering come from
 * AG Grid. The four rep-owned fields edit inline on a single click and PATCH
 * on change; clicking any other cell opens the shared detail panel.
 */
export default function SiteGrid() {
  const gridRef = useRef(null)

  const { sites, isLoading: isLoadingSites, loadError } = useSites()
  const { calls, isLoading: isLoadingCalls, loadError: callsError } = useCalls()
  const { riskBySite } = useRevenueRisk()

  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [density, setDensity] = useState('compact')
  const [saveError, setSaveError] = useState(null)
  const [displayedCount, setDisplayedCount] = useState(null)

  // Calls arrive newest first, so the first record seen per site is the most
  // recent one; the same pass counts the records per site.
  const { latestCallBySite, callCountBySite } = useMemo(() => {
    const latest = new Map()
    const counts = new Map()
    calls.forEach((call) => {
      if (!latest.has(call.site)) latest.set(call.site, call)
      counts.set(call.site, (counts.get(call.site) ?? 0) + 1)
    })
    return { latestCallBySite: latest, callCountBySite: counts }
  }, [calls])

  const rowData = useMemo(
    () =>
      sites.map((site) =>
        toGridRow(site, {
          latestCall: latestCallBySite.get(site.id) ?? null,
          callCount: callCountBySite.get(site.id) ?? 0,
          revenueRisk: riskBySite.get(site.id) ?? null,
        }),
      ),
    [sites, latestCallBySite, callCountBySite, riskBySite],
  )

  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      filter: 'agTextColumnFilter',
      floatingFilter: showFilters,
      minWidth: 44,
      suppressHeaderMenuButton: false,
    }),
    [showFilters],
  )

  const handleCellValueChanged = useCallback(async (event) => {
    const { colDef, oldValue, newValue, data, node } = event
    if (newValue === oldValue) return

    try {
      // A cleared cell arrives as null; the API stores blanks as ''.
      const updated = await patchSite(data.id, { [colDef.field]: newValue ?? '' })
      setSaveError(null)
      dispatchSiteUpdated(updated)
    } catch (error) {
      setSaveError(`Could not save ${colDef.headerName}: ${error.message}`)
      // Put the pre-edit value back so the grid never shows an unsaved edit.
      node.setData({ ...data, [colDef.field]: oldValue })
    }
  }, [])

  const handleCellClicked = useCallback((event) => {
    // Editable cells begin editing on this click; everything else opens the
    // detail panel for the row.
    if (event.colDef.editable) return
    dispatchAssetSelected(event.data)
  }, [])

  const exportCsv = useCallback(() => {
    gridRef.current?.api.exportDataAsCsv({ fileName: 'canteen-sites.csv' })
  }, [])

  if (isLoadingSites || isLoadingCalls) {
    return (
      <div className="flex h-full items-center justify-center text-muted">
        Loading sites…
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

  const shownCount = displayedCount ?? sites.length
  const assignedCount = sites.filter(
    (site) => getRepInitials(site) === CURRENT_REP.initials,
  ).length
  const lastSync = getLastSyncDate(sites)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <GridToolbar
        rowCount={shownCount}
        columnCount={COLUMN_COUNT}
        pinnedCount={PINNED_COUNT}
        search={search}
        onSearchChange={setSearch}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters((current) => !current)}
        density={density}
        onDensityChange={setDensity}
        onExport={exportCsv}
      />

      {callsError && (
        <p className="flex-none border-b border-toolbar-line bg-[#FFF8E6] px-2.5 py-1.5 text-[11px] text-warning-text">
          Call history unavailable, so the call columns are empty: {callsError}
        </p>
      )}

      {saveError && (
        <p className="flex-none border-b border-toolbar-line bg-[#FDECEC] px-2.5 py-1.5 text-[11px] text-[#8A1616]">
          {saveError}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <AgGridReact
          ref={gridRef}
          theme={GRID_THEME}
          icons={GRID_ICONS}
          rowData={rowData}
          columnDefs={SITE_COLUMN_DEFS}
          defaultColDef={defaultColDef}
          getRowId={(params) => String(params.data.id)}
          rowHeight={ROW_HEIGHT[density]}
          headerHeight={HEADER_HEIGHT}
          quickFilterText={search}
          singleClickEdit
          stopEditingWhenCellsLoseFocus
          onCellValueChanged={handleCellValueChanged}
          onCellClicked={handleCellClicked}
          onModelUpdated={(event) =>
            setDisplayedCount(event.api.getDisplayedRowCount())
          }
        />
      </div>

      <div className="flex h-6 flex-none items-center gap-3.5 border-t border-toolbar-line bg-surface px-2.5 text-[11px] text-muted">
        <span className="tabular-nums">{sites.length} sites</span>
        <span className="tabular-nums">
          {assignedCount} assigned to {CURRENT_REP.initials}
        </span>
        <span className="ml-auto tabular-nums">
          {lastSync ? `Last sync ${formatIsoDate(lastSync)}` : 'Not yet synced'}
        </span>
      </div>
    </div>
  )
}
