import { useEffect, useRef, useState } from 'react'
// maplibre-gl v6 ships named exports only — there is no default export.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { getSites } from '../../api/client'

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const INITIAL_CENTER = [-98.5, 39.8]
const INITIAL_ZOOM = 2
const MAX_PITCH = 80

const MARKER_CLASSES =
  'w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-md ' +
  'cursor-pointer hover:scale-125 transition-transform'

/** Broadcast a site selection so sibling panels can react without prop drilling. */
function dispatchAssetSelected(site) {
  window.dispatchEvent(new CustomEvent('assetSelected', { detail: site }))
}

/** DRF returns a bare array unless pagination is enabled; tolerate both shapes. */
function toSiteArray(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && Array.isArray(payload.results)) return payload.results
  return []
}

function hasCoordinates(site) {
  return typeof site.latitude === 'number' && typeof site.longitude === 'number'
}

/**
 * Full-bleed MapLibre GL globe plotting every site that has coordinates.
 *
 * Clicking a marker dispatches a window-level `assetSelected` event carrying
 * the full site record.
 */
export default function SiteMap() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!containerRef.current) return undefined

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      maxPitch: MAX_PITCH,
    })
    mapRef.current = map

    map.addControl(new maplibregl.GlobeControl(), 'top-right')
    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' })
    })

    // Markers are tracked so unmount can tear them down before the map itself.
    const markers = []
    let isCancelled = false

    const addSiteMarkers = async () => {
      try {
        const sites = toSiteArray(await getSites())
        if (isCancelled) return

        sites.filter(hasCoordinates).forEach((site) => {
          const element = document.createElement('div')
          element.className = MARKER_CLASSES
          element.addEventListener('click', () => dispatchAssetSelected(site))

          markers.push(
            new maplibregl.Marker({ element })
              .setLngLat([site.longitude, site.latitude])
              .addTo(map),
          )
        })
      } catch (error) {
        if (!isCancelled) setLoadError(error.message)
      }
    }

    map.on('load', addSiteMarkers)

    return () => {
      isCancelled = true
      markers.forEach((marker) => marker.remove())
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full w-full" />
      {loadError && (
        <div className="absolute bottom-3 left-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 shadow-md">
          Could not load sites: {loadError}
        </div>
      )}
    </div>
  )
}
