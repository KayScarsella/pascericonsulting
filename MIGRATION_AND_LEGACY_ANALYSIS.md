# Migration & legacy analysis

This document summarizes: (1) what was wrong or fixed in the new migrations, and (2) how the old PHP/JS app maps to the new DB and Next.js pages so you can adapt data and flows.

---

## 1. Migrations (`section_new_tool.sql`, `question_new_tool.sql`)

### What was not working (and was fixed in code)

- **Logic engine operators**  
  The section `logic_rules` use:
  - `"operator": "gt"` (e.g. “Procedura > 4” → esente)
  - `"operator": "is_not_empty"` (e.g. “identificazione operatore” compilata)  
  The app’s `src/lib/logic-engine.ts` only handled `eq` and `neq`, so those rules never matched.

  **Fix applied:**  
  - In `logic-engine.ts`: added support for `gt`, `lt`, and `is_not_empty`.  
  - In `types/questions.ts`: extended `LogicCondition.operator` with `'is_not_empty'` and made `value` optional for that case.

- **Section `order_index` type**  
  The section INSERT used `'0'` (string). The `sections` table expects a number.

  **Fix applied:**  
  - In `section_new_tool.sql`: `order_index` value changed from `'0'` to `0`.

### What you should check in the DB

- **`tools` table**  
  The section references `tool_id = '69d3d115-acc1-49f3-8d39-a003df7145be'` (EUDR). Ensure this ID exists in `tools` and that `tool_access` / app constants use the same ID.

- **Master data for EUDR questions**  
  The new questions depend on:
  - **`eu_products`**: `id`, `description` (and optionally `eu_code`, `order`) for “Prodotto da verificare”.
  - **`country`**: `id`, `country_name`, `extra_eu` for “Paese di approvvigionamento” (logic uses `extra_eu` for the incoerenza rule).

  If you migrated from the old DB, map:
  - Old `prodotti_ue` (codice_UE, Descrizione) → `eu_products` (id UUID, description, eu_code).
  - Old `paese` (Nome, Extra_Europeo) → `country` (id UUID, country_name, extra_eu boolean).

- **EUDR “Valutazione” section (optional)**  
  The evaluation page loads sections with `group_name` in `['Analisi Rischio', 'Valutazione']`. If you don’t have a “Valutazione” section for EUDR yet, the page still works and shows only “Analisi Rischio” in read-only; you can add a “Valutazione” section later if you need a second step.

---

## 2. Old system (index.php + script.js) vs new (Next.js + DB)

### Old flow

| Step | Old | New |
|------|-----|-----|
| **Auth** | PHP session, `protectPage('premium')` | Next.js + Supabase auth, `getToolAccess(EUDR_TOOL_ID)` |
| **Form page** | `index.php` (with optional `?id=...` for edit) | `/EUDR/risk-analysis` (optional `?session_id=...`) |
| **Form data** | Single table `verifica_regolamento_ue` | `assessment_sessions` + `user_responses` (one row per question) |
| **Save new** | `server/Save_On_DB.php` → returns `id` | Create `assessment_sessions` + save responses via actions |
| **Update existing** | `server/modify_valutazione.php` + `id` | Same session_id; update `user_responses` |
| **After submit** | Redirect to `valutazione.php?id=...` or `cerca.php?verifiche=true` | Redirect to `/EUDR/evaluation?session_id=...` or `/EUDR/search` (workflow actions) |
| **Documents** | `documenti` (nome_tabella, tabella_id, nome_file, nome_file_univoco) | `documents` + storage; file fields in questions use `file_path` in `user_responses` |

### Old DB structures (referred to by index.php / script.js)

- **verifica_regolamento_ue**  
  Columns used: `id`, `id_utente`, `codice_UE`, `Nome_Commerciale`, `Riciclo`, `importazione`, `Analisi_di_Test`, `Proprietario`, `Paese`, `Acquistato_Furi_UE`, `identificazione_operatore`, `Sogetto_Al_Regolamento`, `data`.
- **documenti**  
  Linked by `nome_tabella = 'verifica_regolamento_ue'` and `tabella_id = v.id`.
- **prodotti_ue**  
  `codice_UE`, `Descrizione` (dropdown “Prodotto da verificare”).
- **paese**  
  `Nome`, `Extra_Europeo` (dropdown “Paese”, with `#EX_EU` suffix in value for script.js).

### New DB structures (used by Next.js EUDR)

- **assessment_sessions**  
  One row per “verifica”: `id`, `user_id`, `tool_id` (EUDR), `session_type` (e.g. `verifica`), `status`, `metadata`, etc.
- **user_responses**  
  One row per answer: `session_id`, `question_id`, `answer_text` or `answer_json`, `file_path` (if file question).
- **sections**  
  Defines form blocks (e.g. “Analisi Rischio”) and `logic_rules` (JSON) for alerts / stop.
- **questions**  
  Defines fields (text, select, async_select, etc.) and `config` (options, source_table, source_extra_cols, etc.).
- **country**  
  `id` (UUID), `country_name`, `extra_eu` (boolean).
- **eu_products**  
  `id` (UUID), `description`, `eu_code`, `order`.

