# EUDR due diligence (Earth Engine)

**Full step-by-step tutorial:** [CONFIGURATION.md](./CONFIGURATION.md)  
**How analysis works vs Code Editor:** [HOW_IT_WORKS.md](./HOW_IT_WORKS.md)  
**Hansen logic, acceptance, zero-pixel causes:** [METHODOLOGY.md](./METHODOLOGY.md) (Google Cloud, service account, env vars, Supabase).  
**Section E (paese di raccolta) + map + risk adjustment:** [INTEGRATION_SECTION_E.md](./INTEGRATION_SECTION_E.md).

## Configurazione Earth Engine (riepilogo)

1. Crea un **service account** nel progetto Google Cloud collegato a Earth Engine.
2. Scarica il JSON della chiave privata.
3. Imposta una delle variabili d’ambiente (solo server, mai nel client):
   - `EARTH_ENGINE_PRIVATE_KEY_JSON` — stringa JSON completa del file (su Windows usare `_B64` è più semplice).
   - oppure `EARTH_ENGINE_PRIVATE_KEY_JSON_B64` — stesso JSON codificato in base64.

Il service account deve avere accesso all’API Earth Engine (progetto registrato su Earth Engine).

## Dove si usa (solo embed)

- **Nessuna pagina dedicata**: l’analisi AOI è solo nel blocco inline **`EmbeddedDueDiligenceBlock`** (dopo la domanda rischio paese nella sezione Paese di raccolta, analisi finale EUDR).

## Output

- `aoi.geojson` + `dd_report.json` (+ opzionale `aoi_map_snapshot.png`) (slim: istogramma, colori, legenda, limiti/fonti per PDF/replica) in bucket `user-uploads` sotto `{userId}/eudr-due-diligence/{sessionId}/{runId}/`. Niente più dump completo EE su storage.

Dataset usato: `UMD/hansen/global_forest_change_2024_v1_12` (loss + lossyear) — vedi `runForestLossForAoi.ts`.
