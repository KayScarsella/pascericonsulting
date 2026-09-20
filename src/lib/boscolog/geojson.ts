import { area as turfArea } from '@turf/turf'
import { normalizeAoiInput } from '@/features/eudr-due-diligence/server/earthengine/normalizeAoi'

export type BoscologGeoFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{
    type: 'Feature'
    properties?: Record<string, unknown> | null
    geometry: {
      type: string
      coordinates: unknown
    }
  }>
}

export const BOSCOLOG_GEOJSON_MAX_BYTES = 1.5 * 1024 * 1024

export type Wgs84CheckResult =
  | { ok: true; warning?: string }
  | { ok: false; error: string }

function walkCoords(coords: unknown, visit: (lon: number, lat: number) => void): void {
  if (!Array.isArray(coords) || coords.length === 0) return
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    visit(coords[0] as number, coords[1] as number)
    return
  }
  for (const child of coords) walkCoords(child, visit)
}

/** Rough CRS check: lon/lat in geographic range; warn if values look unusual. */
export function assertWgs84Rough(fc: BoscologGeoFeatureCollection): Wgs84CheckResult {
  let maxAbsLon = 0
  let maxAbsLat = 0
  let count = 0
  let outOfRange = false

  for (const feature of fc.features ?? []) {
    const geom = feature.geometry
    if (!geom || geom.coordinates == null) continue
    walkCoords(geom.coordinates, (lon, lat) => {
      count += 1
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        outOfRange = true
        return
      }
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        outOfRange = true
        return
      }
      maxAbsLon = Math.max(maxAbsLon, Math.abs(lon))
      maxAbsLat = Math.max(maxAbsLat, Math.abs(lat))
    })
  }

  if (count === 0) {
    return { ok: false, error: 'Nessuna coordinata nelle geometrie' }
  }
  if (outOfRange) {
    return {
      ok: false,
      error:
        'Coordinate fuori range WGS84 (lon ±180, lat ±90). Usa EPSG:4326, non UTM/proiettato.',
    }
  }

  let warning: string | undefined
  if (maxAbsLon > 100 && maxAbsLat < 1) {
    warning =
      'Coordinate insolite (lon alta, lat ~0): verifica che il file sia in WGS84 / EPSG:4326.'
  }

  return { ok: true, warning }
}

export function featureCount(fc: BoscologGeoFeatureCollection): number {
  return fc.features?.length ?? 0
}

/** Area in hectares (Turf area is m²). Points contribute 0. */
export function areaHa(fc: BoscologGeoFeatureCollection): number {
  try {
    const m2 = turfArea(fc as GeoJSON.FeatureCollection)
    if (!Number.isFinite(m2) || m2 <= 0) return 0
    return Math.round((m2 / 10_000) * 1000) / 1000
  } catch {
    return 0
  }
}

export function lotHasGeo(lot: {
  geojson?: unknown
  geo_feature_count?: number | null
}): boolean {
  if (typeof lot.geo_feature_count === 'number' && lot.geo_feature_count > 0) return true
  if (!lot.geojson || typeof lot.geojson !== 'object') return false
  const fc = lot.geojson as { features?: unknown[] }
  return Array.isArray(fc.features) && fc.features.length > 0
}

export type ParseGeojsonResult =
  | {
      ok: true
      featureCollection: BoscologGeoFeatureCollection
      featureCount: number
      areaHa: number
      warning?: string
    }
  | { ok: false; error: string }

/** Parse raw JSON string or object → normalized FeatureCollection + metrics. */
export function parseAndNormalizeLotGeojson(raw: unknown): ParseGeojsonResult {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return { ok: false, error: 'GeoJSON vuoto' }
    if (new TextEncoder().encode(trimmed).length > BOSCOLOG_GEOJSON_MAX_BYTES) {
      return { ok: false, error: 'File troppo grande (max ~1.5 MB)' }
    }
    try {
      parsed = JSON.parse(trimmed) as unknown
    } catch {
      return { ok: false, error: 'JSON non valido' }
    }
  } else if (raw && typeof raw === 'object') {
    const size = new TextEncoder().encode(JSON.stringify(raw)).length
    if (size > BOSCOLOG_GEOJSON_MAX_BYTES) {
      return { ok: false, error: 'GeoJSON troppo grande (max ~1.5 MB)' }
    }
  } else {
    return { ok: false, error: 'Input GeoJSON non valido' }
  }

  const normalized = normalizeAoiInput(parsed)
  if (!normalized) {
    return {
      ok: false,
      error:
        'Nessuna geometria valida (Polygon, MultiPolygon, Point o MultiPoint). Controlla il file.',
    }
  }

  const fc = normalized.featureCollection as BoscologGeoFeatureCollection
  const wgs = assertWgs84Rough(fc)
  if (!wgs.ok) return { ok: false, error: wgs.error }

  return {
    ok: true,
    featureCollection: fc,
    featureCount: featureCount(fc),
    areaHa: areaHa(fc),
    warning: wgs.warning,
  }
}

export function buildFeatureCollectionExport(
  lots: Array<{
    id: string
    name: string
    geojson: unknown
  }>
): BoscologGeoFeatureCollection {
  const features: BoscologGeoFeatureCollection['features'] = []
  for (const lot of lots) {
    if (!lot.geojson || typeof lot.geojson !== 'object') continue
    const fc = lot.geojson as BoscologGeoFeatureCollection
    if (!Array.isArray(fc.features)) continue
    for (const f of fc.features) {
      features.push({
        ...f,
        properties: {
          ...(f.properties && typeof f.properties === 'object' ? f.properties : {}),
          boscolog_lot_id: lot.id,
          boscolog_lot_name: lot.name,
        },
      })
    }
  }
  return { type: 'FeatureCollection', features }
}
