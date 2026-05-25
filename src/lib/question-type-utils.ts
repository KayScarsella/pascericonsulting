import { hasYearValuesAnswer } from "@/lib/year-values"
import type { YearValuesQuestionConfig } from "@/types/questions"

export function normalizeQuestionType(type: string | null | undefined): string {
  return String(type ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
}

export function isYearValuesQuestionType(type: string | null | undefined): boolean {
  const normalized = normalizeQuestionType(type)
  return (
    normalized === "year_values" ||
    normalized === "year_value" ||
    normalized === "cpi_years" ||
    normalized === "cpi_year_values"
  )
}

export const JSON_ANSWER_QUESTION_TYPES = new Set([
  "date_range",
  "repeater",
  "year_values",
])

export function isJsonAnswerQuestionType(type: string | null | undefined): boolean {
  return JSON_ANSWER_QUESTION_TYPES.has(normalizeQuestionType(type))
}

export function isQuestionAnsweredByType(
  type: string | null | undefined,
  config: unknown,
  val: unknown,
  fileVal: string | null | undefined
): boolean {
  if (fileVal != null && fileVal !== "") return true

  const normalized = normalizeQuestionType(type)

  if (isYearValuesQuestionType(type)) {
    const fields = (config as YearValuesQuestionConfig | null)?.fields
    return hasYearValuesAnswer(val, fields)
  }

  if (normalized === "repeater") {
    return Array.isArray(val) && val.length > 0
  }

  if (normalized === "date_range") {
    if (!val || typeof val !== "object" || Array.isArray(val)) return false
    const obj = val as { start?: string | null; end?: string | null }
    return Boolean(String(obj.start ?? "").trim() || String(obj.end ?? "").trim())
  }

  return val !== undefined && val !== null && val !== ""
}

export function hasMeaningfulAnswerJson(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((val) => {
      if (val == null || val === "") return false
      if (typeof val === "number" && Number.isFinite(val)) return true
      if (typeof val === "string" && val.trim() !== "") return true
      return Boolean(val)
    })
  }
  return false
}
