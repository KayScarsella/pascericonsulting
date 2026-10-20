import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEudrOutcomeDescription,
  determineEudrDdsType,
  EUDR_DDS_SEMPLIFICATA_APPENDIX,
  EUDR_DDS_STANDARD_LABEL,
  getEudrDdsPdfOutcomeLine,
} from '@/lib/eudr-dds-determination'

const baseAccettabile =
  'Per questo approvvigionamento il rischio deforestazione è trascurabile, non sono necessarie azioni di mitigazione.'

test('semplificata: catena semplice, 1 paese RB, rischio trascurabile', () => {
  const type = determineEudrDdsType({
    chainComplexity: 'semplice',
    countryCount: 1,
    countryRiskCodes: ['RB'],
    isRiskTrascurabile: true,
  })
  assert.equal(type, 'semplificata')
})

test('standard: catena non_semplice', () => {
  const type = determineEudrDdsType({
    chainComplexity: 'non_semplice',
    countryCount: 1,
    countryRiskCodes: ['RB'],
    isRiskTrascurabile: true,
  })
  assert.equal(type, 'standard')
})

test('standard: complessità catena assente', () => {
  const type = determineEudrDdsType({
    chainComplexity: null,
    countryCount: 1,
    countryRiskCodes: ['RB'],
    isRiskTrascurabile: true,
  })
  assert.equal(type, 'standard')
})

test('standard: più di 1 paese', () => {
  const type = determineEudrDdsType({
    chainComplexity: 'semplice',
    countryCount: 2,
    countryRiskCodes: ['RB', 'RB'],
    isRiskTrascurabile: true,
  })
  assert.equal(type, 'standard')
})

test('standard: paese RS non idoneo a semplificata', () => {
  const type = determineEudrDdsType({
    chainComplexity: 'semplice',
    countryCount: 1,
    countryRiskCodes: ['RS'],
    isRiskTrascurabile: true,
  })
  assert.equal(type, 'standard')
})

test('standard: rischio non trascurabile', () => {
  const type = determineEudrDdsType({
    chainComplexity: 'semplice',
    countryCount: 1,
    countryRiskCodes: ['RB'],
    isRiskTrascurabile: false,
  })
  assert.equal(type, 'standard')
})

test('standard: AOI gate', () => {
  const type = determineEudrDdsType({
    chainComplexity: 'semplice',
    countryCount: 1,
    countryRiskCodes: ['RB'],
    isRiskTrascurabile: true,
    aoiGateTriggered: true,
  })
  assert.equal(type, 'standard')
})

test('buildEudrOutcomeDescription appende Art. 13 per semplificata', () => {
  const text = buildEudrOutcomeDescription(baseAccettabile, 'semplificata', true)
  assert.ok(text.includes(baseAccettabile))
  assert.ok(text.includes(EUDR_DDS_SEMPLIFICATA_APPENDIX))
})

test('getEudrDdsPdfOutcomeLine: semplificata → appendix Art. 13', () => {
  assert.equal(getEudrDdsPdfOutcomeLine('semplificata'), EUDR_DDS_SEMPLIFICATA_APPENDIX)
})

test('getEudrDdsPdfOutcomeLine: standard → appendix Art. 8', () => {
  assert.equal(getEudrDdsPdfOutcomeLine('standard'), EUDR_DDS_STANDARD_LABEL)
})

test('buildEudrOutcomeDescription appende Art. 8 per standard', () => {
  const text = buildEudrOutcomeDescription(baseAccettabile, 'standard', true)
  assert.ok(text.includes(baseAccettabile))
  assert.ok(text.includes(EUDR_DDS_STANDARD_LABEL))
})
