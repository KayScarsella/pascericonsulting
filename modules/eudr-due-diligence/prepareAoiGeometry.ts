/**
 * Geometria minima per storage e Earth Engine.
 * Le proprietà (ordini, specie, date) non entrano nel calcolo.
 * La simplify a ~15 m (mezzo pixel Hansen) taglia i vertici senza spostare il verdetto JRC a 10 m.
 * I batch evitano l'unione di particelle sparse: ogni reduceRegions resta sul bbox della particella.
 */

import { multiPolygon, polygon } from '@turf/helpers'
import { simplify } from '@turf/simplify'

export type AoiGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: 'Point'; coordinates: number[] }
  | { type: 'MultiPoint'; coordinates: number[][] }

export type AoiFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{ type: 'Feature'; properties: Record<string, never>; geometry: AoiGeometry }>
}

/** Mezzo pixel Hansen (~30 m). Sotto la risoluzione JRC (10 m) il verdetto non cambia. */
export const AOI_SIMPLIFY_TOLERANCE_M = 15
const METERS_PER_DEGREE = 111_320
export const AOI_SIMPLIFY_TOLERANCE_DEG = AOI_SIMPLIFY_TOLERANCE_M / METERS_PER_DEGREE
/** ~0,1 m: più fine della simplify, tiene piccolo il JSON. */
export const AOI_COORD_DECIMALS = 6
export const AOI_BATCH_MAX_FEATURES = 40
export const AOI_BATCH_MAX_VERTICES = 8_000
/** Sopra questa estensione la mediana Sentinel-2 sul rettangolo non è più un caricamento utile. */
export const AOI_S2_MAX_BBOX_KM2 = 2_500

const SUPPORTED = new Set(['Polygon', 'MultiPolygon', 'Point', 'MultiPoint'])

export function countVertices(coordinates: unknown): number {
  if (!Array.isArray(coordinates)) return 0
  if (typeof coordinates[0] === 'number') return 1
  let n = 0
  for (const child of coordinates) n += countVertices(child)
  return n
}

function roundNumber(n: number): number {
  const factor = 10 ** AOI_COORD_DECIMALS
  return Math.round(n * factor) / factor
}

function roundPosition(position: number[]): number[] {
  return [roundNumber(position[0] ?? 0), roundNumber(position[1] ?? 0)]
}

function closeRing(ring: number[][]): number[][] {
  if (ring.length === 0) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) return [...ring, [first[0], first[1]]]
  return ring
}

function isAoiGeometry(value: unknown): value is AoiGeometry {
  if (!value || typeof value !== 'object') return false
  const g = value as { type?: unknown; coordinates?: unknown }
  return typeof g.type === 'string' && SUPPORTED.has(g.type) && Array.isArray(g.coordinates)
}

function ringsOk(geometry: AoiGeometry): boolean {
  if (geometry.type === 'Point') return geometry.coordinates.length >= 2
  if (geometry.type === 'MultiPoint') return geometry.coordinates.every((p) => p.length >= 2)
  if (geometry.type === 'Polygon') return geometry.coordinates.every((ring) => ring.length >= 4)
  return geometry.coordinates.every((poly) => poly.every((ring) => ring.length >= 4))
}

function roundGeometry(geometry: AoiGeometry): AoiGeometry {
  if (geometry.type === 'Point') {
    return { type: 'Point', coordinates: roundPosition(geometry.coordinates) }
  }
  if (geometry.type === 'MultiPoint') {
    return { type: 'MultiPoint', coordinates: geometry.coordinates.map(roundPosition) }
  }
  if (geometry.type === 'Polygon') {
    return { type: 'Polygon', coordinates: geometry.coordinates.map((ring) => closeRing(ring.map(roundPosition))) }
  }
  return {
    type: 'MultiPolygon',
    coordinates: geometry.coordinates.map((poly) => poly.map((ring) => closeRing(ring.map(roundPosition)))),
  }
}

