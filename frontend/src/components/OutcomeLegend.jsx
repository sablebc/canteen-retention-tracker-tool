import { OUTCOMES, countOutcomes } from '../lib/outcomes'

/**
 * The tracker legend as a live summary strip: one swatch and count per call
 * outcome, then the unclassified remainder and the classified total.
 *
 * Counts derive from whichever site list is passed in, so the Grid reports
 * every site and My Calls reports only the current rep's.
 */
export default function OutcomeLegend({ sites, label = 'Outcomes' }) {
  const { counts, classified, unclassified } = countOutcomes(sites)

  return (
    <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 border-b border-toolbar-line bg-surface px-2.5 py-1.5 text-[11px] text-muted">
      <span className="font-semibold uppercase tracking-[0.06em]">{label}</span>

      {OUTCOMES.map(({ value, short, color }) => (
        <span key={value} className="flex items-center gap-1.5 whitespace-nowrap">
          <span
            aria-hidden="true"
            className="inline-block h-[10px] w-[10px] flex-none border border-line"
            style={{ backgroundColor: color }}
          />
          {short}: <span className="tabular-nums text-body">{counts[value]}</span>
        </span>
      ))}

      <span className="whitespace-nowrap">
        Unclassified: <span className="tabular-nums">{unclassified}</span>
      </span>

      <span className="ml-auto whitespace-nowrap font-semibold text-body">
        Total classified: <span className="tabular-nums">{classified}</span>
      </span>
    </div>
  )
}
