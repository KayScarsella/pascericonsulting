import { getToolAccess } from "@/lib/tool-auth"
import { TIMBER_TOOL_ID } from "@/lib/constants"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "@/types/supabase"
import { redirect } from "next/navigation"
import { ShieldAlert, TreePine, FileText, ArrowLeft } from "lucide-react"
import Link from "next/link"

import { SectionList } from "@/components/questions/SectionList"
import { mergeParentChildResponses } from '@/lib/logic-engine'
import { processTimberValutazione, finalizeTimberAnalisi } from "@/actions/workflows"

export default async function ValutazioneFinalePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const sessionId = params.session_id as string | undefined;

  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { role } = await getToolAccess(TIMBER_TOOL_ID)

  if (!role || role === 'standard') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <div className="p-4 bg-amber-50 rounded-full">
          <ShieldAlert className="w-12 h-12 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Accesso Limitato</h1>
        <p className="text-slate-600 max-w-md">La Valutazione è disponibile solo per gli utenti Premium o Admin.</p>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <div className="p-4 bg-red-50 rounded-full">
          <ShieldAlert className="w-10 h-10 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Nessuna sessione selezionata</h2>
        <p className="text-slate-500">Non puoi accedere direttamente a questa pagina senza aver iniziato una verifica.</p>
      </div>
    )
  }

  // FETCH SESSION INFO — con session_type per decidere sezioni e layout
  const { data: sessionInfo, error: sessionError } = await supabase
    .from('assessment_sessions')
    .select('user_id, session_type, parent_session_id, metadata')
    .eq('id', sessionId)
    .single();

  if (sessionError || !sessionInfo) return <div className="p-8 text-center text-red-600 font-bold">Sessione non trovata.</div>;
  if (sessionInfo.user_id !== user.id && role !== 'admin') return <div className="p-8 text-center text-red-600 font-bold">Accesso negato.</div>;

  const isAnalisiFinale = sessionInfo.session_type === 'analisi_finale';

  // CARICAMENTO SEZIONI: 
  // Per analisi_finale → TUTTE le sezioni (Analisi Rischio + Valutazione in view-only, Valutazione Finale in edit)
  // Per verifica (step 2) → Analisi Rischio (view) + Valutazione (edit) come prima
  const groupNames = isAnalisiFinale
    ? ['Analisi Rischio', 'Valutazione', 'Valutazione Finale']
    : ['Analisi Rischio', 'Valutazione'];

  const { data: sections } = await supabase
    .from('sections')
    .select(`*, questions (*)`)
    .eq('tool_id', TIMBER_TOOL_ID)
    .in('group_name', groupNames)
    .order('order_index', { ascending: true })
    .order('order_index', { foreignTable: 'questions', ascending: true })

  // FETCH RISPOSTE
  // Per analisi_finale: carichiamo sia le risposte della sessione corrente (Valutazione Finale)
  // sia le risposte della sessione padre (Analisi Rischio + Valutazione) per la vista read-only
  let allResponses: Database['public']['Tables']['user_responses']['Row'][] = [];

  const { data: childResponses } = await supabase
    .from('user_responses')
    .select('*')
    .eq('session_id', sessionId)

  allResponses = childResponses || [];

  if (isAnalisiFinale && sessionInfo.parent_session_id) {
    const { data: parentResponses } = await supabase
      .from('user_responses')
      .select('*')
      .eq('session_id', sessionInfo.parent_session_id)

    if (parentResponses?.length) {
      allResponses = mergeParentChildResponses(parentResponses, allResponses)
    }
  }

  // CONFIGURAZIONE MODALITÀ SEZIONI
  const configuredSections = sections?.map(section => {
    if (isAnalisiFinale) {
      // Sezioni precedenti (Analisi Rischio + Valutazione) → sola lettura, chiuse
      if (section.group_name === 'Analisi Rischio' || section.group_name === 'Valutazione') {
        return { ...section, default_open: false, default_mode: 'view' as const }
      }
      // Sezioni nuove (Valutazione Finale) → modifica, aperte
      return { ...section, default_open: true, default_mode: 'edit' as const }
    }
    // Per verifiche (step 2): Analisi Rischio view, Valutazione edit
    if (section.group_name === 'Analisi Rischio') {
      return { ...section, default_open: false, default_mode: 'view' as const }
    }
    if (section.group_name === 'Valutazione') {
      return { ...section, default_open: true, default_mode: 'edit' as const }
    }
    return section;
  }) ?? null;

  // TITOLO E CONTESTO
  const metadata = sessionInfo.metadata as Record<string, unknown> | null;
  const nomeOperazione = (metadata?.nome_operazione as string) || null;
  const pageTitle = isAnalisiFinale ? 'Analisi Finale' : 'Valutazione Finale';
  const pageDescription = isAnalisiFinale
    ? 'Compila i dati specifici per questa analisi: fornitore, specie, paese, legislazione e catena di approvvigionamento.'
    : 'Rivedi i dati dell\u0027Analisi del Rischio e compila la valutazione finale.';

  return (
    <div className="max-w-5xl mx-auto px-4 pb-16">

      {/* HEADER con palette #967635 */}
      <div className="relative mt-6 mb-10">
        {/* Back link */}
        <Link
          href="/timberRegulation/search"
          className="inline-flex items-center gap-1.5 text-sm text-[#967635] hover:text-[#7a5f2a] font-medium mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Torna all&apos;archivio
        </Link>

        {/* Hero card */}
        <div className="relative overflow-hidden rounded-2xl border border-[#967635]/20 bg-gradient-to-br from-[#967635]/5 via-white to-[#c9a55a]/5 p-8 shadow-sm">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-[#967635]/10 to-transparent rounded-bl-full" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#c9a55a]/10 to-transparent rounded-tr-full" />

          <div className="relative flex items-start gap-5">
            <div className="flex-shrink-0 p-3 bg-gradient-to-br from-[#967635] to-[#7a5f2a] rounded-xl shadow-md">
              {isAnalisiFinale
                ? <FileText className="w-7 h-7 text-white" />
                : <TreePine className="w-7 h-7 text-white" />
              }
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                {pageTitle}
              </h1>
              {nomeOperazione && (
                <p className="mt-1 text-[#967635] font-semibold text-sm md:text-base truncate">
                  {nomeOperazione}
                </p>
              )}
              <p className="mt-2 text-slate-500 text-sm leading-relaxed max-w-2xl">
                {pageDescription}
              </p>
            </div>
          </div>

          {/* Progress indicators */}
          {isAnalisiFinale && (
            <div className="relative mt-6 flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#967635]/10 text-[#7a5f2a] font-medium border border-[#967635]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#967635]" />
                Analisi in corso
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-400">
                Le sezioni A e B contengono i dati della verifica preliminare (sola lettura)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SEZIONI */}
      <SectionList
        sections={configuredSections}
        userResponses={allResponses}
        toolId={TIMBER_TOOL_ID}
        sessionId={sessionId}
        onCompleteAction={isAnalisiFinale ? finalizeTimberAnalisi : processTimberValutazione}
      />

    </div>
  )
}