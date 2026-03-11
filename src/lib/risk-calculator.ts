/**
 * risk-calculator.ts
 * Pure risk calculation for Timber Regulation "Valutazione Finale"
 * 
 * Calculates risk indices for 11 scored questions and produces
 * an overall risk score (max of all indices).
 * 
 * Risk ≤ 0.30 → "accettabile" (low risk, expiry +12 months)
 * Risk > 0.30 → "non accettabile" (mitigation actions required)
 */

// ── QUESTION IDS ──────────────────────────────────────────────────

/** E) Dati Paese — "probabilità taglio illegale" (rischio_spece) */
const Q_TAGLIO_ILLEGALE = 'adb74c5e-16dc-4e79-97ee-d983d1fdbe19'
/** E) Dati Paese — "probabilità produzione illegale" (indici_corruzione) */
const Q_PRODUZIONE_ILLEGALE = '81a73979-beeb-4f30-b7b5-c42531b3acd2'
/** E) Dati Paese — "conflitti presenti" */
const Q_CONFLITTI = '6cd9fa2e-ea94-4bb5-a32f-aff0a4bd2a87'

/** F) Legislazione — "diritti di prelievo legname" */
const Q_DIRITTI_PRELIEVO = '6f3dd7ab-8bce-439b-a4e1-47d1af4949a8'
/** F) Legislazione — "pagamenti diritti di prelievo" */
const Q_PAGAMENTI_DIRITTI = 'b9ac754b-edd0-4927-a332-bfd20b460320'
/** F) Legislazione — "evidenze rispetto legislazione" */
const Q_EVIDENZE_LEGISLAZIONE = 'e25019e8-15b8-4a56-b291-3f5d04615c42'
/** F) Legislazione — "evidenze rispetto diritti terzi" */
const Q_EVIDENZE_DIRITTI_TERZI = 'a4f3352f-f9d7-4b7e-8f4b-f54485096977'
/** F) Legislazione — "evidenze rispetto commerciale/doganale" */
const Q_EVIDENZE_COMMERCIALE = 'cba7d68c-bba8-452d-8085-36d4b08f0b79'

/** G) Catena — "passaggi proprietà conosciuti" */
const Q_PASSAGGI_PROPRIETA = '666ba370-93d7-4059-9cbe-e57c4f6639d0'
/** G) Catena — "sicurezza non mescolamento" */
const Q_NON_MESCOLAMENTO = 'd6c0b5d1-4f8b-482e-9dc5-7edf4674c7fe'
/** G) Catena — "sanzioni in vigore" */
const Q_SANZIONI = 'a0a0703b-a343-423a-bce8-e9d3912e8e78'

// ── RISK INDEX LOOKUP TABLES ──────────────────────────────────────

/** rischio_spece: high code = high risk */
const RISCHIO_SPECE: Record<string, number> = {
    'EX': 1.00,
    'EW': 0.70,
    'CR': 0.30,
    'EN': 0.00,
    'DD': 0.00,
}

/** indici_corruzione: AA = highest risk */
const INDICI_CORRUZIONE: Record<string, number> = {
    'AA': 1.00,
    'MA': 0.75,
    'MM': 0.50,
    'MB': 0.25,
    'TT': 0.00,
}

/** dati_legali: low reliability = high risk (code → risk) */
const DATI_LEGALI: Record<string, number> = {
    '1': 0.10,   // affidabilità alta
    '2': 0.25,   // affidabilità medio alta
    '3': 0.50,   // affidabilità media
    '4': 0.75,   // affidabilità medio bassa
    '44': 1.00,   // affidabilità bassa
}

/** si/no → risk. For "positive = bad" questions (conflicts, sanctions) */
const SI_IS_BAD: Record<string, number> = { 'si': 1.0, 'no': 0.1 }
/** si/no → risk. For "positive = good" questions (passaggi, mescolamento) */
const NO_IS_BAD: Record<string, number> = { 'si': 0.1, 'no': 1.0 }

// ── ANSWER LABEL LOOKUP (raw code → human-readable label) ─────────

