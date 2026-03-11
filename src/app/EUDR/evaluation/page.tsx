import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { ShieldAlert } from "lucide-react"

import { SectionList } from "@/components/questions/SectionList"
import { processEudrValutazione } from "@/actions/workflows"

export default async function EvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const sessionId = params.session_id as string | undefined

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
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
          La configurazione delle analisi finali è disponibile solo per gli utenti <strong>Premium</strong> o <strong>Admin</strong>.
        </p>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <div className="p-4 bg-red-50 rounded-full">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Nessuna verifica selezionata</h2>
        <p className="text-slate-500">Non è stato fornito un ID valido. Torna allo storico per selezionare una verifica.</p>
      </div>
    )
  }

  const { data: sessionInfo, error: sessionError } = await supabase
    .from('assessment_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .eq('tool_id', EUDR_TOOL_ID)
    .single()

  if (sessionError || !sessionInfo) {
    return <div className="p-8 text-center text-red-600 font-bold">Sessione non trovata nel database.</div>
  }

  if (sessionInfo.user_id !== user.id && role !== 'admin') {
    return <div className="p-8 text-center text-red-600 font-bold">Non sei autorizzato a visualizzare o modificare questa verifica.</div>
  }

  const { data: sections } = await supabase
    .from('sections')
    .select(`*, questions (*)`)
    .eq('tool_id', EUDR_TOOL_ID)
    .in('group_name', ['Analisi Rischio', 'Valutazione'])
    .order('order_index', { ascending: true })
    .order('order_index', { foreignTable: 'questions', ascending: true })

  const { data: userResponses } = await supabase
    .from('user_responses')
    .select('*')
    .eq('session_id', sessionId)

  const configuredSections = sections?.map(section => {
    if (section.group_name === 'Analisi Rischio') {
      return {
        ...section,
        default_open: false,
        default_mode: 'view' as const
      }
    }
    if (section.group_name === 'Valutazione') {
      return {
        ...section,
        default_open: true,
        default_mode: 'edit' as const
      }
    }
    return section
  }) ?? null

  return (
    <div className="max-w-5xl mx-auto">

      <div className="border-b border-slate-200 pb-6 mb-8 mt-4">
        <h1 className="text-3xl font-bold text-slate-900">Configurazione Analisi Finali</h1>
        <p className="text-slate-500 mt-2">
          Rivedi i dati della verifica preliminare e definisci quante e quali analisi finali generare.
        </p>
      </div>

      <SectionList
        sections={configuredSections}
        userResponses={userResponses}
        toolId={EUDR_TOOL_ID}
        sessionId={sessionId}
        onCompleteAction={processEudrValutazione}
      />

    </div>
  )
}
