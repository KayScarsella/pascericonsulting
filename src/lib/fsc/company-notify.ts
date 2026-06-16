import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { FscMemberType } from '@/types/fsc'
import { fscMemberTypeLabel } from '@/lib/fsc/constants'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendResendHttp(args: {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: args.from,
        to: [args.to],
        subject: args.subject,
        html: args.html,
      }),
    })
    const payload = (await resp.json().catch(() => null)) as Record<string, unknown> | null
    if (!resp.ok) {
      const msg = payload ? JSON.stringify(payload) : `HTTP ${resp.status}`
      return { ok: false, error: `Resend: ${msg}` }
    }
    const id = String(payload?.id ?? '')
    if (!id) return { ok: false, error: 'Resend: risposta senza id' }
    return { ok: true, id }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Errore di rete verso Resend' }
  }
}

export async function notifyUserOfFscCompanyAccess(
  _supabase: SupabaseClient<Database>,
  input: {
    appPublicUrl: string
    userId: string
    email: string
    companyName: string
    memberType: FscMemberType
    canEdit: boolean
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.FROM_EMAIL?.trim()
  if (!resendKey || !fromEmail) {
    return { ok: false, error: 'RESEND_API_KEY e FROM_EMAIL richiesti per la notifica' }
  }

  const roleLabel = fscMemberTypeLabel(input.memberType)
  const editLabel = input.canEdit ? 'con permesso di modifica' : 'in sola lettura'
  const base = input.appPublicUrl.replace(/\/$/, '')
  const fscUrl = `${base}/cloud-fsc`

  const subject = `Accesso all’impresa ${input.companyName.trim() || 'FSC'}`
  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;">
      <h2 style="margin:0 0 16px;">Nuovo accesso impresa FSC</h2>
      <p style="line-height:1.6;color:#374151;">
        Le è stato assegnato l’accesso all’impresa <strong>${escapeHtml(input.companyName)}</strong>
        su CLOUD FSC con ruolo <strong>${escapeHtml(roleLabel)}</strong> (${escapeHtml(editLabel)}).
      </p>
      <p style="margin:18px 0;">
        <a href="${escapeHtml(fscUrl)}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
          Apri CLOUD FSC
        </a>
      </p>
      <p style="font-size:12px;color:#64748b;">Se il pulsante non funziona: ${escapeHtml(fscUrl)}</p>
    </div>
  `

  const sent = await sendResendHttp({
    apiKey: resendKey,
    from: fromEmail,
    to: input.email,
    subject,
    html,
  })

  return sent.ok ? { ok: true } : sent
}
