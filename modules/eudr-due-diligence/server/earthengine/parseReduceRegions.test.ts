import test from 'node:test'
import assert from 'node:assert/strict'
import { readHistogram, readSumM2 } from './runEudrAoiAssessment'

test('gli ettari si leggono anche se la proprietà non si chiama sum', () => {
  assert.equal(readSumM2({ area_m2: 250000 }), 250000)
  assert.equal(readSumM2({ area: 90000 }), 90000)
  assert.equal(readSumM2({ Map: 10000 }), 10000)
  assert.equal(readSumM2({ sum: 4500 }), 4500)
  assert.equal(readSumM2({}), 0)
})

test('l’istogramma Hansen non si azzera se la chiave non è intera o il nome banda cambia', () => {
  assert.deepEqual(readHistogram({ lossyear: { '21.0': 4, '22': 1, note: 'x' } }), {
    '21': 4,
    '22': 1,
  })
  assert.deepEqual(readHistogram({ histogram: { '1': 10, '20': 74579 } }), {
    '1': 10,
    '20': 74579,
  })
  assert.deepEqual(readHistogram({ '21': 8, 'system:index': '0' }), { '21': 8 })
})
