import { useCallback, useMemo, useState } from 'react'
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community'
import { AgGridReact } from 'ag-grid-react'

import { patchSite } from '../../api/client'
import { useCalls } from '../../hooks/useCalls'
import { useSites } from '../../hooks/useSites'
import {
  dispatchAssetSelected,
  dispatchSiteUpdated,
  getLatestCallBySite,
} from '../../lib/sites'
import { SITE_COLUMN_DEFS } from './agGridColumns'

ModuleRegistry.registerModules([AllCommunityModule])

/** Smartsheet-ish look: compact rows, grey header, alternating row colors. */
const GRID_THEME = themeQuartz.withParams({
  accentColor: '#2563eb',
  borderColor: '#e5e7eb',
  headerBackgroundColor: '#f3f4f6',
  headerFontWeight: 600,
  oddRowBackgroundColor: '#f9fafb',
  fontSize: 13,
  cellHorizontalPadding: 10,
})

const ROW_HEIGHT = 30
const HEADER_HEIGHT = 34

const DEFAULT_COL_DEF = {
  sortable: true,
  resizable: true,
  filter: 'agTextColumnFilter',
  minWidth: 60,
}

/**
 * Spreadsheet view of every tracked site, built on AG Grid Community.
 *
 * Sorting (shift-click for multi-column), text filtering, resizing, and
 * reordering come from the grid itself. The four rep-owned fields are
 * editable inline and save via PATCH on cell value change; the call columns
 * show the site's most recent call and stay read-only — call logging happens
 * through the detail panel. Clicking any non-editable cell dispatches the
 * shared `assetSelected` event, which opens that panel.
 */
export default function SiteGrid() {
  const { sites, isLoading: isLoadingSites, loadError } = useSites()
  const { calls, isLoading: isLoadingCalls, loadError: callsError } = useCalls()
  const [saveError, setSaveError] = useState(null)
  // Row count after the grid's own column filters; null until first render.
  const [displayedCount, setDisplayedCount] = useState(null)

  const latestCallBySite = useMemo(() => getLatestCallBySite(calls), [calls])

  const rowData = useMemo(
    () =>
      sites.map((site) => ({
        ...site,
        latestCall: latestCallBySite.get(site.id) ?? null,
      })),
    [sites, latestCallBySite],
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
    // Clicks on editable cells are for editing, not for opening the panel.
    if (event.colDef.editable) return
    const { latestCall: _latestCall, ...site } = event.data
    dispatchAssetSelected(site)
  }, [])

  if (isLoadingSites || isLoadingCalls) {
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

  const shownCount = displayedCount ?? sites.length

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-end border-b border-gray-200 bg-white px-3 py-1.5">
        <span className="text-sm text-gray-500 tabular-nums">
          {shownCount === sites.length
            ? `${sites.length} sites`
            : `${shownCount} of ${sites.length} sites`}
        </span>
      </div>

      {callsError && (
        <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Call history unavailable, so the call columns are empty: {callsError}
        </p>
      )}

      {saveError && (
        <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {saveError}
        </p>
      )}

      <div className="min-h-0 flex-1">
        <AgGridReact
          theme={GRID_THEME}
          rowData={rowData}
          columnDefs={SITE_COLUMN_DEFS}
          defaultColDef={DEFAULT_COL_DEF}
          getRowId={(params) => String(params.data.id)}
          rowHeight={ROW_HEIGHT}
          headerHeight={HEADER_HEIGHT}
          onCellValueChanged={handleCellValueChanged}
          onCellClicked={handleCellClicked}
          onModelUpdated={(event) =>
            setDisplayedCount(event.api.getDisplayedRowCount())
          }
        />
      </div>
    </div>
  )
}
