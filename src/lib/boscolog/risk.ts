export type RiskTriState = 'yes' | 'no' | ''

export type BoscologRiskAnswers = {
  supplierVerified: RiskTriState
  permitsComplete: RiskTriState
  geolocAvailable: RiskTriState
  protectedArea: RiskTriState
  pastNonCompliance: RiskTriState
  chainSeparated: RiskTriState
  ddDocs: RiskTriState
}

export type BoscologRiskOutcome = 'ok' | 'monitora' | 'blocca' | ''

export type BoscologRisk = {
  assessedAt: string
  assessor: string
  outcome: BoscologRiskOutcome | string
  notes: string
  mitigation: string
  locked: boolean
  lockedAt: string
  lockedBy: string
  answers: BoscologRiskAnswers
}

export type BoscologRiskLevel = 'Basso' | 'Medio' | 'Alto'

export type RiskComputeResult = {
  score: number
  level: BoscologRiskLevel
  missing: number
}

const EMPTY_ANSWERS: BoscologRiskAnswers = {
  supplierVerified: '',
  permitsComplete: '',
  geolocAvailable: '',
  protectedArea: '',
  pastNonCompliance: '',
  chainSeparated: '',
  ddDocs: '',
}

function asTri(v: unknown): RiskTriState {
  if (v === 'yes' || v === 'si') return 'yes'
  if (v === 'no') return 'no'
  return ''
}

export function normalizeRisk(raw: unknown, hasGeo = false): BoscologRisk {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const answersRaw =
    r.answers && typeof r.answers === 'object'
      ? (r.answers as Record<string, unknown>)
      : {}

  const answers: BoscologRiskAnswers = {
    supplierVerified: asTri(answersRaw.supplierVerified),
    permitsComplete: asTri(answersRaw.permitsComplete),
    geolocAvailable: asTri(answersRaw.geolocAvailable),
    protectedArea: asTri(answersRaw.protectedArea),
    pastNonCompliance: asTri(answersRaw.pastNonCompliance),
    chainSeparated: asTri(answersRaw.chainSeparated),
    ddDocs: asTri(answersRaw.ddDocs),
  }

  if (!answers.geolocAvailable && hasGeo) {
    answers.geolocAvailable = 'yes'
  }

  return {
    assessedAt: String(r.assessedAt ?? ''),
    assessor: String(r.assessor ?? ''),
    outcome: String(r.outcome ?? ''),
    notes: String(r.notes ?? ''),
    mitigation: String(r.mitigation ?? ''),
    locked: Boolean(r.locked),
    lockedAt: String(r.lockedAt ?? ''),
    lockedBy: String(r.lockedBy ?? ''),
    answers,
  }
}

function triToVal(x: RiskTriState): number | null {
  if (x === 'yes') return 1
  if (x === 'no') return 0
  return null
}

/**
 * Port of prototype riskCompute — score 0–100 → Basso/Medio/Alto.
 */
export function riskCompute(input: {
  origin_eu?: string | null
  risk?: unknown
  hasGeo?: boolean
}): RiskComputeResult {
  const risk = normalizeRisk(input.risk, Boolean(input.hasGeo))
  const a = risk.answers

  const weights: [keyof BoscologRiskAnswers, number, 'no' | 'yes'][] = [
    ['supplierVerified', 15, 'no'],
    ['permitsComplete', 15, 'no'],
    ['geolocAvailable', 15, 'no'],
    ['protectedArea', 15, 'yes'],
    ['pastNonCompliance', 15, 'yes'],
    ['chainSeparated', 10, 'no'],
    ['ddDocs', 10, 'no'],
  ]

  let score = 0
  let missing = 0

  if (input.origin_eu === 'extraUE') score += 20

  for (const [k, w, dir] of weights) {
    const v = triToVal(a[k])
    if (v === null) {
      score += w * 0.5
      missing += 1
      continue
    }
    if (dir === 'no' && v === 0) score += w
    if (dir === 'yes' && v === 1) score += w
  }

  score = Math.max(0, Math.min(100, Math.round(score)))
  const level: BoscologRiskLevel = score <= 25 ? 'Basso' : score <= 60 ? 'Medio' : 'Alto'
  return { score, level, missing }
}

export function riskLevelBadgeClass(level: string | null | undefined): string {
  if (level === 'Alto') return 'bg-red-100 text-red-800 hover:bg-red-100'
  if (level === 'Medio') return 'bg-amber-100 text-amber-800 hover:bg-amber-100'
  if (level === 'Basso') return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100'
  return 'bg-slate-100 text-slate-700 hover:bg-slate-100'
}

export function emptyRisk(): BoscologRisk {
  return normalizeRisk({ answers: { ...EMPTY_ANSWERS } })
}
