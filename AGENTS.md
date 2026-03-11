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

## Indice tecnico completo
Vedi `PROJECT_INDEX.md`.

