# AGENTS.md — Guida rapida

Questo file serve a rendere le prossime domande “complete” e sempre contestualizzate al progetto.

## Prima di chiedere (2 righe)
- Cita la **route** o il **file** coinvolto (es. `src/app/EUDR/risk-analysis/page.tsx`).
- Dimmi **ruolo utente** (admin/premium/standard) e **toolId** se c’entrano permessi o documenti.

## Dove cercare le cose
- **Routing/UI**: `src/app/**`
- **Server Actions (Supabase)**: `src/actions/**`
- **RBAC/permessi tool**: `src/lib/tool-auth.ts`
- **Supabase client + session refresh**: `src/utils/supabase/**`
- **UI library (shadcn)**: `src/components/ui/**`
- **Area Documenti**: `src/actions/documents.ts` + tabella `documents` + bucket `documents`

## Sicurezza Auth / Supabase (operatore)
- Dashboard progetto **bqmjtxhdhfbwxydcaidv**:
  - **Leaked password protection**: Auth → Password security → abilitare (lint `auth_leaked_password_protection`).
  - **Email OTP expiration**: Auth → Email → impostare **≤ 3600 secondi** (lint `auth_otp_long_expiry`). Vale solo per magic link / OTP Supabase al click «Continua e accedi»; il link porta Resend (`ONBOARDING_PORTAL_TICKET_TTL_DAYS`) resta separato — vedi `AUTH_EMAIL_OTP_EXPIRATION_HINT`.
- Inviti onboarding: **solo Resend** (`RESEND_API_KEY`, `FROM_EMAIL`) + link porta `/auth/onboarding-entry` (vedi `INVITE_REQUIRES_RESEND_HINT` in `src/lib/constants.ts`).
- Scadenze CLOUD FSC (email Resend 30 gg prima): cron `fsc_daily_alerts` → outbox `fsc_alert_outbox`; Edge Function `fsc-expiry-emails` (schedule 07:15 UTC, secrets `SITE_URL`). Trigger manuale: `triggerFscExpiryEmailsNowAction` in `src/actions/fsc/alerts.ts`. EUDR/Timber non coinvolti (`expiry-reminders`).
- RPC SECURITY DEFINER: migration `20260624110000_fsc_rpc_security_hardening.sql` revoca `PUBLIC`/`anon` e limita i grant per ruolo.

## Indice tecnico completo
Vedi `PROJECT_INDEX.md`.

