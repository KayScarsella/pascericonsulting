import { CLOUD_FSC_TOOL_ID, EUDR_TOOL_ID, TIMBER_TOOL_ID } from "@/lib/constants"

/** Fallback when `tools.base_path` is null in DB (avoids landing-page config alerts). */
export const TOOL_DEFAULT_BASE_PATHS: Record<string, string> = {
  [EUDR_TOOL_ID]: "/EUDR",
  [TIMBER_TOOL_ID]: "/timberRegulation",
  [CLOUD_FSC_TOOL_ID]: "/cloud-fsc",
}

export function resolveToolBasePath(
  toolId: string,
  basePath: string | null | undefined
): string | null {
  const trimmed = basePath?.trim()
  if (trimmed) return trimmed
  return TOOL_DEFAULT_BASE_PATHS[toolId] ?? null
}
