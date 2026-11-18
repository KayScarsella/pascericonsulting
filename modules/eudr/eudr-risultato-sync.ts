import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@/types/supabase"
import {
  aoiGateStillFailing,
  applyAoiGateToEudrRiskResult,
  type DdLastRunSnapshot,
} from "@/features/eudr-due-diligence/aoiRiskGate"
import {
  isDdLastRunMetadataComplete,
  normalizeDdLastRunForOutcome,
  resolveDdLastRun,
} from "@/features/eudr-due-diligence/storage/loadDdLastRunFromStorage"
import { computeEudrDdsOutcome, type EudrDdsResponseMaps } from "@/lib/eudr-dds-inputs"
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
      chainComplexity: 'semplice' | 'non_semplice' | null
      countryCount: number
      countryRiskCodes: string[]
    }
  }
  ddLastRunNormalized?: DdLastRunSnapshot
  /** Questionnaire score before the AOI gate. Used if storage still has to resolve the snapshot. */
  baseResult?: RiskCalculationResult
  aoiMitigated?: boolean
  parentSessionId?: string | null
  responses?: EudrDdsResponseMaps
  storageResolutionNeeded?: boolean
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
    baseResult,
    aoiMitigated,
    parentSessionId,
    responses,
    storageResolutionNeeded,
  } = params

  const needsInitialFinalize = sessionStatus !== "completed" || !sessionFinalOutcome
  const pageSuggestsAoiGate = Boolean(ddLastRunNormalized?.triggers_non_accettabile)
  const aoiStillFailing = aoiGateStillFailing(ddLastRunNormalized, result)
  const needsAoiSync =
    !needsInitialFinalize && aoiStillFailing && sessionFinalOutcome === "Rischio Trascurabile"

  if (!needsInitialFinalize && !needsAoiSync && !pageSuggestsAoiGate && !storageResolutionNeeded) return

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

    if (!isDdLastRunMetadataComplete(effectiveDd)) {
      const resolved = await resolveDdLastRun(
        supabase,
        sessionUserId,
        sessionId,
        effectiveDd ?? null
      )
      if (resolved) effectiveDd = normalizeDdLastRunForOutcome(resolved)
    } else {
      effectiveDd = normalizeDdLastRunForOutcome(effectiveDd)
    }

    const snapshotKey = (dd?: DdLastRunSnapshot) =>
      dd?.run_id
        ? [
            dd.run_id,
            dd.triggers_non_accettabile === true,
            dd.tendenza_deforestazione === true,
            dd.tendenza_rule_applied === true,
            (dd.reasons || []).join("\n"),
          ].join("|")
        : ""
    const gateChanged = snapshotKey(effectiveDd) !== snapshotKey(ddLastRunNormalized)

    let resultUsed = result
    let ddsTypeUsed = ddsType
    let descriptionUsed = displayOutcomeDescription
    let ddsUsed = ddsOutcome
    if (gateChanged && baseResult) {
      const mitigated = aoiMitigated === true
      resultUsed = applyAoiGateToEudrRiskResult(baseResult, effectiveDd, { mitigated })
      if (responses) {
        const recomputed = await computeEudrDdsOutcome(
          supabase,
          sessionId,
          parentSessionId ?? null,
          resultUsed,
          effectiveDd,
          { aoiMitigated: mitigated, responses }
        )
        ddsTypeUsed = recomputed.ddsType
        descriptionUsed = recomputed.outcomeDescription
        ddsUsed = recomputed
      }
    }

    const gateStillFailing = aoiGateStillFailing(effectiveDd, resultUsed)
    const outcomeFromGate = gateStillFailing
      ? "Rischio Non Trascurabile"
      : resultUsed.outcome === "accettabile"
        ? "Rischio Trascurabile"
        : "Rischio Non Trascurabile"

    const riskPatch = {
      risk_score: resultUsed.overallRisk,
      risk_details: resultUsed.details.map((d) => ({
        shortLabel: d.shortLabel,
        riskIndex: d.riskIndex,
      })),
      expiry_date: gateStillFailing ? null : resultUsed.expiryDate,
      dds_type: ddsTypeUsed,
      dds_determined_at: new Date().toISOString(),
      dds_chain_complexity: ddsUsed.ddsInputs.chainComplexity,
      dds_country_count: ddsUsed.ddsInputs.countryCount,
      dds_country_risks: ddsUsed.ddsInputs.countryRiskCodes,
      outcome_description: descriptionUsed,
    }

    if (needsInitialFinalize || needsAoiSync || pageSuggestsAoiGate || gateChanged) {
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
