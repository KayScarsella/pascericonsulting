# AI Router — open ONLY the matching rule/folder

1. Read this file first. Never load `PROJECT_INDEX.md` / full `AGENTS.md` unless the human asks.
2. Auth / onboarding → `.cursor/rules/module-auth.mdc` + `modules/auth/` + `infra/auth/` + `src/app/(auth)/**`
3. Supabase clients / session → `.cursor/rules/infra.mdc` + `infra/supabase/` (shims: `src/utils/supabase/`)
4. Shared RBAC / constants / types → `.cursor/rules/core.mdc` + `core/`
5. EUDR Due Diligence (AOI/EE/map) → `.cursor/rules/module-eudr-due-diligence.mdc` + `modules/eudr-due-diligence/`
6. EUDR workflow/PDF/DDS libs → `.cursor/rules/module-eudr.mdc` + `modules/eudr/` + routes `src/app/EUDR/**`
7. Timber Regulation → `.cursor/rules/module-timber.mdc` + `modules/timber/` + `src/app/timberRegulation/**`
8. BoscoLog → `.cursor/rules/module-boscolog.mdc` + `modules/boscolog/` + actions `src/actions/boscolog/` + `src/app/boscolog/**`
9. CLOUD FSC → `.cursor/rules/module-fsc.mdc` + `modules/fsc/` + actions `src/actions/fsc/` + `src/app/cloud-fsc/**`
10. Documents (area documenti) → `.cursor/rules/module-documents.mdc` + `modules/documents/` + `src/actions/documents.ts`
11. UI routes stay in `src/app/**` — never move App Router files; use bridge rules under `.cursor/rules/app-*.mdc`
12. Dead code only → `archive/` (AI-ignored via `.cursorignore`)
