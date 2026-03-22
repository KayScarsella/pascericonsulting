/**
 * Normalize uploaded GeoJSON to a Polygon/MultiPolygon geometry for Earth Engine.
 * Accepts raw geometry, Feature, or FeatureCollection (first feature).
 */

import type { AoiGeoJson } from '../../types/due-diligence-run'

type GeoJsonGeometryType = 'Polygon' | 'MultiPolygon' | 'Point' | 'MultiPoint'

type GeoJsonGeometry =
  | { type: 'Polygon'; coordinates: number[][][] }
  | { type: 'MultiPolygon'; coordinates: number[][][][] }
  | { type: 'Point'; coordinates: number[] }
  | { type: 'MultiPoint'; coordinates: number[][] }

type GeoJsonFeature = {
  type: 'Feature'
  properties?: Record<string, unknown> | null
  geometry: GeoJsonGeometry
}

type GeoJsonFeatureCollection = {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

export interface NormalizedAoiInput {
  featureCollection: GeoJsonFeatureCollection
  geometries: GeoJsonGeometry[]
}

function isGeometry(o: unknown): o is GeoJsonGeometry {
  if (!o || typeof o !== 'object') return false
  const g = o as Record<string, unknown>
  const t = g.type
  if (t !== 'Polygon' && t !== 'MultiPolygon' && t !== 'Point' && t !== 'MultiPoint') return false
  return Array.isArray(g.coordinates)
}

function asFeature(geom: GeoJsonGeometry): GeoJsonFeature {
  return { type: 'Feature', properties: { name: 'AOI' }, geometry: geom }
}

/**
 * Normalize AOI input into a FeatureCollection + list of geometries.
 * Accepts: Geometry, Feature, FeatureCollection (all features), GeometryCollection.
 *
 * Note: downstream analysis requires polygonal area; point geometries will be buffered in EE space.
 */
export function normalizeAoiInput(input: unknown): NormalizedAoiInput | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>

  const geometries: GeoJsonGeometry[] = []

  // Raw geometry
  if (isGeometry(o)) geometries.push(o)

  // Feature
  if (o.type === 'Feature' && isGeometry(o.geometry)) {
    geometries.push(o.geometry as GeoJsonGeometry)
  }

  // FeatureCollection (all features)
  if (o.type === 'FeatureCollection' && Array.isArray(o.features)) {
    for (const f of o.features) {
      if (!f || typeof f !== 'object') continue
      const ff = f as Record<string, unknown>
      if (ff.type === 'Feature' && isGeometry(ff.geometry)) {
        geometries.push(ff.geometry as GeoJsonGeometry)
      }
    }
  }

  // GeometryCollection
  if (o.type === 'GeometryCollection' && Array.isArray(o.geometries)) {
    for (const g of o.geometries) {
      if (isGeometry(g)) geometries.push(g)
    }
  }

  if (geometries.length === 0) return null

  const featureCollection: GeoJsonFeatureCollection = {
    type: 'FeatureCollection',
    features: geometries.map(asFeature),
  }

  return { featureCollection, geometries }
}
