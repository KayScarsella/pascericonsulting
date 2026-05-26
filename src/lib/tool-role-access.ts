import type { ToolRole } from '@/lib/tool-auth'

export type DocumentMinRole = 'standard' | 'premium'

/** Allineato a topBar canView(): admin vede tutto; premium vede standard+premium. */
export function canAccessMinRole(
  userRole: ToolRole | null | undefined,
  minRole: DocumentMinRole
): boolean {
  if (!userRole) return false
  if (userRole === 'admin') return true
  if (minRole === 'standard') return userRole === 'standard' || userRole === 'premium'
  return userRole === 'premium'
}
