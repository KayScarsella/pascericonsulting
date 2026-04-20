import test from "node:test"
import assert from "node:assert/strict"
import { deriveEudrWorkflowStateFromSnapshot } from "@/lib/eudr-workflow-state"

test("routes to risk-analysis when step1 is not completed", () => {
  const state = deriveEudrWorkflowStateFromSnapshot({
    rootSessionId: "root-1",
    status: "in_progress",
    finalOutcome: null,
    metadata: null,
    childCount: 0,
    inProgressChildId: null,
    latestChildId: null,
    fallbackStep1Completed: false,
  })

  assert.equal(state.resumeStep, "risk-analysis")
  assert.equal(state.resumeUrl, "/EUDR/risk-analysis?session_id=root-1")
})

test("routes to evaluation when step1 is complete and step2 is not saved", () => {
  const state = deriveEudrWorkflowStateFromSnapshot({
    rootSessionId: "root-2",
    status: "in_progress",
    finalOutcome: null,
    metadata: { step1_completed_at: "2026-01-01T00:00:00.000Z" },
    childCount: 0,
    inProgressChildId: null,
    latestChildId: null,
  })

  assert.equal(state.resumeStep, "evaluation")
  assert.equal(state.resumeUrl, "/EUDR/evaluation?session_id=root-2")
})

test("routes to specific child final evaluation when step2 generated analyses", () => {
  const state = deriveEudrWorkflowStateFromSnapshot({
    rootSessionId: "root-3",
    status: "completed",
    finalOutcome: "Verifica Completata",
    metadata: {
      step1_completed_at: "2026-01-01T00:00:00.000Z",
      step2_saved_at: "2026-01-01T00:10:00.000Z",
    },
    childCount: 2,
    inProgressChildId: "child-in-progress",
    latestChildId: "child-latest",
  })

  assert.equal(state.resumeStep, "valutazione-finale")
  assert.equal(state.resumeUrl, "/EUDR/valutazione-finale?session_id=child-in-progress")
})

test("never routes exempt workflow to evaluation", () => {
  const state = deriveEudrWorkflowStateFromSnapshot({
    rootSessionId: "root-4",
    status: "completed",
    finalOutcome: "Esente / Non Soggetto",
    metadata: {
      is_blocked: true,
      block_variant: "success",
      step1_completed_at: "2026-01-01T00:00:00.000Z",
    },
    childCount: 0,
    inProgressChildId: null,
    latestChildId: null,
  })

  assert.equal(state.isExempt, true)
  assert.equal(state.resumeStep, "risk-analysis")
  assert.equal(state.resumeUrl, "/EUDR/risk-analysis?session_id=root-4")
})

