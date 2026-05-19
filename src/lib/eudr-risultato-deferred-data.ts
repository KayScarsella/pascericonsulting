import { createClient } from "@/utils/supabase/server"
import { getEudrPdfSections } from "@/lib/eudr-pdf-sections"
import type { DdLastRunSnapshot } from "@/features/eudr-due-diligence/aoiRiskGate"
import { loadDdLastRunFromStorage } from "@/features/eudr-due-diligence/storage/loadDdLastRunFromStorage"
import {
  EUDR_SCORED_QUESTIONS,
  getEudrLabelForRaw,
  type RiskCalculationResult,
} from "@/lib/eudr-risk-calculator"
import type { QuestionConfig } from "@/types/questions"
import type { DdPdfPayload } from "@/components/ExportAnalysisPdfButton"
import type { SectionForPdf } from "@/components/ExportAnalysisPdfButton"

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

export type MitigationHistoryEntry = {
  id: string
  question_id: string
  previous_answer: string | null
  new_answer: string
  mitigated_at: string
  comment?: string | null
  file_path?: string | null
}

export type EudrRisultatoDeferredData = {
  sectionsForPdf: SectionForPdf[]
  ddPdfPayload: DdPdfPayload | null
  mitigationHistory: MitigationHistoryEntry[]
  questionLabelsMap: Record<
    string,
    { label: string; shortLabel: string; lookup: Record<string, number>; labels: Record<string, string> }
  >
  queryCount: number
  storageMs: number
}

type QuestionRow = {
  id: string
  text: string
  order_index: number | null
  type: string
  config: QuestionConfig | null
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

export type EudrRisultatoDeferredLoadParams = {
  sessionId: string
  sessionUserId: string
  answersMap: Record<string, string | null>
  answersJsonMap: Record<string, unknown>
  result: RiskCalculationResult
  ddLastRun?: DdLastRunSnapshot
}

/** Per-request loader: must not use React cache (calls createClient → cookies). */
export async function loadEudrRisultatoDeferredData(
  params: EudrRisultatoDeferredLoadParams
): Promise<EudrRisultatoDeferredData> {
  const { sessionId, sessionUserId, answersMap, answersJsonMap, result, ddLastRun } = params
  const supabase = await createClient()
  let effectiveDdLastRun = ddLastRun
  if (!effectiveDdLastRun?.run_id) {
    const fromStorage = await loadDdLastRunFromStorage(supabase, sessionUserId, sessionId)
    if (fromStorage) effectiveDdLastRun = fromStorage
  }
  let queryCount = 0
  let storageMs = 0

  const questionLabelsMap: EudrRisultatoDeferredData["questionLabelsMap"] = {}
  for (const sq of EUDR_SCORED_QUESTIONS) {
    questionLabelsMap[sq.id] = {
      label: sq.label,
      shortLabel: sq.shortLabel,
      lookup: sq.lookup,
      labels: sq.labels,
    }
  }

  let mitigationHistory: MitigationHistoryEntry[] = []
  try {
    queryCount += 1
    const dynamicClient = supabase as unknown as DynamicTableClient
    const { data: historyData } = await dynamicClient
      .from("mitigation_history")
      .select("id, question_id, previous_answer, new_answer, mitigated_at, comment, file_path")
      .eq("session_id", sessionId)
      .order("mitigated_at", { ascending: false })
    mitigationHistory = (historyData as MitigationHistoryEntry[] | null) || []
  } catch {
    // ignore
  }

  queryCount += 1
  const sectionsDataFiltered = await getEudrPdfSections()

  const supplierIds = new Set<string>()
  for (const section of sectionsDataFiltered) {
    for (const q of section.questions || []) {
      if (q.type === "supplier_manager") {
        const id = answersMap[q.id]
        if (id && id.trim()) supplierIds.add(id.trim())
      }
    }
  }

  const supplierRecordsById: Record<string, SupplierRecord> = {}
  const supplierDetailsMap: Record<string, string> = {}
  if (supplierIds.size > 0) {
    queryCount += 1
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

  const asyncSelectLabelMaps = new Map<string, Map<string, string>>()
  for (const [key, bucket] of idsByAsyncKey.entries()) {
    const ids = [...bucket.ids]
    const map = new Map<string, string>()
    const dynamicClient = supabase as unknown as DynamicTableClient
    for (const idsChunk of chunk(ids, 500)) {
      queryCount += 1
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
    if (q.type === "supplier_manager") return supplierDetails[raw] ?? (raw || "—")
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
      const mapKey = `${table}|${labelCol}|${valueCol}`
      const map = asyncSelectLabelMaps.get(mapKey)
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

  const sectionsForPdf: SectionForPdf[] = sectionsDataFiltered
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

  let ddPdfPayload: DdPdfPayload | null = null
  if (effectiveDdLastRun?.run_id) {
    const storageStart = Date.now()
    const artifactSessionId = effectiveDdLastRun.dd_artifact_session_id ?? sessionId
    queryCount += 1
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
        { path: `${base}/${effectiveDdLastRun.run_id}/dd_report.json`, artifactPrefix: `${base}/${effectiveDdLastRun.run_id}` },
      ]
      let blob: Blob | null = null
      let artifactPrefix = base
      for (const c of reportCandidates) {
        const { data, error: dlErr } = await supabase.storage
          .from("user-uploads")
          .download(c.path)
        if (!dlErr && data) {
          blob = data
          artifactPrefix = c.artifactPrefix
          break
        }
      }
      if (blob) {
        try {
          const parsed = JSON.parse(await blob.text()) as DdPdfPayload
          if (parsed?.lossyear_histogram && parsed?.cutting_date_iso) {
            const payload = parsed as DdPdfPayload
            if (payload.has_snapshot) {
              const snapName =
                payload.snapshot_storage_filename?.trim() || "aoi_map_render.png"
              const snapPath = `${artifactPrefix}/${snapName}`
              queryCount += 1
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
    storageMs = Date.now() - storageStart
  }

  return {
    sectionsForPdf,
    ddPdfPayload,
    mitigationHistory,
    questionLabelsMap,
    queryCount,
    storageMs,
  }
}

/**
 * Deduplicates PDF + mitigation deferred segments on the same page (one DB round-trip).
 * Call the returned function from both Suspense boundaries; do not wrap in React cache.
 */
export function createEudrRisultatoDeferredLoader(params: EudrRisultatoDeferredLoadParams) {
  let promise: Promise<EudrRisultatoDeferredData> | undefined
  return () => {
    promise ??= loadEudrRisultatoDeferredData(params)
    return promise
  }
}
