/**
 * The call-outcome legend from rows 2-9 of the tracker spreadsheet.
 *
 * `color` values were read out of the workbook's own legend fills rather than
 * eyeballed, so a coloured row here matches the same row in Smartsheet:
 *
 *   No assets/route dormant          FFCCD2
 *   Completed survey                 C6E7C8
 *   Missing/invalid contact details  FEFF85
 *   Follow up/Issue                  BDBDBD
 *   Awaiting email response          EBC7EF
 *   French accounts                  B9DDFC
 *   Left VM/call back                (no fill)
 *   Temp closed due to season        (no fill)
 *
 * The sheet leaves the last two uncoloured. "Left VM" stays white to match,
 * and "Temp closed" uses the light pink it was described with, so the two are
 * still tellable apart on the row itself.
 *
 * `value` matches `retention.models.CallOutcome`; keep the two in step.
 */
export const OUTCOMES = [
  {
    value: 'no_assets',
    label: 'No assets/route dormant',
    short: 'No assets',
    color: '#FFCCD2',
  },
  {
    value: 'completed_survey',
    label: 'Completed survey',
    short: 'Completed survey',
    color: '#C6E7C8',
  },
  {
    value: 'invalid_contact',
    label: 'Missing/invalid contact details',
    short: 'Invalid contact',
    color: '#FEFF85',
  },
  {
    value: 'follow_up',
    label: 'Follow up/Issue (Seed ticket or email the branch)',
    short: 'Follow up/Issue',
    color: '#BDBDBD',
  },
  {
    value: 'awaiting_email',
    label: 'Awaiting email response',
    short: 'Awaiting Email',
    color: '#EBC7EF',
  },
  {
    value: 'french_account',
    label: 'French accounts',
    short: 'French',
    color: '#B9DDFC',
  },
  {
    value: 'left_vm',
    label: 'Left VM/call back',
    short: 'Left VM',
    color: '#FFFFFF',
  },
  {
    value: 'temp_closed',
    label: 'Temp closed due to season',
    short: 'Temp closed',
    color: '#F9D6E5',
  },
]

/** Row background per outcome; sites with no outcome keep the default. */
export const OUTCOME_COLORS = Object.fromEntries(
  OUTCOMES.map(({ value, color }) => [value, color]),
)

const OUTCOME_BY_VALUE = new Map(OUTCOMES.map((outcome) => [outcome.value, outcome]))

/** Full label for an outcome value, or '' when a site is unclassified. */
export function outcomeLabel(value) {
  return OUTCOME_BY_VALUE.get(value)?.label ?? ''
}

/** Short label used in the legend and the grid column. */
export function outcomeShortLabel(value) {
  return OUTCOME_BY_VALUE.get(value)?.short ?? ''
}

/**
 * Count sites per outcome.
 *
 * @returns {{counts: Object, classified: number, unclassified: number}}
 *   `counts` is keyed by outcome value and always carries all eight keys, so
 *   the legend renders a stable row set even at zero.
 */
export function countOutcomes(sites) {
  const counts = Object.fromEntries(OUTCOMES.map(({ value }) => [value, 0]))
  let unclassified = 0

  sites.forEach((site) => {
    const outcome = site.call_outcome
    if (outcome && outcome in counts) {
      counts[outcome] += 1
    } else {
      unclassified += 1
    }
  })

  const classified = OUTCOMES.reduce((total, { value }) => total + counts[value], 0)
  return { counts, classified, unclassified }
}
