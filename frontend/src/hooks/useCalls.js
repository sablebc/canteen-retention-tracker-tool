import { useEffect, useState } from 'react'

import { getCalls } from '../api/client'
import { CALL_LOGGED_EVENT, toSiteArray } from '../lib/sites'

/**
 * Load every call record once, and keep the list in step with panel activity.
 *
 * The API returns calls newest first, and a call logged from the detail panel
 * is prepended via the `callLogged` event, so consumers can treat the first
 * record they meet for a site as that site's most recent call.
 */
export function useCalls() {
  const [calls, setCalls] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let isCancelled = false

    const loadCalls = async () => {
      try {
        const payload = await getCalls()
        if (!isCancelled) setCalls(toSiteArray(payload))
      } catch (error) {
        if (!isCancelled) setLoadError(error.message)
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    loadCalls()
    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    const handleCallLogged = (event) => {
      const created = event.detail
      if (!created) return
      setCalls((current) => [created, ...current])
    }

    window.addEventListener(CALL_LOGGED_EVENT, handleCallLogged)
    return () => window.removeEventListener(CALL_LOGGED_EVENT, handleCallLogged)
  }, [])

  return { calls, isLoading, loadError }
}
