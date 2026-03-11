# PROJECT_INDEX — pascericonsulting

Indice tecnico del progetto per avere contesto “globale” nelle prossime domande.

## TL;DR
- **Stack**: Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui
- **Backend**: Supabase (Auth, DB, Storage) usato via `@supabase/ssr` e `@supabase/supabase-js`
- **Dominio**: portale gestionale con aree **EUDR** e **Timber Regulation**

## Comandi (da `package.json`)
- `npm run dev`: avvio sviluppo (Next dev server)
- `npm run build`: build produzione
- `npm run start`: start produzione
- `npm run lint`: ESLint

## Config principali
- `next.config.ts`: `reactCompiler: true`
- `tsconfig.json`: strict + alias `@/* -> src/*`
- `eslint.config.mjs`: preset Next core-web-vitals + TypeScript
- `postcss.config.mjs`: Tailwind via `@tailwindcss/postcss`
- `components.json`: configurazione shadcn/ui (CSS in `src/app/globals.css`)

## Entrypoint e routing (Next App Router)
- **Root layout**: `src/app/layout.tsx`
- **Home**: `src/app/page.tsx`
  - Se l’utente è loggato → `redirect("/landingPage")`
  - Altrimenti mostra CTA Login/Signup

### Rotte principali (verificate)
- **Auth**
  - `src/app/(auth)/login/page.tsx` → `/login`
  - `src/app/(auth)/signup/page.tsx` → `/signup`
  - `src/app/(auth)/landingPage/page.tsx` → `/landingPage`
  - `src/app/(auth)/callback/route.ts` → `/callback` (Gestione callback Supabase)
- **EUDR**
  - `src/app/EUDR/page.tsx` → `/EUDR`
  - `src/app/EUDR/search/page.tsx`
  - `src/app/EUDR/risk-analysis/page.tsx`
  - `src/app/EUDR/evaluation/page.tsx`
  - `src/app/EUDR/documentation/page.tsx`
  - `src/app/EUDR/master/page.tsx`
- **Timber Regulation**
  - `src/app/timberRegulation/page.tsx` → `/timberRegulation`
  - `src/app/timberRegulation/search/page.tsx`
  - `src/app/timberRegulation/risk-analysis/page.tsx`
  - `src/app/timberRegulation/evaluation/page.tsx`
  - `src/app/timberRegulation/valutazione-finale/page.tsx`
  - `src/app/timberRegulation/mitigazione/page.tsx` → `/timberRegulation/mitigazione`
  - `src/app/timberRegulation/risultato/page.tsx` → `/timberRegulation/risultato`
  - `src/app/timberRegulation/documentation/page.tsx`
  - `src/app/timberRegulation/master/page.tsx`

## Struttura cartelle (macro)
- `src/app/`: pagine/layout Next (App Router)
- `src/actions/`: Server Actions (`'use server'`) per Supabase Auth e DB
  - `auth.ts`, `documents.ts`, `questions.ts`, `suppliers.ts`, `workflows.ts`, `UserService.ts`, `actions.ts`
- `src/components/`:
  - `ui/`: componenti base shadcn/ui
  - `questions/`: componenti per i form di valutazione (SectionList, questionItem, dynamicInput, FileUploader, SupplierManager)
  - `SearchClient.tsx`, `TimberSearchTabs.tsx`, `TimberVerificationList.tsx`, `documentsView.tsx`: componenti core dominio
  - `MitigationForm.tsx`, `MitigationHistorySection.tsx`, `RiskBarChart.tsx`: componenti Timber Regulation
- `src/lib/`:
  - `tool-auth.ts`: gestione permessi RBAC
  - `logic-engine.ts`: logica di valutazione
- `src/utils/supabase/`: factory client Supabase
- `src/types/`: definizioni TypeScript

## Supabase: configurazione, sessioni, auth
### Env richieste
Il codice usa:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Client Supabase (pattern usato)
Nel codice si usa `createServerClient(...)` con cookie handling (SSR):
- `src/actions/auth.ts`
- `src/actions/documents.ts`
- `src/app/(auth)/callback/route.ts`
- `src/utils/supabase/proxy.ts` (helper per middleware)

### Auth actions
- `src/actions/auth.ts`: login, signup (con redirect a `/callback`), logout.
- `src/app/(auth)/callback/route.ts`: scambia il codice email per una sessione.

## RBAC / Tool access (verificato)
- `src/lib/tool-auth.ts`: `getToolAccess(toolId)`
  - Se non autenticato → `redirect("/login")`
  - Se nessun accesso per quel tool → `redirect("/landingPage")`
  - Legge tabella Supabase `tool_access` (`role`)

## Documenti (DB + Storage)
- `src/actions/documents.ts`
  - Gestione tabella `documents` e bucket storage `documents`.
  - Operazioni: Upload, Delete (via RPC `get_recursive_storage_paths`), Download (Signed URL).

## Middleware / refresh session
Il middleware è configurato in:
- `src/proxy.ts` (Standard attuale del progetto)
che richiama:
- `src/utils/supabase/proxy.ts` → `updateSession(request)`

**Nota**: il file si chiama `src/proxy.ts` come da configurazione specifica del progetto, assicurarsi che il server Next.js sia configurato per caricarlo correttamente se non è lo standard `middleware.ts`.

## Indici database (Supabase)
- **File**: `supabase/migrations/20250306000000_add_performance_indexes.sql`
- PostgreSQL crea automaticamente indici su PK e unique; le FK beneficiano di indici espliciti per le query frequenti.
- Per applicare: `supabase db push` oppure eseguire lo script manualmente nel SQL Editor di Supabase.

## Cosa chiedermi
Indica sempre la route coinvolta e il ruolo utente per debugging mirati.
