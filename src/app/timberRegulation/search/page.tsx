import { getToolAccess } from "@/lib/tool-auth"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { Lock } from "lucide-react"

import { AssessmentSessionRow, SessionMetadata } from "@/components/TimberAnalisiTable"
import { VerificationRow, TimberSearchView } from "@/components/TimberSearchView"
import {
  parsePageParam,
  parseSearchParam,
  parseSortDirParam,
} from "@/lib/table-query"
import {
  ANALISI_FINALE_GOOD_OUTCOMES,
  ANALISI_FINALE_NEGATIVE_OUTCOMES,
} from "@/lib/final-outcome"
import { resolveTimberWorkflowState } from "@/lib/timber-workflow-state"
import { normalizeTimberSearchTab } from "@/lib/timber-search-routing"

// ID della domanda "Nome Commerciale" nelle verifiche Timber
const NOME_COMMERCIALE_QUESTION_ID = '8e2d4d57-161c-4f37-8089-04ab947389e1'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const tab = normalizeTimberSearchTab(params.tab as string | undefined)
  const page = parsePageParam(params.page, 1)
  const vpage = parsePageParam(params.vpage, 1)
  const q = parseSearchParam(params.q)
  const vq = parseSearchParam(params.vq)
  const sort = (params.sort as string) || 'created_at'
  const dir = parseSortDirParam(params.dir)
  const vsort = (params.vsort as string) || 'created_at'
  const vdir = parseSortDirParam(params.vdir)
  const esito = (params.esito as string) || 'all'
  const stato = (params.stato as string) || 'all'
  const limit = 25
  const start = (page - 1) * limit
  const end = start + limit - 1
  const vstart = (vpage - 1) * limit
  const vend = vstart + limit - 1

  // 1. Setup Supabase
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Check Ruolo
  const { role } = await getToolAccess(TIMBER_TOOL_ID)
  const hasAccess = role === 'admin' || role === 'premium'
  const isAdmin = role === 'admin'

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <div className="p-4 bg-slate-100 rounded-full">
          <Lock className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-700">Archivio Analisi Bloccato</h2>
        <p className="text-slate-500 text-sm">Passa a Premium per cercare e gestire il tuo storico analisi.</p>
      </div>
    )
  }

  // 3a. FETCH ANALISI FINALI (paginated). Admin sees all; others only their own.
  const analisiQuery = supabase
    .from('assessment_sessions')
    .select(
      'id, created_at, status, parent_session_id, final_outcome, metadata, evaluation_code, user_id, profiles ( full_name )',
      { count: 'exact' }
    )
    .eq('tool_id', TIMBER_TOOL_ID)
    .eq('session_type', 'analisi_finale')
  if (!isAdmin) analisiQuery.eq('user_id', user.id)
  if (esito === 'in_corso') {
    analisiQuery.neq('status', 'completed')
  } else if (esito === 'accettabile') {
    analisiQuery.eq('status', 'completed')
    analisiQuery.in('final_outcome', [...ANALISI_FINALE_GOOD_OUTCOMES])
  } else if (esito === 'non_accettabile') {
    analisiQuery.eq('status', 'completed')
    analisiQuery.in('final_outcome', [...ANALISI_FINALE_NEGATIVE_OUTCOMES])
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
  const { data, count, error } = await analisiQuery
    .order(sort, { ascending: dir === 'asc' })
    .range(start, end)

  if (error) {
    console.error("Errore durante il fetch dello storico analisi:", error)
  }

  const totalPages = Math.ceil((count || 0) / limit) || 1

  const parentIds = Array.from(
    new Set((data || []).map((r) => r.parent_session_id).filter((id): id is string => Boolean(id)))
  )

  const parentCodeById = new Map<string, number>()

  if (parentIds.length > 0) {
    const { data: parents, error: parentsError } = await supabase
      .from('assessment_sessions')
      .select('id, evaluation_code')
      .in('id', parentIds)

    if (parentsError) {
      console.error("Errore durante il fetch delle verifiche base:", parentsError)
    } else {
      (parents || []).forEach((p) => parentCodeById.set(p.id, p.evaluation_code))
    }
  }

  const formattedData: AssessmentSessionRow[] = (data || []).map((row) => {
    const baseId = row.parent_session_id || row.id
    const baseCode = parentCodeById.get(baseId) ?? row.evaluation_code ?? 0

    return {
      id: row.id,
      created_at: row.created_at || new Date().toISOString(),
      status: row.status || 'in_progress',
      parent_session_id: row.parent_session_id,
      final_outcome: row.final_outcome,
      metadata: (row.metadata as SessionMetadata) || null,
      evaluation_code: row.evaluation_code || 0,
      base_session_id: baseId,
      base_evaluation_code: baseCode,
      owner_name:
        (row.profiles as { full_name?: string } | null)?.full_name ?? null,
    }
  })

  // 3b. FETCH VERIFICHE PRELIMINARI (paginated). Admin sees all; others only their own.
  const verifCountQuery = supabase
    .from('assessment_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('tool_id', TIMBER_TOOL_ID)
    .eq('session_type', 'verifica')
  if (!isAdmin) verifCountQuery.eq('user_id', user.id)
  const { count: verifCount } = await verifCountQuery

  const totalPagesV = Math.ceil((verifCount || 0) / limit) || 1

  const verifListQuery = supabase
    .from('assessment_sessions')
    .select(
      'id, created_at, evaluation_code, status, final_outcome, metadata, user_id, profiles ( full_name )'
    )
    .eq('tool_id', TIMBER_TOOL_ID)
    .eq('session_type', 'verifica')
  if (!isAdmin) verifListQuery.eq('user_id', user.id)
  if (stato === 'in_corso') {
    verifListQuery.neq('status', 'completed')
  } else if (stato === 'conclusa') {
    verifListQuery.eq('status', 'completed')
  }
  if (vq) {
    const n = Number.parseInt(vq, 10)
    const numericClause = Number.isFinite(n) ? `,evaluation_code.eq.${n}` : ""
    verifListQuery.or(
      [
        `metadata->>nome_commerciale.ilike.%${vq}%`,
        `profiles.full_name.ilike.%${vq}%`,
      ].join(",") + numericClause
    )
  }
  const { data: baseSessions } = await verifListQuery
    .order(vsort, { ascending: vdir === 'asc' })
    .range(vstart, vend)

  let verificationRows: VerificationRow[] = []

  if (baseSessions && baseSessions.length > 0) {
    const sessionIds = baseSessions.map((s) => s.id)

    const { data: nomeRows } = await supabase
      .from('user_responses')
      .select('session_id, answer_text, answer_json')
      .eq('tool_id', TIMBER_TOOL_ID)
      .in('session_id', sessionIds)
      .eq('question_id', NOME_COMMERCIALE_QUESTION_ID)

    const nomeBySession = new Map<string, string>()
    for (const r of nomeRows || []) {
      let val = (r.answer_text || '').toString().trim()
      if (!val && r.answer_json) {
        const j = r.answer_json as Record<string, unknown>
        val = (j?.value ?? j?.text ?? JSON.stringify(j) ?? '').toString().trim()
      }
      if (val) nomeBySession.set(r.session_id, val)
    }

    verificationRows = await Promise.all(baseSessions.map(async (session) => {
      const metadata = (session.metadata as SessionMetadata | null) ?? null
      const workflowState = await resolveTimberWorkflowState(
        supabase,
        {
          id: session.id,
          status: session.status,
          final_outcome: session.final_outcome,
          metadata: session.metadata,
        },
        session.status === "completed" && session.final_outcome !== "Esente / Non Soggetto"
      )

      return {
        id: session.id,
        created_at: session.created_at || new Date().toISOString(),
        evaluation_code: session.evaluation_code || 0,
        riskCompleted: workflowState.step1Completed,
        evaluationCompleted: workflowState.step2Saved,
        status: session.status || 'in_progress',
        final_outcome: session.final_outcome,
        isBlocked: workflowState.isExempt,
        resume_url: workflowState.resumeUrl,
        owner_name:
          (session.profiles as { full_name?: string } | null)?.full_name ??
          null,
        nomeCommerciale:
          nomeBySession.get(session.id) ?? (metadata?.nome_commerciale as string) ?? null,
      }
    }))
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Storico verifiche e analisi</h1>
        <p className="text-slate-500">
          Passa rapidamente tra analisi finali e verifiche preliminari per il Regolamento Timber.
        </p>
      </div>

      <TimberSearchView
        tab={tab}
        analyses={formattedData}
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
