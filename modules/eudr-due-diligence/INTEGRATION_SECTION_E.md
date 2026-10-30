# Section E (Paese di raccolta) ↔ Map + risk adjustment

This doc ties the **Valutazione Finale** questionnaire (section **E ) DATI RELATIVI AL PAESE DI RACCOLTA DEL LEGNAME**) to the **Hansen AOI run** and explains how to **raise/lower risk** from GeoJSON + felling date.

## 1. What your CSV questions already cover (section E)

From the export, section E (`group_name` = same block as title) includes:

| Theme | Field type | Role in due diligence |
|-------|------------|------------------------|
| Paese di raccolta | `async_select` → `country` | Anchors country; prefill from `assessment_sessions.metadata.country` in `eudr-valutazione.ts` |
| Rischio paese | select RB / RS / RA | **Scored** in `eudr-risk-calculator.ts` (lookup RB 0.1, RS 0.3, RA 1.0) |
| Intervallo produzione | `date_range` | Time window for production — should align with **data di taglio** / harvest |
| Specie origine foresta | primaria / piantata / piantagione / terreni boschivi | Context for degradation vs deforestation framing |
| FAO ANNEX2 2010–2020 | number | Prefilled from `country.fao` when session is created |
| Degrado dal 31/12/2020 | affidabilità 1…44 | **Scored** as DATI_LEGALI (same as other “affidabilità” questions) |
| Nessuna trasformazione ad uso agricolo post 2020 | affidabilità 1…44 | **Scored** |
| Conflitti raccolta legname | sì/no | **Scored** (si → high risk index) |

Sections F, G, H, I cover social, legislation, chain, valutatore — all feed `calculateEudrRisk()` via fixed `question_id`s in `src/lib/eudr-risk-calculator.ts`.

**Note on CSV `id` column:** Several rows share the same `id` as `section_id`. Scoring uses **per-question UUIDs** (e.g. `Q_RISCHIO_PAESE`, `Q_DEGRADO`). Ensure Supabase `questions.id` match the constants in `eudr-risk-calculator.ts` or the calculator will see empty answers for those slots.

## 2. Are you performing due diligence “correctly” today?

**What is already solid**

- **Structured checklist** aligned with EUDR-style pillars (country risk, degradation declaration, conflicts, legislation, chain, sanctions).
- **Prefill from `country`** (conflicts, sanction, `country_risk`, FAO, CPI) reduces manual error and aligns with your DB.
- **Risk model** is explicit: `overallRisk = max(detail risk indices)`; threshold `RISK_THRESHOLD` → accettabile / non accettabile + expiry (see `src/lib/risk-calculator.ts` + `eudr-risk-calculator.ts`).
- **Hansen AOI** is a documented **screening** layer (`METHODOLOGY.md`) with optional **cutting date**; UI in `EmbeddedDueDiligenceBlock` + `LossYearChart` (solo anni ≥ 2021; palette Hansen sulle colonne dopo taglio).

**Gaps for a “satisfactory” informational package**

| Gap | Why it matters |
|-----|----------------|
| **No link** between section E and the map run | Valutatore cannot see that the AOI was actually checked for loss after 2020 / after felling date inside the same session. |
| **Degrado / deforestazione zero** are self-assessed affidabilità | Hansen can **contradict** or **support** them; without binding, risk stays purely declarative. |
| **GeoJSON in questionnaire** | AOI via embed dopo rischio paese; artifacts in `user-uploads/.../eudr-due-diligence/{runId}`. |
| **Risk calculator does not ingest Hansen** | `calculateEudrRisk(answersMap)` only reads `user_responses`; no automatic bump when loss pixels exist after cut-off or after declared felling date. |

So: **questionnaire + prefill + max-risk logic are coherent**; **satisfactory** for a documented self-assessment. To make the **final analysis** reflect **geospatial evidence**, you need to **persist the run** on the same `analisi_finale` session and optionally **adjust displayed risk** (see below).

## 3. How to include map + GeoJSON/JSON + felling date in section E

