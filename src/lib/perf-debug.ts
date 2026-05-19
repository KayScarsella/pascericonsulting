/** Logs structured perf metrics to Vercel function logs when PERF_DEBUG=1 or on preview. */
export function logRoutePerf(
  route: string,
  metrics: { tab: string; queryCount: number; durationMs: number }
) {
  const enabled =
    process.env.PERF_DEBUG === "1" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.NODE_ENV === "development"
  if (!enabled) return

  console.info(
    `[perf] ${route} tab=${metrics.tab} queries=${metrics.queryCount} durationMs=${metrics.durationMs}`
  )
}
