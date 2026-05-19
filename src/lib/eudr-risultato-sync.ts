import { after } from "next/server"
import { createClient } from "@/utils/supabase/server"
import type { DdLastRunSnapshot } from "@/features/eudr-due-diligence/aoiRiskGate"
import type { RiskCalculationResult } from "@/lib/eudr-risk-calculator"
import type { EudrDdsType } from "@/types/session"

type FinalizeEudrSessionParams = {
  sessionId: string
  sessionStatus: string | null
  sessionFinalOutcome: string | null
  metadata: Record<string, unknown> | null
  result: RiskCalculationResult
  ddsType: EudrDdsType
  displayOutcomeDescription: string
  ddsOutcome: {
    ddsInputs: {
      nonEuCompanyCount: number
      countryCount: number
      countryRiskCodes: string[]
    }
  }
  ddLastRunNormalized?: DdLastRunSnapshot
}

/** Persists session outcome after the response is sent (non-blocking TTFB). */
export function scheduleEudrSessionFinalize(params: FinalizeEudrSessionParams) {
  const {
    sessionId,
    sessionStatus,
    sessionFinalOutcome,
    metadata,
    result,
    ddsType,
    displayOutcomeDescription,
    ddsOutcome,
    ddLastRunNormalized,
  } = params

  const needsInitialFinalize = sessionStatus !== "completed" || !sessionFinalOutcome
  const needsAoiSync =
    !needsInitialFinalize &&
    Boolean(ddLastRunNormalized?.triggers_non_accettabile) &&
    sessionFinalOutcome === "Rischio Trascurabile"

  if (!needsInitialFinalize && !needsAoiSync) return

  after(async () => {
    const supabase = await createClient()

    if (needsInitialFinalize) {
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
          dds_type: ddsType,
          dds_determined_at: new Date().toISOString(),
          dds_non_eu_companies: ddsOutcome.ddsInputs.nonEuCompanyCount,
          dds_country_count: ddsOutcome.ddsInputs.countryCount,
          dds_country_risks: ddsOutcome.ddsInputs.countryRiskCodes,
          outcome_description: displayOutcomeDescription,
          ...(ddLastRunNormalized?.triggers_non_accettabile
            ? {
                aoi_gate_triggered: true,
                aoi_gate_reasons: ddLastRunNormalized.reasons,
              }
            : {}),
        },
      }
      await supabase.from("assessment_sessions").update(updatePayload).eq("id", sessionId)
      return
    }

    if (needsAoiSync) {
      await supabase
        .from("assessment_sessions")
        .update({
          final_outcome: "Rischio Non Trascurabile",
          metadata: {
            ...(metadata || {}),
            risk_score: result.overallRisk,
            risk_details: result.details.map((d) => ({
              shortLabel: d.shortLabel,
              riskIndex: d.riskIndex,
            })),
            expiry_date: null,
            aoi_gate_triggered: true,
            aoi_gate_reasons: ddLastRunNormalized?.reasons,
            aoi_gate_synced_at: new Date().toISOString(),
          },
        })
        .eq("id", sessionId)
    }
  })
}
