import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/types/supabase"
import type { DdLastRunSnapshot } from "@/features/eudr-due-diligence/aoiRiskGate"
import {
  loadDdLastRunFromStorage,
  persistDdLastRunBackfill,
} from "@/features/eudr-due-diligence/storage/loadDdLastRunFromStorage"
import type { RiskCalculationResult } from "@/lib/eudr-risk-calculator"
import type { EudrDdsType } from "@/types/session"

type FinalizeEudrSessionParams = {
  /** Must be created with cookies() before `after()` — not inside the callback. */
  supabase: SupabaseClient<Database>
  sessionId: string
  sessionUserId: string
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

function pickDdLastRun(
  fromPage: DdLastRunSnapshot | undefined,
  fromDb: DdLastRunSnapshot | undefined
): DdLastRunSnapshot | undefined {
  if (fromPage?.run_id) return fromPage
  if (fromDb?.run_id) return fromDb
  return undefined
}

function buildMergedMetadata(
  stalePageMeta: Record<string, unknown> | null,
  freshDbMeta: Record<string, unknown>,
  patch: Record<string, unknown>,
  ddLastRun?: DdLastRunSnapshot
): Record<string, unknown> {
  const dbDd = freshDbMeta.dd_last_run as DdLastRunSnapshot | undefined
  const effectiveDd = pickDdLastRun(ddLastRun, dbDd) ?? (stalePageMeta?.dd_last_run as DdLastRunSnapshot | undefined)

  return {
    ...(stalePageMeta || {}),
    ...freshDbMeta,
    ...patch,
    ...(effectiveDd ? { dd_last_run: effectiveDd } : {}),
    ...(effectiveDd?.triggers_non_accettabile
      ? { aoi_gate_triggered: true, aoi_gate_reasons: effectiveDd.reasons }
      : patch.aoi_gate_triggered === false
        ? { aoi_gate_triggered: false, aoi_gate_reasons: [] }
        : {}),
  }
}

/** Persists session outcome after the response is sent (non-blocking TTFB). */
export function scheduleEudrSessionFinalize(params: FinalizeEudrSessionParams) {
  const {
    supabase,
    sessionId,
    sessionUserId,
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
  const pageSuggestsAoiGate = Boolean(ddLastRunNormalized?.triggers_non_accettabile)
  const needsAoiSync =
    !needsInitialFinalize && pageSuggestsAoiGate && sessionFinalOutcome === "Rischio Trascurabile"

  if (!needsInitialFinalize && !needsAoiSync && !pageSuggestsAoiGate) return

  after(async () => {
    const { data: freshRow } = await supabase
      .from("assessment_sessions")
      .select("metadata, final_outcome, status")
      .eq("id", sessionId)
      .single()

    const freshMeta = (freshRow?.metadata as Record<string, unknown>) || {}
    let effectiveDd = pickDdLastRun(
      ddLastRunNormalized,
      freshMeta.dd_last_run as DdLastRunSnapshot | undefined
    )

    if (!effectiveDd?.run_id) {
      const fromStorage = await loadDdLastRunFromStorage(supabase, sessionUserId, sessionId)
      if (fromStorage) {
        effectiveDd = fromStorage
        await persistDdLastRunBackfill(supabase, sessionId, fromStorage, freshMeta)
      }
    }

    const outcomeFromGate = effectiveDd?.triggers_non_accettabile
      ? "Rischio Non Trascurabile"
      : result.outcome === "accettabile"
        ? "Rischio Trascurabile"
        : "Rischio Non Trascurabile"

    const riskPatch = {
      risk_score: result.overallRisk,
      risk_details: result.details.map((d) => ({
        shortLabel: d.shortLabel,
        riskIndex: d.riskIndex,
      })),
      expiry_date: effectiveDd?.triggers_non_accettabile ? null : result.expiryDate,
      dds_type: ddsType,
      dds_determined_at: new Date().toISOString(),
      dds_non_eu_companies: ddsOutcome.ddsInputs.nonEuCompanyCount,
      dds_country_count: ddsOutcome.ddsInputs.countryCount,
      dds_country_risks: ddsOutcome.ddsInputs.countryRiskCodes,
      outcome_description: displayOutcomeDescription,
    }

    if (needsInitialFinalize || needsAoiSync || pageSuggestsAoiGate) {
      const mergedMeta = buildMergedMetadata(metadata, freshMeta, {
        ...riskPatch,
        completed_at: freshMeta.completed_at || new Date().toISOString(),
      }, effectiveDd)

      await supabase
        .from("assessment_sessions")
        .update({
          status: "completed",
          final_outcome: outcomeFromGate,
          metadata: mergedMeta as Json,
        })
        .eq("id", sessionId)
    }
  })
}
