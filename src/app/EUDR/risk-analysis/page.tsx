import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { ShieldAlert } from "lucide-react"

// Importiamo SOLO il componente lista, non i singoli item
import { SectionList } from "@/components/questions/SectionList"

export default async function RiskAnalysisPage() {
  // 1. Setup Supabase
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  // 2. Auth & User Check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 3. Controllo Ruolo (Safety)
  const { role } = await getToolAccess(EUDR_TOOL_ID)
  
  // Se non ha ruolo o è standard -> BLOCCO VISIVO
  if (!role || role === 'standard') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="p-4 bg-amber-50 rounded-full">
            <ShieldAlert className="w-12 h-12 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Accesso Limitato</h1>
        <p className="text-slate-600 max-w-md">
            L&apos;Analisi del Rischio è disponibile solo per gli utenti <strong>Premium</strong> o <strong>Admin</strong>.
        </p>
        <p className="text-sm text-slate-500">Contatta l&apos;amministratore per aggiornare il tuo piano.</p>
      </div>
    )
  }

  // 4. FETCH DATI STRUTTURATI (Sezioni + Domande annidate)
  const { data: sections } = await supabase
    .from('sections')
    .select(`
      *,
      questions (
        *
      )
    `)
    .eq('tool_id', EUDR_TOOL_ID)
    .eq('group_name', 'Analisi Rischio')
    .order('order_index', { ascending: true })
    .order('order_index', { foreignTable: 'questions', ascending: true })

  // 5. FETCH RISPOSTE ESISTENTI
  const { data: userResponses } = await supabase
    .from('user_responses')
    .select('*')
    .eq('tool_id', EUDR_TOOL_ID)
    .eq('user_id', user.id)

  return (
    <div className="max-w-5xl mx-auto">
      
      {/* Header statico della pagina */}
      <div className="border-b border-slate-200 pb-6 mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Analisi Rischio EUDR</h1>
        <p className="text-slate-500 mt-2">
          Compila le sezioni sottostanti per calcolare il livello di rischio. I dati vengono salvati automaticamente.
        </p>
      </div>

      {/* Componente di Visualizzazione Separato */}
      <SectionList 
        sections={sections} 
        userResponses={userResponses} 
        toolId={EUDR_TOOL_ID} 
        defaultOpen={true}
        defaultMode="edit"
        redirectOnSave="/timberRegulation/evaluation"
      />
      
    </div>
  )
}