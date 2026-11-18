import { unstable_cache } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { createServiceRoleClient } from "@/utils/supabase/admin"
import { EUDR_SEARCH_ALL_TAG, eudrSearchTag } from "@/lib/eudr-cache"
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
import {
  buildAnalisiSearchOrClause,
  buildVerificaSearchOrClause,
  resolveOwnerUserIdsForSearch,
} from "@/lib/session-search"
import type { Database } from "@/types/supabase"

type SearchParams = { [key: string]: string | string[] | undefined }

type SearchCacheKey = {
  userId: string
  isAdmin: boolean
  tab: string
  page: number
  vpage: number
  q: string
  vq: string
  sort: string
  dir: string
  vsort: string
  vdir: string
  esito: string
  stato: string
}

type ParentEmbed =
  | { evaluation_code: number }
  | { evaluation_code: number }[]
  | null

type AnalisiListRow = {
  id: string
  created_at: string | null
  status: string | null
  parent_session_id: string | null
  final_outcome: string | null
  metadata: EudrAssessmentSessionRow["metadata"]
  evaluation_code: number | null
  profiles: { full_name?: string | null } | null
  parent?: ParentEmbed
}

type SearchPayload = {
  formattedAnalisi: EudrAssessmentSessionRow[]
  totalPages: number
  verificationRows: EudrVerificationRow[]
  totalPagesV: number
  queryCount: number
}

const PAGE_SIZE = 25

const ANALISI_EMBED_SELECT =
  "id, created_at, status, parent_session_id, final_outcome, metadata, evaluation_code, user_id, profiles ( full_name ), parent:assessment_sessions!assessment_sessions_parent_fk(evaluation_code)" as const

const ANALISI_PLAIN_SELECT =
  "id, created_at, status, parent_session_id, final_outcome, metadata, evaluation_code, user_id, profiles ( full_name )" as const

export async function EudrSearchData({
  searchParams,
  isAdmin,
  userId,
}: {
  searchParams: SearchParams
  isAdmin: boolean
  userId: string
}) {
  const perfStart = Date.now()
  const tab = normalizeEudrSearchTab(searchParams.tab as string | undefined)
  const key: SearchCacheKey = {
    userId,
    isAdmin,
    tab,
    page: parsePageParam(searchParams.page, 1),
    vpage: parsePageParam(searchParams.vpage, 1),
    q: parseSearchParam(searchParams.q),
    vq: parseSearchParam(searchParams.vq),
    sort: (searchParams.sort as string) || "created_at",
    dir: parseSortDirParam(searchParams.dir),
    vsort: (searchParams.vsort as string) || "created_at",
    vdir: parseSortDirParam(searchParams.vdir),
    esito: (searchParams.esito as string) || "all",
    stato: (searchParams.stato as string) || "all",
  }

  const payload = await loadCachedEudrSearch(key)

  logRoutePerf("/EUDR/search", {
    tab,
    queryCount: payload.queryCount,
    durationMs: Date.now() - perfStart,
    dbMs: Date.now() - perfStart,
  })

  return (
    <EudrSearchView
      tab={tab}
      analyses={payload.formattedAnalisi}
      page={key.page}
      totalPages={payload.totalPages}
      verifications={payload.verificationRows}
      vpage={key.vpage}
      totalPagesV={payload.totalPagesV}
      isAdmin={isAdmin}
    />
  )
}

function loadCachedEudrSearch(key: SearchCacheKey) {
  const tags = key.isAdmin
    ? [eudrSearchTag(key.userId), EUDR_SEARCH_ALL_TAG]
    : [eudrSearchTag(key.userId)]
  return unstable_cache(async () => queryEudrSearch(key), ["eudr-search-list", JSON.stringify(key)], {
    tags,
    revalidate: 3600,
  })()
}

async function queryEudrSearch(key: SearchCacheKey): Promise<SearchPayload> {
  const supabase = createServiceRoleClient()
  const isVerificheTab = key.tab === "verifiche"
  let queryCount = 0
  let formattedAnalisi: EudrAssessmentSessionRow[] = []
  let totalPages = 1
  let verificationRows: EudrVerificationRow[] = []
  let totalPagesV = 1

  if (!isVerificheTab) {
    const loaded = await loadAnalisiPage(supabase, key)
    queryCount += loaded.queryCount
    totalPages = loaded.totalPages
    formattedAnalisi = loaded.rows
  } else {
    const loaded = await loadVerifichePage(supabase, key)
    queryCount += loaded.queryCount
    totalPagesV = loaded.totalPagesV
    verificationRows = loaded.rows
  }

  return { formattedAnalisi, totalPages, verificationRows, totalPagesV, queryCount }
}

