import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { ShieldAlert, ArrowLeft, CheckCircle, AlertTriangle, Shield } from "lucide-react"
import Link from "next/link"

import {
  calculateEudrRisk,
  RISK_THRESHOLD,
  EUDR_SCORED_QUESTIONS,
  EUDR_COUNTRY_PREFILL_QUESTION_IDS,
  getEudrLabelForRaw,
} from "@/lib/eudr-risk-calculator"
import {
  applyAoiGateToEudrRiskResult,
  AOI_GATE_QUESTION_ID,
  type DdLastRunSnapshot,
} from "@/features/eudr-due-diligence/aoiRiskGate"
import type { RiskCalculationResult } from "@/lib/eudr-risk-calculator"
import { RiskBarChart } from "@/components/RiskBarChart"
import { MitigationHistorySection } from "@/components/MitigationHistorySection"
import { ExportAnalysisPdfButton, PDF_DISCLAIMERS } from "@/components/ExportAnalysisPdfButton"
import type { QuestionConfig } from "@/types/questions"

type DynamicTableClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => Promise<{ data: Array<Record<string, unknown>> | null }>
      eq: (column: string, value: string) => {
        order: (
          columnName: string,
          options: { ascending: boolean }
        ) => Promise<{ data: Array<Record<string, unknown>> | null }>
      }
    }
  }
}

