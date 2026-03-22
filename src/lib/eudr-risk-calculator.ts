/**
 * eudr-risk-calculator.ts
 * EUDR "Valutazione Finale" risk calculation aligned with legacy PHP $labels / Risk_Index_*.
 *
 * - Affidabilità (1,2,3,4,44): same DATI_LEGALI mapping as timber risk-calculator.
 * - Conflitti / Segnalazioni / Sanzioni: si → 1, no → 0.30 (PHP).
 * - Passaggi proprietà / Non mescolamento: no → 1, si → 0.30 (PHP).
 * - Rischio paese: RB/RS/RA → low/standard/high (RS = 0.30 per rischio_paese.csv). RM kept as legacy alias.
 *
 * overallRisk = max(all indices); ≤ 0.30 → accettabile + expiry +12 months.
 */

import type { RiskDetail, RiskCalculationResult } from "@/lib/risk-calculator"
import { RISK_THRESHOLD } from "@/lib/risk-calculator"

// Re-export for EUDR pages
export { RISK_THRESHOLD }
export type { RiskDetail, RiskCalculationResult }

// ── QUESTION IDS (EUDR Valutazione Finale – final analysis) ─────────────
// Sezioni list D/E — id domanda univoci da Supabase (non section_id).

/** 1) Paese di raccolta del legname — section 8e3c8459…, async_select country */
const Q_PAESE_RACCOLTA = "d5e6f7a8-b9c0-4d1e-9f2a-3b4c5d6e7f54"
/** Nome della specie — section 9c2f5b17…, async_select species */
const Q_SPECIE = "ce302e2d-e894-4cc1-bc8b-9b580e163e7f"

/** 2) Rischio paese – RB / RS / RA (aligned with country_risk enum) */
const Q_RISCHIO_PAESE = "e8f9a0b1-c2d3-4e4f-8a9b-0c1d2e3f4a65"
/** 6) Trasformazione foresta/piantagione ad uso agricolo post 31-12-2020 */
const Q_TRASFORMAZIONE = "b0c1d2e3-f4a5-4b6c-8d7e-9f0a1b2c3d09"
/** 7) Degrado foreste dal 31/12/2020 */
const Q_DEGRADO = "e1f2a3b4-c5d6-4e7f-8a9b-0c1d2e3f4a10"
/** 8) Conflitti raccolta legname */
const Q_CONFLITTI = "f4a5b6c7-d8e9-4f0a-8b1c-2d3e4f5a6b21"
/** 1) Requisiti salute e sicurezza sul lavoro */
const Q_SICUREZZA_LAVORO = "a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c31"
/** 2) Diritti umani rispettati */
const Q_DIRITTI_UMANI = "d7e8f9a0-b1c2-4d3e-9f4a-5b6c7d8e9f42"
/** 3) FPIC / Popoli tradizionali */
const Q_FPIC = "b8c9d0e1-f2a3-4b4c-8d5e-9f0a1b2c3d53"
/** 4) Segnalazioni popolazioni indigene */
const Q_SEGNALAZIONI = "e2f3a4b5-c6d7-4e8f-9a0b-1c2d3e4f5a64"
/** 1) Evidenze diritti uso suolo */
const Q_USO_SUOLO = "d3e4f5a6-b7c8-4d9e-8f0a-1b2c3d4e5f81"
/** 2) Evidenze tutela ambiente */
const Q_TUTELA_AMBIENTE = "f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f7a8b92"
/** 3) Norme foreste / biodiversità */
const Q_NORME_FORESTE = "a4b5c6d7-e8f9-4a0b-9c1d-2e3f4a5b6c03"
/** 4) Rispetto legislazione produzione */
const Q_RISPETTO_LEGISLAZIONE = "c7d8e9f0-a1b2-4c3d-9e4f-5a6b7c8d9e14"
/** 5) Leggi status giuridico (fiscale, anticorruzione, doganale) */
const Q_STATUS_GIURIDICO = "e8f9a0b1-c2d3-4e4f-8a9b-5c6d7e8f9a25"
/** 6) Deforestazione zero */
const Q_DEFORESTAZIONE_ZERO = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d36"
/** 7) Preoccupazioni corruzione / falsificazione / applicazione legge */
const Q_PREOCCUPAZIONI = "d5e6f7a8-b9c0-4d1e-9f2a-3c4d5e6f7a47"
/** 1) Passaggi proprietà noti */
const Q_PASSAGGI = "e9f0a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a58"
/** 2) Sicurezza non mescolamento */
const Q_NON_MESCOLAMENTO = "b3c4d5e6-f7a8-4b9c-9d0e-1f2a3b4c5d69"
/** 3) Sanzioni ONU/UE legno */
const Q_SANZIONI = "d6e7f8a9-b0c1-4d2e-9f3a-4b5c6d7e8f70"