type AnalisiFilterBuilder = {
  eq: (column: string, value: string) => AnalisiFilterBuilder
  neq: (column: string, value: string) => AnalisiFilterBuilder
  in: (column: string, value: readonly string[]) => AnalisiFilterBuilder
  or: (filters: string) => AnalisiFilterBuilder
}

async function applyAnalisiFilters<T extends AnalisiFilterBuilder>(
  query: T,
  supabase: SupabaseClient<Database>,
  key: SearchCacheKey
): Promise<T> {
  query.eq("tool_id", EUDR_TOOL_ID).eq("session_type", "analisi_finale")
  if (!key.isAdmin) query.eq("user_id", key.userId)
  if (key.esito === "in_corso") {
    query.neq("status", "completed")
  } else if (key.esito === "accettabile") {
    query.eq("status", "completed").in("final_outcome", [...ANALISI_FINALE_GOOD_OUTCOMES])
  } else if (key.esito === "non_accettabile") {
    query.eq("status", "completed").in("final_outcome", [...ANALISI_FINALE_NEGATIVE_OUTCOMES])
  }
  if (key.q) {
    const ownerUserIds = key.isAdmin ? await resolveOwnerUserIdsForSearch(supabase, key.q) : []
    query.or(buildAnalisiSearchOrClause({ q: key.q, ownerUserIds }))
  }
  return query
}

async function loadAnalisiPage(supabase: SupabaseClient<Database>, key: SearchCacheKey) {
  const start = (key.page - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE - 1
  let queryCount = 1

  const embeddedQuery = supabase
    .from("assessment_sessions")
    .select(ANALISI_EMBED_SELECT, { count: "exact" })
  await applyAnalisiFilters(embeddedQuery, supabase, key)
  const embeddedResult = await embeddedQuery
    .order(key.sort, { ascending: key.dir === "asc" })
    .range(start, end)

  let rows: AnalisiListRow[]
  let count = embeddedResult.count
  if (!embeddedResult.error) {
    rows = (embeddedResult.data ?? []).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      status: row.status,
      parent_session_id: row.parent_session_id,
      final_outcome: row.final_outcome,
      metadata: (row.metadata as EudrAssessmentSessionRow["metadata"]) || null,
      evaluation_code: row.evaluation_code,
      profiles: profileRecord(row.profiles),
      parent: row.parent,
    }))
  } else {
    console.error(
      "EUDR search parent embed failed, using the follow-up query:",
      embeddedResult.error.message
    )
    queryCount += 1
    const plainQuery = supabase
      .from("assessment_sessions")
      .select(ANALISI_PLAIN_SELECT, { count: "exact" })
    await applyAnalisiFilters(plainQuery, supabase, key)
    const plainResult = await plainQuery
      .order(key.sort, { ascending: key.dir === "asc" })
      .range(start, end)
    if (plainResult.error) {
      console.error("Errore durante il fetch delle analisi EUDR:", plainResult.error)
    }
    count = plainResult.count
    const plainRows = plainResult.data ?? []
    const parentCodeById = new Map<string, number>()
    const parentIds = Array.from(
      new Set(
        plainRows.map((row) => row.parent_session_id).filter((id): id is string => Boolean(id))
      )
    )
    if (parentIds.length > 0) {
      queryCount += 1
      const { data: parents, error: parentsError } = await supabase
        .from("assessment_sessions")
        .select("id, evaluation_code")
        .in("id", parentIds)
      if (parentsError) {
        console.error("Errore durante il fetch delle verifiche base EUDR:", parentsError)
      } else {
        for (const parent of parents ?? []) parentCodeById.set(parent.id, parent.evaluation_code)
      }
    }
    rows = plainRows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      status: row.status,
      parent_session_id: row.parent_session_id,
      final_outcome: row.final_outcome,
      metadata: (row.metadata as EudrAssessmentSessionRow["metadata"]) || null,
      evaluation_code: row.evaluation_code,
      profiles: profileRecord(row.profiles),
      parent:
        row.parent_session_id && parentCodeById.has(row.parent_session_id)
          ? { evaluation_code: parentCodeById.get(row.parent_session_id) ?? 0 }
          : null,
    }))
  }

  return {
    queryCount,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE) || 1,
    rows: rows.map((row) => toAnalisiRow(row)),
  }
}

