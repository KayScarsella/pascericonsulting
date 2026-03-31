/// <reference types="https://deno.land/x/typescript_types@v1.0.0/index.d.ts" />

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.94.0'

type Json = Record<string, unknown>

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

serve(async () => {
  try {
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = requireEnv('RESEND_API_KEY')
    const fromEmail = requireEnv('FROM_EMAIL')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const reminderType = 'expiry_7d'
    const targetDate = addDaysUtcDateString(7) // matches metadata.expiry_date format used in app

    const { data: sessions, error: sessionsError } = await supabase
      .from('assessment_sessions')
      .select('id,user_id,tool_id,metadata')
      .eq('status', 'completed')
      // PostgREST supports JSON path filters in column name
      .eq('metadata->>expiry_date', targetDate)

    if (sessionsError) throw new Error(`assessment_sessions: ${sessionsError.message}`)

    const candidates = (sessions ?? []) as Array<{
      id: string
      user_id: string
      tool_id: string
    }>

    if (candidates.length === 0) {
      return new Response(JSON.stringify({ ok: true, targetDate, candidates: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const userIds = Array.from(new Set(candidates.map((c) => c.user_id)))
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id,email,full_name')
      .in('id', userIds)

    if (profilesError) throw new Error(`profiles: ${profilesError.message}`)

    const emailByUserId = new Map<string, { email: string; full_name: string | null }>()
    for (const p of profiles ?? []) {
      const email = String((p as any).email ?? '').trim()
      if (!email) continue
      emailByUserId.set(String((p as any).id), {
        email,
        full_name: ((p as any).full_name as string | null) ?? null,
      })
    }

    let inserted = 0
    let sent = 0
    let skipped = 0
    const errors: Array<{ sessionId: string; error: string }> = []

    for (const c of candidates) {
      const to = emailByUserId.get(c.user_id)?.email
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
        const status = (insertError as any).status as number | undefined
        if (status === 409) {
          skipped++
          continue
        }
        errors.push({ sessionId: c.id, error: `insert email_reminders: ${insertError.message}` })
        continue
      }

      inserted++

      // 2) Send email
      try {
        const subject = `Promemoria: scadenza tra 7 giorni (${targetDate})`
        const html = `
          <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;">
            <p>Ciao,</p>
            <p>ti ricordiamo che una tua analisi/strumento risulta in scadenza il <strong>${targetDate}</strong>.</p>
            <p>Se hai bisogno di assistenza, rispondi a questa email.</p>
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
          .eq('id', (reminderRow as any).id)
        if (updateError) {
          errors.push({ sessionId: c.id, error: `update email_reminders: ${updateError.message}` })
        } else {
          sent++
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown send error'
        await supabase.from('email_reminders').update({ error: message }).eq('id', (reminderRow as any).id)
        errors.push({ sessionId: c.id, error: message })
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        reminderType,
        targetDate,
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