/** EUDR prefill — id allineati all’export Supabase (stesso pattern Timber Q_COUNTRY / Q_SPECIES). */
export const EUDR_COUNTRY_PREFILL_QUESTION_IDS = {
  PAESE_RACCOLTA: Q_PAESE_RACCOLTA,
  SPECIE: Q_SPECIE,
  RISCHIO_PAESE: Q_RISCHIO_PAESE,
  CONFLITTI: Q_CONFLITTI,
  SANZIONI: Q_SANZIONI,
} as const

// ── LOOKUPS ─────────────────────────────────────────────────────────────

/** Same as timber DATI_LEGALI – low reliability = high risk */
const DATI_LEGALI: Record<string, number> = {
  "1": 0.1,
  "2": 0.25,
  "3": 0.5,
  "4": 0.75,
  "44": 1.0,
}

const LABELS_DATI_LEGALI: Record<string, string> = {
  "1": "Affidabilità alta",
  "2": "Affidabilità medio alta",
  "3": "Affidabilità media",
  "4": "Affidabilità medio bassa",
  "44": "Affidabilità bassa",
}

/** PHP: Conflitti/Sanzioni/Segnalazioni si → 1, no → 0.30 */
const SI_BAD_EUDR: Record<string, number> = {
  si: 1.0,
  no: 0.3,
}

/** Segnalazioni: non_applicabile → low risk */
const SEGNALAZIONI_LOOKUP: Record<string, number> = {
  si: 1.0,
  no: 0.3,
  non_applicabile: 0.1,
}

const LABELS_SI_NO: Record<string, string> = { si: "Sì", no: "No" }
const LABELS_SEGNALAZIONI: Record<string, string> = {
  si: "Sì",
  no: "No",
  non_applicabile: "Non applicabile",
}

/** PHP: Passaggi/Mescolamento – no → 1, si → 0.30 */
const NO_BAD_EUDR: Record<string, number> = {
  si: 0.3,
  no: 1.0,
}

/** Rischio paese – RB/RS/RA from rischio_paese.csv (RB 0.10, RS 0.30, RA 1.00). RM legacy only. */
const RISCHIO_PAESE_LOOKUP: Record<string, number> = {
  RB: 0.1,
  RS: 0.3,
  RA: 1.0,
  /** Legacy: old question used "Rischio Medio" = RM; keep so existing rows still score until migrated */
  RM: 0.55,
}

const LABELS_RISCHIO_PAESE: Record<string, string> = {
  RB: "Rischio Basso",
  RS: "Rischio Standard",
  RA: "Rischio Alto",
  RM: "Rischio Medio",
}

// ── SCORED QUESTIONS (order = display / chart order) ────────────────────

export const EUDR_SCORED_QUESTIONS: {
  id: string
  label: string
  shortLabel: string
  lookup: Record<string, number>
  labels: Record<string, string>
}[] = [
  {
    id: Q_RISCHIO_PAESE,
    label: "Rischio paese",
    shortLabel: "Rischio paese",
    lookup: RISCHIO_PAESE_LOOKUP,
    labels: LABELS_RISCHIO_PAESE,
  },
  {
    id: Q_TRASFORMAZIONE,
    label:
      "Non è prevista nessuna trasformazione della foresta o piantagione ad uso agricolo dal 31 dicembre 2020",
    shortLabel: "Trasformazione uso agricolo",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_DEGRADO,
    label: "Dal 31/12/2020 non si registra degrado delle foreste",
    shortLabel: "Degrado foreste",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_CONFLITTI,
    label:
      "Sono presenti conflitti nel paese/regione subnazionale di raccolta, che coinvolgono la raccolta del legname",
    shortLabel: "Conflitti",
    lookup: SI_BAD_EUDR,
    labels: LABELS_SI_NO,
  },
  {
    id: Q_SICUREZZA_LAVORO,
    label:
      "Sono rispettati i requisiti legali relativi alla salute e alla sicurezza sul lavoro",
    shortLabel: "Sicurezza sul lavoro",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_DIRITTI_UMANI,
    label:
      "I diritti umani tutelati dal diritto internazionale, così come sanciti dal diritto nazionale, vengono rispettati",
    shortLabel: "Diritti umani",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_FPIC,
    label:
      "I diritti dei Popoli Tradizionali, popolazioni indigene e le comunità locali (FPIC) sono rispettati",
    shortLabel: "FPIC / Popoli tradizionali",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_SEGNALAZIONI,
    label:
      "Esistono segnalazioni motivate da popolazioni indigene/tradizionali/comunità locali sull'uso o proprietà della superficie",
    shortLabel: "Segnalazioni popoli",
    lookup: SEGNALAZIONI_LOOKUP,
    labels: LABELS_SEGNALAZIONI,
  },
  {
    id: Q_USO_SUOLO,
    label: "Esistenza di evidenze sui diritti d'uso del suolo",
    shortLabel: "Evidenze uso suolo",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_TUTELA_AMBIENTE,
    label: "Esistenza di evidenze sui diritti di tutela dell'ambiente",
    shortLabel: "Tutela ambiente",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_NORME_FORESTE,
    label:
      "Evidenza su norme relative alle foreste, gestione e conservazione biodiversità (racc. legno)",
    shortLabel: "Norme foreste",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_RISPETTO_LEGISLAZIONE,
    label:
      "Informazioni probanti che le materie prime sono state prodotte nel rispetto della legislazione del paese",
    shortLabel: "Rispetto legislazione",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_STATUS_GIURIDICO,
    label:
      "Evidenze su leggi applicabili (fiscale, anticorruzione, commerciale, doganale) sullo status giuridico della zona",
    shortLabel: "Status giuridico",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_DEFORESTAZIONE_ZERO,
    label:
      "Informazioni probanti che i prodotti sono a deforestazione zero",
    shortLabel: "Deforestazione zero",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_PREOCCUPAZIONI,
    label:
      "Preoccupazioni su corruzione, falsificazione documenti, carenze applicazione legge (paese origine)",
    shortLabel: "Preoccupazioni paese",
    lookup: DATI_LEGALI,
    labels: LABELS_DATI_LEGALI,
  },
  {
    id: Q_PASSAGGI,
    label:
      "Sono noti tutti i passaggi di proprietà e di destinazione fino al luogo di raccolta del legname",
    shortLabel: "Passaggi proprietà",
    lookup: NO_BAD_EUDR,
    labels: LABELS_SI_NO,
  },
  {
    id: Q_NON_MESCOLAMENTO,
    label:
      "Ragionevole sicurezza sul non mescolamento dei materiali in tutta la catena di fornitura",
    shortLabel: "Non mescolamento",
    lookup: NO_BAD_EUDR,
    labels: LABELS_SI_NO,
  },
  {
    id: Q_SANZIONI,
    label:
      "Sanzioni ONU/UE in vigore su import/export legno (paesi raccolta/transito/fornitori)",
    shortLabel: "Sanzioni",
    lookup: SI_BAD_EUDR,
    labels: LABELS_SI_NO,
  },
]

