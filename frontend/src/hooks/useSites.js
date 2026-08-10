import { useEffect, useState } from 'react'

import { getSites } from '../api/client'
import { SITE_UPDATED_EVENT, toSiteArray } from '../lib/sites'

/**
 * Load every site once, and keep the list in step with panel edits.
 *
 * The detail panel saves through its own request, so without the
 * `siteUpdated` subscription a list view would keep showing the pre-edit
 * values until it was remounted.
 */
export function useSites() {
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let isCancelled = false

    const loadSites = async () => {
      try {
        const payload = await getSites()
        if (!isCancelled) setSites(toSiteArray(payload))
      } catch (error) {
        if (!isCancelled) setLoadError(error.message)
      } finally {
        if (!isCancelled) setIsLoading(false)
      }
    }

    loadSites()
    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    const handleSiteUpdated = (event) => {
      const updated = event.detail
      if (!updated) return
      setSites((current) =>
        current.map((site) => (site.id === updated.id ? updated : site)),
      )
    }

    window.addEventListener(SITE_UPDATED_EVENT, handleSiteUpdated)
    return () => window.removeEventListener(SITE_UPDATED_EVENT, handleSiteUpdated)
  }, [])

  return { sites, isLoading, loadError }
}
