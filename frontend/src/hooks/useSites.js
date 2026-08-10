import { useCallback, useEffect, useState } from 'react'

import { getSites } from '../api/client'
import {
  DATA_REFRESHED_EVENT,
  SITE_UPDATED_EVENT,
  toSiteArray,
} from '../lib/sites'

/**
 * Load every site, and keep the list in step with panel edits and imports.
 *
 * The detail panel saves through its own request, so without the
 * `siteUpdated` subscription a list view would keep showing the pre-edit
 * values until it was remounted. A tracker import replaces the data wholesale,
 * so `dataRefreshed` triggers a full refetch.
 */
export function useSites() {
  const [sites, setSites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const loadSites = useCallback(async () => {
    try {
      const payload = await getSites()
      setSites(toSiteArray(payload))
      setLoadError(null)
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSites()
  }, [loadSites])

  useEffect(() => {
    const handleSiteUpdated = (event) => {
      const updated = event.detail
      if (!updated) return
      setSites((current) =>
        current.map((site) => (site.id === updated.id ? updated : site)),
      )
    }

    window.addEventListener(SITE_UPDATED_EVENT, handleSiteUpdated)
    window.addEventListener(DATA_REFRESHED_EVENT, loadSites)
    return () => {
      window.removeEventListener(SITE_UPDATED_EVENT, handleSiteUpdated)
      window.removeEventListener(DATA_REFRESHED_EVENT, loadSites)
    }
  }, [loadSites])

  return { sites, isLoading, loadError }
}