function toAnalisiRow(row: AnalisiListRow): EudrAssessmentSessionRow {
  const baseId = row.parent_session_id || row.id
  const embeddedCode = parentEvaluationCode(row.parent)
  const baseCode = row.parent_session_id
    ? (embeddedCode ?? row.evaluation_code ?? 0)
    : (row.evaluation_code ?? 0)

  return {
    id: row.id,
    created_at: row.created_at || new Date().toISOString(),
    status: row.status || "in_progress",
    parent_session_id: row.parent_session_id,
    final_outcome: row.final_outcome,
    metadata: row.metadata || null,
    evaluation_code: row.evaluation_code || 0,
    base_session_id: baseId,
    base_evaluation_code: baseCode,
    owner_name: row.profiles?.full_name ?? null,
  }
}

function profileRecord(
  profiles: { full_name?: string | null } | { full_name?: string | null }[] | null
): { full_name?: string | null } | null {
  if (!profiles) return null
  if (Array.isArray(profiles)) return profiles[0] ?? null
  return profiles
}

function parentEvaluationCode(parent: ParentEmbed | undefined): number | null {
  if (!parent) return null
  if (Array.isArray(parent)) return parent[0]?.evaluation_code ?? null
  return parent.evaluation_code ?? null
}

async function loadVerifichePage(supabase: SupabaseClient<Database>, key: SearchCacheKey) {
  const start = (key.vpage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE - 1

  let countQuery = supabase
    .from("assessment_sessions")
    .select("id", { count: "exact", head: true })
    .eq("tool_id", EUDR_TOOL_ID)
    .eq("session_type", "verifica")
  if (!key.isAdmin) countQuery = countQuery.eq("user_id", key.userId)

  let listQuery = supabase
    .from("assessment_sessions")
    .select("id, created_at, status, final_outcome, metadata, user_id, profiles ( full_name )")
    .eq("tool_id", EUDR_TOOL_ID)
    .eq("session_type", "verifica")
  if (!key.isAdmin) listQuery = listQuery.eq("user_id", key.userId)
  if (key.stato === "in_corso") listQuery = listQuery.neq("status", "completed")
  else if (key.stato === "conclusa") listQuery = listQuery.eq("status", "completed")
  if (key.vq) {
    const ownerUserIds = key.isAdmin ? await resolveOwnerUserIdsForSearch(supabase, key.vq) : []
    listQuery = listQuery.or(buildVerificaSearchOrClause({ q: key.vq, ownerUserIds }))
  }

  const [{ count }, { data, error }] = await Promise.all([
    countQuery,
    listQuery.order(key.vsort, { ascending: key.vdir === "asc" }).range(start, end),
  ])

  if (error) {
    console.error("Errore durante il fetch delle verifiche EUDR:", error)
  }

  const workflowInputs = (data || []).map((row) => ({
    id: row.id,
    status: row.status,
    final_outcome: row.final_outcome,
    metadata: row.metadata,
    fallbackStep1Completed:
      row.status === "completed" && row.final_outcome !== "Esente / Non Soggetto",
  }))
  const workflowById = await resolveEudrWorkflowStatesBatch(supabase, workflowInputs)

  return {
    queryCount: 2 + (workflowInputs.length > 0 ? 1 : 0),
    totalPagesV: Math.ceil((count || 0) / PAGE_SIZE) || 1,
    rows: (data || []).map((row) => {
      const workflowState = workflowById.get(row.id)
      return {
        id: row.id,
        created_at: row.created_at || new Date().toISOString(),
        status: row.status || "in_progress",
        final_outcome: row.final_outcome,
        metadata: (row.metadata as EudrVerificationRow["metadata"]) || null,
        resume_url: workflowState?.resumeUrl ?? `/EUDR/evaluation?session_id=${row.id}`,
        owner_name: (row.profiles as { full_name?: string } | null)?.full_name ?? null,
      }
    }),
  }
}
