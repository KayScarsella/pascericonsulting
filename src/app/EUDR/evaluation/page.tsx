import { Suspense } from "react"
import type { ComponentProps } from "react"
import { getEudrPageContext } from "@/lib/eudr-page-context"
import {
  getCachedEudrSections,
  getCachedEudrSessionResponses,
  type EudrCachedResponse,
  type EudrCachedSection,
} from "@/lib/eudr-cache"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { redirect } from "next/navigation"
import { ShieldAlert } from "lucide-react"
import { EudrRouteSkeleton } from "@/components/eudr/EudrRouteSkeleton"

import { SectionList } from "@/components/questions/SectionList"
import { processEudrValutazione } from "@/actions/workflows"
import { resolveEudrWorkflowState } from "@/lib/eudr-workflow-state"

export default async function EvaluationPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const sessionId = params.session_id as string | undefined
  const { role, userId } = await getEudrPageContext()

  if (!role || role === "standard") {
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="border-b border-slate-200 pb-6 mb-8 mt-4">
        <h1 className="text-3xl font-bold text-slate-900">Configurazione Analisi Finali</h1>
        <p className="text-slate-500 mt-2">
          Rivedi i dati della verifica preliminare e definisci quante e quali analisi finali generare.
        </p>
      </div>

      <Suspense fallback={<EudrRouteSkeleton />}>
        <EvaluationSections sessionId={sessionId} userId={userId} role={role} />
      </Suspense>
    </div>
  )
}

async function EvaluationSections({
  sessionId,
  userId,
  role,
}: {
  sessionId: string
  userId: string
  role: string
}) {
  const { supabase } = await getEudrPageContext()
  const sectionsPromise = getCachedEudrSections(["Analisi Rischio", "Valutazione"])

  const { data: sessionInfo, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("id, user_id, session_type, status, final_outcome, metadata")
    .eq("id", sessionId)
    .eq("tool_id", EUDR_TOOL_ID)
    .single()

  if (sessionError || !sessionInfo) {
    return <div className="p-8 text-center text-red-600 font-bold">Sessione non trovata nel database.</div>
  }

  if (sessionInfo.user_id !== userId && role !== "admin") {
    return <div className="p-8 text-center text-red-600 font-bold">Non sei autorizzato a visualizzare o modificare questa verifica.</div>
  }

  if (sessionInfo.session_type === "analisi_finale") {
    redirect(`/EUDR/valutazione-finale?session_id=${sessionId}`)
  }

  const workflowState = await resolveEudrWorkflowState(
    supabase,
    {
      id: sessionInfo.id,
      status: sessionInfo.status,
      final_outcome: sessionInfo.final_outcome,
      metadata: sessionInfo.metadata,
    },
    sessionInfo.status === "completed" && sessionInfo.final_outcome !== "Esente / Non Soggetto"
  )

  if (workflowState.resumeStep === "risk-analysis" || workflowState.isExempt) {
    redirect(`/EUDR/risk-analysis?session_id=${sessionId}`)
  }

  const [sections, userResponses] = await Promise.all([
    sectionsPromise,
    getCachedEudrSessionResponses(sessionId),
  ])

  const configuredSections = sections.map((section) => configureSection(section))

  return (
    <SectionList
      sections={configuredSections}
      userResponses={asResponses(userResponses)}
      toolId={EUDR_TOOL_ID}
      sessionId={sessionId}
      onCompleteAction={processEudrValutazione}
    />
  )
}

function configureSection(section: EudrCachedSection) {
  const withTool = { ...section, tool_id: EUDR_TOOL_ID }
  if (section.group_name === "Analisi Rischio") {
    return { ...withTool, default_open: false, default_mode: "view" as const }
  }
  if (section.group_name === "Valutazione") {
    return { ...withTool, default_open: true, default_mode: "edit" as const }
  }
  return withTool
}

function asResponses(rows: EudrCachedResponse[]): ComponentProps<typeof SectionList>["userResponses"] {
  return rows as unknown as ComponentProps<typeof SectionList>["userResponses"]
}
