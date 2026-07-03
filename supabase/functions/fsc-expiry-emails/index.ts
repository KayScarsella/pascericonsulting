/// <reference types="https://deno.land/x/typescript_types@v1.0.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.94.0'

type Json = Record<string, unknown>

const TEMPLATE_VERSION = '2026-07-02-v1'
const CLOUD_FSC_TOOL_ID = '50cd9969-0300-4d41-b807-1a88088d07e1'

type OutboxRow = {
  id: string
  alert_kind: string
  company_id: string
  tool_id: string
  source_table: string
  source_id: string
  target_date: string
  title: string
  message: string | null
  recipient_user_id: string
  profiles: { email: string; full_name: string | null } | null
  fsc_companies: { ragione_sociale: string } | null
}

type FscDocumentRow = {
  id: string
  name: string
  module: string
  category: string
  version: number
}

type PartnerRow = {
  id: string
  ragione_sociale: string
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name)?.trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function siteUrl(): string {
  const raw =
    Deno.env.get('SITE_URL')?.trim() ||
    Deno.env.get('NEXT_PUBLIC_SITE_URL')?.trim() ||
    Deno.env.get('APP_PUBLIC_URL')?.trim()
  if (!raw) throw new Error('Missing env: SITE_URL (or NEXT_PUBLIC_SITE_URL)')
  return raw.replace(/\/+$/, '')
}

function addDaysUtcDateString(days: number): string {
  const now = new Date()
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + days)
  return utcMidnight.toISOString().slice(0, 10)
}

function formatItDateFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

function parseDaysAhead(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return Math.trunc(n)
  }
  return fallback
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

function moduleLabel(module: string): string {
  if (module === 'ente') return 'Documenti ente'
  return 'Documenti gestione'
}

function modulePath(module: string): string {
  if (module === 'ente') return '/cloud-fsc/documenti-ente'
  return '/cloud-fsc/documenti-gestione'
}

