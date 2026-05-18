import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEudrOutcomeDescription,
  determineEudrDdsType,
  EUDR_DDS_SEMPLIFICATA_APPENDIX,
  EUDR_DDS_STANDARD_PDF_LABEL,
  getEudrDdsPdfOutcomeLine,
} from '@/lib/eudr-dds-determination'

const baseAccettabile =
  'Per questo approvvigionamento il rischio deforestazione è trascurabile, non sono necessarie azioni di mitigazione.'

test('semplificata: 5 società, 2 paesi RB, rischio trascurabile', () => {
  const type = determineEudrDdsType({
    nonEuCompanyCount: 5,
    countryCount: 2,
    countryRiskCodes: ['RB', 'RB'],
    isRiskTrascurabile: true,
  })
  assert.equal(type, 'semplificata')
})

test('standard: 6 società extra-UE', () => {
  const type = determineEudrDdsType({
    nonEuCompanyCount: 6,
    countryCount: 1,
    countryRiskCodes: ['RB'],
    isRiskTrascurabile: true,
  })
  assert.equal(type, 'standard')
})

test('standard: più di 2 paesi', () => {
  const type = determineEudrDdsType({
    nonEuCompanyCount: 2,
    countryCount: 3,
    countryRiskCodes: ['RB', 'RB', 'RB'],
    isRiskTrascurabile: true,
  })
  assert.equal(type, 'standard')
})

test('standard: paesi RS non idonei a semplificata', () => {
  const type = determineEudrDdsType({
    nonEuCompanyCount: 2,
    countryCount: 2,
    countryRiskCodes: ['RB', 'RS'],
    isRiskTrascurabile: true,
  })
  assert.equal(type, 'standard')
})

test('standard: rischio non trascurabile', () => {
  const type = determineEudrDdsType({
    nonEuCompanyCount: 1,
    countryCount: 1,
    countryRiskCodes: ['RB'],
    isRiskTrascurabile: false,
  })
  assert.equal(type, 'standard')
})

test('standard: AOI gate', () => {
  const type = determineEudrDdsType({
    nonEuCompanyCount: 1,
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

test('getEudrDdsPdfOutcomeLine: standard → DDS standard', () => {
  assert.equal(getEudrDdsPdfOutcomeLine('standard'), EUDR_DDS_STANDARD_PDF_LABEL)
})
