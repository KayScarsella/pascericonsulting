/** SessionStorage key for support: last failed auth callback shape (no secrets). */
export const AUTH_CALLBACK_DEBUG_KEY = 'auth_callback_last_attempt'

export type AuthCallbackDebugInfo = {
  at: string
  hasCode: boolean
  hasTokenHash: boolean
  linkType: string | null
  hasAccessToken: boolean
  authError: string | null
  authErrorDescription: string | null
}

export function persistAuthCallbackDebug(info: AuthCallbackDebugInfo): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(AUTH_CALLBACK_DEBUG_KEY, JSON.stringify(info))
  } catch {
    // ignore quota / private mode
  }
}

export function readAuthCallbackDebug(): AuthCallbackDebugInfo | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(AUTH_CALLBACK_DEBUG_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthCallbackDebugInfo
  } catch {
    return null
  }
}

/** OTP types handled on /auth/callback (not recovery — that uses a dedicated page). */
export const INVITE_CALLBACK_OTP_TYPES = ['invite', 'magiclink', 'signup', 'email'] as const

export type InviteCallbackOtpType = (typeof INVITE_CALLBACK_OTP_TYPES)[number]

export function isInviteCallbackOtpType(
  value: string | null | undefined
): value is InviteCallbackOtpType {
  return (
    value != null &&
    (INVITE_CALLBACK_OTP_TYPES as readonly string[]).includes(value)
  )
}