---

## 3. Field mapping: old form → new questions

| Old (verifica_regolamento_ue / form) | New (EUDR section “Analisi Rischio”) | Note |
|--------------------------------------|--------------------------------------|-----|
| codice_UE | Question “Prodotto da verificare” (async_select → `eu_products`) | Store `eu_products.id` in `answer_text` or as value |
| Nome_Commerciale | Question “Nome commerciale prodotto” (text + optional file) | `answer_text`; file in `file_path` |
| Riciclo | Question “Prodotto realizzato esclusivamente con materiale di recupero…” (select si/no) | `answer_text`: `"si"` / `"no"` |
| importazione | Question “Procedura di importazione da fuori UE…” (select 1–11) | `answer_text`: `"1"` … `"11"` |
| Paese | Question “Paese di approvvigionamento” (async_select → `country`) | `answer_text`: `country.id`; extra `extra_eu` used in logic only (client-side until we persist extra in JSON) |
| Proprietario | Question “Legname tagliato dalla Sua Organizzazione…” (select si/no) | `answer_text`: `"si"` / `"no"` |
| Acquistato_Furi_UE | Question “Prodotto acquistato tramite agente…” (select si/no) | `answer_text`: `"si"` / `"no"` |
| identificazione_operatore | Question “Identificazione della mia organizzazione” (select pmi / non pmi) | `answer_text`: `"pmi"` / `"non pmi"` |
| Sogetto_Al_Regolamento | Derived from logic rules (success = no, warning/danger = si) | Not stored as a column; workflow uses rule outcome (esente → completed; soggetto → evaluation) |
| Analisi_di_Test | Checkbox in old form | Not in current migration; add a question if you need it |
| File_Prodotto | File in old form | Handled by “Nome commerciale” question if `file_upload_enabled: true` |

---

## 4. How to adapt: DB and pages

### DB

1. **Run migrations**  
   Apply `section_new_tool.sql` and `question_new_tool.sql` (with the `order_index` fix already applied) so that the EUDR section and 8 questions exist for `tool_id = '69d3d115-acc1-49f3-8d39-a003df7145be'`.

2. **Ensure `tools` row**  
   There must be a row in `tools` with `id = '69d3d115-acc1-49f3-8d39-a003df7145be'` (and optionally name “EUDR”, base_path “/EUDR”). If you use a different EUDR tool ID, update the constant `EUDR_TOOL_ID` in `src/lib/constants.ts` and the migration `tool_id` to match.

3. **Master data**  
   - Populate **eu_products** from `prodotti_ue` (generate UUIDs for `id`, map Descrizione → `description`, codice_UE → `eu_code`).  
   - Populate **country** from `paese` (generate UUIDs for `id`, Nome → `country_name`, Extra_Europeo → `extra_eu` boolean).

4. **Optional: migrate old “verifiche” into new model**  
   For each row in `verifica_regolamento_ue`: create one `assessment_sessions` (tool_id = EUDR, session_type = `verifica`, user_id from your user mapping), then one `user_responses` per field above, using the new question IDs from `question_new_tool.sql`. Attachments from `documenti` can be migrated to your documents storage and `file_path` on the corresponding question’s `user_responses`.

### Pages / UX

- **New “Analisi Rischio”**  
  User goes to `/EUDR/risk-analysis`. No `session_id` → show “Inizia Nuova Valutazione” and create a session; with `session_id` → load section “Analisi Rischio” and save answers into `user_responses`. On “complete”, the workflow redirects to `/EUDR/evaluation?session_id=...` or `/EUDR/search` (if esente).

- **New “Valutazione” (evaluation)**  
  User lands on `/EUDR/evaluation?session_id=...` after risk analysis. Page shows “Analisi Rischio” in read-only and, if present, “Valutazione” in edit. Completion redirects to `/EUDR/search`.

- **Search / list**  
  Old: `cerca.php?verifiche=true`. New: `/EUDR/search`. Implement the session list on `/EUDR/search` by querying `assessment_sessions` where `tool_id = EUDR_TOOL_ID` and optionally `session_type = 'verifica'`, and link each row to `risk-analysis?session_id=...` or `evaluation?session_id=...` as needed.

- **No more direct PHP endpoints**  
  Replace `Save_On_DB.php` and `modify_valutazione.php` with the Next.js flow: session creation in risk-analysis, then `saveResponsesBulk` (or equivalent) in `src/actions/questions.ts` and the EUDR workflow actions in `src/actions/workflows.ts`.

---

## 5. Summary

- **Migrations:** Logic engine now supports `gt`, `lt`, and `is_not_empty` so all EUDR section rules can fire; section `order_index` is numeric.
- **Old app:** One table per “verifica” and one form POST; redirect to valutazione or cerca.
- **New app:** One session + many `user_responses`, workflow-driven redirects, same business rules in `logic_rules` and workflow actions.
- **Adaptation:** Ensure `tools` and master data (`eu_products`, `country`) exist and match the new schema; optionally migrate old `verifica_regolamento_ue`/documenti into sessions and user_responses; use the new routes and stop calling the old PHP save endpoints.
