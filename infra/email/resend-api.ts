/** Server-only helpers for Resend REST API (https://resend.com/docs/api-reference). */

export type ResendEmailListItem = {
  id: string
  to: string[]
  from: string
  created_at: string
  subject: string
  last_event: string | null
}

export type ResendEmailDetail = ResendEmailListItem & {
  html?: string | null
  text?: string | null
}

const RESEND_BASE = 'https://api.resend.com'

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

export async function listResendEmails(
  apiKey: string,
  opts?: { limit?: number; after?: string }
): Promise<{ data: ResendEmailListItem[]; has_more: boolean; error?: string }> {
  const url = new URL(`${RESEND_BASE}/emails`)
  url.searchParams.set('limit', String(Math.min(opts?.limit ?? 100, 100)))
  if (opts?.after) url.searchParams.set('after', opts.after)

  try {
    const resp = await fetch(url.toString(), {
      headers: authHeaders(apiKey),
      cache: 'no-store',
    })
    const payload = (await resp.json().catch(() => null)) as {
      data?: ResendEmailListItem[]
      has_more?: boolean
      message?: string
    } | null
    if (!resp.ok) {
      return {
        data: [],
        has_more: false,
        error: payload?.message ?? `HTTP ${resp.status}`,
      }
    }
    return {
      data: payload?.data ?? [],
      has_more: Boolean(payload?.has_more),
    }
  } catch (e) {
    return {
      data: [],
      has_more: false,
      error: e instanceof Error ? e.message : 'Errore di rete verso Resend',
    }
  }
}

export async function getResendEmail(
  apiKey: string,
  emailId: string
): Promise<{ data: ResendEmailDetail | null; error?: string }> {
  try {
    const resp = await fetch(`${RESEND_BASE}/emails/${encodeURIComponent(emailId)}`, {
      headers: authHeaders(apiKey),
      cache: 'no-store',
    })
    const payload = (await resp.json().catch(() => null)) as ResendEmailDetail & { message?: string }
    if (!resp.ok) {
      return { data: null, error: payload?.message ?? `HTTP ${resp.status}` }
    }
    return { data: payload }
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Errore di rete verso Resend' }
  }
}

const INVITE_SUBJECT_PREFIX = 'Invito alla piattaforma'

/** Recent invite emails indexed by recipient (lowercase), newest wins. */
export async function buildInviteEmailIndexByRecipient(
  apiKey: string,
  maxPages = 8
): Promise<Map<string, ResendEmailListItem>> {
  const byRecipient = new Map<string, ResendEmailListItem>()
  let after: string | undefined
  for (let page = 0; page < maxPages; page++) {
    const batch = await listResendEmails(apiKey, { limit: 100, after })
    if (batch.error) break
    for (const item of batch.data) {
      if (!item.subject?.startsWith(INVITE_SUBJECT_PREFIX)) continue
      const to = item.to?.[0]?.trim().toLowerCase()
      if (!to) continue
      const existing = byRecipient.get(to)
      if (!existing || item.created_at > existing.created_at) {
        byRecipient.set(to, item)
      }
    }
    if (!batch.has_more || batch.data.length === 0) break
    after = batch.data[batch.data.length - 1]?.id
    if (!after) break
  }
  return byRecipient
}

export function resendEventLabelIt(lastEvent: string | null | undefined): string {
  if (!lastEvent) return '—'
  const map: Record<string, string> = {
    sent: 'Inviata',
    delivered: 'Consegnata',
    opened: 'Aperta (pixel)',
    clicked: 'Click in email',
    bounced: 'Rimbalzata',
    failed: 'Fallita',
    suppressed: 'Soppressa',
    complained: 'Segnalata spam',
    delivery_delayed: 'Consegna ritardata',
    scheduled: 'Programmata',
  }
  return map[lastEvent] ?? lastEvent
}
