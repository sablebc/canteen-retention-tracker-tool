import { useCallback, useEffect, useState } from 'react'

import { getCalls } from '../api/client'
import {
  CALL_LOGGED_EVENT,
  DATA_REFRESHED_EVENT,
  toSiteArray,
} from '../lib/sites'

/**
 * Load every call record, and keep the list in step with panel activity.
 *
 * The API returns calls newest first, and a call logged from the detail panel
 * is prepended via the `callLogged` event, so consumers can treat the first
 * record they meet for a site as that site's most recent call.
 */
export function useCalls() {
  const [calls, setCalls] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const loadCalls = useCallback(async () => {
    try {
      const payload = await getCalls()
      setCalls(toSiteArray(payload))
      setLoadError(null)
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCalls()
  }, [loadCalls])

  useEffect(() => {
    const handleCallLogged = (event) => {
      const created = event.detail
      if (!created) return
      setCalls((current) => [created, ...current])
    }

    window.addEventListener(CALL_LOGGED_EVENT, handleCallLogged)
    window.addEventListener(DATA_REFRESHED_EVENT, loadCalls)
    return () => {
      window.removeEventListener(CALL_LOGGED_EVENT, handleCallLogged)
      window.removeEventListener(DATA_REFRESHED_EVENT, loadCalls)
    }
  }, [loadCalls])

  return { calls, isLoading, loadError }
}
