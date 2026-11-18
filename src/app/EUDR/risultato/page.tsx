import { Suspense } from "react"
import { getToolAccess } from "@/lib/tool-auth"
import { getSessionContext } from "@/lib/session-context"
import { getCachedEudrSessionResponses } from "@/lib/eudr-cache"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { redirect } from "next/navigation"
import { logRoutePerf } from "@/lib/perf-debug"
import { scheduleEudrSessionFinalize } from "@/lib/eudr-risultato-sync"
import {
  EudrRisultatoMitigationDeferred,
  EudrRisultatoPdfDeferred,
  EudrRisultatoResolvedShell,
  type EudrRisultatoDeferredProps,
} from "@/components/eudr/EudrRisultatoDeferred"
import { EudrRisultatoPdfSkeleton } from "@/components/eudr/EudrRisultatoDeferredSkeleton"
import {
  EudrRisultatoOutcomeSections,
  toEudrRisultatoOutcomeView,
} from "@/components/eudr/EudrRisultatoOutcomeSections"
import { ShieldAlert, ArrowLeft } from "lucide-react"
import Link from "next/link"

import {
  calculateEudrRisk,
  EUDR_COUNTRY_PREFILL_QUESTION_IDS,
} from "@/lib/eudr-risk-calculator"
import {
  applyAoiGateToEudrRiskResult,
  isAoiGateMitigatedForSession,
  type DdLastRunSnapshot,
} from "@/features/eudr-due-diligence/aoiRiskGate"
import type { RiskCalculationResult } from "@/lib/eudr-risk-calculator"
import { computeEudrDdsOutcome } from "@/lib/eudr-dds-inputs"
import type { EudrDdsType } from "@/types/session"
import { createEudrRisultatoDeferredLoader } from "@/lib/eudr-risultato-deferred-data"
import {
  isDdLastRunMetadataComplete,
  normalizeDdLastRunForOutcome,
} from "@/features/eudr-due-diligence/storage/loadDdLastRunFromStorage"

