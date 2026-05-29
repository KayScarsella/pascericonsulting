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
- Dashboard progetto: abilitare **Leaked password protection** (Auth → password security).
- Inviti onboarding: **solo Resend** (`RESEND_API_KEY`, `FROM_EMAIL`) + link porta `/auth/onboarding-entry` (vedi `INVITE_REQUIRES_RESEND_HINT` in `src/lib/constants.ts`).
- Recupero password: **Email OTP expiration** (Auth → Email); vedi `AUTH_EMAIL_OTP_EXPIRATION_HINT`.

## Indice tecnico completo
Vedi `PROJECT_INDEX.md`.

