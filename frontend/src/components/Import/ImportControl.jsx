import { useCallback, useEffect, useRef, useState } from 'react'

import { getImportLogs, importTracker } from '../../api/client'
import { dispatchDataRefreshed, formatIsoDate } from '../../lib/sites'
import ImportSummaryModal from './ImportSummaryModal'

/** The date part of an ISO timestamp, for "Last updated". */
function toIsoDate(timestamp) {
  return typeof timestamp === 'string' ? timestamp.slice(0, 10) : null
}

/**
 * Header control for refreshing the data from a new Smartsheet export.
 *
 * Picking a file uploads it to `/api/retention/import/`, which stores it and
 * re-runs the ingest. On success every view refetches and the returned
 * summary is shown in a modal.
 */
export default function ImportControl() {
  const fileInputRef = useRef(null)

  const [lastImport, setLastImport] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  const loadHistory = useCallback(async () => {
    try {
      const logs = await getImportLogs()
      setLastImport(Array.isArray(logs) && logs.length > 0 ? logs[0] : null)
    } catch {
      // The header simply omits "Last updated" if the history is unavailable.
      setLastImport(null)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleFileChosen = async (event) => {
    const file = event.target.files?.[0]
    // Clear immediately so choosing the same file twice fires onChange again.
    event.target.value = ''
    if (!file) return

    setIsUploading(true)
    setError(null)
    try {
      const result = await importTracker(file)
      setSummary(result)
      dispatchDataRefreshed()
      await loadHistory()
    } catch (importFailure) {
      setError(importFailure.message)
    } finally {
      setIsUploading(false)
    }
  }

  const lastUpdated = toIsoDate(lastImport?.imported_at)

  return (
    <>
      <div className="flex items-center gap-2.5">
        {lastUpdated && (
          <span className="whitespace-nowrap text-[11px] text-header-meta">
            Last updated: {formatIsoDate(lastUpdated)}
          </span>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="h-[22px] whitespace-nowrap border border-accent-hover bg-accent px-[9px] text-[11px] font-bold text-teal-deep hover:bg-accent-hover disabled:border-teal-hairline disabled:bg-transparent disabled:text-header-meta"
        >
          {isUploading ? 'Importing…' : 'Import / Update'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={handleFileChosen}
          className="hidden"
        />
      </div>

      {(summary || error) && (
        <ImportSummaryModal
          summary={summary}
          error={error}
          onClose={() => {
            setSummary(null)
            setError(null)
          }}
        />
      )}
    </>
  )
}
