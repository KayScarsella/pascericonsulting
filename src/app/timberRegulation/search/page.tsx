import { getToolAccess } from "@/lib/tool-auth"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { Lock } from "lucide-react"

// 🛠️ Importiamo il componente e i tipi esatti che abbiamo definito senza "any"
import { SearchClient, AssessmentSessionRow, SessionMetadata } from "@/components/SearchClient" 

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const page = parseInt((params.page as string) || '1');
  const limit = 25;
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  // 1. Setup Supabase
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 2. Check Ruolo (Abilitiamo l'accesso a Premium e Admin)
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

  // 3. FETCH DATI (Pulito e Unificato)
  const { data, count, error } = await supabase
    .from('assessment_sessions')
    .select('id, created_at, status, parent_session_id, final_outcome, metadata, evaluation_code', { count: 'exact' })
    .eq('tool_id', TIMBER_TOOL_ID)
    .eq('session_type', 'analisi_finale') // Mostra solo le Analisi Finali
    .order('created_at', { ascending: false })
    .range(start, end);

  if (error) {
    console.error("Errore durante il fetch dello storico analisi:", error);
  }

  const totalPages = Math.ceil((count || 0) / limit) || 1;

  // 4. FORMATTAZIONE E TIPIZZAZIONE SICURA (Nessun 'any')
  // Mappiamo i dati di Supabase per farli combaciare esattamente con AssessmentSessionRow
  const formattedData: AssessmentSessionRow[] = (data || []).map(row => ({
    id: row.id,
    created_at: row.created_at || new Date().toISOString(),
    status: row.status || 'in_progress',
    parent_session_id: row.parent_session_id,
    final_outcome: row.final_outcome,
    // Castiamo il JSONB di Supabase al nostro tipo SessionMetadata
    metadata: (row.metadata as SessionMetadata) || null,
    evaluation_code: row.evaluation_code || 0
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-8 px-4">
      <div className="space-y-2 border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold text-slate-900">Storico Analisi</h1>
        <p className="text-slate-500">Gestisci e visualizza le tue analisi concluse o in corso di validità.</p>
      </div>

      {/* Componente Client fortemente tipizzato */}
      <SearchClient 
        data={formattedData}
        page={page}
        totalPages={totalPages}
        isAdmin={isAdmin}
      />
    </div>
  )
}