export function getEudrLabelForRaw(
  labels: Record<string, string>,
  raw: string | null
): string {
  if (!raw) return "—"
  const n = raw.toLowerCase().trim()
  const key = Object.keys(labels).find((k) => k.toLowerCase() === n)
  return key ? labels[key] : raw
}

export function getCanonicalValueForEudrRiskQuestion(
  questionId: string,
  raw: string
): string {
  const sq = EUDR_SCORED_QUESTIONS.find((q) => q.id === questionId)
  if (!sq) return raw
  const n = raw.trim()
  if (!n) return raw
  const valueKey = Object.keys(sq.lookup).find(
    (k) => k.toLowerCase() === n.toLowerCase()
  )
  if (valueKey) return valueKey
  const labelKey = Object.keys(sq.labels).find(
    (k) => sq.labels[k].toLowerCase() === n.toLowerCase()
  )
  return labelKey ?? raw
}

/**
 * Calculate EUDR risk from questionId → answer_text map.
 * Merges parent + child session responses before calling (caller responsibility).
 */
export function calculateEudrRisk(
  answersMap: Record<string, string | null>
): RiskCalculationResult {
  const details: RiskDetail[] = EUDR_SCORED_QUESTIONS.map((q) => {
    const raw = answersMap[q.id] ?? null
    const normalised = raw?.toLowerCase().trim() ?? ""
    const lookupKey = normalised
      ? Object.keys(q.lookup).find((k) => k.toLowerCase() === normalised)
      : null
    const riskIndex =
      lookupKey != null ? (q.lookup[lookupKey] ?? 0) : 0
    const labelKey = normalised
      ? Object.keys(q.labels).find((k) => k.toLowerCase() === normalised)
      : null
    const answerLabel = labelKey
      ? q.labels[labelKey]
      : raw ?? "—"

    return {
      questionId: q.id,
      label: q.label,
      shortLabel: q.shortLabel,
      riskIndex,
      answerRaw: raw,
      answerLabel,
    }
  })

  const overallRisk =
    details.length > 0 ? Math.max(...details.map((d) => d.riskIndex)) : 0
  const isAccettabile = overallRisk <= RISK_THRESHOLD

  let expiryDate: string | null = null
  if (isAccettabile) {
    const d = new Date()
    d.setMonth(d.getMonth() + 12)
    expiryDate = d.toISOString().split("T")[0]
  }

  return {
    details,
    overallRisk,
    outcome: isAccettabile ? "accettabile" : "non accettabile",
    outcomeDescription: isAccettabile
      ? "Per questo approvvigionamento il rischio deforestazione è trascurabile, non sono necessarie azioni di mitigazione."
      : "Per questo approvvigionamento il rischio deforestazione è non trascurabile, sono necessarie azioni di mitigazione.",
    expiryDate,
  }
}
