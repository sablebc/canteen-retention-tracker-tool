/**
 * Column set for the My Calls table, at the handoff's widths.
 *
 * Each column owns how it sorts (`sortValue` + `type`, shared with the grid's
 * comparator) and how it renders (`format`), so the table body stays generic.
 * `flex` marks the one column that absorbs the remaining width.
 */
import { outcomeShortLabel } from '../../lib/outcomes'
import { formatCurrency, formatIsoDate, formatText } from '../../lib/sites'

/** Widest the table may shrink before it starts scrolling horizontally. */
export const MIN_TABLE_WIDTH = 1120

export const CALL_COLUMNS = [
  {
    key: 'site_id',
    label: '#',
    width: 60,
    type: 'text',
    numeric: true,
    sortValue: (site) => site.site_id,
    format: (site) => site.site_id,
  },
  {
    key: 'name',
    label: 'Site Name',
    width: 240,
    flex: true,
    type: 'text',
    bold: true,
    sortValue: (site) => site.name,
    format: (site) => site.name,
  },
  {
    key: 'branch',
    label: 'Branch',
    width: 130,
    type: 'text',
    sortValue: (site) => site.branch,
    format: (site) => formatText(site.branch),
  },
  {
    key: 'account_status',
    label: 'Account Status',
    width: 110,
    type: 'text',
    sortValue: (site) => site.account_status,
    format: (site) => formatText(site.account_status),
  },
  {
    key: 'call_outcome',
    label: 'Call Outcome',
    width: 140,
    type: 'text',
    sortValue: (site) => outcomeShortLabel(site.call_outcome),
    format: (site) => outcomeShortLabel(site.call_outcome) || '—',
  },
  {
    key: 'contact_name',
    label: 'Contact',
    width: 150,
    type: 'text',
    sortValue: (site) => site.contact_name,
    format: (site) => formatText(site.contact_name),
  },
  {
    key: 'phone_number',
    label: 'Phone',
    width: 120,
    type: 'text',
    numeric: true,
    sortValue: (site) => site.phone_number,
    format: (site) => formatText(site.phone_number),
  },
  {
    key: 'annual_revenue',
    label: 'Annual Rev.',
    width: 110,
    type: 'number',
    align: 'right',
    numeric: true,
    sortValue: (site) => site.annual_revenue,
    format: (site) => formatCurrency(site.annual_revenue),
  },
  {
    key: 'call_state',
    label: 'Status',
    width: 90,
    type: 'number',
    stateColor: true,
    sortValue: (site) => (site.call_state === 'Called' ? 1 : 0),
    format: (site) => (site.call_state === 'Called' ? '[Called]' : '[Pending]'),
  },
  {
    key: 'last_call_date',
    label: 'Last Call',
    width: 100,
    type: 'date',
    numeric: true,
    muted: true,
    sortValue: (site) => site.last_call_date,
    format: (site) =>
      site.last_call_date ? formatIsoDate(site.last_call_date) : '—',
  },
]

/** Flex sizing for one column, shared by the header and the body cells. */
export function cellStyle(column) {
  return column.flex
    ? { flex: `1 1 ${column.width}px`, minWidth: `${column.width}px` }
    : { flex: `0 0 ${column.width}px`, width: `${column.width}px` }
}
