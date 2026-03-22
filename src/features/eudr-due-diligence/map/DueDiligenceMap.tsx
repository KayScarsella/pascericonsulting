'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Map, { Source, Layer, NavigationControl, type MapRef } from 'react-map-gl/maplibre'
import type { LayerProps } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { COLOR_POST_CUT, COLOR_POST_EU_ONLY } from '../constants/hansen-visual'

const MAP_STYLE_LIGHT = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'

/** Esri World Imagery — copertura globale; oltre ~18–19 spesso upscaling → pixeloso */
const SATELLITE_TILES_ESRI = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
]

/**
 * Opzionale: URL template tile ad alta risoluzione (es. WMTS Maxar 30cm/15cm con API key).
 * Impostare NEXT_PUBLIC_SATELLITE_TILES_HIGH_RES con {z}/{x}/{y} o {z}/{y}/{x} come da fornitore.
 * Le tile XYZ sono a risoluzione fissa per zoom: non esiste “più nitido allo zoom” senza
 * cambiare sorgente (es. passare a WMTS con livelli nativi o servizi commerciali).
 */
function getHighResTilesTemplate(): string | null {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SATELLITE_TILES_HIGH_RES?.trim()) {
    return process.env.NEXT_PUBLIC_SATELLITE_TILES_HIGH_RES.trim()
  }
  return null
}

type FeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{ type: string; geometry?: { type: string; coordinates: unknown } }>
}

export type YearTileEntry = { year: number; tilesUrlTemplate: string }

type Props = {
  /** Chiamato quando la mappa è pronta — per cattura canvas → PNG su storage */
  onMapLoad?: (map: { getCanvas: () => HTMLCanvasElement }) => void
  geoJsonUrl: string | null
  lossTilesUrlTemplate?: string | null
  lossAttribution?: string
  lossDualClassMode?: boolean
  /** Overlay verde: foresta JRC al 31/12/2020 */
  forest2020TilesUrlTemplate?: string | null
  forest2020Attribution?: string
  /** Compositi Sentinel-2 per anno — sostituiscono il basemap quando selezionati (zoom ~10 m) */
  sentinel2YearTiles?: YearTileEntry[]
  sentinel2Attribution?: string
  className?: string
}

const aoiFillLayer: LayerProps = {
  id: 'aoi-fill',
  type: 'fill',
  paint: { 'fill-color': '#1e40af', 'fill-opacity': 0.08 },
}

const aoiLineLayer: LayerProps = {
  id: 'aoi-line',
  type: 'line',
  paint: { 'line-color': '#1e3a8a', 'line-width': 2.5 },
}

