import { formatYearValuesDisplay } from "@/lib/year-values"
import { normalizeQuestionType, isYearValuesQuestionType } from "@/lib/question-type-utils"
import type { YearValuesQuestionConfig } from "@/types/questions"

type DisplayQuestion = {
  type: string
  config?: YearValuesQuestionConfig | null
}

export function resolveQuestionDisplayAnswer(
  q: DisplayQuestion,
  answerText: string | null,
  answerJson: unknown
): string | null {
  const normalized = normalizeQuestionType(q.type)

  if (isYearValuesQuestionType(q.type)) {
    const fields = q.config?.fields?.length
      ? q.config.fields
      : [
          { key: "cpi_23", label: "CPI 2023" },
          { key: "cpi_24", label: "CPI 2024" },
          { key: "cpi_25", label: "CPI 2025" },
        ]
    const payload =
      answerJson ??
      (answerText?.trim()
        ? (() => {
            try {
              return JSON.parse(answerText)
            } catch {
              return null
            }
          })()
        : null)
    return formatYearValuesDisplay(payload, fields)
  }

  if (normalized === "date_range" && answerJson && typeof answerJson === "object") {
    const obj = answerJson as { start?: string; end?: string }
    const start = obj.start?.trim() || "—"
    const end = obj.end?.trim() || "—"
    return `${start} → ${end}`
  }

  return null
}
