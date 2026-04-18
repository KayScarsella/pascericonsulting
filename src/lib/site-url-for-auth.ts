/**
 * Base URL for Supabase Auth redirect_to (reset password, invite, etc.).
 *
 * During `next dev`, `NEXT_PUBLIC_SITE_URL` is often set to production for client-side
 * absolute URLs; auth emails must still point at localhost unless overridden.
 */
export function normalizeSiteUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/$/, "")
  if (!trimmed) return null
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

export function siteUrlForAuth(): string | null {
  if (process.env.NODE_ENV === "development") {
    return normalizeSiteUrl(process.env.NEXT_PUBLIC_DEV_SITE_URL ?? "http://localhost:3000")
  }

  const fromEnv = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "")
  if (fromEnv) return fromEnv

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) {
    return normalizeSiteUrl(`https://${vercel.replace(/^https?:\/\//, "")}`)
  }

  return null
}