const LABELS_RISCHIO_SPECE: Record<string, string> = {
    'EX': 'Alto rischio illegalità',
    'EW': 'Moderato rischio illegalità',
    'CR': 'Basso rischio illegalità',
    'EN': 'Nessun rischio illegalità',
    'DD': 'Nessuna informazione rilevante',
}

const LABELS_INDICI_CORRUZIONE: Record<string, string> = {
    'AA': 'Alto',
    'MA': 'Medio Alto',
    'MM': 'Medio',
    'MB': 'Medio Basso',
    'TT': 'Basso',
}

const LABELS_DATI_LEGALI: Record<string, string> = {
    '1': 'Affidabilità alta',
    '2': 'Affidabilità medio alta',
    '3': 'Affidabilità media',
    '4': 'Affidabilità medio bassa',
    '44': 'Affidabilità bassa',
}

const LABELS_SI_NO: Record<string, string> = { 'si': 'Sì', 'no': 'No' }

// ── RISK LABELS (for display) ─────────────────────────────────────

export interface RiskDetail {
    questionId: string
    label: string
    shortLabel: string
    riskIndex: number
    answerRaw: string | null
    answerLabel: string
}

/** Risk is acceptable if overall risk ≤ this threshold */
export const RISK_THRESHOLD = 0.30

export const SCORED_QUESTIONS: {
    id: string
    label: string
    shortLabel: string
    lookup: Record<string, number>
    labels: Record<string, string>
}[] = [
        { id: Q_TAGLIO_ILLEGALE, label: 'Probabilità che la specie sia stata tagliata illegalmente nel paese di raccolta', shortLabel: 'Taglio illegale', lookup: RISCHIO_SPECE, labels: LABELS_RISCHIO_SPECE },
        { id: Q_PRODUZIONE_ILLEGALE, label: 'Probabilità di produzione illegale o pratiche illegali nel paese di raccolta', shortLabel: 'Produzione illegale', lookup: INDICI_CORRUZIONE, labels: LABELS_INDICI_CORRUZIONE },
        { id: Q_CONFLITTI, label: 'Conflitti nel paese/regione di raccolta che coinvolgono il legname', shortLabel: 'Conflitti', lookup: SI_IS_BAD, labels: LABELS_SI_NO },
        { id: Q_DIRITTI_PRELIEVO, label: 'Esistenza diritti di prelievo legname entro confini legali', shortLabel: 'Diritti prelievo', lookup: DATI_LEGALI, labels: LABELS_DATI_LEGALI },
        { id: Q_PAGAMENTI_DIRITTI, label: 'Pagamenti diritti di prelievo legname e imposte', shortLabel: 'Pagamenti diritti', lookup: DATI_LEGALI, labels: LABELS_DATI_LEGALI },
        { id: Q_EVIDENZE_LEGISLAZIONE, label: 'Evidenze di rispetto della legislazione ambientale e forestale', shortLabel: 'Legislazione ambient.', lookup: DATI_LEGALI, labels: LABELS_DATI_LEGALI },
        { id: Q_EVIDENZE_DIRITTI_TERZI, label: 'Evidenze di rispetto diritti legittimi di terzi', shortLabel: 'Diritti terzi', lookup: DATI_LEGALI, labels: LABELS_DATI_LEGALI },
        { id: Q_EVIDENZE_COMMERCIALE, label: 'Evidenze di rispetto legislazione commerciale e doganale', shortLabel: 'Commerciale/dogan.', lookup: DATI_LEGALI, labels: LABELS_DATI_LEGALI },
        { id: Q_PASSAGGI_PROPRIETA, label: 'Passaggi di proprietà e destinazione noti fino al luogo di raccolta', shortLabel: 'Passaggi proprietà', lookup: NO_IS_BAD, labels: LABELS_SI_NO },
        { id: Q_NON_MESCOLAMENTO, label: 'Sicurezza circa il non mescolamento dei materiali nella catena', shortLabel: 'Non mescolamento', lookup: NO_IS_BAD, labels: LABELS_SI_NO },
        { id: Q_SANZIONI, label: 'Sanzioni ONU/UE su importazioni/esportazioni di legno', shortLabel: 'Sanzioni', lookup: SI_IS_BAD, labels: LABELS_SI_NO },
    ]

