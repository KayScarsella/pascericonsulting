# AGENTS.md

**AI entrypoint:** open `AI_ROUTER.md` first; load only the matching `.cursor/rules/*.mdc` + folder.

## Before asking (human)
- Cite route/file (e.g. `src/app/EUDR/risk-analysis/page.tsx`).
- State user role (admin/premium/standard) and `toolId` when permissions matter.

## Hard safety (max)
- Do not move App Router files out of `src/app/`.
- Invites onboarding: Resend only (`RESEND_API_KEY`, `FROM_EMAIL`); portal `/auth/onboarding-entry`.
- Supabase Auth ops: enable leaked-password protection; Email OTP expiry ≤ 3600s (dashboard `bqmjtxhdhfbwxydcaidv`).

Humans: full index in `PROJECT_INDEX.md`. Agents: use `AI_ROUTER.md` only.
