import { useEffect } from 'react'

/** Counters worth showing, in the order the ingest performs them. */
const SUMMARY_ROWS = [
  { key: 'sites_created', label: 'Sites created' },
  { key: 'sites_updated', label: 'Sites updated' },
  { key: 'reps_created', label: 'Rep assignments created' },
  { key: 'reps_updated', label: 'Rep assignments updated' },
  { key: 'calls_created', label: 'Imported calls created' },
  { key: 'calls_updated', label: 'Imported calls updated' },
  { key: 'revenue_created', label: 'Revenue snapshots created' },
  { key: 'revenue_updated', label: 'Revenue snapshots updated' },
  { key: 'rows_scanned', label: 'Rows scanned' },
]

/** Turn a warning bucket key into the wording the CLI report uses. */
const WARNING_LABELS = {
  unparseable_dates: 'Unparseable dates (left blank)',
  ambiguous_dates: 'Ambiguous dates (read day-first)',
  bad_ratings: 'Ratings outside 1-5 (left blank)',
  unparseable_durations: 'Unparseable call durations',
  duplicate_site_ids: "Duplicate '#' site IDs (last row wins)",
  synthetic_collisions: 'Identical name+address rows (merged)',
  invalid_rep_values: 'RS values not recognised as rep initials',
  rejected_native_ids: "'#' placeholders ignored",
}

function SummaryTable({ summary }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
      {SUMMARY_ROWS.filter(({ key }) => summary[key] !== undefined).map(
        ({ key, label }) => (
          <div key={key} className="flex items-baseline justify-between gap-3">
            <dt className="text-[11px] text-muted">{label}</dt>
            <dd className="text-[12px] font-semibold tabular-nums">
              {summary[key]}
            </dd>
          </div>
        ),
      )}
    </dl>
  )
}

function Warnings({ warnings }) {
  const buckets = Object.entries(warnings ?? {}).filter(
    ([, values]) => Array.isArray(values) && values.length > 0,
  )
  if (buckets.length === 0) return null

  return (
    <section className="mt-3">
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-teal-header">
        Warnings
      </h3>
      <ul className="space-y-1.5">
        {buckets.map(([key, values]) => (
          <li key={key} className="border border-line-light bg-surface px-2 py-1.5">
            <p className="text-[11px] font-semibold text-warning-text">
              {WARNING_LABELS[key] ?? key} ({values.length})
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {values.slice(0, 3).map((value) => (
                <li key={value} className="truncate text-[11px] text-muted">
                  {value}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Result of a tracker import: the headline sentence, the per-model counters,
 * and any data-quality warnings the ingest raised.
 */
export default function ImportSummaryModal({ summary, error, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(16,36,48,0.18)] p-4">
      <button
        type="button"
        aria-label="Close import summary"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import summary"
        className="relative flex max-h-full w-[460px] max-w-full flex-col border border-line bg-white shadow-[0_1px_2px_rgba(16,36,48,0.14)]"
      >
        <header className="flex flex-none items-start gap-2.5 bg-teal-header px-3 py-2.5 text-white">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold">
              {error ? 'Import failed' : 'Import complete'}
            </h2>
            {summary?.filename && (
              <p className="mt-0.5 truncate text-[11px] text-panel-meta">
                {summary.filename}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto h-[22px] w-[22px] flex-none border border-close-border text-white"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
          {error ? (
            <p className="border border-line-light bg-surface px-2.5 py-2 text-[12px] text-warning-text">
              {error}
            </p>
          ) : (
            <>
              <p className="mb-3 border-l-[3px] border-accent border-y border-r border-y-line-light border-r-line-light bg-surface px-2.5 py-2 text-[12px]">
                {summary.message}
              </p>
              <SummaryTable summary={summary} />
              <Warnings warnings={summary.warnings} />
            </>
          )}
        </div>

        <footer className="flex flex-none justify-end border-t border-toolbar-line px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="h-[26px] border border-accent-hover bg-accent px-4 text-[12px] font-bold text-teal-deep hover:bg-accent-hover"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  )
}
