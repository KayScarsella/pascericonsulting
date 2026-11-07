import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AOI_BATCH_MAX_FEATURES,
  AOI_BATCH_MAX_VERTICES,
  AOI_S2_MAX_BBOX_KM2,
  aoiBoundingBoxAreaKm2,
  batchAoiGeometries,
  countVertices,
  simplifyUploadedFeatureCollection,
  type AoiGeometry,
} from './prepareAoiGeometry'

function square(originX: number, originY: number, steps: number): AoiGeometry {
  const ring: number[][] = []
  const step = 0.00001
  for (let i = 0; i <= steps; i++) ring.push([originX + i * step, originY])
  for (let i = 1; i <= steps; i++) ring.push([originX + steps * step, originY - i * step])
  for (let i = 1; i <= steps; i++) ring.push([originX + (steps - i) * step, originY - steps * step])
  for (let i = 1; i < steps; i++) ring.push([originX, originY - (steps - i) * step])
  ring.push([originX, originY])
  return { type: 'Polygon', coordinates: [ring] }
}

function ringWithVertices(count: number): AoiGeometry {
  const ring: number[][] = []
  for (let i = 0; i < count - 1; i++) ring.push([-56 + i * 0.000001, -33])
  ring.push(ring[0])
  return { type: 'Polygon', coordinates: [ring] }
}

test('la simplify toglie le proprietà e i vertici collineari', () => {
  const dense = square(-56, -33, 40)
  const before = countVertices(dense.coordinates)
  const collection = simplifyUploadedFeatureCollection({
    type: 'FeatureCollection',
    features: [{ geometry: dense, properties: { CustomerPurchaseOrder: '4504089660' } } as never],
  })
  assert.equal(collection.features.length, 1)
  assert.deepEqual(collection.features[0].properties, {})
  assert.ok(countVertices(collection.features[0].geometry.coordinates) < before)
  assert.ok(countVertices(collection.features[0].geometry.coordinates) <= 8)
})

test('i batch rispettano 40 feature e circa 8000 vertici', () => {
  const many = Array.from({ length: 100 }, (_, i) => square(-56 + i * 0.01, -33, 1))
  const byCount = batchAoiGeometries(many)
  assert.equal(byCount.length, 3)
  assert.equal(byCount[0].length, AOI_BATCH_MAX_FEATURES)
  assert.equal(byCount[1].length, AOI_BATCH_MAX_FEATURES)
  assert.equal(byCount[2].length, 20)

  const heavy = [ringWithVertices(3000), ringWithVertices(3000), ringWithVertices(3000)]
  const byVertices = batchAoiGeometries(heavy)
  assert.equal(byVertices.length, 2)
  assert.equal(countVertices(byVertices[0][0].coordinates) + countVertices(byVertices[0][1].coordinates), 6000)
  assert.ok(6000 <= AOI_BATCH_MAX_VERTICES)
  assert.equal(byVertices[1].length, 1)

  const alone = batchAoiGeometries([ringWithVertices(9000)])
  assert.equal(alone.length, 1)
  assert.equal(countVertices(alone[0][0].coordinates), 9000)
})

test('il bbox di particelle sparse supera la soglia Sentinel-2, un lotto no', () => {
  const scattered = [
    square(-57.68, -31.96, 2),
    square(-54.52, -34.52, 2),
  ]
  assert.ok(aoiBoundingBoxAreaKm2(scattered) > AOI_S2_MAX_BBOX_KM2)
  assert.ok(aoiBoundingBoxAreaKm2([square(-56, -33, 2)]) < AOI_S2_MAX_BBOX_KM2)
})
