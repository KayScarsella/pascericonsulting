## expiry-reminders (Edge Function)

Invia email automatiche (via **Resend**) quando una sessione ha `assessment_sessions.metadata.expiry_date = current_date + 7`.

### Secrets richiesti (Supabase → Project Settings → Secrets)

- `RESEND_API_KEY`
- `FROM_EMAIL` (es. `noreply@tuodominio.it`)

Supabase fornisce già:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Schedule

Configura una schedule (Supabase Dashboard → Edge Functions → Schedules) che invoca la funzione `expiry-reminders` una volta al giorno (es. 08:00 UTC).

### Idempotenza

La funzione usa `public.email_reminders` come outbox/log con vincolo unico su:

`(user_id, session_id, reminder_type, target_date)`

Se la schedule gira più volte, non reinvia.

