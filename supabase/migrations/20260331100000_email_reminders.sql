-- Email reminders outbox/log (idempotent sends)

create table if not exists public.email_reminders (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  user_id uuid not null,
  tool_id uuid not null,
  session_id uuid not null,
  reminder_type text not null,
  target_date date not null,
  sent_at timestamp with time zone,
  provider_id text,
  error text,
  constraint email_reminders_pkey primary key (id),
  constraint email_reminders_user_fk foreign key (user_id) references public.profiles (id) on delete cascade,
  constraint email_reminders_tool_fk foreign key (tool_id) references public.tools (id) on delete cascade,
  constraint email_reminders_session_fk foreign key (session_id) references public.assessment_sessions (id) on delete cascade
);

alter table public.email_reminders enable row level security;

-- Idempotency key (avoid duplicate sends)
create unique index if not exists email_reminders_idempotency_key
  on public.email_reminders (user_id, session_id, reminder_type, target_date);

-- Fast lookup for pending sends
create index if not exists email_reminders_pending_lookup
  on public.email_reminders (target_date, reminder_type, sent_at)
  where sent_at is null;

