import test from 'node:test'
import assert from 'node:assert/strict'
import { parseGeoJsonText } from '@/features/eudr-due-diligence/parseGeoJsonText'

const payload = '{"type":"FeatureCollection","features":[]}'

test('JSON.parse rifiuta un GeoJSON con BOM', () => {
  assert.throws(() => JSON.parse(`\uFEFF${payload}`))
})

test('parseGeoJsonText accetta il BOM e il JSON pulito', () => {
  const withBom = parseGeoJsonText(`\uFEFF${payload}`) as { type: string }
  const plain = parseGeoJsonText(payload) as { type: string }
  assert.equal(withBom.type, 'FeatureCollection')
  assert.equal(plain.type, 'FeatureCollection')
})
