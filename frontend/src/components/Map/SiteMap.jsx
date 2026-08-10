import { useEffect, useMemo, useRef, useState } from 'react'
// maplibre-gl v6 ships named exports only — there is no default export.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useCalls } from '../../hooks/useCalls'
import { useSites } from '../../hooks/useSites'
import {
  dispatchAssetSelected,
  formatText,
  getAppCalledSiteIds,
  getRepInitials,
} from '../../lib/sites'
import MapLegend from './MapLegend'
import { CATEGORY_COLORS, MAP_CATEGORIES, categorizeSite } from './mapCategories'

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const INITIAL_CENTER = [-98.5, 39.8]
const INITIAL_ZOOM = 2
const MAX_PITCH = 80
const POPUP_OFFSET_PX = 12

// Color comes from the site's category, applied as an inline style.
const MARKER_CLASSES =
  'w-3 h-3 rounded-full border-2 border-white shadow-md ' +
  'cursor-pointer hover:scale-125 transition-transform'

function hasCoordinates(site) {
  return typeof site.latitude === 'number' && typeof site.longitude === 'number'
}

/**
 * Build a popup's DOM by hand — element by element, via textContent — so
 * tracker-sourced strings are never interpreted as HTML.
 */
function buildPopupContent(site) {
  const container = document.createElement('div')
  container.className = 'space-y-1 pr-2 text-sm'

  const name = document.createElement('p')
  name.className = 'font-semibold text-gray-900'
  name.textContent = site.name
  container.appendChild(name)

  const facts = [
    ['Status', formatText(site.account_status)],
    ['Rep', formatText(getRepInitials(site))],
  ]
  facts.forEach(([label, value]) => {
    const row = document.createElement('p')
    row.className = 'text-gray-600'

    const term = document.createElement('span')
    term.className = 'font-medium text-gray-500'
    term.textContent = `${label}: `
    row.append(term, value)
    container.appendChild(row)
  })

  const detailsButton = document.createElement('button')
  detailsButton.type = 'button'
  detailsButton.className = 'mt-1 text-sm font-medium text-blue-700 hover:underline'
  detailsButton.textContent = 'View Details'
  detailsButton.addEventListener('click', () => dispatchAssetSelected(site))
  container.appendChild(detailsButton)

  return container
}

/**
 * Full-bleed MapLibre GL globe plotting every site that has coordinates.
 *
 * Markers are color-coded by assignment and call status (same "called" rule
 * as My Calls: at least one app-sourced call record), with a legend whose
 * rows toggle each category. Clicking a marker opens a popup; its
 * "View Details" button dispatches the shared `assetSelected` event.
 */
export default function SiteMap() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  // Live marker handles, kept so the visibility effect can show/hide them
  // without rebuilding, and so unmount can tear them down before the map.
  const markersRef = useRef([])
  const [isMapReady, setIsMapReady] = useState(false)
  const [visibleCategories, setVisibleCategories] = useState(
    () => new Set(MAP_CATEGORIES.map(({ id }) => id)),
  )

  const { sites, loadError: sitesError } = useSites()
  const { calls, loadError: callsError } = useCalls()

  const appCalledSiteIds = useMemo(() => getAppCalledSiteIds(calls), [calls])

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
    map.on('load', () => setIsMapReady(true))

    return () => {
      setIsMapReady(false)
      map.remove()
      mapRef.current = null
    }
  }, [])

  // (Re)build the markers whenever the site list or call status changes.
  useEffect(() => {
    const map = mapRef.current
    if (!isMapReady || !map) return undefined

    const markers = sites.filter(hasCoordinates).map((site) => {
      const categoryId = categorizeSite(site, appCalledSiteIds)

      const element = document.createElement('div')
      element.className = MARKER_CLASSES
      element.style.backgroundColor = CATEGORY_COLORS[categoryId]

      const popup = new maplibregl.Popup({
        offset: POPUP_OFFSET_PX,
        closeButton: false,
      }).setDOMContent(buildPopupContent(site))

      // Marker click toggles the attached popup; maplibre wires that up.
      const marker = new maplibregl.Marker({ element })
        .setLngLat([site.longitude, site.latitude])
        .setPopup(popup)
        .addTo(map)

      return { marker, element, categoryId }
    })
    markersRef.current = markers

    return () => {
      markers.forEach(({ marker }) => marker.remove())
      markersRef.current = []
    }
  }, [isMapReady, sites, appCalledSiteIds])

  // Runs after the marker effect above, so freshly built markers are
  // immediately filtered to the checked categories.
  useEffect(() => {
    markersRef.current.forEach(({ element, categoryId }) => {
      element.style.display = visibleCategories.has(categoryId) ? '' : 'none'
    })
  }, [visibleCategories, isMapReady, sites, appCalledSiteIds])

  const toggleCategory = (categoryId) => {
    setVisibleCategories((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }

  const loadError = sitesError ?? callsError

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full w-full" />

      <MapLegend
        visibleCategories={visibleCategories}
        onToggle={toggleCategory}
      />

      {loadError && (
        <div className="absolute bottom-3 right-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 shadow-md">
          Could not load map data: {loadError}
        </div>
      )}
    </div>
  )
}
