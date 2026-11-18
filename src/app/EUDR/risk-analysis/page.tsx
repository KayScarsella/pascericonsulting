import { Suspense } from "react"
import type { ComponentProps } from "react"
import { getEudrPageContext } from "@/lib/eudr-page-context"
import {
  getCachedEudrSections,
  getCachedEudrSessionResponses,
  touchEudrSearch,
  type EudrCachedResponse,
} from "@/lib/eudr-cache"
import { EUDR_TOOL_ID } from "@/lib/constants"
import { redirect } from "next/navigation"
import { ShieldAlert, FilePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/utils/supabase/server"
import { EudrRouteSkeleton } from "@/components/eudr/EudrRouteSkeleton"

import { SectionList } from "@/components/questions/SectionList"
import { processPrimaFaseEUDR } from "@/actions/workflows"
import { resolveEudrWorkflowState } from "@/lib/eudr-workflow-state"

/** Earth Engine due-diligence Server Actions can exceed the default 60s limit. */
export const maxDuration = 300

export default async function RiskAnalysisPage({
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
          La verifica preliminare è disponibile solo per gli utenti <strong>Premium</strong> o <strong>Admin</strong>.
        </p>
      </div>
    )
  }

  if (!sessionId) {
    const createNewSession = async () => {
      "use server"
      const supabaseAction = await createClient()
      const { data: { user: actionUser } } = await supabaseAction.auth.getUser()
      if (!actionUser) redirect("/login")

      const { getEffectiveToolUserId } = await import("@/lib/tool-impersonation")
      const effectiveUserId = await getEffectiveToolUserId(EUDR_TOOL_ID)

      const { data: newSession, error: createError } = await supabaseAction
        .from("assessment_sessions")
        .insert({
          user_id: effectiveUserId,
          tool_id: EUDR_TOOL_ID,
          session_type: "verifica",
          status: "in_progress",
        })
        .select("id")
        .single()

      if (createError || !newSession) throw new Error("Errore durante la creazione di una nuova verifica.")

      touchEudrSearch(effectiveUserId)
      redirect(`/EUDR/risk-analysis?session_id=${newSession.id}`)
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

  return (
    <Suspense fallback={<EudrRouteSkeleton />}>
      <RiskAnalysisSections sessionId={sessionId} userId={userId} role={role} />
    </Suspense>
  )
}

async function RiskAnalysisSections({
  sessionId,
  userId,
  role,
}: {
  sessionId: string
  userId: string
  role: string
}) {
  const { supabase } = await getEudrPageContext()
  const sectionsPromise = getCachedEudrSections(["Analisi Rischio"])

  const { data: sessionInfo, error: sessionError } = await supabase
    .from("assessment_sessions")
    .select("id, user_id, session_type, status, final_outcome, metadata")
    .eq("id", sessionId)
    .eq("tool_id", EUDR_TOOL_ID)
    .single()

  if (sessionError || !sessionInfo) {
    return <div className="p-8 text-center text-red-600 font-bold">Sessione non trovata.</div>
  }
  if (sessionInfo.user_id !== userId && role !== "admin") {
    return <div className="p-8 text-center text-red-600 font-bold">Accesso negato.</div>
  }

  if (sessionInfo.session_type === "analisi_finale") {
    redirect(`/EUDR/valutazione-finale?session_id=${sessionId}`)
  }

  await resolveEudrWorkflowState(
    supabase,
    {
      id: sessionInfo.id,
      status: sessionInfo.status,
      final_outcome: sessionInfo.final_outcome,
      metadata: sessionInfo.metadata,
    },
    sessionInfo.status === "completed" && sessionInfo.final_outcome !== "Esente / Non Soggetto"
  )

  const [sections, userResponses] = await Promise.all([
    sectionsPromise,
    getCachedEudrSessionResponses(sessionId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <SectionList
        sections={sections.map((section) => ({ ...section, tool_id: EUDR_TOOL_ID }))}
        userResponses={asResponses(userResponses)}
        toolId={EUDR_TOOL_ID}
        sessionId={sessionId}
        defaultOpen={true}
        defaultMode="edit"
        onCompleteAction={processPrimaFaseEUDR}
      />
    </div>
  )
}

function asResponses(rows: EudrCachedResponse[]): ComponentProps<typeof SectionList>["userResponses"] {
  return rows as unknown as ComponentProps<typeof SectionList>["userResponses"]
}
