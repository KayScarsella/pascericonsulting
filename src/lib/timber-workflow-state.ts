import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"
import type { SessionMetadata } from "@/types/session"
import { TIMBER_TOOL_ID } from "@/lib/constants"

type SessionRow = Database["public"]["Tables"]["assessment_sessions"]["Row"]

export type ResumeStep = "risk-analysis" | "evaluation" | "valutazione-finale"

export type TimberWorkflowState = {
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
  if (step === "risk-analysis") return `/timberRegulation/risk-analysis?session_id=${rootSessionId}`
  if (step === "evaluation") return `/timberRegulation/evaluation?session_id=${rootSessionId}`
  const finalSessionId = inProgressChildId ?? latestChildId
  if (!finalSessionId) return `/timberRegulation/evaluation?session_id=${rootSessionId}`
  return `/timberRegulation/valutazione-finale?session_id=${finalSessionId}`
}

export async function resolveTimberWorkflowState(
  supabase: SupabaseClient<Database>,
  rootSession: Pick<SessionRow, "id" | "status" | "final_outcome" | "metadata">,
  fallbackStep1Completed: boolean = false
): Promise<TimberWorkflowState> {
  const metadata = (rootSession.metadata as SessionMetadata | null) ?? null

  const { data: childRows } = await supabase
    .from("assessment_sessions")
    .select("id, status, created_at")
    .eq("tool_id", TIMBER_TOOL_ID)
    .eq("session_type", "analisi_finale")
    .eq("parent_session_id", rootSession.id)
    .order("created_at", { ascending: false })

  const childCount = childRows?.length ?? 0
  const inProgressChild = childRows?.find((row) => row.status !== "completed") ?? null
  const latestChild = childRows?.[0] ?? null

  return deriveTimberWorkflowStateFromSnapshot({
    rootSessionId: rootSession.id,
    status: rootSession.status,
    finalOutcome: rootSession.final_outcome,
    metadata,
    childCount,
    inProgressChildId: inProgressChild?.id ?? null,
    latestChildId: latestChild?.id ?? null,
    fallbackStep1Completed,
  })
}

export function deriveTimberWorkflowStateFromSnapshot(
  snapshot: WorkflowSnapshot
): TimberWorkflowState {
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
