import test from 'node:test'
import assert from 'node:assert/strict'
import {
  describeSentinel2CompositeGaps,
  selectSentinel2CompositeYears,
} from '@/features/eudr-due-diligence/server/earthengine/getSentinel2YearCompositeTiles'

test('anni Sentinel-2 dal taglio fino all anno corrente', () => {
  assert.deepEqual(selectSentinel2CompositeYears(2024, 2026), [2024, 2025, 2026])
  assert.deepEqual(selectSentinel2CompositeYears(2026, 2026), [2026])
})

test('taglio prima del 2020 parte dal cut-off e rispetta il tetto di 5', () => {
  assert.deepEqual(selectSentinel2CompositeYears(2018, 2026), [2020, 2023, 2024, 2025, 2026])
  assert.deepEqual(selectSentinel2CompositeYears(null, 2026), [2020, 2023, 2024, 2025, 2026])
})

test('taglio successivo all anno corrente usa solo l anno con immagini', () => {
  assert.deepEqual(selectSentinel2CompositeYears(2028, 2026), [2026])
})

test('anno in corso prima di luglio avvisa che la mediana è parziale', () => {
  const notice = describeSentinel2CompositeGaps({
    requestedYears: [2024, 2025, 2026],
    succeededYears: [2024, 2025, 2026],
    asOf: new Date(2026, 2, 1),
  })
  assert.match(notice ?? '', /2026/)
  assert.match(notice ?? '', /incompleta/)
})

test('anno omesso indica quale composito usano mappa e poster', () => {
  const notice = describeSentinel2CompositeGaps({
    requestedYears: [2024, 2025, 2026],
    succeededYears: [2024, 2025],
    asOf: new Date(2026, 10, 1),
  })
  assert.match(notice ?? '', /non disponibile per 2026/)
  assert.match(notice ?? '', /usano il 2025/)
})

test('nessun avviso se tutti i compositi richiesti sono riusciti a fine anno', () => {
  assert.equal(
    describeSentinel2CompositeGaps({
      requestedYears: [2025, 2026],
      succeededYears: [2025, 2026],
      asOf: new Date(2026, 10, 1),
    }),
    null
  )
})
