import test from "node:test"
import assert from "node:assert/strict"
import { buildEudrPrefillRows } from "@/actions/workflows/eudr-prefill"
import { EUDR_PREFILL_DERIVED_QUESTION_IDS } from "@/lib/eudr-question-ids"

test("keeps non-empty child answer over parent/derived prefill", () => {
  const rows = buildEudrPrefillRows({
    userId: "u1",
    finalSessionId: "s1",
    existingChildRows: [
      { question_id: "q-inherited", answer_text: "child", answer_json: null, file_path: null },
      {
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.CONFLITTI,
        answer_text: "no",
        answer_json: null,
        file_path: null,
      },
    ],
    parentRows: [{ question_id: "q-inherited", answer_text: "parent", answer_json: null, file_path: null }],
    derivedRows: [{ question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.CONFLITTI, answer_text: "si" }],
  })

  assert.equal(rows.length, 0)
})

test("prefills missing inherited and derived answers", () => {
  const rows = buildEudrPrefillRows({
    userId: "u1",
    finalSessionId: "s1",
    existingChildRows: [],
    parentRows: [{ question_id: "q-parent", answer_text: "from-parent", answer_json: null, file_path: null }],
    derivedRows: [{ question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.SPECIE, answer_text: "specie-1" }],
  })

  assert.equal(rows.length, 2)
  const inherited = rows.find((r) => r.question_id === "q-parent")
  const derived = rows.find((r) => r.question_id === EUDR_PREFILL_DERIVED_QUESTION_IDS.SPECIE)
  assert.equal(inherited?.answer_text, "from-parent")
  assert.equal(derived?.answer_text, "specie-1")
})

test("does not inherit parent values for derived question IDs", () => {
  const rows = buildEudrPrefillRows({
    userId: "u1",
    finalSessionId: "s1",
    existingChildRows: [],
    parentRows: [
      {
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.PAESE_RACCOLTA,
        answer_text: "parent-country",
        answer_json: null,
        file_path: null,
      },
    ],
    derivedRows: [],
  })

  assert.equal(rows.length, 0)
})

test("prefills derived CPI answer_json when child row is empty", () => {
  const rows = buildEudrPrefillRows({
    userId: "u1",
    finalSessionId: "s1",
    existingChildRows: [],
    parentRows: [],
    derivedRows: [
      {
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.CPI,
        answer_json: { cpi_23: 36, cpi_24: 38 },
      },
    ],
  })

  assert.equal(rows.length, 1)
  const cpi = rows.find((r) => r.question_id === EUDR_PREFILL_DERIVED_QUESTION_IDS.CPI)
  assert.deepEqual(cpi?.answer_json, { cpi_23: 36, cpi_24: 38 })
  assert.equal(cpi?.answer_text, null)
})

test("keeps existing child CPI answer_json over derived prefill", () => {
  const rows = buildEudrPrefillRows({
    userId: "u1",
    finalSessionId: "s1",
    existingChildRows: [
      {
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.CPI,
        answer_text: null,
        answer_json: { cpi_23: 10 },
        file_path: null,
      },
    ],
    parentRows: [],
    derivedRows: [
      {
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.CPI,
        answer_json: { cpi_23: 36, cpi_24: 38, cpi_25: 40 },
      },
    ],
  })

  assert.equal(rows.length, 0)
})

test("does not treat empty CPI json object as existing child answer", () => {
  const rows = buildEudrPrefillRows({
    userId: "u1",
    finalSessionId: "s1",
    existingChildRows: [
      {
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.CPI,
        answer_text: null,
        answer_json: {},
        file_path: null,
      },
    ],
    parentRows: [],
    derivedRows: [
      {
        question_id: EUDR_PREFILL_DERIVED_QUESTION_IDS.CPI,
        answer_json: { cpi_25: 41 },
      },
    ],
  })

  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].answer_json, { cpi_25: 41 })
})
