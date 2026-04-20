/// <reference types="https://deno.land/x/typescript_types@v1.0.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.94.0'

type Json = Record<string, unknown>
type ParentSessionRow = { id: string; evaluation_code: number | null }
type ProfileRow = { id: string; email: string; full_name: string | null }
type ReminderInsertRow = { id: string }

const TEMPLATE_VERSION = '2026-03-31-v2'

function requireEnv(name: string): string {
  const v = Deno.env.get(name)?.trim()
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

function addDaysUtcDateString(days: number): string {
  const now = new Date()
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + days)
  return utcMidnight.toISOString().slice(0, 10) // YYYY-MM-DD
}

function formatItDateFromYmd(ymd: string): string {
  // Expecting YYYY-MM-DD
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  return `${d}/${m}/${y}`
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

function getStringField(obj: unknown, key: string): string {
  if (!obj || typeof obj !== 'object' || !(key in obj)) return ''
  const value = (obj as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function getNullableStringField(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== 'object' || !(key in obj)) return null
  const value = (obj as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function getNullableNumberField(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== 'object' || !(key in obj)) return null
  const value = (obj as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getErrorStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object' || !('status' in err)) return undefined
  const status = (err as Record<string, unknown>).status
  return typeof status === 'number' ? status : undefined
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

serve(async (req) => {
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = requireEnv('RESEND_API_KEY')
    const fromEmail = requireEnv('FROM_EMAIL')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Defaults for scheduled runs (no body)
    const body = await safeReadJson(req)
    const daysAhead = parseDaysAhead(body.daysAhead, 7)
    const requestedReminderType = typeof body.reminderType === 'string' ? body.reminderType.trim() : ''
    const toolId = typeof body.toolId === 'string' ? body.toolId.trim() : ''

    const reminderType = requestedReminderType || `expiry_${daysAhead}d`
    const targetDate = addDaysUtcDateString(daysAhead) // matches metadata.expiry_date format used in app

    let sessionsQuery = supabase
      .from('assessment_sessions')
      .select('id,user_id,tool_id,metadata,evaluation_code,parent_session_id')
      .eq('status', 'completed')
      // PostgREST supports JSON path filters in column name
      .eq('metadata->>expiry_date', targetDate)

    if (toolId) sessionsQuery = sessionsQuery.eq('tool_id', toolId)

    const { data: sessions, error: sessionsError } = await sessionsQuery

    if (sessionsError) throw new Error(`assessment_sessions: ${sessionsError.message}`)

    const candidates = (sessions ?? []) as Array<{
      id: string
      user_id: string
      tool_id: string
      evaluation_code: number
      parent_session_id: string | null
    }>

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          templateVersion: TEMPLATE_VERSION,
          reminderType,
          daysAhead,
          targetDate,
          toolId: toolId || null,
          candidates: 0,
          inserted: 0,
          sent: 0,
          skipped: 0,
          errors: [],
        }),
        {
        headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Map parent_session_id -> evaluation_code, so the email uses the "base analysis" number.
    const parentIds = Array.from(
      new Set(candidates.map((c) => c.parent_session_id).filter((v): v is string => Boolean(v)))
    )
    const parentCodeById = new Map<string, number>()
    if (parentIds.length > 0) {
      const { data: parents, error: parentsError } = await supabase
        .from('assessment_sessions')
        .select('id,evaluation_code')
        .in('id', parentIds)
      if (parentsError) throw new Error(`assessment_sessions parents: ${parentsError.message}`)
      for (const p of (parents ?? []) as ParentSessionRow[]) {
        const id = getStringField(p, 'id')
        const code = getNullableNumberField(p, 'evaluation_code')
        if (id && code != null) parentCodeById.set(id, code)
      }
    }

    const userIds = Array.from(new Set(candidates.map((c) => c.user_id)))
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id,email,full_name')
      .in('id', userIds)

    if (profilesError) throw new Error(`profiles: ${profilesError.message}`)

    const profileByUserId = new Map<string, { email: string; full_name: string | null }>()
    for (const p of (profiles ?? []) as ProfileRow[]) {
      const email = getStringField(p, 'email').trim()
      if (!email) continue
      profileByUserId.set(getStringField(p, 'id'), {
        email,
        full_name: getNullableStringField(p, 'full_name'),
      })
    }

    let inserted = 0
    let sent = 0
    let skipped = 0
    const errors: Array<{ sessionId: string; error: string }> = []

    for (const c of candidates) {
      const profile = profileByUserId.get(c.user_id)
      const to = profile?.email
      if (!to) {
        skipped++
        continue
      }

      // 1) Insert idempotent log row (skip if already exists)
      const { data: reminderRow, error: insertError } = await supabase
        .from('email_reminders')
        .insert({
          user_id: c.user_id,
          tool_id: c.tool_id,
          session_id: c.id,
          reminder_type: reminderType,
          target_date: targetDate,
        })
        .select('id')
        .single()

      if (insertError) {
        // Conflict => already processed
        const status = getErrorStatus(insertError)
        if (status === 409) {
          skipped++
          continue
        }
        errors.push({ sessionId: c.id, error: `insert email_reminders: ${insertError.message}` })
        continue
      }

      const reminderId = getStringField(reminderRow as ReminderInsertRow | null, 'id')
      if (!reminderId) {
        errors.push({ sessionId: c.id, error: 'insert email_reminders: missing reminder id' })
        continue
      }
      inserted++

      // 2) Send email
      try {
        const baseCode =
          c.parent_session_id ? parentCodeById.get(c.parent_session_id) : undefined
        const analysisNumber = String(baseCode ?? c.evaluation_code ?? '')
        const subject = `Scadenza analisi n. ${analysisNumber}`
        const recipientName = (profile?.full_name ?? '').trim() || 'Gentile Cliente'
        const itDate = formatItDateFromYmd(targetDate)
        const html = `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;">
            <!-- template_version:${TEMPLATE_VERSION} -->
            <p>${recipientName},</p>
            <p>
              comunichiamo che l’analisi n. <strong>${analysisNumber}</strong> scade il <strong>${itDate}</strong>.
              Si prega di aggiornarla entro tale termine per garantire conformità al Regolamento UE 2023/1115.
              Restiamo a disposizione per supporto.
            </p>
            <p>Cordiali saluti,<br />Vincenzo</p>
          </div>
        `
        const { id: providerId } = await sendResendEmail({
          apiKey: resendApiKey,
          from: fromEmail,
          to,
          subject,
          html,
        })

        const { error: updateError } = await supabase
          .from('email_reminders')
          .update({ sent_at: new Date().toISOString(), provider_id: providerId, error: null })
          .eq('id', reminderId)
        if (updateError) {
          errors.push({ sessionId: c.id, error: `update email_reminders: ${updateError.message}` })
        } else {
          sent++
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown send error'
        await supabase.from('email_reminders').update({ error: message }).eq('id', reminderId)
        errors.push({ sessionId: c.id, error: message })
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        templateVersion: TEMPLATE_VERSION,
        reminderType,
        daysAhead,
        targetDate,
        toolId: toolId || null,
        candidates: candidates.length,
        inserted,
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

