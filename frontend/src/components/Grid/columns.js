/**
 * Column definitions for the site grid.
 *
 * Each column owns both how it sorts (`sortValue`, `type`) and how it renders
 * (`format`), so adding a column does not mean touching the table body.
 */
import {
  formatCurrency,
  formatIsoDate,
  formatText,
  getLatestAnnualRevenue,
  getRepInitials,
} from '../../lib/sites'

/** The special value used by the rep filter for sites with no assignment. */
export const UNASSIGNED = 'Unassigned'

export const COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    type: 'text',
    sortValue: (site) => site.name,
    format: (site) => formatText(site.name),
    cellClassName: 'font-medium text-gray-900',
  },
  {
    key: 'address',
    label: 'Address',
    type: 'text',
    sortValue: (site) => site.address,
    format: (site) => formatText(site.address),
    // Addresses are long and a few carry two locations in one cell; truncate
    // and expose the full text as a tooltip rather than blowing out the row.
    cellClassName: 'max-w-[20rem] truncate',
    title: (site) => site.address,
  },
  {
    key: 'branch',
    label: 'Branch',
    type: 'text',
    sortValue: (site) => site.branch,
    format: (site) => formatText(site.branch),
  },
  {
    key: 'lob',
    label: 'LOB',
    type: 'text',
    sortValue: (site) => site.lob,
    format: (site) => formatText(site.lob),
  },
  {
    key: 'account_status',
    label: 'Account Status',
    type: 'text',
    sortValue: (site) => site.account_status,
    // Rendered as a badge by the table body rather than as plain text.
    isStatus: true,
  },
  {
    key: 'last_order_date',
    label: 'Last Order',
    type: 'date',
    sortValue: (site) => site.last_order_date,
    format: (site) => formatIsoDate(site.last_order_date),
    cellClassName: 'tabular-nums',
  },
  {
    key: 'rep',
    label: 'Rep',
    type: 'text',
    sortValue: getRepInitials,
    format: (site) => formatText(getRepInitials(site)),
  },
  {
    key: 'annual_revenue',
    label: 'Annual Revenue',
    type: 'number',
    align: 'right',
    sortValue: getLatestAnnualRevenue,
    format: (site) => formatCurrency(getLatestAnnualRevenue(site)),
    cellClassName: 'tabular-nums',
  },
  {
    key: 'phone_number',
    label: 'Phone Number',
    type: 'text',
    sortValue: (site) => site.phone_number,
    format: (site) => formatText(site.phone_number),
    cellClassName: 'tabular-nums',
  },
]

/** Tailwind classes per normalised account status, with a neutral fallback. */
const STATUS_STYLES = {
  Active: 'bg-emerald-100 text-emerald-800',
  Inactive: 'bg-rose-100 text-rose-800',
  Potential: 'bg-amber-100 text-amber-800',
  'Undeployed/Removed': 'bg-slate-200 text-slate-700',
  Unknown: 'bg-gray-100 text-gray-600',
}

export function statusClasses(status) {
  return STATUS_STYLES[status] ?? STATUS_STYLES.Unknown
}
