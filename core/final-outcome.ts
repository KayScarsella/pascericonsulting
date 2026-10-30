/**
 * Stored `assessment_sessions.final_outcome` for analisi_finale uses
 * "Rischio Trascurabile" / "Rischio Non Trascurabile" (and legacy accettabile wording).
 * Do not use ilike('%trascurabile%') for "good" rows: it also matches "Non Trascurabile".
 */

/** Exact values only — use `.in()` so filters AND cleanly with search `.or()`. */
export const ANALISI_FINALE_GOOD_OUTCOMES = [
  'Rischio Trascurabile',
  'Rischio Accettabile',
  'Rischio accettabile',
] as const

export const ANALISI_FINALE_NEGATIVE_OUTCOMES = [
  'Rischio Non Trascurabile',
  'Rischio Non Accettabile',
  'Rischio non accettabile',
] as const

export function finalOutcomeIsNegative(outcome: string | null | undefined): boolean {
  if (!outcome) return false
  const s = outcome.toLowerCase()
  return s.includes('non trascurabile') || s.includes('non accettabile')
}
