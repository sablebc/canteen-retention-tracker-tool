import { useEffect, useState } from 'react'

const IDLE = 'idle'
const SAVING = 'saving'
const SAVED = 'saved'
const FAILED = 'failed'

const HOW_LONG_TO_SHOW_SAVED_MS = 2000

/**
 * One inline-editable site field with a fixed set of choices.
 *
 * Saves on change rather than on blur, unlike the free-text fields beside it:
 * a dropdown has no half-finished state to protect, so waiting for focus to
 * move would only delay the write and risk losing it.
 *
 * The empty option is kept selectable, because "nobody has asked yet" is a
 * real answer and a rep must be able to go back to it.
 */
export default function EditableSelect({
  label,
  value,
  options,
  placeholder = 'Not recorded',
  onSave,
}) {
  const [state, setState] = useState(IDLE)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (state !== SAVED) return undefined
    const timer = setTimeout(() => setState(IDLE), HOW_LONG_TO_SHOW_SAVED_MS)
    return () => clearTimeout(timer)
  }, [state])

  const handleChange = async (event) => {
    setState(SAVING)
    setError(null)
    try {
      await onSave(event.target.value)
      setState(SAVED)
    } catch (saveError) {
      setState(FAILED)
      setError(saveError.message)
    }
  }

  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
        {state === SAVING && <span className="normal-case text-gray-400">saving…</span>}
        {state === SAVED && <span className="normal-case text-emerald-600">saved</span>}
      </span>

      <select
        value={value ?? ''}
        onChange={handleChange}
        disabled={state === SAVING}
        className={`w-full rounded-md border bg-white px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 disabled:bg-gray-50 ${
          state === FAILED
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
        }`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {state === FAILED && (
        <span className="mt-1 block text-xs text-red-700">
          Could not save: {error}
        </span>
      )}
    </label>
  )
}
