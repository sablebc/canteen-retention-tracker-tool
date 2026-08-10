import { useEffect, useState } from 'react'

const IDLE = 'idle'
const SAVING = 'saving'
const SAVED = 'saved'
const FAILED = 'failed'

const HOW_LONG_TO_SHOW_SAVED_MS = 2000

/**
 * One inline-editable site field.
 *
 * Saves on blur when the value actually changed, so a rep can tab through the
 * panel without firing a request per field. Escape reverts to the last saved
 * value; Enter commits without waiting for focus to move.
 */
export default function EditableField({ label, value, onSave }) {
  const [draft, setDraft] = useState(value ?? '')
  const [state, setState] = useState(IDLE)
  const [error, setError] = useState(null)

  // A save elsewhere in the panel replaces the whole site object; pick up the
  // canonical value unless the user is mid-edit on this field.
  useEffect(() => {
    if (state === IDLE) setDraft(value ?? '')
  }, [value, state])

  useEffect(() => {
    if (state !== SAVED) return undefined
    const timer = setTimeout(() => setState(IDLE), HOW_LONG_TO_SHOW_SAVED_MS)
    return () => clearTimeout(timer)
  }, [state])

  const commit = async () => {
    const trimmed = draft.trim()
    if (trimmed === (value ?? '')) {
      setState(IDLE)
      return
    }

    setState(SAVING)
    setError(null)
    try {
      await onSave(trimmed)
      setState(SAVED)
    } catch (saveError) {
      setState(FAILED)
      setError(saveError.message)
    }
  }

  const revert = () => {
    setDraft(value ?? '')
    setState(IDLE)
    setError(null)
  }

  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
        {state === SAVING && <span className="text-gray-400 normal-case">saving…</span>}
        {state === SAVED && <span className="text-emerald-600 normal-case">saved</span>}
      </span>

      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') revert()
        }}
        disabled={state === SAVING}
        className={`w-full rounded-md border px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 disabled:bg-gray-50 ${
          state === FAILED
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }`}
      />

      {state === FAILED && (
        <span className="mt-1 block text-xs text-red-700">
          Could not save: {error}
        </span>
      )}
    </label>
  )
}
