import { useCallback, useEffect, useState } from 'react'

import { getCallsForSite, patchSite } from '../../api/client'
import {
  daysSince,
  dispatchCallLogged,
  dispatchSiteUpdated,
  formatCurrency,
  formatDaysSince,
  formatIsoDate,
  formatText,
  getLatestAnnualRevenue,
  getLatestF25Revenue,
  isBlank,
} from '../../lib/sites'
import { statusClasses } from '../../lib/statusStyles'
import CallHistory from './CallHistory'
import CallOutcomeField from './CallOutcomeField'
import EditableField from './EditableField'
import LogCallForm from './LogCallForm'

/** Site fields the API accepts a PATCH for, in the order they are shown.
 *
 * Contact Name gets the full panel width: the tracker mixes names, emails,
 * and both in one cell (e.g. "Missing | invoices@gentek.ca"), so the raw
 * value must stay fully visible while remaining editable for corrections.
 */
const EDITABLE_FIELDS = [
  { key: 'contact_name', label: 'Contact Name', fullWidth: true },
  { key: 'method_of_ordering', label: 'Method of Ordering' },
  { key: 'lob', label: 'LOB' },
  { key: 'phone_number', label: 'Phone Number' },
]

const HOW_LONG_TO_SHOW_CONFIRMATION_MS = 3000

// A site that has not ordered in a quarter is the reason this call is being
// made, so the gap is called out rather than left to be worked out from a date.
const STALE_AFTER_DAYS = 90

function ReadOnlyField({ label, value, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  )
}

/**
 * The last order date with the gap since it spelled out beside it.
 *
 * A rep on a call needs "seven months ago", not a date to subtract from today
 * while someone waits on the phone.
 */
function LastOrderField({ lastOrderDate }) {
  const days = daysSince(lastOrderDate)
  const isStale = days !== null && days >= STALE_AFTER_DAYS

  return (
    <ReadOnlyField
      label="Last Order Date"
      value={
        <>
          <span>{formatIsoDate(lastOrderDate)}</span>
          {!isBlank(lastOrderDate) && (
            <span
              className={`ml-1.5 ${isStale ? 'font-medium text-warning-text' : 'text-gray-500'}`}
            >
              ({formatDaysSince(lastOrderDate)})
            </span>
          )}
        </>
      }
    />
  )
}

/**
 * Slide-out panel for the selected site: reference fields, the four editable
 * ones, call history, and the call-logging form.
 *
 * The panel owns the authoritative copy of the site while it is open. Saves
 * re-broadcast the updated record so the map and list views stay in step.
 */
export default function SiteDetailPanel({ site, onClose }) {
  const [current, setCurrent] = useState(site)
  const [calls, setCalls] = useState([])
  const [isLoadingCalls, setIsLoadingCalls] = useState(true)
  const [callsError, setCallsError] = useState(null)
  // Open with the form ready: the whole point of opening a site is to work
  // on it, so logging a call must not cost an extra click.
  const [isLoggingCall, setIsLoggingCall] = useState(true)
  const [confirmation, setConfirmation] = useState(null)

  // A different row was clicked while the panel was open.
  useEffect(() => {
    setCurrent(site)
    setIsLoggingCall(true)
    setConfirmation(null)
  }, [site])

  const loadCalls = useCallback(async (siteId) => {
    setIsLoadingCalls(true)
    setCallsError(null)
    try {
      const payload = await getCallsForSite(siteId)
      setCalls(Array.isArray(payload) ? payload : (payload?.results ?? []))
    } catch (error) {
      setCallsError(error.message)
    } finally {
      setIsLoadingCalls(false)
    }
  }, [])

  useEffect(() => {
    loadCalls(site.id)
  }, [site.id, loadCalls])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (!confirmation) return undefined
    const timer = setTimeout(() => setConfirmation(null), HOW_LONG_TO_SHOW_CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [confirmation])

  const saveField = async (key, value) => {
    const updated = await patchSite(current.id, { [key]: value })
    setCurrent(updated)
    dispatchSiteUpdated(updated)
  }

  const handleCallLogged = async (created) => {
    setIsLoggingCall(false)
    setConfirmation('Call logged.')
    dispatchCallLogged(created)
    await loadCalls(current.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close site details"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-gray-900/20"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Details for ${current.name}`}
        className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-gray-200 px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-gray-900">
              {current.name}
            </h2>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
              <span className="tabular-nums">{current.site_id}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(
                  current.account_status,
                )}`}
              >
                {current.account_status || 'Unknown'}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-2.5">
          <dl className="grid grid-cols-2 gap-2.5">
            <ReadOnlyField
              label="Address"
              value={formatText(current.address)}
              className="col-span-2"
            />
            <ReadOnlyField label="Branch" value={formatText(current.branch)} />
            <LastOrderField lastOrderDate={current.last_order_date} />
            <ReadOnlyField
              label="Annual Revenue"
              value={formatCurrency(getLatestAnnualRevenue(current))}
            />
            <ReadOnlyField
              label="F25 Revenue"
              value={formatCurrency(getLatestF25Revenue(current))}
            />
          </dl>

          <section className="mt-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Details</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {EDITABLE_FIELDS.map(({ key, label, fullWidth }) => (
                <div key={key} className={fullWidth ? 'col-span-2' : ''}>
                  <EditableField
                    label={label}
                    value={current[key]}
                    onSave={(value) => saveField(key, value)}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="-mx-3.5 mt-4 border-t border-toolbar-line">
            <CallOutcomeField
              value={current.call_outcome}
              onSave={(value) => saveField('call_outcome', value)}
            />
          </div>

          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Call history
                <span className="ml-1.5 font-normal text-gray-500">
                  {isLoadingCalls ? '' : `(${calls.length})`}
                </span>
              </h3>

              {!isLoggingCall && (
                <button
                  type="button"
                  onClick={() => setIsLoggingCall(true)}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Log call
                </button>
              )}
            </div>

            {confirmation && (
              <p className="mb-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {confirmation}
              </p>
            )}

            {isLoggingCall && (
              <div className="mb-3">
                <LogCallForm
                  siteId={current.id}
                  onLogged={handleCallLogged}
                  onCancel={() => setIsLoggingCall(false)}
                />
              </div>
            )}

            <div className="rounded-md border border-gray-200">
              <CallHistory
                calls={calls}
                isLoading={isLoadingCalls}
                error={callsError}
              />
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
