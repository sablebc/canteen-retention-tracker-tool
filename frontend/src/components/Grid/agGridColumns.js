/**
 * AG Grid column definitions for the spreadsheet view, mirroring the source
 * Smartsheet's column order.
 *
 * Row data is a site record with a `latestCall` property (the site's most
 * recent CallRecord, or null). The four editable columns bind straight to
 * site fields so AG Grid's inline editing writes them back; the call columns
 * are read-only projections of the latest call.
 */
import {
  formatCurrency,
  formatIsoDate,
  getLatestAnnualRevenue,
  getLatestF25Revenue,
  getRepInitials,
  isBlank,
} from '../../lib/sites'

const formatCurrencyCell = (params) =>
  isBlank(params.value) ? '' : formatCurrency(params.value)

const formatDateCell = (params) =>
  isBlank(params.value) ? '' : formatIsoDate(params.value)

/** Column factory for the read-only projections of the latest call. */
function latestCallColumn(colId, headerName, callField, extra = {}) {
  return {
    colId,
    headerName,
    valueGetter: (params) => params.data.latestCall?.[callField] ?? null,
    ...extra,
  }
}

export const SITE_COLUMN_DEFS = [
  {
    field: 'rs',
    headerName: 'RS',
    valueGetter: (params) => getRepInitials(params.data),
    width: 70,
    pinned: 'left',
  },
  { field: 'site_id', headerName: '#', width: 90, pinned: 'left' },
  {
    field: 'name',
    headerName: 'Site Name',
    width: 220,
    pinned: 'left',
    cellClass: 'font-medium',
  },
  { field: 'address', headerName: 'Address', width: 260 },
  {
    field: 'method_of_ordering',
    headerName: 'Method of Ordering',
    width: 160,
    editable: true,
  },
  { field: 'contact_name', headerName: 'Contact Name', width: 150, editable: true },
  { field: 'branch', headerName: 'Branch', width: 120 },
  {
    colId: 'f25',
    headerName: 'f25',
    valueGetter: (params) => getLatestF25Revenue(params.data),
    valueFormatter: formatCurrencyCell,
    width: 110,
    type: 'rightAligned',
  },
  {
    colId: 'annual_revenue',
    headerName: 'Annual Revenue',
    valueGetter: (params) => getLatestAnnualRevenue(params.data),
    valueFormatter: formatCurrencyCell,
    width: 140,
    type: 'rightAligned',
  },
  { field: 'lob', headerName: 'LOB', width: 120, editable: true },
  { field: 'phone_number', headerName: 'Phone Number', width: 140, editable: true },
  { field: 'account_status', headerName: 'Account Status', width: 140 },
  {
    field: 'last_order_date',
    headerName: 'Last Order Date',
    valueFormatter: formatDateCell,
    width: 140,
  },
  latestCallColumn('q1', 'Q1', 'q1_last_order_feedback', { width: 180 }),
  latestCallColumn('q2', 'Q2', 'q2_working_well', { width: 180 }),
  latestCallColumn('rating', 'Rating', 'rating', {
    width: 90,
    valueFormatter: (params) => (isBlank(params.value) ? '' : `${params.value}/5`),
  }),
  latestCallColumn('q4', 'Q4', 'q4_could_improve', { width: 180 }),
  latestCallColumn('call_duration', 'Call Duration', 'duration_minutes', {
    width: 120,
    valueFormatter: (params) => (isBlank(params.value) ? '' : `${params.value} min`),
  }),
  latestCallColumn('notes', 'Notes', 'notes', { width: 240 }),
  latestCallColumn('actions_required', 'Actions Required', 'actions_required', {
    width: 200,
  }),
]
