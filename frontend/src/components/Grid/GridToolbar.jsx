/**
 * The 34px toolbar above the grid: what the view is showing on the left,
 * search and the grid actions on the right.
 */

const BUTTON_CLASSES =
  'h-[22px] border border-line bg-white px-[9px] text-[11px] hover:bg-surface'

const DENSITIES = [
  { id: 'compact', label: 'Compact' },
  { id: 'comfortable', label: 'Comfortable' },
]

export default function GridToolbar({
  rowCount,
  columnCount,
  pinnedCount,
  search,
  onSearchChange,
  showFilters,
  onToggleFilters,
  density,
  onDensityChange,
  onExport,
}) {
  return (
    <div className="flex h-[34px] flex-none items-center gap-2 border-b border-toolbar-line bg-surface px-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        All Sites
      </span>
      <span className="text-toolbar-line">|</span>
      <span className="whitespace-nowrap text-[11px] text-muted tabular-nums">
        {rowCount} rows · {columnCount} columns · {pinnedCount} pinned
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <div className="flex items-center border border-line bg-white">
          {DENSITIES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => onDensityChange(id)}
              aria-pressed={density === id}
              className={`h-[20px] px-[7px] text-[11px] ${
                density === id
                  ? 'bg-teal-header font-semibold text-white'
                  : 'text-muted hover:bg-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search sites"
          aria-label="Search sites"
          className="h-[22px] w-[180px] border border-line bg-white px-[7px] text-[11px] focus:border-accent focus:outline focus:outline-1 focus:outline-accent"
        />

        <button
          type="button"
          onClick={onToggleFilters}
          aria-pressed={showFilters}
          className={
            showFilters
              ? 'h-[22px] border border-accent-hover bg-accent px-[9px] text-[11px] font-semibold text-teal-deep'
              : BUTTON_CLASSES
          }
        >
          Filters
        </button>

        <button
          type="button"
          onClick={onExport}
          className="h-[22px] border border-teal-header bg-teal-header px-[9px] text-[11px] text-white hover:bg-teal-deep"
        >
          Export
        </button>
      </div>
    </div>
  )
}
