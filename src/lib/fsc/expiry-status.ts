export type FscExpiryStatus = 'expired' | 'warning' | 'ok' | 'none'

export function getFscExpiryStatus(expiresAt: string | null | undefined): FscExpiryStatus {
  if (!expiresAt) return 'none'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(expiresAt)
  expiry.setHours(0, 0, 0, 0)

  const diffMs = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'warning'
  return 'ok'
}
