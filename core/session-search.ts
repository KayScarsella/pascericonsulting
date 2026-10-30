import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * PostgREST non supporta filtri su risorse embedded (es. profiles.full_name)
 * dentro .or() sulla tabella principale. Per cercare per proprietario si risolvono
 * prima gli user_id da profiles e si usa user_id.in.(...) nel filtro OR.
 */
export async function resolveOwnerUserIdsForSearch(
  supabase: SupabaseClient,
  q: string
): Promise<string[]> {
  const trimmed = q.trim()
  if (!trimmed) return []

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("full_name", `%${trimmed}%`)
    .limit(50)

  if (error) {
    console.error("Errore ricerca proprietari:", error.message)
    return []
  }

  return (data || []).map((p) => p.id)
}

export function buildAnalisiSearchOrClause(opts: {
  q: string
  ownerUserIds?: string[]
}): string {
  const { q, ownerUserIds = [] } = opts
  const clauses = [
    `metadata->>nome_operazione.ilike.%${q}%`,
    `metadata->>operation_name.ilike.%${q}%`,
  ]

  const n = Number.parseInt(q, 10)
  if (Number.isFinite(n)) {
    clauses.push(`evaluation_code.eq.${n}`)
  }

  if (ownerUserIds.length > 0) {
    clauses.push(`user_id.in.(${ownerUserIds.join(",")})`)
  }

  return clauses.join(",")
}

export function buildVerificaSearchOrClause(opts: {
  q: string
  ownerUserIds?: string[]
  includeEvaluationCode?: boolean
}): string {
  const { q, ownerUserIds = [], includeEvaluationCode = false } = opts
  const clauses = [`metadata->>nome_commerciale.ilike.%${q}%`]

  if (includeEvaluationCode) {
    const n = Number.parseInt(q, 10)
    if (Number.isFinite(n)) {
      clauses.push(`evaluation_code.eq.${n}`)
    }
  }

  if (ownerUserIds.length > 0) {
    clauses.push(`user_id.in.(${ownerUserIds.join(",")})`)
  }

  return clauses.join(",")
}
