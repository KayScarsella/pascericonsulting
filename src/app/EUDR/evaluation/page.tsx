import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { ShieldAlert } from "lucide-react"

import { SectionList } from "@/components/questions/SectionList"

export default async function EvaluationPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { role } = await getToolAccess(EUDR_TOOL_ID)
  
  if (!role || role === 'standard') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="p-4 bg-amber-50 rounded-full">
            <ShieldAlert className="w-12 h-12 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Accesso Limitato</h1>
        <p className="text-slate-600 max-w-md">
            La Valutazione è disponibile solo per gli utenti <strong>Premium</strong> o <strong>Admin</strong>.
        </p>
      </div>
    )
  }

  // 🛠️ DA MODIFICARE: Qui cambieremo il `.eq('group_name', 'Analisi Rischio')` 
  // con il nome del gruppo che vuoi caricare in questa pagina.
  const { data: sections } = await supabase
    .from('sections')
    .select(`
      *,
      questions (
        *
      )
    `)
    .eq('tool_id', EUDR_TOOL_ID)
    .eq('group_name', 'Valutazione')
    .order('order_index', { ascending: true })
    .order('order_index', { foreignTable: 'questions', ascending: true })

  const { data: userResponses } = await supabase
    .from('user_responses')
    .select('*')
    .eq('tool_id', EUDR_TOOL_ID)
    .eq('user_id', user.id)

  return (
    <div className="max-w-5xl mx-auto">
      
      <div className="border-b border-slate-200 pb-6 mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Valutazione EUDR</h1>
        <p className="text-slate-500 mt-2">
          Controlla e valuta i dati inseriti.
        </p>
      </div>

      <SectionList 
        sections={sections} 
        userResponses={userResponses} 
        toolId={EUDR_TOOL_ID} 
        // 🛠️ DA MODIFICARE: Puoi impostare qui la modalità (es: defaultMode="view")
        defaultOpen={true}
        defaultMode="edit" 
        // redirectOnSave="/next-page" // Se serve un altro step successivo!
      />
      
    </div>
  )
}