export default async function EudrRisultatoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const perfStart = Date.now()
  let queryCount = 0

  const params = await searchParams
  const sessionId = params.session_id as string | undefined

  const { role, userId } = await getToolAccess(EUDR_TOOL_ID)
  const sessionCtx = await getSessionContext()
  if (!sessionCtx) redirect("/login")
  const supabase = sessionCtx.supabase
  if (!role || role === "standard") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="p-4 bg-amber-50 rounded-full">
          <ShieldAlert className="w-12 h-12 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Accesso Limitato</h1>
        <p className="text-slate-600 max-w-md">
          I risultati sono disponibili solo per utenti Premium o Admin.
        </p>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <div className="p-4 bg-red-50 rounded-full">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Nessuna sessione selezionata</h2>
      </div>
    )
  }

  queryCount += 1
  const { data: session } = await supabase
    .from("assessment_sessions")
    .select(
      "id, user_id, session_type, parent_session_id, metadata, status, final_outcome, evaluation_code"
    )
    .eq("id", sessionId)
    .single()

  if (!session)
    return <div className="p-8 text-center text-red-600 font-bold">Sessione non trovata.</div>
  if (session.user_id !== userId && role !== "admin")
    return <div className="p-8 text-center text-red-600 font-bold">Accesso negato.</div>

  // Profile of session owner (impersonated user when admin acts as them)
  queryCount += 1
  const { data: userProfile } = await supabase
    .from("profiles")
    .select(
      "full_name,ragione_sociale,cf_partita_iva,indirizzo,cap,citta,provincia,recapito_telefonico,email"
    )
    .eq("id", session.user_id)
    .single()

  const metadata = session.metadata as Record<string, unknown> | null
  let baseEvaluationCode = session.evaluation_code ?? null
  if (session.parent_session_id) {
    const { data: parentSession } = await supabase
      .from("assessment_sessions")
      .select("evaluation_code")
      .eq("id", session.parent_session_id)
      .single()
    if (parentSession?.evaluation_code != null) baseEvaluationCode = parentSession.evaluation_code
  }
  const nomeOperazione =
    (metadata?.nome_operazione as string) ||
    (metadata?.operation_name as string) ||
    "Analisi Finale EUDR"

  const allResponses = session.parent_session_id
    ? (await Promise.all([
        getCachedEudrSessionResponses(session.parent_session_id),
        getCachedEudrSessionResponses(sessionId),
      ])).flat()
    : await getCachedEudrSessionResponses(sessionId)

  const answersMap: Record<string, string | null> = {}
  const answersJsonMap: Record<string, unknown> = {}
  for (const r of allResponses) {
    answersMap[r.question_id] = r.answer_text
    if (r.answer_json != null) answersJsonMap[r.question_id] = r.answer_json
  }

  // Resolve species + country for PDF header using the same approach as Timber
  const countryId = (answersMap[EUDR_COUNTRY_PREFILL_QUESTION_IDS.PAESE_RACCOLTA] || "").trim() || null
  const specieId = (answersMap[EUDR_COUNTRY_PREFILL_QUESTION_IDS.SPECIE] || "").trim() || null

  const [speciesResult, countryResult, aoiMitigated] = await Promise.all([
    specieId
      ? supabase.from("species").select("common_name, scientific_name").eq("id", specieId).single()
      : null,
    countryId
      ? supabase.from("country").select("country_name, conflicts").eq("id", countryId).single()
      : null,
    isAoiGateMitigatedForSession(supabase, sessionId),
  ])

  const specieCommon = String(speciesResult?.data?.common_name ?? "").trim()
  const specieScientific = String(speciesResult?.data?.scientific_name ?? "").trim()
  const specieName =
    specieCommon && specieScientific
      ? `${specieCommon} - ${specieScientific}`
      : specieCommon || specieScientific || "N/D"
  const countryName = countryResult?.data?.country_name || "N/D"
  const countryHasConflicts = countryResult?.data?.conflicts ?? false

  const baseResult: RiskCalculationResult = calculateEudrRisk(answersMap)
  const metadataDdLastRun = metadata?.dd_last_run as DdLastRunSnapshot | undefined
  const metadataSnapshotComplete = isDdLastRunMetadataComplete(metadataDdLastRun)
  const ddsResponses = { answersMap, answersJsonMap }
  // Complete metadata is resolveDdLastRun's fast branch: use it and do not touch storage.
  // Otherwise paint from the snapshot already on the session. The PDF Suspense child
  // downloads and replaces this view with the same gate applied to the resolved snapshot.
  const ddLastRunNormalized = normalizeDdLastRunForOutcome(
    metadataDdLastRun?.run_id ? metadataDdLastRun : undefined
  )
  const result = applyAoiGateToEudrRiskResult(baseResult, ddLastRunNormalized, {
    mitigated: aoiMitigated,
  })

  const ddsOutcome = await computeEudrDdsOutcome(
    supabase,
    sessionId,
    session.parent_session_id,
    result,
    ddLastRunNormalized,
    { aoiMitigated, responses: ddsResponses }
  )
  const displayOutcomeDescription = ddsOutcome.outcomeDescription
  const ddsType: EudrDdsType = ddsOutcome.ddsType

  scheduleEudrSessionFinalize({
    supabase,
    sessionId,
    sessionUserId: session.user_id,
    sessionStatus: session.status,
    sessionFinalOutcome: session.final_outcome,
    metadata,
    result,
    ddsType,
    displayOutcomeDescription,
    ddsOutcome,
    ddLastRunNormalized,
    baseResult,
    aoiMitigated,
    parentSessionId: session.parent_session_id,
    responses: ddsResponses,
    storageResolutionNeeded: !metadataSnapshotComplete,
  })

  logRoutePerf("/EUDR/risultato", {
    tab: sessionId,
    queryCount,
    durationMs: Date.now() - perfStart,
    dbMs: Date.now() - perfStart,
  })

  const getDeferredData = createEudrRisultatoDeferredLoader({
    sessionId,
    sessionUserId: session.user_id,
    answersMap,
    answersJsonMap,
    result,
    ddLastRun: ddLastRunNormalized,
    resolveStorage: !metadataSnapshotComplete,
    metadataDdLastRun,
    baseResult,
    aoiMitigated,
    parentSessionId: session.parent_session_id,
    responses: ddsResponses,
  })

  const deferredProps: EudrRisultatoDeferredProps = {
    sessionId,
    nomeOperazione,
    userProfile,
    displayOutcomeDescription,
    ddsType,
    specieName,
    countryName,
    countryHasConflicts,
    baseEvaluationCode,
    result,
    answersMap,
    answersJsonMap,
    ddLastRunNormalized,
    getDeferredData,
  }

  const outcomeView = toEudrRisultatoOutcomeView({
    result,
    displayOutcomeDescription,
    ddsType,
    ddLastRunNormalized,
    aoiMitigated,
    nomeOperazione,
    sessionId,
  })

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <Link
        href="/EUDR/search"
        className="inline-flex items-center gap-1.5 text-sm text-[#967635] hover:text-[#7a5f2a] font-medium mt-6 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Torna all&apos;archivio
      </Link>

      {metadataSnapshotComplete ? (
        <EudrRisultatoOutcomeSections
          view={outcomeView}
          pdf={
            <Suspense fallback={<EudrRisultatoPdfSkeleton />}>
              <EudrRisultatoPdfDeferred {...deferredProps} />
            </Suspense>
          }
        />
      ) : (
        <Suspense
          fallback={
            <EudrRisultatoOutcomeSections view={outcomeView} pdf={<EudrRisultatoPdfSkeleton />} />
          }
        >
          <EudrRisultatoResolvedShell {...deferredProps} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        <EudrRisultatoMitigationDeferred {...deferredProps} />
      </Suspense>
    </div>
  )
}
