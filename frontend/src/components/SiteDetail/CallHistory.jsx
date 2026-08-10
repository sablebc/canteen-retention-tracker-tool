import { useState } from 'react'

import { EM_DASH, formatIsoDate, isAppCall, isBlank } from '../../lib/sites'

const NOTES_PREVIEW_LENGTH = 90

/** Star-style rating readout; the SOP treats anything under 5 as a follow-up. */
function Rating({ value }) {
  if (isBlank(value)) return <span className="text-gray-400">{EM_DASH}</span>
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
        value < 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
      }`}
    >
      {value}/5
    </span>
  )
}

function hasExpandableDetail(call) {
  return Boolean(
    call.notes ||
      call.q1_last_order_feedback ||
      call.q2_working_well ||
      call.q4_could_improve ||
      call.actions_required ||
      call.data_corrections,
  )
}

function DetailRow({ label, value }) {
  if (isBlank(value)) return null
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="whitespace-pre-wrap text-sm text-gray-700">{value}</dd>
    </div>
  )
}

function CallEntry({ call }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const canExpand = hasExpandableDetail(call)
  // Legacy rows from the tracker import are shown for context but greyed
  // out — they are not calls made through this tool.
  const isImported = !isAppCall(call)

  const preview = isBlank(call.notes)
    ? EM_DASH
    : `${call.notes.slice(0, NOTES_PREVIEW_LENGTH)}${
        call.notes.length > NOTES_PREVIEW_LENGTH ? '…' : ''
      }`

  return (
    <li
      className={`border-b border-gray-100 px-3 py-2 last:border-b-0 ${
        isImported ? 'bg-gray-50 opacity-70' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium text-gray-900 tabular-nums">
          {formatIsoDate(call.call_date)}
        </span>
        {isImported && (
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">
            Imported from tracker
          </span>
        )}
        <span className="text-gray-500">
          {isBlank(call.duration_minutes) ? EM_DASH : `${call.duration_minutes} min`}
        </span>
        <Rating value={call.rating} />
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
          {isBlank(call.rep_initials) ? EM_DASH : call.rep_initials}
        </span>

        {canExpand && (
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="ml-auto text-xs text-blue-700 hover:underline"
          >
            {isExpanded ? 'Hide' : 'Details'}
          </button>
        )}
      </div>

      {!isExpanded && (
        <p className="mt-0.5 truncate text-sm text-gray-500">{preview}</p>
      )}

      {isExpanded && (
        <dl className="mt-2 space-y-2 rounded-md bg-gray-50 p-2">
          <DetailRow label="Q1 · Last order" value={call.q1_last_order_feedback} />
          <DetailRow label="Q2 · Working well" value={call.q2_working_well} />
          <DetailRow label="Q4 · Could improve" value={call.q4_could_improve} />
          <DetailRow label="Notes" value={call.notes} />
          <DetailRow label="Actions required" value={call.actions_required} />
          <DetailRow label="Data corrections" value={call.data_corrections} />
        </dl>
      )}
    </li>
  )
}

/** Reverse-chronological list of a site's logged calls. */
export default function CallHistory({ calls, isLoading, error }) {
  if (isLoading) {
    return <p className="px-3 py-3 text-sm text-gray-500">Loading call history…</p>
  }

  if (error) {
    return (
      <p className="mx-3 my-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
        Could not load call history: {error}
      </p>
    )
  }

  if (calls.length === 0) {
    return (
      <p className="px-3 py-3 text-sm text-gray-500">
        No calls logged for this site yet.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-gray-100">
      {calls.map((call) => (
        <CallEntry key={call.id} call={call} />
      ))}
    </ul>
  )
}
