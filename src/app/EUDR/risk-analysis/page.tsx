import { getToolAccess } from "@/lib/tool-auth"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { ShieldAlert, FilePlus } from "lucide-react"
import { Button } from "@/components/ui/button"

import { SectionList } from "@/components/questions/SectionList"
import { processPrimaFaseEUDR } from "@/actions/workflows"

export default async function RiskAnalysisPage({
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
          La verifica preliminare è disponibile solo per gli utenti <strong>Premium</strong> o <strong>Admin</strong>.
        </p>
      </div>
    )
  }

  if (!sessionId) {
    const createNewSession = async () => {
      "use server"
      const actionCookieStore = await cookies()
      const supabaseAction = createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => actionCookieStore.getAll(), setAll: () => {} } }
      )

      const { data: { user: actionUser } } = await supabaseAction.auth.getUser()
      if (!actionUser) redirect('/login')

      const { data: newSession, error: createError } = await supabaseAction
        .from('assessment_sessions')
        .insert({
          user_id: actionUser.id,
          tool_id: EUDR_TOOL_ID,
          session_type: 'verifica',
          status: 'in_progress'
        })
        .select('id')
        .single()

      if (createError || !newSession) throw new Error("Errore durante la creazione di una nuova verifica.")

      redirect(`?session_id=${newSession.id}`)
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4">
        <div className="p-6 bg-amber-50 border border-amber-100 rounded-full shadow-sm">
          <FilePlus className="w-12 h-12 text-[#967635]" />
        </div>
        <div className="space-y-3 max-w-lg">
          <h1 className="text-3xl font-bold text-slate-900">Nuova Verifica Preliminare</h1>
          <p className="text-slate-600 text-lg">
            Non hai selezionato nessuna verifica attiva. Vuoi iniziare una nuova verifica preliminare EUDR da zero?
          </p>
        </div>
        <form action={createNewSession}>
          <Button type="submit" size="lg" className="bg-[#967635] hover:bg-[#856625] text-white px-10 h-14 text-lg rounded-full shadow-md transition-all hover:scale-105">
            Inizia Nuova Valutazione
          </Button>
        </form>
      </div>
    )
  }

  const { data: sessionInfo, error: sessionError } = await supabase
    .from('assessment_sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !sessionInfo) return <div className="p-8 text-center text-red-600 font-bold">Sessione non trovata.</div>
  if (sessionInfo.user_id !== user.id && role !== 'admin') return <div className="p-8 text-center text-red-600 font-bold">Accesso negato.</div>

  const { data: sections } = await supabase
    .from('sections')
    .select(`*, questions (*)`)
    .eq('tool_id', EUDR_TOOL_ID)
    .eq('group_name', 'Analisi Rischio')
    .order('order_index', { ascending: true })
    .order('order_index', { foreignTable: 'questions', ascending: true })

  const { data: userResponses } = await supabase
    .from('user_responses')
    .select('*')
    .eq('session_id', sessionId)

  return (
    <div className="max-w-5xl mx-auto">
      <SectionList
        sections={sections}
        userResponses={userResponses}
        toolId={EUDR_TOOL_ID}
        sessionId={sessionId}
        defaultOpen={true}
        defaultMode="edit"
        onCompleteAction={processPrimaFaseEUDR}
      />
    </div>
  )
}
