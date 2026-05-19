import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { Lock } from "lucide-react"
import { createClient } from "@/utils/supabase/server"

import { EudrSearchView, type EudrVerificationRow } from "@/components/EudrSearchView"
import type { EudrAssessmentSessionRow } from "@/components/EudrAnalisiTable"
import {
  parsePageParam,
  parseSearchParam,
  parseSortDirParam,
} from "@/lib/table-query"
import {
  ANALISI_FINALE_GOOD_OUTCOMES,
  ANALISI_FINALE_NEGATIVE_OUTCOMES,
} from "@/lib/final-outcome"
import { resolveEudrWorkflowStatesBatch } from "@/lib/eudr-workflow-state"
import { normalizeEudrSearchTab } from "@/lib/eudr-search-routing"
import { logRoutePerf } from "@/lib/perf-debug"

export default async function EudrSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const perfStart = Date.now()
  let queryCount = 0

  const params = await searchParams
  const tab = normalizeEudrSearchTab(params.tab as string | undefined)
  const isVerificheTab = tab === "verifiche"
  const page = parsePageParam(params.page, 1)
  const vpage = parsePageParam(params.vpage, 1)
  const q = parseSearchParam(params.q)
  const vq = parseSearchParam(params.vq)
  const sort = (params.sort as string) || "created_at"
  const dir = parseSortDirParam(params.dir)
  const vsort = (params.vsort as string) || "created_at"
  const vdir = parseSortDirParam(params.vdir)
  const esito = (params.esito as string) || "all"
  const stato = (params.stato as string) || "all"
  const limit = 25
  const start = (page - 1) * limit
  const end = start + limit - 1
  const vstart = (vpage - 1) * limit
  const vend = vstart + limit - 1

  const { role, userId } = await getToolAccess(EUDR_TOOL_ID)
  const hasAccess = role === "admin" || role === "premium"
  const isAdmin = role === "admin"

  if (!hasAccess) {
    return <LockedSearchView />
  }

  const supabase = await createClient()

  let formattedAnalisi: EudrAssessmentSessionRow[] = []
  let totalPages = 1
  let verificationRows: EudrVerificationRow[] = []
  let totalPagesV = 1

  if (!isVerificheTab) {
    const analisiQuery = supabase
      .from("assessment_sessions")
      .select(
        "id, created_at, status, parent_session_id, final_outcome, metadata, evaluation_code, user_id, profiles ( full_name )",
        { count: "exact" }
      )
      .eq("tool_id", EUDR_TOOL_ID)
      .eq("session_type", "analisi_finale")
    if (!isAdmin) analisiQuery.eq("user_id", userId)
    if (esito === "in_corso") {
      analisiQuery.neq("status", "completed")
    } else if (esito === "accettabile") {
      analisiQuery.eq("status", "completed")
      analisiQuery.in("final_outcome", [...ANALISI_FINALE_GOOD_OUTCOMES])
    } else if (esito === "non_accettabile") {
      analisiQuery.eq("status", "completed")
      analisiQuery.in("final_outcome", [...ANALISI_FINALE_NEGATIVE_OUTCOMES])
    }
    if (q) {
      const n = Number.parseInt(q, 10)
      const numericClause = Number.isFinite(n) ? `,evaluation_code.eq.${n}` : ""
      analisiQuery.or(
        [
          `metadata->>nome_operazione.ilike.%${q}%`,
          `metadata->>operation_name.ilike.%${q}%`,
          `profiles.full_name.ilike.%${q}%`,
        ].join(",") + numericClause
      )
    }

    queryCount += 1
    const { data: analisiData, count, error: analisiError } = await analisiQuery
      .order(sort, { ascending: dir === "asc" })
      .range(start, end)

    if (analisiError) {
      console.error("Errore durante il fetch delle analisi EUDR:", analisiError)
    }

    totalPages = Math.ceil((count || 0) / limit) || 1

    const parentIds = Array.from(
      new Set(
        (analisiData || [])
          .map((r) => r.parent_session_id)
          .filter((id): id is string => Boolean(id))
      )
    )

    const parentCodeById = new Map<string, number>()

    if (parentIds.length > 0) {
      queryCount += 1
      const { data: parents, error: parentsError } = await supabase
        .from("assessment_sessions")
        .select("id, evaluation_code")
        .in("id", parentIds)

      if (parentsError) {
        console.error("Errore durante il fetch delle verifiche base EUDR:", parentsError)
      } else {
        ;(parents || []).forEach((p) => parentCodeById.set(p.id, p.evaluation_code))
      }
    }

    formattedAnalisi = (analisiData || []).map((row) => {
      const baseId = row.parent_session_id || row.id
      const baseCode = parentCodeById.get(baseId) ?? row.evaluation_code ?? 0

      return {
        id: row.id,
        created_at: row.created_at || new Date().toISOString(),
        status: row.status || "in_progress",
        parent_session_id: row.parent_session_id,
        final_outcome: row.final_outcome,
        metadata: (row.metadata as EudrAssessmentSessionRow["metadata"]) || null,
        evaluation_code: row.evaluation_code || 0,
        base_session_id: baseId,
        base_evaluation_code: baseCode,
        owner_name:
          (row.profiles as { full_name?: string } | null)?.full_name ?? null,
      }
    })
  } else {
    const verifCountQuery = supabase
      .from("assessment_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tool_id", EUDR_TOOL_ID)
      .eq("session_type", "verifica")
    if (!isAdmin) verifCountQuery.eq("user_id", userId)

    const verifListQuery = supabase
      .from("assessment_sessions")
      .select(
        "id, created_at, status, final_outcome, metadata, user_id, profiles ( full_name )"
      )
      .eq("tool_id", EUDR_TOOL_ID)
      .eq("session_type", "verifica")

    if (!isAdmin) verifListQuery.eq("user_id", userId)
    if (stato === "in_corso") {
      verifListQuery.neq("status", "completed")
    } else if (stato === "conclusa") {
      verifListQuery.eq("status", "completed")
    }
    if (vq) {
      verifListQuery.or(
        [
          `metadata->>nome_commerciale.ilike.%${vq}%`,
          `profiles.full_name.ilike.%${vq}%`,
        ].join(",")
      )
    }

    queryCount += 2
    const [{ count: verifCount }, { data: verifData, error: verifError }] =
      await Promise.all([
        verifCountQuery,
        verifListQuery.order(vsort, { ascending: vdir === "asc" }).range(vstart, vend),
      ])

    if (verifError) {
      console.error("Errore durante il fetch delle verifiche EUDR:", verifError)
    }

    totalPagesV = Math.ceil((verifCount || 0) / limit) || 1

    const workflowInputs = (verifData || []).map((row) => ({
      id: row.id,
      status: row.status,
      final_outcome: row.final_outcome,
      metadata: row.metadata,
      fallbackStep1Completed:
        row.status === "completed" && row.final_outcome !== "Esente / Non Soggetto",
    }))

    queryCount += workflowInputs.length > 0 ? 1 : 0
    const workflowById = await resolveEudrWorkflowStatesBatch(supabase, workflowInputs)

    verificationRows = (verifData || []).map((row) => {
      const workflowState = workflowById.get(row.id)
      return {
        id: row.id,
        created_at: row.created_at || new Date().toISOString(),
        status: row.status || "in_progress",
        final_outcome: row.final_outcome,
        metadata: (row.metadata as EudrVerificationRow["metadata"]) || null,
        resume_url: workflowState?.resumeUrl ?? `/EUDR/evaluation?session_id=${row.id}`,
        owner_name:
          (row.profiles as { full_name?: string } | null)?.full_name ?? null,
      }
    })
  }

  logRoutePerf("/EUDR/search", {
    tab,
    queryCount,
    durationMs: Date.now() - perfStart,
  })

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Storico verifiche e analisi EUDR</h1>
        <p className="text-slate-500">
          Passa rapidamente tra analisi finali e verifiche preliminari per EUDR.
        </p>
      </div>

      <EudrSearchView
        tab={tab}
        analyses={formattedAnalisi}
        page={page}
        totalPages={totalPages}
        verifications={verificationRows}
        vpage={vpage}
        totalPagesV={totalPagesV}
        isAdmin={isAdmin}
      />
    </div>
  )
}

function LockedSearchView() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
      <div className="p-4 bg-slate-100 rounded-full">
        <Lock className="w-10 h-10 text-slate-400" />
      </div>
      <h2 className="text-xl font-bold text-slate-700">Archivio Analisi Bloccato</h2>
      <p className="text-slate-500 text-sm">
        Passa a Premium per cercare e gestire lo storico delle analisi e verifiche EUDR.
      </p>
    </div>
  )
}
