import { cache } from 'react'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getToolAccess } from '@/lib/tool-auth'
import {
  TOOL_IMPERSONATION_COOKIE,
  isImpersonationAllowedTool,
} from '@/lib/tool-impersonation-shared'
import type { Database } from '@/types/supabase'

export {
  TOOL_IMPERSONATION_COOKIE,
  isImpersonationAllowedTool,
  toolHomePathForImpersonation,
} from '@/lib/tool-impersonation-shared'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ToolImpersonationState = {
  toolId: string
  actorUserId: string
  targetUserId: string
  targetFullName: string | null
  targetEmail: string | null
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function parseImpersonationCookie(
  raw: string | undefined
): { toolId: string; targetUserId: string } | null {
  if (!raw) return null
  const sep = raw.indexOf(':')
  if (sep <= 0) return null
  const toolId = raw.slice(0, sep)
  const targetUserId = raw.slice(sep + 1)
  if (!isUuid(toolId) || !isUuid(targetUserId)) return null
  if (!isImpersonationAllowedTool(toolId)) return null
  return { toolId, targetUserId }
}

export async function clearToolImpersonationCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(TOOL_IMPERSONATION_COOKIE)
}

export async function setToolImpersonationCookie(
  toolId: string,
  targetUserId: string
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(TOOL_IMPERSONATION_COOKIE, `${toolId}:${targetUserId}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  })
}

async function createReadonlyServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {},
      },
    }
  )
}

/**
 * Returns active impersonation for this tool, or null.
 * Does not mutate cookies (safe in RSC). Invalid cookies are ignored.
 */
export const getToolImpersonation = cache(
  async (toolId: string): Promise<ToolImpersonationState | null> => {
    if (!isImpersonationAllowedTool(toolId)) return null

    const cookieStore = await cookies()
    const parsed = parseImpersonationCookie(
      cookieStore.get(TOOL_IMPERSONATION_COOKIE)?.value
    )
    if (!parsed || parsed.toolId !== toolId) return null

    const { role, userId: actorUserId } = await getToolAccess(toolId)
    if (role !== 'admin' || actorUserId === parsed.targetUserId) return null

    const supabase = await createReadonlyServerClient()
    const { data: access, error } = await supabase
      .from('tool_access')
      .select('user_id, profiles(full_name, email)')
      .eq('tool_id', toolId)
      .eq('user_id', parsed.targetUserId)
      .maybeSingle()

    if (error || !access) return null

    const profile = access.profiles as {
      full_name: string | null
      email: string | null
    } | null

    return {
      toolId,
      actorUserId,
      targetUserId: parsed.targetUserId,
      targetFullName: profile?.full_name ?? null,
      targetEmail: profile?.email ?? null,
    }
  }
)

/** Owner id for new analyses / scoped lists: impersonated target or auth user. */
export async function getEffectiveToolUserId(toolId: string): Promise<string> {
  const { userId } = await getToolAccess(toolId)
  const impersonation = await getToolImpersonation(toolId)
  return impersonation?.targetUserId ?? userId
}
