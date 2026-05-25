export type YearValueField = { key: string; label: string }

export function parseOptionalYearValue(raw: string): number | null | false {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(",", ".")
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return false
  return parsed
}

export function hasYearValuesAnswer(
  value: unknown,
  fields?: YearValueField[]
): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  const keys = fields?.length ? fields.map((f) => f.key) : Object.keys(obj)
  return keys.some((key) => {
    const v = obj[key]
    if (v == null || v === "") return false
    if (typeof v === "number" && Number.isFinite(v)) return true
    const parsed = Number(String(v).replace(",", "."))
    return Number.isFinite(parsed)
  })
}

export function buildCpiAnswerFromCountry(country: {
  cpi_23?: number | null
  cpi_24?: number | null
  cpi_25?: number | null
}): Record<string, number> | null {
  const out: Record<string, number> = {}
  for (const key of ["cpi_23", "cpi_24", "cpi_25"] as const) {
    const raw = country[key]
    if (raw == null) continue
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw
      continue
    }
    const parsed = Number(raw)
    if (Number.isFinite(parsed)) out[key] = parsed
  }
  return Object.keys(out).length > 0 ? out : null
}

export function buildCpiAnswerFromExtra(
  extra: Record<string, unknown> | null | undefined
): Record<string, number> | null {
  if (!extra) return null
  return buildCpiAnswerFromCountry({
    cpi_23: extra.cpi_23 as number | null | undefined,
    cpi_24: extra.cpi_24 as number | null | undefined,
    cpi_25: extra.cpi_25 as number | null | undefined,
  })
}

export function formatYearValuesDisplay(
  value: unknown,
  fields: YearValueField[]
): string {
  if (!hasYearValuesAnswer(value, fields)) return "—"
  const obj = value as Record<string, unknown>
  return fields
    .map((field) => {
      const raw = obj[field.key]
      if (raw == null || raw === "") return `${field.label}: —`
      return `${field.label}: ${String(raw)}`
    })
    .join(" · ")
}
