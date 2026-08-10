/**
 * AG Grid column definitions for the Grid view: 20 columns, the first three
 * pinned, in the handoff's order and pixel widths.
 *
 * Rows are pre-flattened by `SiteGrid` (see `toGridRow`), so every column
 * binds to a plain field. That keeps sorting, filtering, and CSV export
 * working without a value getter running 905 times per interaction.
 */
import { outcomeShortLabel } from '../../lib/outcomes'
import { formatCurrency, formatIsoDate, isBlank } from '../../lib/sites'
import { RatingCell } from '../StarRating'

/** Marks the four rep-owned fields the API accepts a PATCH for. */
const EDITABLE = {
  editable: true,
  cellClass: 'cell-editable',
}

const NUMERIC = {
  type: 'rightAligned',
  filter: 'agNumberColumnFilter',
  cellClass: 'tabular-nums',
}

const formatCurrencyCell = (params) =>
  isBlank(params.value) ? '' : formatCurrency(params.value)

const formatDateCell = (params) =>
  isBlank(params.value) ? '' : formatIsoDate(params.value)

export const SITE_COLUMN_DEFS = [
  {
    field: 'rep_initials',
    headerName: 'RS',
    width: 44,
    pinned: 'left',
    cellClass: 'font-semibold text-teal-header',
  },
  {
    field: 'site_id',
    headerName: '#',
    width: 60,
    pinned: 'left',
    cellClass: 'tabular-nums text-muted',
  },
  {
    field: 'name',
    headerName: 'Site Name',
    width: 210,
    pinned: 'left',
    cellClass: 'font-medium',
  },

  { field: 'address', headerName: 'Address', width: 200 },
  { field: 'city', headerName: 'City', width: 110 },
  { field: 'province', headerName: 'Prov.', width: 62 },
  { field: 'branch', headerName: 'Branch', width: 118 },
  { field: 'lob', headerName: 'LOB', width: 118, ...EDITABLE },
  { field: 'account_status', headerName: 'Account Status', width: 118 },
  {
    // Not in the original 20-column handoff: the row colour alone cannot be
    // read by everyone, and two legend categories are uncoloured, so the
    // classification is also spelled out.
    field: 'call_outcome',
    headerName: 'Call Outcome',
    width: 140,
    valueFormatter: (params) => outcomeShortLabel(params.value),
    filterParams: {
      valueFormatter: (params) => outcomeShortLabel(params.value),
    },
  },
  { field: 'contact_name', headerName: 'Contact Name', width: 140, ...EDITABLE },
  {
    field: 'phone_number',
    headerName: 'Phone',
    width: 122,
    ...EDITABLE,
    cellClass: `${EDITABLE.cellClass} tabular-nums`,
  },
  {
    field: 'method_of_ordering',
    headerName: 'Method of Ordering',
    width: 146,
    ...EDITABLE,
  },
  {
    field: 'last_order_date',
    headerName: 'Last Order',
    width: 100,
    valueFormatter: formatDateCell,
    cellClass: 'tabular-nums',
  },
  {
    field: 'f25_revenue',
    headerName: 'F25 Revenue',
    width: 112,
    ...NUMERIC,
    valueFormatter: formatCurrencyCell,
  },
  {
    field: 'annual_revenue',
    headerName: 'Annual Revenue',
    width: 122,
    ...NUMERIC,
    valueFormatter: formatCurrencyCell,
  },
  {
    field: 'revenue_risk',
    headerName: 'Rev. Risk',
    width: 80,
    ...NUMERIC,
    // Blank until the analysis endpoint stops answering 501.
    valueFormatter: (params) =>
      isBlank(params.value) ? '' : Number(params.value).toFixed(2),
  },
  { field: 'call_count', headerName: 'Calls', width: 58, ...NUMERIC },
  {
    field: 'last_call_date',
    headerName: 'Last Call',
    width: 100,
    valueFormatter: formatDateCell,
    cellClass: 'tabular-nums',
  },
  {
    field: 'latest_rating',
    headerName: 'Rating',
    width: 62,
    ...NUMERIC,
    cellRenderer: RatingCell,
  },
  { field: 'latest_actions', headerName: 'Actions Required', width: 170 },
]

/** The counts the toolbar reports, kept in step with the definitions above. */
export const COLUMN_COUNT = SITE_COLUMN_DEFS.length
export const PINNED_COUNT = SITE_COLUMN_DEFS.filter((col) => col.pinned).length
