## fsc-expiry-emails (Edge Function)

Invia email automatiche (via **Resend**) per le scadenze CLOUD FSC accodate in `fsc_alert_outbox`, **30 giorni prima** della data di scadenza.

Tipi coperti:

- Documenti gestione/ente (`document_expiry_30d`) — solo versione `active`
- Certificato e controllo periodico fornitori
- Certificato e controllo periodico terzisti

EUDR/Timber **non** sono coinvolti (reminder separati in `expiry-reminders`).

### Prerequisito

Il cron `fsc_daily_alerts` (07:00 UTC) deve aver già eseguito `fsc_process_alert_outbox`, che popola l'outbox quando `scadenza = oggi + 30 giorni`.

### Secrets richiesti (Supabase → Project Settings → Secrets)

- `RESEND_API_KEY`
- `FROM_EMAIL` (es. `noreply@tuodominio.it`)
- `SITE_URL` — URL pubblico dell'app senza slash finale (es. valore di `NEXT_PUBLIC_SITE_URL`)

Supabase fornisce già:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Schedule

Configura una schedule (Supabase Dashboard → Edge Functions → Schedules) che invoca `fsc-expiry-emails` **una volta al giorno alle 07:15 UTC**, subito dopo `fsc_daily_alerts`.

Body opzionale (default):

```json
{ "daysAhead": 30, "toolId": "50cd9969-0300-4d41-b807-1a88088d07e1" }
```

### Idempotenza

- Outbox: vincolo unico `(alert_kind, source_id, recipient_user_id, target_date)`
- Email: colonna `email_sent_at` su `fsc_alert_outbox` — riesecuzioni non reinviano

### Trigger manuale (admin)

Da Next.js: `triggerFscExpiryEmailsNowAction()` in `src/actions/fsc/alerts.ts` (richiede admin CLOUD FSC).
