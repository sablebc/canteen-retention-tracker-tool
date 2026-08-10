import { useEffect, useState } from 'react'

import { OUTCOMES, OUTCOME_COLORS } from '../../lib/outcomes'

const IDLE = 'idle'
const SAVING = 'saving'
const SAVED = 'saved'
const FAILED = 'failed'

const HOW_LONG_TO_SHOW_SAVED_MS = 2000

/**
 * The site's overall call outcome, saved the moment it is picked.
 *
 * This is the classification of the site after all call attempts, which is
 * why it sits outside the call-logging form: a rep can mark a site "Left VM"
 * or "Temp closed" without there being a conversation to log.
 */
export default function CallOutcomeField({ value, onSave }) {
  const [state, setState] = useState(IDLE)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (state !== SAVED) return undefined
    const timer = setTimeout(() => setState(IDLE), HOW_LONG_TO_SHOW_SAVED_MS)
    return () => clearTimeout(timer)
  }, [state])

  const handleChange = async (event) => {
    const next = event.target.value
    setState(SAVING)
    setError(null)
    try {
      await onSave(next)
      setState(SAVED)
    } catch (saveError) {
      setState(FAILED)
      setError(saveError.message)
    }
  }

  const swatch = OUTCOME_COLORS[value]

  return (
    <section className="border-b border-toolbar-line px-3 py-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-teal-header">
          Call Outcome
        </span>
        <span className="h-px flex-1 bg-line-light" />
        {state === SAVING && <span className="text-[10px] text-muted">saving…</span>}
        {state === SAVED && (
          <span className="text-[10px] text-success-text">saved</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-[18px] w-[18px] flex-none border border-line"
          style={{ backgroundColor: swatch ?? '#FFFFFF' }}
        />
        <select
          value={value ?? ''}
          onChange={handleChange}
          disabled={state === SAVING}
          aria-label="Call outcome"
          className={`h-[26px] flex-1 border bg-white px-1.5 text-[12px] focus:outline focus:outline-1 disabled:bg-surface ${
            state === FAILED
              ? 'border-[#B4453C] focus:border-[#B4453C] focus:outline-[#B4453C]'
              : 'border-line focus:border-accent focus:outline-accent'
          }`}
        >
          <option value="">Not yet classified</option>
          {OUTCOMES.map(({ value: outcome, label }) => (
            <option key={outcome} value={outcome}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {state === FAILED && (
        <p className="mt-1 text-[11px] text-[#8A1616]">Could not save: {error}</p>
      )}
    </section>
  )
}
