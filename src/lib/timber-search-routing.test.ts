import test from "node:test"
import assert from "node:assert/strict"
import {
  normalizeTimberSearchTab,
  resolveTimberVerificheActionUrl,
} from "./timber-search-routing.ts"

test("normalizes both verifica and verifiche tabs to verifiche", () => {
  assert.equal(normalizeTimberSearchTab("verifica"), "verifiche")
  assert.equal(normalizeTimberSearchTab("verifiche"), "verifiche")
  assert.equal(normalizeTimberSearchTab("analisi"), "analisi")
})

test("uses server-side resume url when valid", () => {
  const url = resolveTimberVerificheActionUrl({
    sessionId: "root-1",
    riskCompleted: false,
    isBlocked: true,
    resumeUrl: "/timberRegulation/evaluation?session_id=root-1",
  })

  assert.equal(url, "/timberRegulation/evaluation?session_id=root-1")
})

test("falls back to risk-analysis when step1 is incomplete", () => {
  const url = resolveTimberVerificheActionUrl({
    sessionId: "root-2",
    riskCompleted: false,
    isBlocked: false,
    resumeUrl: null,
  })

  assert.equal(url, "/timberRegulation/risk-analysis?session_id=root-2")
})

test("falls back to evaluation when step1 complete and not blocked", () => {
  const url = resolveTimberVerificheActionUrl({
    sessionId: "root-3",
    riskCompleted: true,
    isBlocked: false,
    resumeUrl: "",
  })

  assert.equal(url, "/timberRegulation/evaluation?session_id=root-3")
})

test("ignores invalid resume urls outside timber flow", () => {
  const url = resolveTimberVerificheActionUrl({
    sessionId: "root-4",
    riskCompleted: true,
    isBlocked: false,
    resumeUrl: "/EUDR/evaluation?session_id=root-4",
  })

  assert.equal(url, "/timberRegulation/evaluation?session_id=root-4")
})
