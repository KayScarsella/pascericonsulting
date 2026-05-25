import { Suspense } from "react"
import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { createClient } from "@/utils/supabase/server"
import { logRoutePerf } from "@/lib/perf-debug"
import { scheduleEudrSessionFinalize } from "@/lib/eudr-risultato-sync"
import {
  EudrRisultatoMitigationDeferred,
  EudrRisultatoPdfDeferred,
  type EudrRisultatoDeferredProps,
} from "@/components/eudr/EudrRisultatoDeferred"
import { EudrRisultatoPdfSkeleton } from "@/components/eudr/EudrRisultatoDeferredSkeleton"
import { ShieldAlert, ArrowLeft, CheckCircle, AlertTriangle, Shield } from "lucide-react"
import Link from "next/link"

import {
  calculateEudrRisk,
  RISK_THRESHOLD,
  EUDR_COUNTRY_PREFILL_QUESTION_IDS,
} from "@/lib/eudr-risk-calculator"
import {
  applyAoiGateToEudrRiskResult,
  AOI_GATE_QUESTION_ID,
  type DdLastRunSnapshot,
} from "@/features/eudr-due-diligence/aoiRiskGate"
import type { RiskCalculationResult } from "@/lib/eudr-risk-calculator"
import { computeEudrDdsOutcome } from "@/lib/eudr-dds-inputs"
import { getEudrDdsDisplayLabel } from "@/lib/eudr-dds-determination"
import type { EudrDdsType } from "@/types/session"
import { RiskBarChart } from "@/components/RiskBarChart"
import { createEudrRisultatoDeferredLoader } from "@/lib/eudr-risultato-deferred-data"
import {
  persistDdLastRunBackfill,
  resolveDdLastRun,
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
  const supabase = await createClient()
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
  const [{ data: session }, { data: userProfile }] = await Promise.all([
    supabase
      .from("assessment_sessions")
      .select(
        "id, user_id, session_type, parent_session_id, metadata, status, final_outcome, evaluation_code"
      )
      .eq("id", sessionId)
      .single(),
    supabase
      .from("profiles")
      .select(
        "full_name,ragione_sociale,cf_partita_iva,indirizzo,cap,citta,provincia,recapito_telefonico,email"
      )
      .eq("id", userId)
      .single(),
  ])

  if (!session)
    return <div className="p-8 text-center text-red-600 font-bold">Sessione non trovata.</div>
  if (session.user_id !== userId && role !== "admin")
    return <div className="p-8 text-center text-red-600 font-bold">Accesso negato.</div>

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

  let allResponses: { question_id: string; answer_text: string | null; answer_json: unknown }[] = []
  if (session.parent_session_id) {
    queryCount += 1
    const [{ data: parentResponses }, { data: childResponses }] = await Promise.all([
      supabase
        .from("user_responses")
        .select("question_id, answer_text, answer_json")
        .eq("session_id", session.parent_session_id),
      supabase
        .from("user_responses")
        .select("question_id, answer_text, answer_json")
        .eq("session_id", sessionId),
    ])
    allResponses = [...(parentResponses || []), ...(childResponses || [])]
  } else {
    const { data: childResponses } = await supabase
      .from("user_responses")
      .select("question_id, answer_text, answer_json")
      .eq("session_id", sessionId)
    allResponses = childResponses || []
  }

  const answersMap: Record<string, string | null> = {}
  const answersJsonMap: Record<string, unknown> = {}
  for (const r of allResponses) {
    answersMap[r.question_id] = r.answer_text
    if (r.answer_json != null) answersJsonMap[r.question_id] = r.answer_json
  }

  // Resolve species + country for PDF header using the same approach as Timber
  const countryId = (answersMap[EUDR_COUNTRY_PREFILL_QUESTION_IDS.PAESE_RACCOLTA] || "").trim() || null
  const specieId = (answersMap[EUDR_COUNTRY_PREFILL_QUESTION_IDS.SPECIE] || "").trim() || null

  const [speciesResult, countryResult] = await Promise.all([
    specieId
      ? supabase.from("species").select("common_name, scientific_name").eq("id", specieId).single()
      : null,
    countryId
      ? supabase.from("country").select("country_name, conflicts").eq("id", countryId).single()
      : null,
  ])

  const specieCommon = String(speciesResult?.data?.common_name ?? "").trim()
  const specieScientific = String(speciesResult?.data?.scientific_name ?? "").trim()
  const specieName =
    specieCommon && specieScientific
      ? `${specieCommon} - ${specieScientific}`
      : specieCommon || specieScientific || "N/D"
  const countryName = countryResult?.data?.country_name || "N/D"
  const countryHasConflicts = countryResult?.data?.conflicts ?? false

  let result: RiskCalculationResult = calculateEudrRisk(answersMap)
  const metadataDdLastRun = metadata?.dd_last_run as DdLastRunSnapshot | undefined
  const ddLastRun = await resolveDdLastRun(
    supabase,
    session.user_id,
    sessionId,
    metadataDdLastRun
  )
  if (ddLastRun && !metadataDdLastRun?.run_id) {
    await persistDdLastRunBackfill(supabase, sessionId, ddLastRun, metadata)
  }
  const normalizeAoiReasons = (reasons: string[] | undefined) => {
    const msg =
      'Verifica: Ogni perdita FORESTALE rilevata dopo il 31/12/2020 all’interno della maschera forestale 2020 costituisce una "evidenza" di possibile non conformità.'
    return (reasons ?? []).map((r) =>
      r.includes("stand-replacement") && r.includes("31/12/2020") ? msg : r
    )
  }
  const ddLastRunNormalized = ddLastRun
    ? { ...ddLastRun, reasons: normalizeAoiReasons(ddLastRun.reasons) }
    : ddLastRun
  result = applyAoiGateToEudrRiskResult(result, ddLastRunNormalized)

  const ddsOutcome = await computeEudrDdsOutcome(
    supabase,
    sessionId,
    session.parent_session_id,
    result,
    ddLastRunNormalized
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
  })

  const isAccettabile = result.outcome === "accettabile"
  const failingQuestions = result.details.filter((d) => d.riskIndex > RISK_THRESHOLD)
  // La mitigazione serve per domande del questionario: l'AOI gate è una "soglia" e non è mitigabile.
  const failingNonAoiQuestions = failingQuestions.filter((d) => d.questionId !== AOI_GATE_QUESTION_ID)

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

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">
      <Link
        href="/EUDR/search"
        className="inline-flex items-center gap-1.5 text-sm text-[#967635] hover:text-[#7a5f2a] font-medium mt-6 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Torna all&apos;archivio
      </Link>

      <div
        className={`relative overflow-hidden rounded-2xl border-2 p-8 mb-10 shadow-md ${
          isAccettabile
            ? "border-[#4a7c2e]/30 bg-gradient-to-br from-[#e8f5e2] via-white to-[#f0f8ec]"
            : "border-red-300/50 bg-gradient-to-br from-red-50 via-white to-orange-50/30"
        }`}
      >
        <div
          className={`absolute top-0 right-0 w-56 h-56 rounded-bl-full ${
            isAccettabile ? "bg-[#4a7c2e]/5" : "bg-red-500/5"
          }`}
        />
        <div className="relative flex items-start gap-5">
          <div
            className={`flex-shrink-0 p-4 rounded-2xl shadow-lg ${
              isAccettabile
                ? "bg-gradient-to-br from-[#4a7c2e] to-[#2d5016]"
                : "bg-gradient-to-br from-red-500 to-red-700"
            }`}
          >
            {isAccettabile ? (
              <CheckCircle className="w-8 h-8 text-white" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                isAccettabile ? "text-[#4a7c2e]" : "text-red-600"
              }`}
            >
              Esito Analisi EUDR
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              {isAccettabile ? "Rischio Trascurabile" : "Rischio Non Trascurabile"}
            </h1>
            <p className="mt-2 text-slate-600 text-sm leading-relaxed max-w-2xl whitespace-pre-line">
              {displayOutcomeDescription}
            </p>
            <p className="mt-3">
              <span
                className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${
                  ddsType === "semplificata"
                    ? "border-[#4a7c2e]/30 bg-[#4a7c2e]/10 text-[#2d5016]"
                    : "border-slate-300 bg-slate-100 text-slate-700"
                }`}
              >
                {getEudrDdsDisplayLabel(ddsType)}
              </span>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-slate-400 text-xs uppercase tracking-wide">Operazione</span>
                <p className="font-semibold text-[#3d2b1a]">{nomeOperazione}</p>
              </div>
              {result.expiryDate && (
                <div>
                  <span className="text-slate-400 text-xs uppercase tracking-wide">Scadenza</span>
                  <p className="font-semibold text-[#4a7c2e]">
                    {new Date(result.expiryDate).toLocaleDateString("it-IT")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="absolute top-6 right-6 hidden md:block">
          <div
            className={`text-center rounded-xl px-4 py-2 shadow-sm border ${
              isAccettabile
                ? "bg-[#4a7c2e]/10 border-[#4a7c2e]/20"
                : "bg-red-50 border-red-200"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Rischio Max
            </p>
            <p
              className={`text-2xl font-black ${
                isAccettabile ? "text-[#4a7c2e]" : "text-red-600"
              }`}
            >
              {result.overallRisk.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<EudrRisultatoPdfSkeleton />}>
        <EudrRisultatoPdfDeferred {...deferredProps} />
      </Suspense>

      {/* AOI / Hansen: esito esplicito positivo vs negativo (dd_last_run salvato al run) */}
      {ddLastRunNormalized && (
        <div
          className={`rounded-2xl border p-5 mb-10 ${
            ddLastRunNormalized.triggers_non_accettabile
              ? "border-red-200 bg-red-50/80"
              : "border-[#4a7c2e]/25 bg-[#4a7c2e]/5"
          }`}
        >
          <div className="flex items-start gap-3">
            {ddLastRunNormalized.triggers_non_accettabile ? (
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-6 h-6 text-[#4a7c2e] flex-shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm md:text-base font-black tracking-wide uppercase text-slate-900">
                {ddLastRunNormalized.triggers_non_accettabile
                  ? "Screening dell’area di interesse soggetta a perdita forestale dopo la data di taglio dichiarata – risultato: rischio non trascurabile"
                  : "Screening dell’area di interesse non soggetta a perdita forestale dopo la data di taglio dichiarata – risultato: rischio trascurabile"}
              </p>
              <h3 className="font-bold text-[#3d2b1a]">
                Screening AOI (EUDR) —{" "}
                {ddLastRunNormalized.triggers_non_accettabile
                  ? "esito negativo"
                  : "nessun gate attivato"}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {ddLastRunNormalized.triggers_non_accettabile
                  ? 'Verifica: Ogni perdita FORESTALE rilevata dopo il 31/12/2020 all’interno della maschera forestale 2020 costituisce una "evidenza" di possibile non conformità.'
                  : "Nell’AOI non risulta evidenza significativa di loss su foresta al 2020 dopo il cutoff (JRC GFC2020 ∩ Hansen), né loss Hansen post-taglio oltre soglia. Il gate AOI non ha alzato il rischio oltre il questionario."}
              </p>
              {ddLastRunNormalized.cutting_date_iso &&
                /^\d{4}/.test(ddLastRunNormalized.cutting_date_iso) && (
                <p className="text-xs text-slate-500 mt-2 rounded-md bg-slate-100/80 border border-slate-200 px-3 py-2">
                  <strong>Legenda mappa Hansen (run AOI):</strong> rosso = loss dall&apos;anno di taglio in poi
                  (≥ {ddLastRunNormalized.cutting_date_iso.slice(0, 4)}), incluso l&apos;anno inserito — così eventuale
                  loss nell&apos;anno del taglio è visibile e coerente con l&apos;esito. Blu = solo anni 2021…
                  precedenti all&apos;anno di taglio.
                </p>
              )}
              <p className="text-xs text-slate-500 mt-2 font-mono">
                Run: {ddLastRunNormalized.run_id.slice(0, 8)}… · pixel loss (Hansen tot):{" "}
                {ddLastRunNormalized.loss_pixel_count ?? "—"} · {ddLastRunNormalized.dataset_id}
                {ddLastRunNormalized.gate_uses_jrc_gfc2020 &&
                  ddLastRunNormalized.loss_on_forest_2020_post_eudr_ha != null && (
                    <>
                      {" "}
                      · loss su foresta 2020 post-EUDR ≈{" "}
                      {ddLastRunNormalized.loss_on_forest_2020_post_eudr_ha.toFixed(2)} ha
                    </>
                )}
              </p>
              {ddLastRunNormalized.logic_mode && (
                <p className="text-xs text-slate-600 mt-2">
                  Modalità screening:{' '}
                  <strong>
                    {ddLastRunNormalized.logic_mode === 'raffinata'
                      ? 'raffinata (JRC ∩ Hansen)'
                      : 'base (Hansen / sotto soglia)'}
                  </strong>
                </p>
              )}
              {ddLastRunNormalized.triggers_non_accettabile &&
                ddLastRunNormalized.reasons?.length > 0 && (
                <ul className="mt-3 text-sm text-red-800 list-disc list-inside space-y-1">
                  {ddLastRunNormalized.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
              {!ddLastRunNormalized.triggers_non_accettabile &&
                ddLastRunNormalized.advisory_notes &&
                ddLastRunNormalized.advisory_notes.length > 0 && (
                  <ul className="mt-3 text-sm text-amber-900 list-disc list-inside space-y-1 bg-amber-50/80 rounded-md p-3 border border-amber-100">
                    {ddLastRunNormalized.advisory_notes.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 md:p-8 mb-10">
        <h2 className="text-lg font-bold text-[#3d2b1a] mb-6">Grafico dei Rischi</h2>
        <RiskBarChart details={result.details} overallRisk={result.overallRisk} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-10">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#3d2b1a]">Dettaglio Indici di Rischio</h2>
          {failingQuestions.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              {failingQuestions.length}{" "}
              {failingQuestions.length === 1 ? "criterio critico" : "criteri critici"}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#fcfaf7] text-left">
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#967635]/70">
                  #
                </th>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#967635]/70">
                  Criterio
                </th>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#967635]/70 text-center">
                  Risposta
                </th>
                <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#967635]/70 text-right">
                  Indice
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.details.map((d, i) => {
                const isFailing = d.riskIndex > RISK_THRESHOLD
                const riskColor =
                  d.riskIndex <= RISK_THRESHOLD
                    ? "text-[#4a7c2e] bg-[#4a7c2e]/10"
                    : d.riskIndex <= 0.6
                      ? "text-amber-700 bg-amber-50"
                      : "text-red-700 bg-red-50"
                return (
                  <tr
                    key={d.questionId}
                    className={`transition-colors ${
                      isFailing
                        ? "bg-red-50/60 hover:bg-red-50 border-l-4 border-l-red-400"
                        : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-6 py-4 text-slate-700 max-w-md">
                      <div className="flex items-center gap-2">
                        {isFailing && (
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <p
                          className={`font-medium leading-relaxed ${isFailing ? "text-red-900" : ""}`}
                        >
                          {d.label}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`text-xs font-mono uppercase ${isFailing ? "text-red-600 font-semibold" : "text-slate-500"}`}
                      >
                        {d.answerLabel || "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-bold ${riskColor}`}
                      >
                        {d.riskIndex.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                )
              })}
              <tr
                className={`font-bold ${isAccettabile ? "bg-[#e8f5e2]/50" : "bg-red-50/50"}`}
              >
                <td className="px-6 py-4" />
                <td className="px-6 py-4 text-[#3d2b1a] text-base" colSpan={2}>
                  Rischio complessivo di fornitura (MAX)
                </td>
                <td className="px-6 py-4 text-right">
                  <span
                    className={`inline-flex px-3 py-1.5 rounded-lg text-sm font-black ${
                      isAccettabile
                        ? "bg-[#4a7c2e] text-white"
                        : "bg-red-600 text-white"
                    }`}
                  >
                    {result.overallRisk.toFixed(2)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {!isAccettabile && failingNonAoiQuestions.length > 0 && (
        <div className="rounded-2xl border-2 border-dashed border-red-200 bg-gradient-to-r from-red-50/50 to-orange-50/30 p-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 p-3 bg-gradient-to-br from-red-500 to-red-700 rounded-xl shadow-md">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-red-900">Azioni di mitigazione richieste</h3>
              <p className="text-sm text-red-700/80 mt-1">
                {failingNonAoiQuestions.length}{" "}
                {failingNonAoiQuestions.length === 1
                  ? "criterio non supera"
                  : "criteri non superano"}{" "}
                la soglia di rischio. Avvia la mitigazione per aggiornare le risposte.
              </p>
            </div>
            <Link
              href={`/EUDR/mitigazione?session_id=${sessionId}`}
              className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl shadow-md transition-all text-sm"
            >
              <Shield className="w-4 h-4" />
              Avvia Mitigazione
            </Link>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        <EudrRisultatoMitigationDeferred {...deferredProps} />
      </Suspense>
    </div>
  )
}
