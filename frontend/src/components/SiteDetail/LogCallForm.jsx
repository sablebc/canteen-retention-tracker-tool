import { useMemo, useState } from 'react'

import { createCall } from '../../api/client'
import { useCurrentRep } from '../../hooks/useCurrentRep'
import { Star } from '../StarRating'

/** The SOP escalates to Q4 whenever the score is short of a 5. */
const TOP_RATING = 5
const RATINGS = [1, 2, 3, 4, 5]

const EMPTY_FORM = {
  rep_initials: '',
  q1_last_order_feedback: '',
  q2_working_well: '',
  rating: '',
  q4_could_improve: '',
  duration_minutes: '',
  notes: '',
  actions_required: '',
  data_corrections: '',
}

const FIELD_CLASSES =
  'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

/**
 * Build the POST body, dropping empty optional values.
 *
 * Blank strings are fine for the text columns but would fail validation on the
 * integer ones, so those are omitted entirely when unanswered.
 */
function toPayload(form, siteId) {
  const payload = {
    site: siteId,
    rep_initials: form.rep_initials.trim(),
    q1_last_order_feedback: form.q1_last_order_feedback,
    q2_working_well: form.q2_working_well,
    q4_could_improve: form.q4_could_improve,
    notes: form.notes,
    actions_required: form.actions_required,
    data_corrections: form.data_corrections,
  }

  if (form.rating !== '') payload.rating = Number(form.rating)
  if (form.duration_minutes !== '') {
    payload.duration_minutes = Number(form.duration_minutes)
  }

  return payload
}

function Field({ label, hint, highlight, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {hint && (
        <span
          className={`mb-1 block text-xs ${
            highlight ? 'font-medium text-amber-700' : 'text-gray-500'
          }`}
        >
          {hint}
        </span>
      )}
      {children}
    </label>
  )
}

/**
 * The SOP call script as a form: Q1, Q2, a 1-5 rating, then Q4.
 *
 * Q4 is always shown rather than revealed conditionally — hiding it would mean
 * a rep who scores the call a 4 never sees the question the SOP requires — but
 * it is highlighted once the rating falls short of a 5.
 */
export default function LogCallForm({ siteId, onLogged, onCancel }) {
  const { initials: myRep } = useCurrentRep()

  // Pre-filled from the header's rep, but still editable: someone covering
  // another rep's list should be able to log the call under their own initials.
  const emptyForm = useMemo(() => ({ ...EMPTY_FORM, rep_initials: myRep }), [myRep])

  const [form, setForm] = useState(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const setField = (name) => (event) =>
    setForm((current) => ({ ...current, [name]: event.target.value }))

  const rating = form.rating === '' ? null : Number(form.rating)
  const needsFollowUp = rating !== null && rating < TOP_RATING

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const created = await createCall(toPayload(form, siteId))
      setForm(emptyForm)
      onLogged(created)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Rep initials">
          <input
            type="text"
            required
            value={form.rep_initials}
            onChange={setField('rep_initials')}
            className={FIELD_CLASSES}
          />
        </Field>

        <Field label="Duration (minutes)">
          <input
            type="number"
            min="0"
            value={form.duration_minutes}
            onChange={setField('duration_minutes')}
            className={FIELD_CLASSES}
          />
        </Field>
      </div>

      <Field label="Q1" hint="How was your last order with us?">
        <textarea
          rows={2}
          value={form.q1_last_order_feedback}
          onChange={setField('q1_last_order_feedback')}
          className={FIELD_CLASSES}
        />
      </Field>

      <Field label="Q2" hint="What's been working well for you?">
        <textarea
          rows={2}
          value={form.q2_working_well}
          onChange={setField('q2_working_well')}
          className={FIELD_CLASSES}
        />
      </Field>

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-gray-700">
          Q3 · Rating
        </legend>
        <div className="flex items-center gap-0.5">
          {RATINGS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                // Clicking the third star means "3"; clicking the current
                // rating again clears it.
                setForm((current) => ({
                  ...current,
                  rating: current.rating === String(value) ? '' : String(value),
                }))
              }
              aria-pressed={form.rating === String(value)}
              aria-label={`Rate ${value} out of ${TOP_RATING}`}
              className="rounded p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <Star filled={rating !== null && value <= rating} className="h-6 w-6" />
            </button>
          ))}
          {form.rating !== '' && (
            <button
              type="button"
              onClick={() => setForm((current) => ({ ...current, rating: '' }))}
              className="ml-1 text-xs text-blue-700 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </fieldset>

      <Field
        label="Q4"
        highlight={needsFollowUp}
        hint={
          needsFollowUp
            ? `Rated ${rating}/5 — ask: what could we do to make your experience a 5?`
            : 'Anything we could be doing better?'
        }
      >
        <textarea
          rows={2}
          value={form.q4_could_improve}
          onChange={setField('q4_could_improve')}
          className={`${FIELD_CLASSES} ${
            needsFollowUp ? 'border-amber-400 bg-amber-50' : ''
          }`}
        />
      </Field>

      <Field label="Notes">
        <textarea
          rows={3}
          value={form.notes}
          onChange={setField('notes')}
          className={FIELD_CLASSES}
        />
      </Field>

      <Field label="Actions required">
        <textarea
          rows={2}
          value={form.actions_required}
          onChange={setField('actions_required')}
          className={FIELD_CLASSES}
        />
      </Field>

      <Field
        label="Data corrections"
        hint="Anything on file that turned out to be wrong."
      >
        <textarea
          rows={2}
          value={form.data_corrections}
          onChange={setField('data_corrections')}
          className={FIELD_CLASSES}
        />
      </Field>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Could not log call: {error}
        </p>
      )}

      <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
        Before you finish: “Is there anything else you'd like to mention?”
      </p>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
        >
          {isSubmitting ? 'Saving…' : 'Save call'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
