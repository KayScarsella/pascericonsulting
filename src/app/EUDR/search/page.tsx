import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { Lock } from "lucide-react"

import { EudrSearchView, type EudrVerificationRow } from "@/components/EudrSearchView"
import type { EudrAssessmentSessionRow } from "@/components/EudrAnalisiTable"

export default async function EudrSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const tab = (params.tab as string) || "analisi"
  const page = Math.max(1, parseInt((params.page as string) || "1", 10))
  const vpage = Math.max(1, parseInt((params.vpage as string) || "1", 10))
  const limit = 25
  const start = (page - 1) * limit
  const end = start + limit - 1
  const vstart = (vpage - 1) * limit
  const vend = vstart + limit - 1

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

  const { role } = await getToolAccess(EUDR_TOOL_ID)
  const hasAccess = role === "admin" || role === "premium"
  const isAdmin = role === "admin"

  if (!hasAccess) {
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

  // ANALISI FINALI EUDR
  const analisiQuery = supabase
    .from("assessment_sessions")
    .select(
      "id, created_at, status, parent_session_id, final_outcome, metadata, evaluation_code, user_id, profiles ( full_name )",
      {
        count: "exact",
      }
    )
    .eq("tool_id", EUDR_TOOL_ID)
    .eq("session_type", "analisi_finale")
  if (!isAdmin) analisiQuery.eq("user_id", user.id)

  const { data: analisiData, count, error: analisiError } = await analisiQuery
    .order("created_at", { ascending: false })
    .range(start, end)

  if (analisiError) {
    console.error("Errore durante il fetch delle analisi EUDR:", analisiError)
  }

  const totalPages = Math.ceil((count || 0) / limit) || 1

  const parentIds = Array.from(
    new Set(
      (analisiData || [])
        .map((r) => r.parent_session_id)
        .filter((id): id is string => Boolean(id))
    )
  )

  const parentCodeById = new Map<string, number>()

  if (parentIds.length > 0) {
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

  const formattedAnalisi: EudrAssessmentSessionRow[] = (analisiData || []).map((row) => {
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

  // VERIFICHE PRELIMINARI EUDR
  const verifCountQuery = supabase
    .from("assessment_sessions")
    .select("id", { count: "exact", head: true })
    .eq("tool_id", EUDR_TOOL_ID)
    .eq("session_type", "verifica")
  if (!isAdmin) verifCountQuery.eq("user_id", user.id)
  const { count: verifCount } = await verifCountQuery

  const totalPagesV = Math.ceil((verifCount || 0) / limit) || 1

  const verifListQuery = supabase
    .from("assessment_sessions")
    .select(
      "id, created_at, status, final_outcome, metadata, user_id, profiles ( full_name )"
    )
    .eq("tool_id", EUDR_TOOL_ID)
    .eq("session_type", "verifica")

  if (!isAdmin) verifListQuery.eq("user_id", user.id)

  const { data: verifData, error: verifError } = await verifListQuery
    .order("created_at", { ascending: false })
    .range(vstart, vend)

  if (verifError) {
    console.error("Errore durante il fetch delle verifiche EUDR:", verifError)
  }

  const verificationRows: EudrVerificationRow[] = (verifData || []).map(
    (row) => ({
      id: row.id,
      created_at: row.created_at || new Date().toISOString(),
      status: row.status || "in_progress",
      final_outcome: row.final_outcome,
      metadata: (row.metadata as EudrVerificationRow["metadata"]) || null,
      owner_name:
        (row.profiles as { full_name?: string } | null)?.full_name ?? null,
    })
  )

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