function simplifyOne(geometry: AoiGeometry): AoiGeometry {
  if (geometry.type === 'Point' || geometry.type === 'MultiPoint') return roundGeometry(geometry)
  try {
    const feature =
      geometry.type === 'Polygon' ? polygon(geometry.coordinates) : multiPolygon(geometry.coordinates)
    const simplified = simplify(feature, {
      tolerance: AOI_SIMPLIFY_TOLERANCE_DEG,
      highQuality: true,
      mutate: false,
    })
    const next = simplified.geometry
    if (!isAoiGeometry(next) || (next.type !== 'Polygon' && next.type !== 'MultiPolygon')) {
      return roundGeometry(geometry)
    }
    const rounded = roundGeometry(next)
    if (!ringsOk(rounded)) return roundGeometry(geometry)
    return rounded
  } catch {
    return roundGeometry(geometry)
  }
}

export function simplifyAoiGeometries(geometries: AoiGeometry[]): AoiGeometry[] {
  return geometries.map(simplifyOne)
}

export function featureCollectionFromGeometries(geometries: AoiGeometry[]): AoiFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: geometries.map((geometry) => ({
      type: 'Feature',
      properties: {},
      geometry,
    })),
  }
}

export function simplifiedFeatureCollection(geometries: AoiGeometry[]): AoiFeatureCollection {
  return featureCollectionFromGeometries(simplifyAoiGeometries(geometries))
}

/** FeatureCollection già unita dal browser: solo geometrie, senza proprietà. */
export function simplifyUploadedFeatureCollection(input: {
  type: 'FeatureCollection'
  features: Array<{ geometry?: unknown } | null>
}): AoiFeatureCollection {
  const geometries: AoiGeometry[] = []
  for (const feature of input.features) {
    if (feature && isAoiGeometry(feature.geometry)) geometries.push(feature.geometry)
  }
  if (geometries.length === 0) {
    throw new Error('Nessuna geometria Polygon/MultiPolygon/Point da semplificare.')
  }
  return simplifiedFeatureCollection(geometries)
}

/**
 * Un batch nuovo quando si superano 40 feature o ~8.000 vertici.
 * Una singola geometria più grande resta da sola: non si può spezzare un anello.
 */
export function batchAoiGeometries<T extends { coordinates: unknown }>(geometries: T[]): T[][] {
  const batches: T[][] = []
  let current: T[] = []
  let vertices = 0
  for (const geometry of geometries) {
    const count = countVertices(geometry.coordinates)
    const exceeds =
      current.length > 0 &&
      (current.length >= AOI_BATCH_MAX_FEATURES || vertices + count > AOI_BATCH_MAX_VERTICES)
    if (exceeds) {
      batches.push(current)
      current = []
      vertices = 0
    }
    current.push(geometry)
    vertices += count
  }
  if (current.length > 0) batches.push(current)
  return batches
}

function walkPositions(coordinates: unknown, visit: (x: number, y: number) => void): void {
  if (!Array.isArray(coordinates)) return
  if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    visit(coordinates[0], coordinates[1])
    return
  }
  for (const child of coordinates) walkPositions(child, visit)
}

/** Area del rettangolo che contiene tutte le particelle, non la somma delle aree. */
export function aoiBoundingBoxAreaKm2(geometries: Array<{ coordinates: unknown }>): number {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const geometry of geometries) {
    walkPositions(geometry.coordinates, (x, y) => {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    })
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return 0
  const midLat = ((minY + maxY) / 2) * (Math.PI / 180)
  const widthKm = (maxX - minX) * 111.32 * Math.cos(midLat)
  const heightKm = (maxY - minY) * 110.574
  return Math.abs(widthKm * heightKm)
}

/**
 * MultiPolygon di tutte le parti, senza dissolvere.
 * Serve solo al clip delle tile: il calcolo del rischio usa i batch, non questa unione.
 */
export function geometriesToMapGeometry(geometries: AoiGeometry[]): AoiGeometry {
  const polygons = geometries.filter(
    (geometry): geometry is Extract<AoiGeometry, { type: 'Polygon' | 'MultiPolygon' }> =>
      geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'
  )
  if (polygons.length === 0) return geometries[0]
  if (polygons.length === 1) return polygons[0]
  const parts: number[][][][] = []
  for (const geometry of polygons) {
    if (geometry.type === 'Polygon') parts.push(geometry.coordinates)
    else parts.push(...geometry.coordinates)
  }
  return { type: 'MultiPolygon', coordinates: parts }
}