function buildEmailContent(args: {
  alertKind: string
  recipientName: string
  companyName: string
  targetDate: string
  title: string
  message: string | null
  document?: FscDocumentRow | null
  partnerName?: string | null
  appBaseUrl: string
}): { subject: string; html: string } {
  const itDate = formatItDateFromYmd(args.targetDate)
  const company = escapeHtml(args.companyName)
  const recipient = escapeHtml(args.recipientName)

  let detailHtml = ''
  let linkPath = '/cloud-fsc'
  let shortTitle = args.title

  if (args.alertKind === 'document_expiry_30d' && args.document) {
    const doc = args.document
    const mod = moduleLabel(doc.module)
    linkPath = modulePath(doc.module)
    shortTitle = 'Documento FSC'
    detailHtml = `
      <p>Il documento <strong>${escapeHtml(doc.name)}</strong> (${escapeHtml(mod)}, categoria ${escapeHtml(doc.category)}, versione ${doc.version}) dell'impresa <strong>${company}</strong> scade il <strong>${itDate}</strong>.</p>
    `
  } else if (
    args.alertKind === 'supplier_certificate_30d' ||
    args.alertKind === 'supplier_control_30d'
  ) {
    linkPath = '/cloud-fsc/fornitori'
    shortTitle =
      args.alertKind === 'supplier_certificate_30d'
        ? 'Certificato fornitore'
        : 'Controllo fornitore'
    const partner = escapeHtml(args.partnerName ?? 'Fornitore')
    const kindLabel =
      args.alertKind === 'supplier_certificate_30d'
        ? 'Il certificato del fornitore'
        : 'Il controllo periodico del fornitore'
    detailHtml = `
      <p>${kindLabel} <strong>${partner}</strong> (impresa <strong>${company}</strong>) è in scadenza il <strong>${itDate}</strong>.</p>
    `
  } else if (
    args.alertKind === 'subcontractor_certificate_30d' ||
    args.alertKind === 'subcontractor_control_30d'
  ) {
    linkPath = '/cloud-fsc/terzisti'
    shortTitle =
      args.alertKind === 'subcontractor_certificate_30d'
        ? 'Certificato terzista'
        : 'Controllo terzista'
    const partner = escapeHtml(args.partnerName ?? 'Terzista')
    const kindLabel =
      args.alertKind === 'subcontractor_certificate_30d'
        ? 'Il certificato del terzista'
        : 'Il controllo periodico del terzista'
    detailHtml = `
      <p>${kindLabel} <strong>${partner}</strong> (impresa <strong>${company}</strong>) è in scadenza il <strong>${itDate}</strong>.</p>
    `
  } else {
    detailHtml = `
      <p>${escapeHtml(args.message ?? args.title)}</p>
      <p>Data scadenza: <strong>${itDate}</strong> — impresa <strong>${company}</strong>.</p>
    `
  }

  const ctaUrl = `${args.appBaseUrl}${linkPath}`
  const subject = `Scadenza FSC – ${shortTitle} – ${args.companyName}`

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color: #0f172a; line-height: 1.5;">
      <!-- template_version:${TEMPLATE_VERSION} -->
      <p>${recipient},</p>
      ${detailHtml}
      <p>Ti avvisiamo con un mese di anticipo per consentire il rinnovo o l'aggiornamento in CLOUD FSC.</p>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600;">Apri CLOUD FSC</a>
      </p>
      <p style="font-size: 13px; color: #64748b;">Se il link non funziona, copia questo indirizzo nel browser:<br />${escapeHtml(ctaUrl)}</p>
      <p>Cordiali saluti,<br />Pasceri Consulting</p>
    </div>
  `

  return { subject, html }
}

serve(async (req) => {
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = requireEnv('RESEND_API_KEY')
    const fromEmail = requireEnv('FROM_EMAIL')
    const appBaseUrl = siteUrl()

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const body = await safeReadJson(req)
    const daysAhead = parseDaysAhead(body.daysAhead, 30)
    const toolId =
      typeof body.toolId === 'string' && body.toolId.trim()
        ? body.toolId.trim()
        : CLOUD_FSC_TOOL_ID
    const targetDate = addDaysUtcDateString(daysAhead)

    const { data: rows, error: rowsError } = await supabase
      .from('fsc_alert_outbox')
      .select(
        `
        id,
        alert_kind,
        company_id,
        tool_id,
        source_table,
        source_id,
        target_date,
        title,
        message,
        recipient_user_id,
        profiles:recipient_user_id ( email, full_name ),
        fsc_companies:company_id ( ragione_sociale )
      `
      )
      .eq('tool_id', toolId)
      .is('email_sent_at', null)
      .eq('target_date', targetDate)

    if (rowsError) throw new Error(`fsc_alert_outbox: ${rowsError.message}`)

    const candidates = (rows ?? []) as OutboxRow[]
    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          templateVersion: TEMPLATE_VERSION,
          daysAhead,
          targetDate,
          toolId,
          candidates: 0,
          sent: 0,
          skipped: 0,
          errors: [],
        }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    const documentIds = candidates
      .filter((r) => r.alert_kind === 'document_expiry_30d')
      .map((r) => r.source_id)
    const supplierIds = candidates
      .filter((r) => r.alert_kind.startsWith('supplier_'))
      .map((r) => r.source_id)
    const subcontractorIds = candidates
      .filter((r) => r.alert_kind.startsWith('subcontractor_'))
      .map((r) => r.source_id)

    const documentById = new Map<string, FscDocumentRow>()
    if (documentIds.length > 0) {
      const { data, error } = await supabase
        .from('fsc_documents')
        .select('id, name, module, category, version')
        .in('id', documentIds)
        .eq('status', 'active')
      if (error) throw new Error(`fsc_documents: ${error.message}`)
      for (const doc of (data ?? []) as FscDocumentRow[]) {
        documentById.set(doc.id, doc)
      }
    }

    const supplierById = new Map<string, PartnerRow>()
    if (supplierIds.length > 0) {
      const { data, error } = await supabase
        .from('fsc_suppliers')
        .select('id, ragione_sociale')
        .in('id', supplierIds)
        .eq('status', 'active')
      if (error) throw new Error(`fsc_suppliers: ${error.message}`)
      for (const row of (data ?? []) as PartnerRow[]) {
        supplierById.set(row.id, row)
      }
    }

    const subcontractorById = new Map<string, PartnerRow>()
    if (subcontractorIds.length > 0) {
      const { data, error } = await supabase
        .from('fsc_subcontractors')
        .select('id, ragione_sociale')
        .in('id', subcontractorIds)
        .eq('status', 'active')
      if (error) throw new Error(`fsc_subcontractors: ${error.message}`)
      for (const row of (data ?? []) as PartnerRow[]) {
        subcontractorById.set(row.id, row)
      }
    }

    let sent = 0
    let skipped = 0
    const errors: Array<{ outboxId: string; error: string }> = []

    for (const row of candidates) {
      const email = row.profiles?.email?.trim()
      if (!email) {
        skipped++
        continue
      }

      if (row.alert_kind === 'document_expiry_30d' && !documentById.has(row.source_id)) {
        skipped++
        continue
      }
      if (row.alert_kind.startsWith('supplier_') && !supplierById.has(row.source_id)) {
        skipped++
        continue
      }
      if (row.alert_kind.startsWith('subcontractor_') && !subcontractorById.has(row.source_id)) {
        skipped++
        continue
      }

      const recipientName = (row.profiles?.full_name ?? '').trim() || 'Gentile utente'
      const companyName = row.fsc_companies?.ragione_sociale?.trim() || 'Impresa FSC'

      const partnerName =
        supplierById.get(row.source_id)?.ragione_sociale ??
        subcontractorById.get(row.source_id)?.ragione_sociale ??
        null

      const { subject, html } = buildEmailContent({
        alertKind: row.alert_kind,
        recipientName,
        companyName,
        targetDate: row.target_date,
        title: row.title,
        message: row.message,
        document: documentById.get(row.source_id) ?? null,
        partnerName,
        appBaseUrl,
      })

      try {
        const { id: providerId } = await sendResendEmail({
          apiKey: resendApiKey,
          from: fromEmail,
          to: email,
          subject,
          html,
        })

        const { error: updateError } = await supabase
          .from('fsc_alert_outbox')
          .update({
            email_sent_at: new Date().toISOString(),
            email_provider_id: providerId,
            email_error: null,
          })
          .eq('id', row.id)
          .is('email_sent_at', null)

        if (updateError) {
          errors.push({ outboxId: row.id, error: `update outbox: ${updateError.message}` })
        } else {
          sent++
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown send error'
        await supabase
          .from('fsc_alert_outbox')
          .update({ email_error: message })
          .eq('id', row.id)
        errors.push({ outboxId: row.id, error: message })
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        templateVersion: TEMPLATE_VERSION,
        daysAhead,
        targetDate,
        toolId,
        candidates: candidates.length,
        sent,
        skipped,
        errors,
      }),
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
