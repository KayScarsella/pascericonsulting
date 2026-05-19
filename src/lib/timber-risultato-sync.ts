import { after } from "next/server"
import { createClient } from "@/utils/supabase/server"
import type { RiskCalculationResult } from "@/lib/risk-calculator"

type FinalizeTimberSessionParams = {
  sessionId: string
  sessionStatus: string | null
  sessionFinalOutcome: string | null
  metadata: Record<string, unknown> | null
  result: RiskCalculationResult
}

/** Persists session outcome after the response is sent (non-blocking TTFB). */
export function scheduleTimberSessionFinalize(params: FinalizeTimberSessionParams) {
  const { sessionId, sessionStatus, sessionFinalOutcome, metadata, result } = params

  if (sessionStatus === "completed" && sessionFinalOutcome) return

  after(async () => {
    const supabase = await createClient()
    const updatePayload: Record<string, unknown> = {
      status: "completed",
      final_outcome:
        result.outcome === "accettabile"
          ? "Rischio Trascurabile"
          : "Rischio Non Trascurabile",
      metadata: {
        ...(metadata || {}),
        risk_score: result.overallRisk,
        risk_details: result.details.map((d) => ({
          shortLabel: d.shortLabel,
          riskIndex: d.riskIndex,
        })),
        completed_at: new Date().toISOString(),
        expiry_date: result.expiryDate,
      },
    }
    await supabase.from("assessment_sessions").update(updatePayload).eq("id", sessionId)
  })
}
