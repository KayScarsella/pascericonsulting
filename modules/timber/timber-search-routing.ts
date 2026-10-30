type TimberVerificheActionRouteInput = {
  sessionId: string
  riskCompleted: boolean
  isBlocked?: boolean | null
  resumeUrl?: string | null
}

const VALID_TIMBER_PATH_PREFIXES = [
  "/timberRegulation/risk-analysis",
  "/timberRegulation/evaluation",
  "/timberRegulation/valutazione-finale",
] as const

export function normalizeTimberSearchTab(tab: string | null | undefined): "analisi" | "verifiche" {
  return tab === "verifiche" || tab === "verifica" ? "verifiche" : "analisi"
}

function isValidTimberResumeUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return VALID_TIMBER_PATH_PREFIXES.some((prefix) => url.startsWith(prefix))
}

export function resolveTimberVerificheActionUrl({
  sessionId,
  riskCompleted,
  isBlocked,
  resumeUrl,
}: TimberVerificheActionRouteInput): string {
  if (isValidTimberResumeUrl(resumeUrl)) return resumeUrl!
  if (isBlocked || !riskCompleted) {
    return `/timberRegulation/risk-analysis?session_id=${sessionId}`
  }
  return `/timberRegulation/evaluation?session_id=${sessionId}`
}
