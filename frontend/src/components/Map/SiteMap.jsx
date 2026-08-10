import { useEffect, useMemo, useRef, useState } from 'react'
// maplibre-gl v6 ships named exports only — there is no default export.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useCalls } from '../../hooks/useCalls'
import { useSites } from '../../hooks/useSites'
import { dispatchAssetSelected, getAppCalledSiteIds } from '../../lib/sites'
import MapLegend from './MapLegend'
import {
  CATEGORY_COLORS,
  DEFAULT_REP_FILTER,
  MAP_CATEGORIES,
  categorizeSite,
  matchesRepFilter,
} from './mapCategories'

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const INITIAL_CENTER = [-98.5, 39.8]
const INITIAL_ZOOM = 2
const MAX_PITCH = 80

// Color comes from the site's category, applied as an inline style.
const MARKER_CLASSES =
  'w-4 h-4 rounded-full border-2 border-white shadow-md ' +
  'cursor-pointer hover:scale-125 transition-transform'

function hasCoordinates(site) {
  return typeof site.latitude === 'number' && typeof site.longitude === 'number'
}

/**
 * Full-bleed MapLibre GL globe plotting every site that has coordinates.
 *
 * Markers are color-coded by assignment and call status (same "called" rule
 * as My Calls: at least one app-sourced call record). The corner panel
 * filters by rep — defaulting to my own sites — and its legend rows toggle
 * each color category. Clicking a marker opens the site detail panel
 * directly via the shared `assetSelected` event.
 */
export default function SiteMap() {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  // Live marker handles, kept so the visibility effect can show/hide them
  // without rebuilding, and so unmount can tear them down before the map.
  const markersRef = useRef([])
  const [isMapReady, setIsMapReady] = useState(false)
  const [repFilter, setRepFilter] = useState(DEFAULT_REP_FILTER)
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
      // One click on a marker opens the detail panel — no popup in between.
      element.addEventListener('click', (event) => {
        event.stopPropagation()
        dispatchAssetSelected(site)
      })

      const marker = new maplibregl.Marker({ element })
        .setLngLat([site.longitude, site.latitude])
        .addTo(map)

      return { marker, element, site, categoryId }
    })
    markersRef.current = markers

    return () => {
      markers.forEach(({ marker }) => marker.remove())
      markersRef.current = []
    }
  }, [isMapReady, sites, appCalledSiteIds])

  // Runs after the marker effect above, so freshly built markers are
  // immediately filtered to the selected rep and checked categories.
  useEffect(() => {
    markersRef.current.forEach(({ element, site, categoryId }) => {
      const isShown =
        matchesRepFilter(site, repFilter) && visibleCategories.has(categoryId)
      element.style.display = isShown ? '' : 'none'
    })
  }, [repFilter, visibleCategories, isMapReady, sites, appCalledSiteIds])

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

  // Mirrors the marker visibility rule so the legend can report the count.
  const shownCount = useMemo(
    () =>
      sites
        .filter(hasCoordinates)
        .filter(
          (site) =>
            matchesRepFilter(site, repFilter) &&
            visibleCategories.has(categorizeSite(site, appCalledSiteIds)),
        ).length,
    [sites, repFilter, visibleCategories, appCalledSiteIds],
  )

  const loadError = sitesError ?? callsError

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full w-full" />

      <MapLegend
        repFilter={repFilter}
        onRepFilterChange={setRepFilter}
        visibleCategories={visibleCategories}
        onToggle={toggleCategory}
        shownCount={shownCount}
        totalCount={sites.length}
      />

      {loadError && (
        <div className="absolute bottom-3 right-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 shadow-md">
          Could not load map data: {loadError}
        </div>
      )}
    </div>
  )
}
