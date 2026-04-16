import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const TEMPLATE_VERSION = '2026-04-10-v1'

const ROLE_LABEL_IT: Record<string, string> = {
  standard: 'Standard',
  premium: 'Premium',
  admin: 'Amministratore',
}

function roleLabelIt(role: string): string {
  return ROLE_LABEL_IT[role] ?? role
}

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
}): Promise<{ ok: true } | { ok: false; error: string }> {
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
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Errore di rete verso Resend' }
  }
}

/** Loads tool name + profile, builds HTML — same copy as Edge Function `tool-access-notify`. */
export async function sendToolAccessNotifyViaResend(
  supabase: SupabaseClient<Database>,
  input: {
    apiKey: string
    from: string
    userId: string
    email: string
    toolId: string
    kind: 'access_granted' | 'role_updated'
    role: string
    appPublicUrl: string
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: toolRow, error: toolError } = await supabase
    .from('tools')
    .select('name')
    .eq('id', input.toolId)
    .maybeSingle()

  if (toolError) {
    return { ok: false, error: toolError.message }
  }

  const toolName = toolRow?.name?.trim() || 'lo strumento'

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', input.userId)
    .maybeSingle()

  const recipientName = (profileRow?.full_name ?? '').trim() || 'Gentile utente'
  const roleIt = roleLabelIt(input.role)
  const base = input.appPublicUrl.replace(/\/$/, '')
  const dashboardUrl = `${base}/landingPage`

  const subject =
    input.kind === 'role_updated'
      ? `Aggiornamento accesso: ${toolName}`
      : `Nuovo accesso al portale: ${toolName}`

  const bodyHtml =
    input.kind === 'role_updated'
      ? `<p>Il suo ruolo per lo strumento <strong>${escapeHtml(toolName)}</strong> è stato aggiornato a <strong>${escapeHtml(roleIt)}</strong>.</p>
           <p>Può accedere al portale dalla sua area personale:</p>`
      : `<p>Le è stato abilitato l’accesso allo strumento <strong>${escapeHtml(toolName)}</strong> con ruolo <strong>${escapeHtml(roleIt)}</strong>.</p>
           <p>Acceda al portale per utilizzarlo:</p>`

  const html = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;">
        <!-- template_version:${TEMPLATE_VERSION} -->
        <p>${escapeHtml(recipientName)},</p>
        ${bodyHtml}
        <p><a href="${escapeHtml(dashboardUrl)}" style="color:#2563eb;">Apri la dashboard</a></p>
        <p style="font-size:12px;color:#64748b;">Se il link non funziona, copi questo indirizzo nel browser:<br />${escapeHtml(dashboardUrl)}</p>
        <p>Cordiali saluti,<br />Pasceri Consulting</p>
      </div>
    `

  return sendResendHttp({
    apiKey: input.apiKey,
    from: input.from,
    to: input.email,
    subject,
    html,
  })
}

export async function sendToolAccessNotifyViaEdgeFunction(input: {
  supabaseUrl: string
  serviceRoleKey: string
  appPublicUrl: string
  userId: string
  email: string
  toolId: string
  kind: 'access_granted' | 'role_updated'
  role: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resp = await fetch(`${input.supabaseUrl}/functions/v1/tool-access-notify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: input.userId,
        email: input.email,
        toolId: input.toolId,
        kind: input.kind,
        role: input.role,
        appPublicUrl: input.appPublicUrl,
      }),
      cache: 'no-store',
    })
    const payload = (await resp.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null
    if (resp.status === 404) {
      return {
        ok: false,
        error:
          'Funzione Edge `tool-access-notify` non trovata (404). Aggiungi RESEND_API_KEY e FROM_EMAIL alle variabili d’ambiente del server Next.js (consigliato), oppure esegui: supabase functions deploy tool-access-notify',
      }
    }
    if (!resp.ok) {
      return { ok: false, error: payload?.error ?? `HTTP ${resp.status}` }
    }
    if (!payload?.ok) {
      return { ok: false, error: payload?.error ?? 'Risposta non valida' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Errore di rete' }
  }
}

/**
 * Preferisce invio diretto da Next (stessi secret di Resend che usi in locale/produzione).
 * Se mancano le chiavi, prova la Edge Function su Supabase (richiede deploy).
 */
export async function notifyUserOfToolAccess(
  supabase: SupabaseClient<Database>,
  input: {
    appPublicUrl: string
    userId: string
    email: string
    toolId: string
    kind: 'access_granted' | 'role_updated'
    role: string
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const resendKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = process.env.FROM_EMAIL?.trim()
  if (resendKey && fromEmail) {
    return sendToolAccessNotifyViaResend(supabase, {
      apiKey: resendKey,
      from: fromEmail,
      userId: input.userId,
      email: input.email,
      toolId: input.toolId,
      kind: input.kind,
      role: input.role,
      appPublicUrl: input.appPublicUrl,
    })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supabaseUrl && serviceRoleKey) {
    return sendToolAccessNotifyViaEdgeFunction({
      supabaseUrl,
      serviceRoleKey,
      appPublicUrl: input.appPublicUrl,
      userId: input.userId,
      email: input.email,
      toolId: input.toolId,
      kind: input.kind,
      role: input.role,
    })
  }

  return {
    ok: false,
    error:
      'Manca la configurazione email: imposta RESEND_API_KEY e FROM_EMAIL sul server Next.js, oppure effettua il deploy della funzione tool-access-notify su Supabase con gli stessi secret.',
  }
}
