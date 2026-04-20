/// <reference types="https://deno.land/x/typescript_types@v1.0.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.94.0'

const TEMPLATE_VERSION = '2026-04-10-v1'

type Json = Record<string, unknown>

function requireEnv(name: string): string {
  const v = Deno.env.get(name)?.trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

async function safeReadJson(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) return {}
  try {
    const parsed = await req.json()
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

async function sendResendEmail(args: {
  apiKey: string
  from: string
  to: string
  subject: string
  html: string
}): Promise<{ id: string }> {
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

  const payload = (await resp.json().catch(() => null)) as Json | null
  if (!resp.ok) {
    const msg = payload ? JSON.stringify(payload) : `HTTP ${resp.status}`
    throw new Error(`Resend error: ${msg}`)
  }

  const id = String((payload as Json | null)?.id ?? '')
  if (!id) throw new Error('Resend error: missing id')
  return { id }
}

const ROLE_LABEL_IT: Record<string, string> = {
  standard: 'Standard',
  premium: 'Premium',
  admin: 'Amministratore',
}

function roleLabelIt(role: string): string {
  return ROLE_LABEL_IT[role] ?? role
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = requireEnv('RESEND_API_KEY')
    const fromEmail = requireEnv('FROM_EMAIL')

    const body = await safeReadJson(req)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
    const toolId = typeof body.toolId === 'string' ? body.toolId.trim() : ''
    const kind = body.kind === 'role_updated' ? 'role_updated' : 'access_granted'
    const roleRaw = typeof body.role === 'string' ? body.role.trim() : 'standard'
    const appPublicUrl =
      typeof body.appPublicUrl === 'string' ? body.appPublicUrl.trim().replace(/\/$/, '') : ''

    if (!email || !email.includes('@') || !userId || !toolId || !appPublicUrl) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Missing or invalid: email, userId, toolId, appPublicUrl',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: toolRow, error: toolError } = await supabase
      .from('tools')
      .select('name')
      .eq('id', toolId)
      .maybeSingle()

    if (toolError) {
      return new Response(JSON.stringify({ ok: false, error: toolError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const toolName = (toolRow as { name?: string } | null)?.name?.trim() || 'lo strumento'

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()

    const recipientName =
      ((profileRow as { full_name?: string } | null)?.full_name ?? '').trim() || 'Gentile utente'
    const roleIt = roleLabelIt(roleRaw)
    const dashboardUrl = `${appPublicUrl}/landingPage`

    const subject =
      kind === 'role_updated'
        ? `Aggiornamento accesso: ${toolName}`
        : `Nuovo accesso al portale: ${toolName}`

    const bodyHtml =
      kind === 'role_updated'
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

    const { id: providerId } = await sendResendEmail({
      apiKey: resendApiKey,
      from: fromEmail,
      to: email,
      subject,
      html,
    })

    return new Response(
      JSON.stringify({ ok: true, templateVersion: TEMPLATE_VERSION, providerId }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
