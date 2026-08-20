import { EUDR_TOOL_ID, TIMBER_TOOL_ID } from '@/lib/constants'
import { resolveToolBasePath } from '@/lib/tool-paths'

/** Cookie name — shared; only server code should set/read it via next/headers. */
export const TOOL_IMPERSONATION_COOKIE = 'pc_tool_impersonation'

const ALLOWED_TOOL_IDS = new Set<string>([EUDR_TOOL_ID, TIMBER_TOOL_ID])

/** EUDR + Timber only. Safe for Client Components. */
export function isImpersonationAllowedTool(toolId: string): boolean {
  return ALLOWED_TOOL_IDS.has(toolId)
}

export function toolHomePathForImpersonation(toolId: string): string {
  return resolveToolBasePath(toolId, null) ?? '/landingPage'
}
