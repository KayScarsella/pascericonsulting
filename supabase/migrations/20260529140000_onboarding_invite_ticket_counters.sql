-- Click counters: portal (multi-use email link) vs magic link mint (single-use, on button only).

alter table public.onboarding_invite_tickets
  add column if not exists portal_views_count integer not null default 0,
  add column if not exists magiclink_mints_count integer not null default 0,
  add column if not exists last_portal_view_at timestamptz,
  add column if not exists last_magiclink_mint_at timestamptz;

comment on column public.onboarding_invite_tickets.portal_views_count is
  'Aperture della pagina /auth/onboarding-entry (link multiuso in email; include possibili scanner).';

comment on column public.onboarding_invite_tickets.magiclink_mints_count is
  'Click su «Continua e accedi»: generazioni del magic link Supabase monouso.';
