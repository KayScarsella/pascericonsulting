import type { EudrDdsType } from '@/types/session'

export type { EudrDdsType }

export const EUDR_DDS_SEMPLIFICATA_APPENDIX =
  "Dichiarazione di Dovuta Diligenza Semplificata ai sensi dell'Articolo 13 del Regolamento (UE) 2023/1115 (EUDR)"

export const EUDR_DDS_STANDARD_LABEL =
  'Dichiarazione di Dovuta Diligenza ai sensi degli articoli 10–11 del Regolamento (UE) 2023/1115 (EUDR)'

export const EUDR_DDS_STANDARD_PDF_LABEL = 'DDS standard'

const MAX_NON_EU_COMPANIES_SEMPLIFICATA = 5
const MAX_COUNTRIES_SEMPLIFICATA = 2

export type EudrDdsDeterminationInput = {
  nonEuCompanyCount: number
  countryCount: number
  countryRiskCodes: string[]
  isRiskTrascurabile: boolean
  aoiGateTriggered?: boolean
}

export function determineEudrDdsType(input: EudrDdsDeterminationInput): EudrDdsType {
  if (input.aoiGateTriggered) return 'standard'
  if (input.nonEuCompanyCount > MAX_NON_EU_COMPANIES_SEMPLIFICATA) return 'standard'
  if (input.countryCount > MAX_COUNTRIES_SEMPLIFICATA) return 'standard'
  if (!input.isRiskTrascurabile) return 'standard'

  const allLowRisk =
    input.countryCount > 0 &&
    input.countryRiskCodes.every((code) => code.toUpperCase() === 'RB')

  if (
    input.countryCount <= MAX_COUNTRIES_SEMPLIFICATA &&
    allLowRisk &&
    input.isRiskTrascurabile
  ) {
    return 'semplificata'
  }

  return 'standard'
}

export function getEudrDdsDisplayLabel(ddsType: EudrDdsType): string {
  return ddsType === 'semplificata' ? 'DDS Semplificata (Art. 13)' : 'DDS Standard (Art. 10–11)'
}

export function getEudrDdsPdfOutcomeLine(ddsType: EudrDdsType): string {
  return ddsType === 'semplificata'
    ? EUDR_DDS_SEMPLIFICATA_APPENDIX
    : EUDR_DDS_STANDARD_PDF_LABEL
}

/** Rimuove appendix DDS già inclusi in outcomeDescription per evitare duplicati nel PDF. */
export function stripEudrDdsAppendix(description: string): string {
  let text = (description || '').trim()
  for (const appendix of [EUDR_DDS_SEMPLIFICATA_APPENDIX, EUDR_DDS_STANDARD_LABEL]) {
    if (text.includes(appendix)) {
      text = text.replace(appendix, '').replace(/\n{2,}/g, '\n\n').trim()
    }
  }
  return text
}

/** Append DDS regulatory line(s) to the risk outcome description when risk is trascurabile. */
export function buildEudrOutcomeDescription(
  baseDescription: string,
  ddsType: EudrDdsType,
  isRiskTrascurabile: boolean
): string {
  const base = (baseDescription || '').trim()
  if (!isRiskTrascurabile) return base

  const appendix =
    ddsType === 'semplificata' ? EUDR_DDS_SEMPLIFICATA_APPENDIX : EUDR_DDS_STANDARD_LABEL

  if (!appendix) return base
  if (base.includes(appendix)) return base
  return `${base}\n\n${appendix}`
}