export default async function EudrRisultatoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const sessionId = params.session_id as string | undefined

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: userProfile } = await supabase
    .from("profiles")
    .select(
      "full_name,ragione_sociale,cf_partita_iva,indirizzo,cap,citta,provincia,recapito_telefonico,email"
    )
    .eq("id", user.id)
    .single()

  const { role } = await getToolAccess(EUDR_TOOL_ID)
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

  const { data: session } = await supabase
    .from("assessment_sessions")
    .select("id, user_id, session_type, parent_session_id, metadata, status, final_outcome, evaluation_code")
    .eq("id", sessionId)
    .single()

  if (!session)
    return <div className="p-8 text-center text-red-600 font-bold">Sessione non trovata.</div>
  if (session.user_id !== user.id && role !== "admin")
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
    const { data: parentResponses } = await supabase
      .from("user_responses")
      .select("question_id, answer_text, answer_json")
      .eq("session_id", session.parent_session_id)
    const { data: childResponses } = await supabase
      .from("user_responses")
      .select("question_id, answer_text, answer_json")
      .eq("session_id", sessionId)
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
      ? supabase.from("species").select("common_name").eq("id", specieId).single()
      : null,
    countryId
      ? supabase.from("country").select("country_name, conflicts").eq("id", countryId).single()
      : null,
  ])

  const specieName = speciesResult?.data?.common_name || "N/D"
  const countryName = countryResult?.data?.country_name || "N/D"
  const countryHasConflicts = countryResult?.data?.conflicts ?? false

  let result: RiskCalculationResult = calculateEudrRisk(answersMap)
  const ddLastRun = metadata?.dd_last_run as DdLastRunSnapshot | undefined
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

  if (session.status !== "completed" || !session.final_outcome) {
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
        ...(ddLastRunNormalized?.triggers_non_accettabile
          ? {
              aoi_gate_triggered: true,
              aoi_gate_reasons: ddLastRunNormalized.reasons,
            }
          : {}),
      },
    }
    await supabase.from("assessment_sessions").update(updatePayload).eq("id", sessionId)
  } else if (
    ddLastRunNormalized?.triggers_non_accettabile &&
    session.final_outcome === "Rischio Trascurabile"
  ) {
    // AOI run after finalize: align stored outcome with gate (non accettabile)
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
          aoi_gate_reasons: ddLastRunNormalized.reasons,
          aoi_gate_synced_at: new Date().toISOString(),
        },
      })
      .eq("id", sessionId)
  }

  let mitigationHistory: {
    id: string
    question_id: string
    previous_answer: string | null
    new_answer: string
    mitigated_at: string
    comment?: string | null
    file_path?: string | null
  }[] = []
  try {
    const dynamicClient = supabase as unknown as DynamicTableClient
    const { data: historyData } = await dynamicClient
      .from("mitigation_history")
      .select("id, question_id, previous_answer, new_answer, mitigated_at, comment, file_path")
      .eq("session_id", sessionId)
      .order("mitigated_at", { ascending: false })
    mitigationHistory = (historyData as typeof mitigationHistory | null) || []
  } catch {
    // ignore
  }

  const isAccettabile = result.outcome === "accettabile"
  const failingQuestions = result.details.filter((d) => d.riskIndex > RISK_THRESHOLD)
  // La mitigazione serve per domande del questionario: l'AOI gate è una "soglia" e non è mitigabile.
  const failingNonAoiQuestions = failingQuestions.filter((d) => d.questionId !== AOI_GATE_QUESTION_ID)

  const questionLabelsMap: Record<
    string,
    { label: string; shortLabel: string; lookup: Record<string, number>; labels: Record<string, string> }
  > = {}
  for (const sq of EUDR_SCORED_QUESTIONS) {
    questionLabelsMap[sq.id] = {
      label: sq.label,
      shortLabel: sq.shortLabel,
      lookup: sq.lookup,
      labels: sq.labels,
    }
  }

  const { data: sectionsForPdfRaw } = await supabase
    .from("sections")
    .select("id, title, order_index, group_name, questions(id, text, order_index, type, config)")
    .eq("tool_id", EUDR_TOOL_ID)
    .in("group_name", ["Analisi Rischio", "Valutazione", "Valutazione Finale"])
    .order("order_index", { ascending: true })
    .order("order_index", { foreignTable: "questions", ascending: true })

  type QuestionRow = {
    id: string
    text: string
    order_index: number | null
    type: string
    config: QuestionConfig | null
  }
  type SectionRow = {
    id: string
    title: string
    order_index: number | null
    group_name: string | null
    questions: QuestionRow[] | null
  }
  const sectionsData = (sectionsForPdfRaw || []) as SectionRow[]
  const sectionsDataFiltered = sectionsData.filter(
    (s) => s.id !== "a3df1e07-a678-49d2-9a4d-f134fba3498c"
  )

  const supplierIds = new Set<string>()
  for (const section of sectionsDataFiltered) {
    for (const q of section.questions || []) {
      if (q.type === "supplier_manager") {
        const id = answersMap[q.id]
        if (id && id.trim()) supplierIds.add(id.trim())
      }
    }
  }
  type SupplierRecord = {
    name: string
    vat_number: string | null
    eori_number: string | null
    address: string | null
    phone: string | null
    email: string | null
    website: string | null
    contact_person: string | null
  }
  const supplierRecordsById: Record<string, SupplierRecord> = {}
  const supplierDetailsMap: Record<string, string> = {}
  if (supplierIds.size > 0) {
    const { data: suppliersRows } = await supabase
      .from("suppliers")
      .select(
        "id, name, vat_number, eori_number, address, phone, email, website, contact_person"
      )
      .in("id", [...supplierIds])
    const parts = (s: SupplierRecord) => {
      const lines: string[] = []
      if (s.name) lines.push(`Nome: ${s.name}`)
      if (s.vat_number) lines.push(`P.IVA: ${s.vat_number}`)
      if (s.eori_number) lines.push(`EORI: ${s.eori_number}`)
      if (s.address) lines.push(`Indirizzo: ${s.address}`)
      if (s.phone) lines.push(`Telefono: ${s.phone}`)
      if (s.email) lines.push(`Email: ${s.email}`)
      if (s.website) lines.push(`Sito: ${s.website}`)
      if (s.contact_person) lines.push(`Referente: ${s.contact_person}`)
      return lines.length ? lines.join("\n") : s.name || "—"
    }
    for (const row of suppliersRows || []) {
      supplierRecordsById[row.id] = row
      supplierDetailsMap[row.id] = parts(row)
    }
  }

  const SUPPLIER_FIELDS: { key: keyof SupplierRecord; label: string }[] = [
    { key: "name", label: "Nome" },
    { key: "vat_number", label: "P.IVA" },
    { key: "eori_number", label: "EORI" },
    { key: "address", label: "Indirizzo" },
    { key: "phone", label: "Telefono" },
    { key: "email", label: "Email" },
    { key: "website", label: "Sito" },
    { key: "contact_person", label: "Referente" },
  ]

  // Resolve async_select labels by fetching ONLY selected IDs (no full-table prefetch).
  const idsByAsyncKey = new Map<
    string,
    { table: string; labelCol: string; valueCol: string; ids: Set<string> }
  >()

  for (const section of sectionsDataFiltered) {
    for (const q of section.questions || []) {
      if (q.type !== "async_select" || !q.config?.source_table) continue
      const raw = (answersMap[q.id] ?? "").trim()
      if (!raw) continue

      const table = String(q.config.source_table)
      const labelCol = q.config.source_label_col ?? "name"
      const valueCol = q.config.source_value_col ?? "id"
      const key = `${table}|${labelCol}|${valueCol}`
      if (!idsByAsyncKey.has(key)) {
        idsByAsyncKey.set(key, { table, labelCol, valueCol, ids: new Set<string>() })
      }
      const bucket = idsByAsyncKey.get(key)!
      raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((id) => bucket.ids.add(id))
    }
  }

  const chunk = <T,>(arr: T[], size: number) => {
    const out: T[][] = []
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
    return out
  }

  const asyncSelectLabelMaps = new Map<string, Map<string, string>>() // key -> (value -> label)
  for (const [key, bucket] of idsByAsyncKey.entries()) {
    const ids = [...bucket.ids]
    const map = new Map<string, string>()
    const dynamicClient = supabase as unknown as DynamicTableClient
    for (const idsChunk of chunk(ids, 500)) {
      const { data } = await dynamicClient
        .from(bucket.table)
        .select(`${bucket.labelCol}, ${bucket.valueCol}`)
        .in(bucket.valueCol, idsChunk)
      for (const row of data || []) {
        map.set(String(row[bucket.valueCol] ?? ""), String(row[bucket.labelCol] ?? ""))
      }
    }
    asyncSelectLabelMaps.set(key, map)
  }

  function resolveDisplayAnswer(
    q: QuestionRow,
    answerText: string | null,
    answerJson: unknown,
    supplierDetails: Record<string, string>
  ): string {
    const raw = answerText ?? ""
    if (q.type === "supplier_manager")
      return supplierDetails[raw] ?? (raw || "—")
    if (q.type === "select" && q.config?.options?.length) {
      const rawNorm = raw.toLowerCase().trim()
      const opt = q.config.options.find(
        (o) => String(o.value).toLowerCase().trim() === rawNorm
      )
      return opt ? opt.label : raw || "—"
    }
    if (q.type === "async_select" && q.config?.source_table) {
      const table = String(q.config.source_table)
      const labelCol = q.config.source_label_col ?? "name"
      const valueCol = q.config.source_value_col ?? "id"
      const key = `${table}|${labelCol}|${valueCol}`
      const map = asyncSelectLabelMaps.get(key)
      if (raw.includes(",")) {
        const labels = raw
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean)
          .map((id) => map?.get(id) ?? id)
        return labels.filter(Boolean).length ? labels.join(", ") : raw || "—"
      }
      const rawNorm = raw.trim()
      return (map?.get(rawNorm) || rawNorm) || "—"
    }
    if (q.type === "repeater" && Array.isArray(answerJson))
      return answerJson.length ? `${answerJson.length} elemento/i` : "—"
    return raw || "—"
  }

  const detailsByQuestionId = new Map(result.details.map((d) => [d.questionId, d]))
  const mitigationByQuestionId = new Map<
    string,
    { previousLabel: string; newLabel: string; date: string; comment?: string | null }[]
  >()
  for (const entry of mitigationHistory) {
    const meta = questionLabelsMap[entry.question_id]
    const getLabel = (raw: string | null) =>
      meta ? getEudrLabelForRaw(meta.labels, raw) : (raw ?? "—")
    const item = {
      previousLabel: getLabel(entry.previous_answer),
      newLabel: getLabel(entry.new_answer),
      date: new Date(entry.mitigated_at).toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      comment: entry.comment,
    }
    if (!mitigationByQuestionId.has(entry.question_id))
      mitigationByQuestionId.set(entry.question_id, [])
    mitigationByQuestionId.get(entry.question_id)!.push(item)
  }

  const sectionsForPdf = sectionsDataFiltered
    .map((section) => {
      const questions = section.questions || []
      const expanded = questions.flatMap((q) => {
        const detail = detailsByQuestionId.get(q.id)
        const rawAnswer = answersMap[q.id]
        const answerJson = answersJsonMap[q.id]
        const mitigation = mitigationByQuestionId.get(q.id)

        if (q.type === "supplier_manager" && rawAnswer?.trim()) {
          const supplier = supplierRecordsById[rawAnswer.trim()]
          if (supplier) {
            return SUPPLIER_FIELDS.map(({ key, label }) => ({
              questionId: q.id,
              questionText: label,
              answerText: supplier[key] ?? "—",
              riskIndex: undefined as number | undefined,
              mitigation: undefined,
            }))
          }
        }

        const answerText = detail
          ? detail.answerLabel
          : resolveDisplayAnswer(q, rawAnswer, answerJson, supplierDetailsMap)
        return [
          {
            questionId: q.id,
            questionText: q.text,
            answerText: typeof answerText === "string" ? answerText : "—",
            riskIndex: detail?.riskIndex,
            mitigation:
              mitigation && mitigation.length > 0 ? mitigation : undefined,
          },
        ]
      })
      return { sectionTitle: section.title, questions: expanded.filter((q) => q.questionText) }
    })
    .filter((s) => s.questions.length > 0)

  // Carica dd_report.json da storage per PDF (layout flat per sessione; fallback cartella legacy runId)
  let ddPdfPayload: import("@/components/ExportAnalysisPdfButton").DdPdfPayload | null = null
  if (ddLastRun?.run_id) {
    const artifactSessionId = ddLastRun.dd_artifact_session_id ?? sessionId
    const { data: artifactSession } = await supabase
      .from("assessment_sessions")
      .select("user_id")
      .eq("id", artifactSessionId)
      .single()
    if (artifactSession?.user_id) {
      const uid = artifactSession.user_id
      const base = `${uid}/eudr-due-diligence/${artifactSessionId}`
      const reportCandidates: { path: string; artifactPrefix: string }[] = [
        { path: `${base}/dd_report.json`, artifactPrefix: base },
        { path: `${base}/${ddLastRun.run_id}/dd_report.json`, artifactPrefix: `${base}/${ddLastRun.run_id}` },
      ]
      let blob: Blob | null = null
      let artifactPrefix = base
      for (const c of reportCandidates) {
        const { data, error: dlErr } = await supabase.storage.from("user-uploads").download(c.path)
        if (!dlErr && data) {
          blob = data
          artifactPrefix = c.artifactPrefix
          break
        }
      }
      if (blob) {
        try {
          const parsed = JSON.parse(await blob.text()) as import("@/components/ExportAnalysisPdfButton").DdPdfPayload
          if (parsed?.lossyear_histogram && parsed?.cutting_date_iso) {
            const payload = parsed as import("@/components/ExportAnalysisPdfButton").DdPdfPayload
            if (payload.has_snapshot) {
              const snapName =
                payload.snapshot_storage_filename?.trim() || "aoi_map_render.png"
              const snapPath = `${artifactPrefix}/${snapName}`
              const { data: snapSigned } = await supabase.storage
                .from("user-uploads")
                .createSignedUrl(snapPath, 3600, { download: false })
              if (snapSigned?.signedUrl) payload.dd_snapshot_signed_url = snapSigned.signedUrl
            }
            ddPdfPayload = payload
          }
        } catch {
          /* ignore */
        }
      }
    }
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
            <p className="mt-2 text-slate-600 text-sm leading-relaxed max-w-2xl">
              {result.outcomeDescription}
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

      <div className="flex flex-wrap items-center gap-3 mb-10">
        <ExportAnalysisPdfButton
          variant="EUDR"
          nomeOperazione={nomeOperazione}
          userProfile={userProfile}
          disclaimerText={PDF_DISCLAIMERS.EUDR}
          outcome={result.outcome}
          outcomeDescription={result.outcomeDescription}
          specieName={specieName}
          countryName={countryName}
          countryHasConflicts={!!countryHasConflicts}
          expiryDate={result.expiryDate}
          overallRisk={result.overallRisk}
          details={result.details}
          sectionsForPdf={sectionsForPdf}
          sessionId={sessionId}
          baseEvaluationCode={baseEvaluationCode}
          ddPdfPayload={ddPdfPayload}
        />
      </div>

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

      {mitigationHistory.length > 0 && (
        <MitigationHistorySection
          sessionId={sessionId}
          history={mitigationHistory}
          questionLabelsMap={questionLabelsMap}
          currentDetails={result.details}
        />
      )}
    </div>
  )
}
