-- Multi-use onboarding portal tickets (email scanners can open the URL; Supabase magic link is minted on button click).

create table public.onboarding_invite_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null,
  tool_id uuid references public.tools (id) on delete set null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint onboarding_invite_tickets_token_hash_key unique (token_hash)
);

create index onboarding_invite_tickets_user_id_idx
  on public.onboarding_invite_tickets (user_id);

create index onboarding_invite_tickets_active_idx
  on public.onboarding_invite_tickets (user_id, expires_at)
  where revoked_at is null;

alter table public.onboarding_invite_tickets enable row level security;

comment on table public.onboarding_invite_tickets is
  'Opaque tickets for /auth/onboarding-entry; reusable until expiry or onboarding_completed. Service role only.';
