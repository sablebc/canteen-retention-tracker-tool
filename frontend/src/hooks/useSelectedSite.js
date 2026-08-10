import { useCallback, useEffect, useState } from 'react'

import { SITE_UPDATED_EVENT } from '../lib/sites'

/**
 * Track the site chosen by the most recent `assetSelected` event.
 *
 * Both the map markers and the table rows broadcast that event, so the detail
 * panel can live once at the app root instead of inside each view.
 */
export function useSelectedSite() {
  const [selectedSite, setSelectedSite] = useState(null)

  useEffect(() => {
    const handleAssetSelected = (event) => {
      if (event.detail) setSelectedSite(event.detail)
    }

    window.addEventListener('assetSelected', handleAssetSelected)
    return () => window.removeEventListener('assetSelected', handleAssetSelected)
  }, [])

  // Keep the open panel pointed at the saved record after an edit.
  useEffect(() => {
    const handleSiteUpdated = (event) => {
      const updated = event.detail
      if (!updated) return
      setSelectedSite((current) =>
        current && current.id === updated.id ? updated : current,
      )
    }

    window.addEventListener(SITE_UPDATED_EVENT, handleSiteUpdated)
    return () => window.removeEventListener(SITE_UPDATED_EVENT, handleSiteUpdated)
  }, [])

  const clearSelection = useCallback(() => setSelectedSite(null), [])

  return { selectedSite, clearSelection }
}
