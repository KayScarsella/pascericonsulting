import type { ToolRole } from '@/lib/tool-auth'

/** Ruoli assegnabili alle cartelle documenti (admin è sempre implicito in canAccess). */
export type DocumentAccessRole = 'standard' | 'tool' | 'premium'

export const DOCUMENT_ACCESS_ROLES: DocumentAccessRole[] = [
  'standard',
  'tool',
  'premium',
]

/** Default: tutti tranne tool (allineato a cartelle “aperte” legacy). */
export const DEFAULT_ALLOWED_ROLES: ToolRole[] = ['standard', 'premium', 'admin']

export function normalizeAllowedRoles(
  roles: readonly string[] | null | undefined
): ToolRole[] {
  const set = new Set<ToolRole>()
  for (const r of roles ?? []) {
    if (r === 'standard' || r === 'tool' || r === 'premium' || r === 'admin') {
      set.add(r)
    }
  }
  // Admin sempre presente in persistenza UI
  set.add('admin')
  if (set.size === 1) {
    // solo admin → comunque ok
  }
  return Array.from(set)
}

/** True se l'utente può aprire/scaricare (admin sempre). */
export function canAccessAllowedRoles(
  userRole: ToolRole | null | undefined,
  allowedRoles: readonly string[] | null | undefined
): boolean {
  if (!userRole) return false
  if (userRole === 'admin') return true
  const allowed = allowedRoles ?? DEFAULT_ALLOWED_ROLES
  return allowed.includes(userRole)
}

/**
 * @deprecated Prefer canAccessAllowedRoles. Mappa legacy min_role → allowlist.
 */
export type DocumentMinRole = 'standard' | 'premium'

export function minRoleToAllowedRoles(minRole: DocumentMinRole): ToolRole[] {
  if (minRole === 'premium') return ['premium', 'admin']
  return ['standard', 'premium', 'admin']
}

/** Allineato al vecchio topBar/canAccessMinRole (senza ruolo tool sulle cartelle premium). */
export function canAccessMinRole(
  userRole: ToolRole | null | undefined,
  minRole: DocumentMinRole
): boolean {
  return canAccessAllowedRoles(userRole, minRoleToAllowedRoles(minRole))
}

/** Feature parity: tool vede le stesse pagine di premium (non Master admin). */
export function hasPremiumFeatureAccess(
  userRole: ToolRole | null | undefined
): boolean {
  return userRole === 'premium' || userRole === 'tool' || userRole === 'admin'
}

export function isStandardOnlyRole(
  userRole: ToolRole | null | undefined
): boolean {
  return !userRole || userRole === 'standard'
}
