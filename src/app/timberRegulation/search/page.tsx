import { getToolAccess } from "@/lib/tool-auth"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { Lock } from "lucide-react"

import { AssessmentSessionRow, SessionMetadata } from "@/components/TimberAnalisiTable"
import { VerificationRow, TimberSearchView } from "@/components/TimberSearchView"

// ID della domanda "Nome Commerciale" nelle verifiche Timber
const NOME_COMMERCIALE_QUESTION_ID = '8e2d4d57-161c-4f37-8089-04ab947389e1'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const tab = (params.tab as string) || 'analisi'
  const page = Math.max(1, parseInt((params.page as string) || '1', 10))
  const vpage = Math.max(1, parseInt((params.vpage as string) || '1', 10))
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
  const { data, count, error } = await analisiQuery
    .order('created_at', { ascending: false })
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
  const { data: baseSessions } = await verifListQuery
    .order('created_at', { ascending: false })
    .range(vstart, vend)

  let verificationRows: VerificationRow[] = []

  if (baseSessions && baseSessions.length > 0) {
    const riskSectionId = 'dbbf9201-5823-4552-944d-eaa119e7235c'
    const evalSectionIds = [
      '945ec651-88f7-47df-bcfe-60215731094a',
      '397d55b4-18a0-4cc4-b92b-1858532d1627',
    ]

    const sessionIds = baseSessions.map((s) => s.id)

    const { data: questions } = await supabase
      .from('questions')
      .select('id, section_id')
      .in('section_id', [riskSectionId, ...evalSectionIds])

    const riskQuestionIds = (questions || [])
      .filter((q) => q.section_id === riskSectionId)
      .map((q) => q.id)

    const evalQuestionIds = (questions || [])
      .filter((q) => evalSectionIds.includes(q.section_id))
      .map((q) => q.id)

    const { data: responses } = await supabase
      .from('user_responses')
      .select('session_id, question_id')
      .eq('tool_id', TIMBER_TOOL_ID)
      .in('session_id', sessionIds)
      .in('question_id', [...riskQuestionIds, ...evalQuestionIds])

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

    verificationRows = baseSessions.map((session) => {
      const responsesForSession = (responses || []).filter((r) => r.session_id === session.id)

      let riskCompleted =
        riskQuestionIds.length > 0 &&
        riskQuestionIds.every((qid) => responsesForSession.some((r) => r.question_id === qid))
      let evaluationCompleted =
        evalQuestionIds.length > 0 &&
        evalQuestionIds.every((qid) => responsesForSession.some((r) => r.question_id === qid))

      const metadata = session.metadata as SessionMetadata | null
      const isBlocked = metadata?.is_blocked === true

      if (session.status === 'completed') {
        riskCompleted = true
        if (!isBlocked) {
          evaluationCompleted = true
        }
      }

      return {
        id: session.id,
        created_at: session.created_at || new Date().toISOString(),
        evaluation_code: session.evaluation_code || 0,
        riskCompleted,
        evaluationCompleted,
        status: session.status || 'in_progress',
        final_outcome: session.final_outcome,
        isBlocked,
        owner_name:
          (session.profiles as { full_name?: string } | null)?.full_name ??
          null,
        nomeCommerciale:
          nomeBySession.get(session.id) ?? (metadata?.nome_commerciale as string) ?? null,
      }
    })
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
