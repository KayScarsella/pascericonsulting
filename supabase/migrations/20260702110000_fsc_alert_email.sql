-- CLOUD FSC: tracking invio email Resend per alert scadenze (outbox esistente)

ALTER TABLE public.fsc_alert_outbox
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_provider_id text,
  ADD COLUMN IF NOT EXISTS email_error text;

CREATE INDEX IF NOT EXISTS idx_fsc_alert_outbox_email_pending
  ON public.fsc_alert_outbox (tool_id, target_date)
  WHERE email_sent_at IS NULL;
