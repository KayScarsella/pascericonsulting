alter table public.onboarding_invite_tickets
  add column if not exists last_resend_email_id text,
  add column if not exists last_resend_sent_at timestamptz;

comment on column public.onboarding_invite_tickets.last_resend_email_id is
  'ID email Resend (GET /emails/:id) per supervisione consegna/aperture.';
