import { OUTCOME_COLORS } from '../../lib/outcomes'
import { ASC } from '../Grid/sorting'
import { CALL_COLUMNS, MIN_TABLE_WIDTH, cellStyle } from './callColumns'

// Matches the funnel icons on the Grid's own header, and clears 4.5:1 against
// the teal behind it; the previous #7E97A5 sat just under it.
const INACTIVE_CARET = 'text-[#9FB4BF]'

function SortCaret({ active, direction }) {
  if (!active) return <span className={`ml-auto ${INACTIVE_CARET}`}>↕</span>
  return <span className="ml-auto">{direction === ASC ? '↑' : '↓'}</span>
}

/**
 * The My Calls table: a teal sticky header over compact alternating rows.
 *
 * A row's background follows its call outcome where one is set, falling back
 * to the alternating white/grey pattern when the site is unclassified.
 */
export default function CallsTable({ sites, sort, onSortChange, onRowClick }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div style={{ minWidth: `${MIN_TABLE_WIDTH}px` }}>
        <div className="sticky top-0 z-20 flex bg-teal-header text-[11px] font-semibold text-white">
          {CALL_COLUMNS.map((column) => (
            <button
              key={column.key}
              type="button"
              onClick={() => onSortChange(column.key)}
              style={cellStyle(column)}
              className={`flex h-[30px] items-center gap-1.5 border-r border-teal-hairline px-2 last:border-r-0 hover:bg-teal-deep ${
                column.align === 'right' ? 'justify-end' : ''
              }`}
            >
              <span className="truncate">{column.label}</span>
              <SortCaret
                active={sort.key === column.key}
                direction={sort.direction}
              />
            </button>
          ))}
        </div>

        {sites.map((site, index) => {
          const outcomeColor = OUTCOME_COLORS[site.call_outcome]
          const background = outcomeColor ?? (index % 2 === 1 ? '#F8F9FA' : '#FFFFFF')

          return (
            <div
              key={site.id}
              role="button"
              tabIndex={0}
              onClick={() => onRowClick(site)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onRowClick(site)
                }
              }}
              style={{ background }}
              className="flex cursor-pointer border-b border-row-divider focus:outline focus:outline-1 focus:outline-accent"
            >
              {CALL_COLUMNS.map((column) => (
                <div
                  key={column.key}
                  style={cellStyle(column)}
                  className={`flex h-[26px] items-center overflow-hidden whitespace-nowrap px-2 ${
                    column.align === 'right' ? 'justify-end' : ''
                  } ${column.numeric ? 'tabular-nums' : ''} ${
                    column.bold ? 'font-medium' : ''
                  } ${column.muted ? 'text-muted' : ''} ${
                    column.stateColor
                      ? site.call_state === 'Called'
                        ? 'text-success-text'
                        : 'text-warning-text'
                      : ''
                  }`}
                >
                  <span className="truncate">{column.format(site)}</span>
                </div>
              ))}
            </div>
          )
        })}

        {sites.length === 0 && (
          <p className="px-3 py-6 text-center text-muted">
            No sites match the current filters.
          </p>
        )}
      </div>
    </div>
  )
}