export function DueDiligenceMap({
  onMapLoad,
  geoJsonUrl,
  lossTilesUrlTemplate,
  lossAttribution,
  lossDualClassMode = false,
  forest2020TilesUrlTemplate,
  forest2020Attribution,
  sentinel2YearTiles,
  sentinel2Attribution,
  className,
}: Props) {
  const [geojson, setGeojson] = useState<FeatureCollection | null>(null)
  const [viewState, setViewState] = useState({ longitude: 0, latitude: 20, zoom: 2 })
  const [showBasemap, setShowBasemap] = useState(true)
  const [showForest2020, setShowForest2020] = useState(true)
  const [showLoss, setShowLoss] = useState(true)
  const [basemapOpacity, setBasemapOpacity] = useState(0.95)
  const [forestOpacity, setForestOpacity] = useState(0.45)
  const [lossOpacity, setLossOpacity] = useState(0.78)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const mapRef = useRef<MapRef>(null)

  const highResTiles = useMemo(() => getHighResTilesTemplate(), [])
  const yearsAvailable = sentinel2YearTiles?.map((e) => e.year) ?? []
  const activeYearEntry =
    selectedYear != null ? sentinel2YearTiles?.find((e) => e.year === selectedYear) : null

  useEffect(() => {
    if (yearsAvailable.length > 0 && selectedYear == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedYear(yearsAvailable[yearsAvailable.length - 1])
    }
  }, [yearsAvailable, selectedYear])

  useEffect(() => {
    if (!geoJsonUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGeojson(null)
      return
    }
    fetch(geoJsonUrl)
      .then((r) => r.json())
      .then((data: FeatureCollection) => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setGeojson(data)
        const geom = data.features?.[0]?.geometry
        if (geom && 'coordinates' in geom && geom.coordinates) {
          const flat = JSON.stringify(geom.coordinates).match(/-?\d+\.?\d*/g)
          if (flat && flat.length >= 4) {
            const nums = flat.map(Number)
            let minLon = Infinity,
              maxLon = -Infinity,
              minLat = Infinity,
              maxLat = -Infinity
            for (let i = 0; i < nums.length; i += 2) {
              const lon = nums[i],
                lat = nums[i + 1]
              if (lat !== undefined && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
                minLon = Math.min(minLon, lon)
                maxLon = Math.max(maxLon, lon)
                minLat = Math.min(minLat, lat)
                maxLat = Math.max(maxLat, lat)
              }
            }
            if (minLon !== Infinity) {
              // Fit bounds once the AOI is known (better than a fixed zoom).
              // If the map isn't ready yet, fall back to a reasonable centered view.
              const center = { longitude: (minLon + maxLon) / 2, latitude: (minLat + maxLat) / 2 }
              // eslint-disable-next-line react-hooks/set-state-in-effect
              setViewState((prev) => ({ ...prev, ...center, zoom: Math.max(prev.zoom, 10) }))
              try {
                const m = mapRef.current?.getMap() as unknown as {
                  fitBounds?: (b: [[number, number], [number, number]], o: { padding: number; duration: number }) => void
                }
                m?.fitBounds?.(
                  [
                    [minLon, minLat],
                    [maxLon, maxLat],
                  ],
                  { padding: 40, duration: 0 }
                )
              } catch {
                /* ignore */
              }
            }
          }
        }
      })
      .catch(() => setGeojson(null))
  }, [geoJsonUrl])

  const mapClass = useMemo(() => className ?? 'w-full h-[480px] rounded-lg border border-slate-200', [className])

  return (
    <div className="space-y-3">
      {/* Controlli layer */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
        <span className="font-semibold text-slate-700">Layer</span>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showBasemap}
            onChange={(e) => setShowBasemap(e.target.checked)}
          />
          Basemap / satellite
        </label>
        {forest2020TilesUrlTemplate && (
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showForest2020}
              onChange={(e) => setShowForest2020(e.target.checked)}
            />
            Foresta 31/12/2020 (JRC)
          </label>
        )}
        {lossTilesUrlTemplate && (
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showLoss} onChange={(e) => setShowLoss(e.target.checked)} />
            Loss Hansen
          </label>
        )}
        {yearsAvailable.length > 0 && (
          <span className="inline-flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
            <span className="text-slate-600">Immagine anno:</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 text-xs"
              value={selectedYear ?? ''}
              onChange={(e) => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
            >
              {yearsAvailable.map((y) => (
                <option key={y} value={y}>
                  {y} (Sentinel-2)
                </option>
              ))}
            </select>
            <span className="text-slate-500">— zoom fino ~18–20 su AOI</span>
          </span>
        )}
      </div>

      <div className={mapClass}>
        <Map
          ref={mapRef}
          {...viewState}
          onLoad={() => {
            try {
              const m = mapRef.current?.getMap() as { getCanvas?: () => HTMLCanvasElement } | undefined
              if (m?.getCanvas && onMapLoad) onMapLoad(m as { getCanvas: () => HTMLCanvasElement })
            } catch {
              /* ignore */
            }
          }}
          onMove={(evt) => setViewState(evt.viewState)}
          mapStyle={MAP_STYLE_LIGHT}
          reuseMaps
          maxZoom={22}
        >
          <NavigationControl position="top-right" showCompass={true} />
          {/* Basemap: composito anno selezionato oppure Esri */}
          {showBasemap && activeYearEntry && (
            <Source
              id="s2-year"
              type="raster"
              tiles={[activeYearEntry.tilesUrlTemplate]}
              tileSize={256}
              attribution={sentinel2Attribution || 'Sentinel-2'}
            >
              <Layer
                id="s2-year-layer"
                type="raster"
                paint={{ 'raster-opacity': basemapOpacity }}
              />
            </Source>
          )}
          {showBasemap && !activeYearEntry && highResTiles && (
            <Source
              id="satellite-hires"
              type="raster"
              tiles={[highResTiles]}
              tileSize={256}
              attribution="High-res tiles (config)"
            >
              <Layer
                id="satellite-hires-layer"
                type="raster"
                paint={{ 'raster-opacity': basemapOpacity }}
              />
            </Source>
          )}
          {showBasemap && !activeYearEntry && !highResTiles && (
            <Source
              id="satellite"
              type="raster"
              tiles={SATELLITE_TILES_ESRI}
              tileSize={256}
              attribution="Esri"
            >
              <Layer
                id="satellite-layer"
                type="raster"
                paint={{ 'raster-opacity': basemapOpacity }}
              />
            </Source>
          )}
          {showForest2020 && forest2020TilesUrlTemplate && (
            <Source
              id="forest-2020"
              type="raster"
              tiles={[forest2020TilesUrlTemplate]}
              tileSize={256}
              attribution={forest2020Attribution || 'JRC'}
            >
              <Layer
                id="forest-2020-raster"
                type="raster"
                paint={{ 'raster-opacity': forestOpacity }}
              />
            </Source>
          )}
          {showLoss && lossTilesUrlTemplate && (
            <Source
              id="hansen-loss"
              type="raster"
              tiles={[lossTilesUrlTemplate]}
              tileSize={256}
              attribution={lossAttribution || 'Hansen'}
            >
              <Layer
                id="hansen-loss-raster"
                type="raster"
                paint={{ 'raster-opacity': lossOpacity }}
              />
            </Source>
          )}
          {geojson && (
            <Source id="aoi" type="geojson" data={geojson as GeoJSON.FeatureCollection}>
              <Layer {...aoiFillLayer} />
              <Layer {...aoiLineLayer} />
            </Source>
          )}
        </Map>
      </div>

      {/* Opacità rapide */}
      <div className="flex flex-wrap gap-4 text-[11px] text-slate-600">
        <label className="inline-flex items-center gap-2">
          Opacità basemap
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(basemapOpacity * 100)}
            onChange={(e) => setBasemapOpacity(Number(e.target.value) / 100)}
          />
        </label>
        {forest2020TilesUrlTemplate && (
          <label className="inline-flex items-center gap-2">
            Opacità foresta 2020
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(forestOpacity * 100)}
              onChange={(e) => setForestOpacity(Number(e.target.value) / 100)}
            />
          </label>
        )}
        {lossTilesUrlTemplate && (
          <label className="inline-flex items-center gap-2">
            Opacità loss
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(lossOpacity * 100)}
              onChange={(e) => setLossOpacity(Number(e.target.value) / 100)}
            />
          </label>
        )}
      </div>

      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 space-y-2">
        {lossTilesUrlTemplate && lossDualClassMode && (
          <div className="flex flex-wrap gap-4 pb-2 border-b border-slate-200">
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="h-4 w-4 rounded shadow-sm" style={{ backgroundColor: COLOR_POST_EU_ONLY }} />
              Blu: loss 2021…anno prima del taglio (escluso anno inserito)
            </span>
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="h-4 w-4 rounded shadow-sm" style={{ backgroundColor: COLOR_POST_CUT }} />
              Rosso: dall&apos;anno di taglio in poi (≥) — incluso l&apos;anno inserito
            </span>
          </div>
        )}
        {forest2020TilesUrlTemplate && (
          <p>
            <strong>Verde:</strong> area classificata <strong>foresta al 31/12/2020</strong> (JRC GFC2020 V3, 10 m).
            Non è l&apos;unica fonte ammessa dall&apos;UE ma è quella esplicitamente legata al cut-off EUDR.
          </p>
        )}
        {activeYearEntry && (
          <p>
            <strong>Sentinel-2 {selectedYear}:</strong> composito ~10 m — zoomando oltre la risoluzione nativa
            l&apos;immagine diventa pixelosa (non c&apos;è “più dettaglio” nello stesso tile).
          </p>
        )}
        <details className="text-slate-600">
          <summary className="cursor-pointer font-medium">Perché a zoom alto è pixeloso? Immagini più nitide?</summary>
          <ul className="mt-2 list-disc pl-4 space-y-1">
            <li>
              Ogni livello zoom XYZ ha una <strong>risoluzione fissa</strong> (es. Esri spesso ~1 m equivalente
              fino a z~19; oltre si ingrandisce il pixel). Sentinel-2 L2A è ~10 m: zoom molto alto = sempre più
              a blocchi.
            </li>
            <li>
              Per basemap <strong>30 cm / 15 cm</strong> servono servizi commerciali (es.{' '}
              <strong>Maxar Vivid Mosaic</strong> WMTS/API) con chiave — si può impostare{' '}
              <code className="bg-slate-100 px-1 rounded">NEXT_PUBLIC_SATELLITE_TILES_HIGH_RES</code> con il
              template URL del fornitore (stesso ordine {'{z}/{y}/{x}'} di Esri) per sostituire il basemap quando
              non usi un anno Sentinel-2.
            </li>
            <li>
              <strong>Zoom-adattivo vero</strong> = WMTS con livelli nativi multipli o più sorgenti raster con
              minzoom/maxzoom diversi; richiede configurazione per fornitore.
            </li>
          </ul>
        </details>
        {!lossTilesUrlTemplate && (
          <p className="text-amber-800">Solo AOI — rieseguire l&apos;analisi per i layer Hansen/foresta.</p>
        )}
      </div>
    </div>
  )
}
