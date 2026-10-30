import test from "node:test"
import assert from "node:assert/strict"
import {
  isJsonAnswerQuestionType,
  isQuestionAnsweredByType,
  normalizeQuestionType,
} from "@/lib/question-type-utils"

test("normalizeQuestionType trims and normalizes aliases", () => {
  assert.equal(normalizeQuestionType(" year_values "), "year_values")
  assert.equal(normalizeQuestionType("year-values"), "year_values")
})

test("year_values is treated as json answer type", () => {
  assert.equal(isJsonAnswerQuestionType("year_values"), true)
})

test("year_values answered only with meaningful numeric fields", () => {
  assert.equal(
    isQuestionAnsweredByType(
      "year_values",
      { fields: [{ key: "cpi_23", label: "CPI 2023" }] },
      { cpi_23: 36 },
      null
    ),
    true
  )
  assert.equal(
    isQuestionAnsweredByType("year_values", null, {}, null),
    false
  )
})
