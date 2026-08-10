/** Search box and dropdown filters sitting above the site grid. */
const SELECT_CLASSES =
  'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 ' +
  'shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function GridFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  statusOptions,
  rep,
  onRepChange,
  repOptions,
  shownCount,
  totalCount,
  onReset,
}) {
  const hasActiveFilters = search !== '' || status !== '' || rep !== ''

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-3 py-2.5">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search name, branch, or LOB…"
        aria-label="Search sites by name, branch, or line of business"
        className={`${SELECT_CLASSES} w-64 placeholder:text-gray-400`}
      />

      <label className="flex items-center gap-1.5 text-sm text-gray-600">
        <span className="sr-only">Filter by account status</span>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          className={SELECT_CLASSES}
        >
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-1.5 text-sm text-gray-600">
        <span className="sr-only">Filter by assigned rep</span>
        <select
          value={rep}
          onChange={(event) => onRepChange(event.target.value)}
          className={SELECT_CLASSES}
        >
          <option value="">All reps</option>
          {repOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-md px-2 py-1 text-sm text-blue-700 hover:bg-blue-50"
        >
          Clear filters
        </button>
      )}

      <span className="ml-auto text-sm text-gray-500 tabular-nums">
        {shownCount === totalCount
          ? `${totalCount} sites`
          : `${shownCount} of ${totalCount} sites`}
      </span>
    </div>
  )
}
