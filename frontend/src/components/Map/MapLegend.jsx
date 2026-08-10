import { MAP_CATEGORIES } from './mapCategories'

/**
 * Corner legend for the map's marker colors. Each row doubles as a toggle
 * that shows/hides that category of markers.
 */
export default function MapLegend({ visibleCategories, onToggle }) {
  return (
    <div className="absolute bottom-3 left-3 rounded-md border border-gray-200 bg-white/95 px-3 py-2 shadow-md">
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
            className="inline-block h-3 w-3 rounded-full border border-white shadow-sm"
            style={{ backgroundColor: color }}
          />
          {label}
        </label>
      ))}
    </div>
  )
}