/** Case-insensitive: get human-readable label for a raw stored value (code). */
export function getLabelForRaw(labels: Record<string, string>, raw: string | null): string {
    if (!raw) return '—'
    const n = raw.toLowerCase().trim()
    const key = Object.keys(labels).find((k) => k.toLowerCase() === n)
    return key ? labels[key] : raw
}

/** For the 11 risk questions: normalize input (value or label) to canonical code for storage. Ensures DB always has the code. */
export function getCanonicalValueForRiskQuestion(questionId: string, raw: string): string {
    const sq = SCORED_QUESTIONS.find((q) => q.id === questionId)
    if (!sq) return raw
    const n = raw.trim()
    if (!n) return raw
    const valueKey = Object.keys(sq.lookup).find((k) => k.toLowerCase() === n.toLowerCase())
    if (valueKey) return valueKey
    const labelKey = Object.keys(sq.labels).find((k) => sq.labels[k].toLowerCase() === n.toLowerCase())
    return labelKey ?? raw
}

/** Section grouping for PDF report (E/F/G). Order matches display. */
export const PDF_SECTIONS: { title: string; questionIds: string[] }[] = [
    { title: 'E) Dati Paese', questionIds: [Q_TAGLIO_ILLEGALE, Q_PRODUZIONE_ILLEGALE, Q_CONFLITTI] },
    { title: 'F) Legislazione', questionIds: [Q_DIRITTI_PRELIEVO, Q_PAGAMENTI_DIRITTI, Q_EVIDENZE_LEGISLAZIONE, Q_EVIDENZE_DIRITTI_TERZI, Q_EVIDENZE_COMMERCIALE] },
    { title: 'G) Catena', questionIds: [Q_PASSAGGI_PROPRIETA, Q_NON_MESCOLAMENTO, Q_SANZIONI] },
]

// ── MAIN CALCULATION ──────────────────────────────────────────────

export interface RiskCalculationResult {
    details: RiskDetail[]
    overallRisk: number
    outcome: 'accettabile' | 'non accettabile'
    outcomeDescription: string
    expiryDate: string | null   // ISO date string, only if accettabile
}

/**
 * Calculate risk from a map of questionId → answer_text
 */
export function calculateRisk(
    answersMap: Record<string, string | null>
): RiskCalculationResult {

    const details: RiskDetail[] = SCORED_QUESTIONS.map(q => {
        const raw = answersMap[q.id] ?? null
        const normalised = raw?.toLowerCase().trim() ?? ''
        const lookupKey = normalised ? Object.keys(q.lookup).find((k) => k.toLowerCase() === normalised) : null
        const riskIndex = lookupKey != null ? (q.lookup[lookupKey] ?? 0) : 0
        const labelKey = normalised ? Object.keys(q.labels).find((k) => k.toLowerCase() === normalised) : null
        const answerLabel = labelKey ? q.labels[labelKey] : (raw ?? '—')

        return {
            questionId: q.id,
            label: q.label,
            shortLabel: q.shortLabel,
            riskIndex,
            answerRaw: raw,
            answerLabel,
        }
    })

    const overallRisk = details.length > 0 ? Math.max(...details.map(d => d.riskIndex)) : 0

    const isAccettabile = overallRisk <= RISK_THRESHOLD

    // Expiry: +12 months from today if accettabile
    let expiryDate: string | null = null
    if (isAccettabile) {
        const d = new Date()
        d.setMonth(d.getMonth() + 12)
        expiryDate = d.toISOString().split('T')[0]
    }

    return {
        details,
        overallRisk,
        outcome: isAccettabile ? 'accettabile' : 'non accettabile',
        outcomeDescription: isAccettabile
            ? 'Per questo approvvigionamento il rischio illegalità è accettabile, non sono necessarie azioni.'
            : 'Per questo approvvigionamento il rischio illegalità non è accettabile, sono indispensabili azioni.',
        expiryDate,
    }
}