### 3.1 Store the run on the session

After `runDueDiligenceAoiAnalysis(sessionId, aoi, cuttingDateIso)`:

- Artifacts are already at `user-uploads/{userId}/eudr-due-diligence/{sessionId}/{runId}/aoi.geojson` + `metadata.json`.
- **Persist reference on the analisi_finale session** so section E and risultato can load it:
  - **Option A (recommended):** extend `assessment_sessions.metadata` for that session, e.g.  
    `dd_last_run: { run_id, cutting_date_iso, completed_at, loss_pixel_count, has_loss_after_cut }`
  - **Option B:** add a dedicated `user_responses` row with `answer_json` = full `RunMetadata` (or minimal subset), keyed by a **new question** “Analisi AOI Hansen” (type custom or file_upload with JSON).

Option A avoids new question rows and keeps one source of truth in metadata; Option B keeps everything in the response table for PDF export if you iterate answers by question.

### 3.2 UI in section E

- **Embed** `EmbeddedDueDiligenceBlock`: file GeoJSON/JSON, data taglio, analisi Hansen; `dd_last_run` su sessione al completamento run.
- **File upload:** accept `.geojson` / `.json`; read as text → `JSON.parse` → pass to `runDueDiligenceAoiAnalysis` (already supported via paste).

### 3.3 Raise or lower risk based on result

**Conservative approach (recommended):** do **not** silently change answers to Q_DEGRADO / Q_DEFORESTAZIONE_ZERO. Instead:

1. **Display overlay on risultato**  
   - If `has_loss_after_cut` or loss after 2020 in AOI → show **amber/red banner**: “Evidenza satellitare: loss Hansen nell’AOI dopo [data taglio / 2020]. Verificare coerenza con le risposte sezione E/G.”
2. **Optional synthetic risk line**  
   - Append a **virtual** `RiskDetail` when building the chart, e.g.  
     `shortLabel: "Screening AOI (Hansen)"`,  
     `riskIndex: 1.0` if loss after cut-off else `0.1`,  
     so `max()` reflects geospatial red flag without overwriting user answers.
3. **Lower risk only with care**  
   - Hansen **absence of loss** does **not** prove degradation-free (see `METHODOLOGY.md`). At most use a **low** index (e.g. 0.1) as “no stand-replacement signal in AOI” — still informational.

**If you want to auto-adjust scored answers:** only after explicit valutatore confirmation (“Apply Hansen result to Q_DEGRADO”) to avoid overwriting deliberate affidabilità without audit trail.

## 4. Implementation checklist

- [x] After successful `runDueDiligenceAoiAnalysis`, **update** `assessment_sessions.metadata` with `dd_last_run` (see `buildDdLastRunSnapshot` in `aoiRiskGate.ts`).
- [x] **Hard gate**: if `dd_last_run.triggers_non_accettabile`, `finalizeEudrAnalisi` and **EUDR risultato** force outcome **non accettabile** (synthetic bar **Screening AOI**).
- [x] **Solo embed** dopo rischio paese (`EmbeddedDueDiligenceBlock`); pagina `/EUDR/due-diligence-map` rimossa.
- [ ] **PDF export**: include AOI summary if `dd_last_run` exists (run id, date, yes/no loss after cut).

## 5. Code pointers

| Piece | Location |
|-------|----------|
| Hansen run + storage | `src/actions/eudr-due-diligence.ts` → `runDueDiligenceAoiAnalysis` |
| Cutting date + chart (2021+, palette dopo taglio) | `EmbeddedDueDiligenceBlock.tsx` + `LossYearChart.tsx` |
| Risk max aggregation | `src/lib/eudr-risk-calculator.ts` → `calculateEudrRisk` |
| Section E prefill from country | `src/actions/workflows/eudr-valutazione.ts` (countryPrefill) |
| Risultato chart | `src/app/EUDR/risultato/page.tsx` |

---

*Informational only; not legal advice. Align any auto-scoring with internal policy and audit requirements.*
