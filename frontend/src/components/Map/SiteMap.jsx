import { useEffect, useMemo, useRef, useState } from 'react'
// maplibre-gl v6 ships named exports only — there is no default export.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import { useCalls } from '../../hooks/useCalls'
import { useCurrentRep } from '../../hooks/useCurrentRep'
import { useSites } from '../../hooks/useSites'
import { dispatchAssetSelected, getAppCalledSiteIds } from '../../lib/sites'
import MapLegend from './MapLegend'
import {
  CATEGORY_COLORS,
  MAP_CATEGORIES,
  buildRepFilterOptions,
  categorizeSite,
  matchesRepFilter,
} from './mapCategories'

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const INITIAL_CENTER = [-98.5, 39.8]
const INITIAL_ZOOM = 2
const MAX_PITCH = 80

// The marker is two elements: a fixed-size wrapper that MapLibre positions
// (it must never be scaled — MapLibre positions it with an inline transform,
// and scaling the same element multiplies that translation, so the marker
// would shift away from the cursor on hover), and an inner dot that grows on
// hover around its own centre. Color comes from the site's category, applied
// as an inline style on the dot.
const MARKER_WRAPPER_CLASSES = 'h-4 w-4 cursor-pointer'
const MARKER_DOT_CLASSES =
  'h-full w-full origin-center rounded-full border-2 border-white shadow-md ' +
  'transition-transform hover:scale-125'

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
  const [visibleCategories, setVisibleCategories] = useState(
    () => new Set(MAP_CATEGORIES.map(({ id }) => id)),
  )

  const { sites, loadError: sitesError } = useSites()
  const { calls, loadError: callsError } = useCalls()
  const { initials: myRep } = useCurrentRep()

  const [repFilter, setRepFilter] = useState(myRep)
  const repOptions = useMemo(() => buildRepFilterOptions(myRep), [myRep])

  // Switching rep in the header re-points the map at that rep's sites. Without
  // this the map would keep filtering to the previous rep while every marker
  // recoloured around it, which reads as a bug rather than a stale filter.
  useEffect(() => {
    setRepFilter(myRep)
  }, [myRep])

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
      const categoryId = categorizeSite(site, appCalledSiteIds, myRep)

      const element = document.createElement('div')
      element.className = MARKER_WRAPPER_CLASSES

      const dot = document.createElement('div')
      dot.className = MARKER_DOT_CLASSES
      dot.style.backgroundColor = CATEGORY_COLORS[categoryId]
      element.appendChild(dot)

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
  }, [isMapReady, sites, appCalledSiteIds, myRep])

  // Runs after the marker effect above, so freshly built markers are
  // immediately filtered to the selected rep and checked categories.
  useEffect(() => {
    markersRef.current.forEach(({ element, site, categoryId }) => {
      const isShown =
        matchesRepFilter(site, repFilter) && visibleCategories.has(categoryId)
      element.style.display = isShown ? '' : 'none'
    })
  }, [repFilter, visibleCategories, isMapReady, sites, appCalledSiteIds, myRep])

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
            visibleCategories.has(categorizeSite(site, appCalledSiteIds, myRep)),
        ).length,
    [sites, repFilter, visibleCategories, appCalledSiteIds, myRep],
  )

  const loadError = sitesError ?? callsError

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg">
      <div ref={containerRef} className="h-full w-full" />

      <MapLegend
        repFilter={repFilter}
        repOptions={repOptions}
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
