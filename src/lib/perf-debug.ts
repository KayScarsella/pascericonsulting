export type RoutePerfMetrics = {
  tab: string
  queryCount: number
  durationMs: number
  authMs?: number
  dbMs?: number
  storageMs?: number
}

export function isPerfDebugEnabled(): boolean {
  return (
    process.env.PERF_DEBUG === "1" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV === "development"
  )
}

/** Logs structured perf metrics to Vercel function logs when PERF_DEBUG=1 or on preview. */
export function logRoutePerf(route: string, metrics: RoutePerfMetrics) {
  if (!isPerfDebugEnabled()) return

  const extras = [
    metrics.authMs != null ? `authMs=${metrics.authMs}` : null,
    metrics.dbMs != null ? `dbMs=${metrics.dbMs}` : null,
    metrics.storageMs != null ? `storageMs=${metrics.storageMs}` : null,
  ]
    .filter(Boolean)
    .join(" ")

  console.info(
    `[perf] ${route} tab=${metrics.tab} queries=${metrics.queryCount} durationMs=${metrics.durationMs}${extras ? ` ${extras}` : ""}`
  )
}
