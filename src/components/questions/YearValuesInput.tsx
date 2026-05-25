"use client"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { parseOptionalYearValue, type YearValueField } from "@/lib/year-values"
import type { AnswerValue } from "@/types/questions"

export type YearValuesInputConfig = {
  fields?: YearValueField[]
  placeholder?: string
}

interface YearValuesInputProps {
  config: YearValuesInputConfig
  value: AnswerValue
  onChange: (val: AnswerValue) => void
  readOnly?: boolean
}

const DEFAULT_CPI_FIELDS: YearValueField[] = [
  { key: "cpi_23", label: "CPI 2023" },
  { key: "cpi_24", label: "CPI 2024" },
  { key: "cpi_25", label: "CPI 2025" },
]

function DebouncedYearField({
  value,
  label,
  placeholder,
  readOnly,
  onChange,
}: {
  value: string
  label: string
  placeholder?: string
  readOnly?: boolean
  onChange: (raw: string) => void
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
      <Input
        type="text"
        inputMode="decimal"
        placeholder={placeholder ?? "opzionale"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("focus-visible:ring-[#967635]", readOnly && "bg-slate-50 text-slate-600")}
        disabled={readOnly}
      />
    </div>
  )
}

export function YearValuesInput({
  config,
  value,
  onChange,
  readOnly,
}: YearValuesInputProps) {
  const fields = config.fields?.length ? config.fields : DEFAULT_CPI_FIELDS

  const current =
    value && !Array.isArray(value) && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {}

  const handleFieldChange = (key: string, raw: string) => {
    const next: Record<string, unknown> = { ...current }
    const parsed = parseOptionalYearValue(raw)
    if (parsed === false) return
    if (parsed == null) {
      delete next[key]
    } else {
      next[key] = parsed
    }
    onChange(Object.keys(next).length > 0 ? (next as AnswerValue) : null)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
      {fields.map((field) => {
        const rawVal = current[field.key]
        const display = rawVal == null || rawVal === "" ? "" : String(rawVal)
        return (
          <DebouncedYearField
            key={field.key}
            label={field.label}
            placeholder={config.placeholder}
            value={display}
            readOnly={readOnly}
            onChange={(raw) => handleFieldChange(field.key, raw)}
          />
        )
      })}
    </div>
  )
}
