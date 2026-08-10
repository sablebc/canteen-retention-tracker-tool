import { MAP_CATEGORIES, REP_FILTER_OPTIONS } from './mapCategories'

/**
 * Corner control panel for the map: a rep dropdown, the color legend (each
 * row doubles as a show/hide toggle for that category), and the count of
 * markers currently shown.
 */
export default function MapLegend({
  repFilter,
  onRepFilterChange,
  visibleCategories,
  onToggle,
  shownCount,
  totalCount,
}) {
  return (
    <div className="absolute bottom-3 left-3 w-52 rounded-md border border-gray-200 bg-white/95 px-3 py-2 shadow-md">
      <label className="mb-2 block">
        <span className="sr-only">Filter sites by rep</span>
        <select
          value={repFilter}
          onChange={(event) => onRepFilterChange(event.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {REP_FILTER_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Legend
      </p>
      {MAP_CATEGORIES.map(({ id, label, color }) => (
        <label
          key={id}
          className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-gray-700"
        >
          <input
            type="checkbox"
            checked={visibleCategories.has(id)}
            onChange={() => onToggle(id)}
            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: color }}
          />
          {label}
        </label>
      ))}

      <p className="mt-1.5 border-t border-gray-100 pt-1.5 text-xs text-gray-500 tabular-nums">
        {shownCount} of {totalCount} sites shown
      </p>
    </div>
  )
}
