import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import type { SessionMetadata } from "@/types/session"
import { EUDR_TOOL_ID } from "@/lib/constants"

type SessionRow = Database["public"]["Tables"]["assessment_sessions"]["Row"]

export type ResumeStep = "risk-analysis" | "evaluation" | "valutazione-finale"

export type EudrWorkflowState = {
  rootSessionId: string
  isExempt: boolean
  step1Completed: boolean
  step2Saved: boolean
  childCount: number
  inProgressChildId: string | null
  latestChildId: string | null
  resumeStep: ResumeStep
  resumeUrl: string
}

type WorkflowSnapshot = {
  rootSessionId: string
  status: string | null
  finalOutcome: string | null
  metadata: SessionMetadata | null
  childCount: number
  inProgressChildId: string | null
  latestChildId: string | null
  fallbackStep1Completed?: boolean
}

function isSuccessBlocked(metadata: SessionMetadata | null | undefined): boolean {
  return Boolean(metadata?.is_blocked && metadata?.block_variant === "success")
}

function hasStep1Marker(metadata: SessionMetadata | null | undefined): boolean {
  return typeof metadata?.step1_completed_at === "string" && metadata.step1_completed_at.length > 0
}

function hasStep2Marker(metadata: SessionMetadata | null | undefined): boolean {
  return typeof metadata?.step2_saved_at === "string" && metadata.step2_saved_at.length > 0
}

function buildResumeUrl(
  rootSessionId: string,
  step: ResumeStep,
  inProgressChildId: string | null,
  latestChildId: string | null
): string {
  if (step === "risk-analysis") return `/EUDR/risk-analysis?session_id=${rootSessionId}`
  if (step === "evaluation") return `/EUDR/evaluation?session_id=${rootSessionId}`
  const finalSessionId = inProgressChildId ?? latestChildId
  if (!finalSessionId) return `/EUDR/evaluation?session_id=${rootSessionId}`
  return `/EUDR/valutazione-finale?session_id=${finalSessionId}`
}

export type EudrWorkflowRootInput = Pick<
  SessionRow,
  "id" | "status" | "final_outcome" | "metadata"
> & {
  fallbackStep1Completed?: boolean
}

type WorkflowChildRow = {
  id: string
  status: string | null
  created_at: string | null
  parent_session_id: string | null
}

function workflowSnapshotFromChildren(
  rootSession: EudrWorkflowRootInput,
  childRows: WorkflowChildRow[]
): WorkflowSnapshot {
  const metadata = (rootSession.metadata as SessionMetadata | null) ?? null
  const sorted = [...childRows].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    return tb - ta
  })
  const inProgressChild = sorted.find((row) => row.status !== "completed") ?? null
  const latestChild = sorted[0] ?? null

  return {
    rootSessionId: rootSession.id,
    status: rootSession.status,
    finalOutcome: rootSession.final_outcome,
    metadata,
    childCount: sorted.length,
    inProgressChildId: inProgressChild?.id ?? null,
    latestChildId: latestChild?.id ?? null,
    fallbackStep1Completed: rootSession.fallbackStep1Completed,
  }
}

/** One query for all verification rows instead of N calls to resolveEudrWorkflowState. */
export async function resolveEudrWorkflowStatesBatch(
  supabase: SupabaseClient<Database>,
  rootSessions: EudrWorkflowRootInput[]
): Promise<Map<string, EudrWorkflowState>> {
  const result = new Map<string, EudrWorkflowState>()
  if (rootSessions.length === 0) return result

  const parentIds = rootSessions.map((s) => s.id)
  const { data: childRows, error } = await supabase
    .from("assessment_sessions")
    .select("id, status, created_at, parent_session_id")
    .eq("tool_id", EUDR_TOOL_ID)
    .eq("session_type", "analisi_finale")
    .in("parent_session_id", parentIds)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Errore batch workflow EUDR:", error)
  }

  const childrenByParent = new Map<string, WorkflowChildRow[]>()
  for (const row of childRows ?? []) {
    if (!row.parent_session_id) continue
    const list = childrenByParent.get(row.parent_session_id) ?? []
    list.push(row)
    childrenByParent.set(row.parent_session_id, list)
  }

  for (const root of rootSessions) {
    const children = childrenByParent.get(root.id) ?? []
    result.set(
      root.id,
      deriveEudrWorkflowStateFromSnapshot(workflowSnapshotFromChildren(root, children))
    )
  }

  return result
}

export async function resolveEudrWorkflowState(
  supabase: SupabaseClient<Database>,
  rootSession: Pick<SessionRow, "id" | "status" | "final_outcome" | "metadata">,
  fallbackStep1Completed: boolean = false
): Promise<EudrWorkflowState> {
  const batch = await resolveEudrWorkflowStatesBatch(supabase, [
    { ...rootSession, fallbackStep1Completed },
  ])
  const state = batch.get(rootSession.id)
  if (!state) {
    throw new Error(`Workflow state missing for session ${rootSession.id}`)
  }
  return state
}

export function deriveEudrWorkflowStateFromSnapshot(snapshot: WorkflowSnapshot): EudrWorkflowState {
  const isExempt =
    snapshot.finalOutcome === "Esente / Non Soggetto" || isSuccessBlocked(snapshot.metadata)

  const step1Completed =
    isExempt ||
    hasStep1Marker(snapshot.metadata) ||
    (snapshot.status === "completed" && !hasStep2Marker(snapshot.metadata) && snapshot.childCount === 0) ||
    Boolean(snapshot.fallbackStep1Completed)

  const step2Saved =
    !isExempt &&
    (hasStep2Marker(snapshot.metadata) ||
      snapshot.childCount > 0 ||
      (snapshot.status === "completed" && !step1Completed))

  const resumeStep: ResumeStep = !step1Completed
    ? "risk-analysis"
    : isExempt
      ? "risk-analysis"
      : !step2Saved
        ? "evaluation"
        : "valutazione-finale"

  return {
    rootSessionId: snapshot.rootSessionId,
    isExempt,
    step1Completed,
    step2Saved,
    childCount: snapshot.childCount,
    inProgressChildId: snapshot.inProgressChildId,
    latestChildId: snapshot.latestChildId,
    resumeStep,
    resumeUrl: buildResumeUrl(
      snapshot.rootSessionId,
      resumeStep,
      snapshot.inProgressChildId,
      snapshot.latestChildId
    ),
  }
}

