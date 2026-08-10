import { statusClasses } from './columns'
import { ASC } from './sorting'

/** Sort direction indicator; renders a stable-width caret so headers don't jump. */
function SortCaret({ active, direction }) {
  if (!active) return <span className="text-gray-300">↕</span>
  return <span className="text-gray-700">{direction === ASC ? '↑' : '↓'}</span>
}

/**
 * The presentational site table: headers, sorting affordances, and rows.
 *
 * Owns no data of its own so the grid and the assignments views can render the
 * same table over different column sets and row sources.
 */
export default function SiteTable({ sites, columns, sort, onSortChange, onRowClick }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-100 shadow-[inset_0_-1px_0_0_rgb(209_213_219)]">
            {columns.map((column) => {
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
                    onClick={() => onSortChange(column.key)}
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
          {sites.map((site) => (
            <tr
              key={site.id}
              tabIndex={0}
              onClick={() => onRowClick(site)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onRowClick(site)
                }
              }}
              className="cursor-pointer odd:bg-white even:bg-gray-50 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  title={column.title ? column.title(site) : undefined}
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

      {sites.length === 0 && (
        <p className="px-3 py-6 text-center text-sm text-gray-500">
          No sites match the current filters.
        </p>
      )}
    </div>
  )
}
