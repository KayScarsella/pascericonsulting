# Hansen-based “deforestation” logic — what we count and whether it’s accepted

## What the app counts today

In [`runForestLossForAoi.ts`](server/earthengine/runForestLossForAoi.ts) the pipeline is:

1. **Load** `UMD/hansen/global_forest_change_2024_v1_12`.
2. **Mask** `lossyear` so only pixels where **`loss > 0`** remain.
3. **Histogram** — `frequencyHistogram` on that masked `lossyear` inside your AOI → counts per loss-year class.

So a pixel is included **only if** the Hansen **loss** layer marks it as forest loss during the study period; then **which year** comes from **lossyear** (1–24 → 2001–2024 in v1.12).

## What Hansen actually means by “loss”

From the **Hansen / GLAD user notes** (GFC-2024-v1.12):

- **Forest loss** = **stand-replacement disturbance**, i.e. a change from a **forest to non-forest** state (not merely thinning or degradation where the pixel stays “forest”).
- **Tree cover 2000** = canopy closure for vegetation **taller than 5 m** (0–100%).
- **lossyear** = either **0** (no loss) or **1–24** (loss detected primarily in **2001–2024**).

They also state that **from v1.4 onward**, **loss is no longer released as a separate layer from lossyear** — *“Loss as previously released corresponds to nonzero values of loss year.”* So in principle, **any pixel with `lossyear` ≠ 0 is a loss pixel**; masking with `loss.gt(0)` should be equivalent if the catalog still exposes `loss` as that bitmask. If the `loss` band is missing or inconsistent, **`lossyear.gt(0)` alone** is the definition aligned with the producers.

## Is this approach “correct and accepted”?

| Aspect | Assessment |
|--------|------------|
| **Dataset** | Hansen GFC is **widely used** for global forest cover **change** (GFW, academic workflows, many EUDR/geospatial discussions cite Hansen or similar satellite products). |
| **Definition vs EUDR** | EUDR uses legal definitions of **deforestation** / **forest degradation**; Hansen measures **gross forest cover loss** (stand-replacement). It is a **strong screening layer** but **not** a one-to-one legal proof — degradation, plantations, and national forest definitions may differ. |
| **Pixel counts as “area”** | Hansen’s own **usage notes** say: *“definitive area estimation should not be made using pixel counts from the forest loss layers”* — they recommend **probability-based / sample-based** estimation for official area reporting (IPCC-style). So **histograms of pixel counts are acceptable as relative indicators / screening**, not as certified hectares without uncertainty treatment. |
| **Interannual comparison** | They warn that **2011+ was reprocessed** differently from earlier years; comparing pre/post 2011 should be done **with caution** until v2.0 reprocessing. |

So: **using Hansen lossyear inside an AOI is an accepted *screening* approach**; **claiming legal “deforestation-free” from pixel counts alone** is **not** what the dataset authors intend without further methodology.

## Why you can see “no loss pixels” in the AOI

Possible reasons (all consistent with the data, not necessarily a bug):

1. **No stand-replacement loss** mapped in that polygon during 2001–2024 (agriculture on long-cleared land, urban, grassland, etc.).
2. **AOI is mostly non-forest in 2000** — loss is defined relative to **forest → non-forest**; clearing that was never “forest” in the Hansen sense may not appear as loss.
3. **Water / no data** — `datamask` 0 or 2 can exclude land; ocean tiles have no meaningful data.
4. **Plantations / short cycles** — v1.12 notes **improved detection** for some plantation clearing; still, not every land-use change is mapped as loss.
5. **AOI too small or geometry** — a single 30 m pixel can be misaligned; very small AOIs may fall on no-loss pixels by chance (less likely for large polygons).

## How to analyse in more depth (conceptually)

1. **Use `lossyear` directly** — mask with `lossyear.gt(0)` (equivalent to “loss” per producer note) and histogram; avoids depending on `loss` if ever inconsistent.
2. **Restrict to forest baseline** — e.g. `treecover2000.gt(10)` or `gt(50)` before loss, to answer “loss on land that was forest in 2000” only (tutorial pattern).
3. **Add `datamask.eq(1)`** — mapped land only, exclude water/no data.
4. **Visual check in Code Editor** — same asset ID, add layers `lossyear` with palette and your AOI; confirms whether the polygon overlaps any red/year pixels.
5. **Temporal smoothing** — Hansen suggests moving averages for trends; single-year buckets are noisy.
6. **Legal / compliance** — combine with **plot coordinates**, **cut-off date**, and **national maps** where required; Hansen is one input, not the whole due diligence.

## Informational due diligence checklist

Use this for a **transparent risk snapshot** and stakeholder communication — **not** as a Due Diligence Statement (DDS) or legal proof. The app’s Hansen histogram is one **screening input**; a full compliance process needs the rest documented separately.

| Check | What to cover | This app |
|-------|----------------|----------|
| **Product & scope** | Commodity, HS codes, quantity; wood products need **degradation** lens too (EUDR definition differs from agri-only deforestation). | Not in AOI tool — handle in product/supply-chain docs or UI. |
| **Geolocation** | Plots where production/harvest occurred; tie AOI to **declared coordinates** and time range. | AOI polygon = where to look; must align with declared plots. |
| **Cut-off 31 Dec 2020** | No deforestation/degradation after that date (per EUDR). | **lossyear** after 2020 inside AOI → **stand-replacement** signal only (see below). |
| **Supply chain** | Suppliers, next operator, traceability records. | Out of scope for Earth Engine — separate records. |
| **Risk assessment** | Proportionality; likelihood of link to deforestation/degradation; mitigation if needed. | Hansen = **forest → non-forest** screening; **not** full degradation-by-conversion. |
| **Evidence & audit trail** | Repeatable method, dataset version, date of analysis. | Dataset pinned in code; histogram stored with session — good for “what we knew when”. |

**Degradation (EUDR sense):** Under EUDR, degradation is mainly **structural conversion** (e.g. primary or naturally regenerating forest → plantation or other wooded land). **Hansen loss** measures **stand-replacement** (forest → non-forest), so it **misses** many degradation cases where the pixel stays “forest”. For degradation-relevant context, combine with baseline primary/natural proxies, plantation layers, disturbance alerts, and/or high-res imagery — and label outputs as **informational**, not legal equivalence.

## References

- [Hansen GFC v1.12 — Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/UMD_hansen_global_forest_change_2024_v1_12)
- [GFC-2024-v1.12 download / user notes](https://storage.googleapis.com/earthenginepartners-hansen/GFC-2024-v1.12/download.html) (loss definition, no pixel-count area claims, v1.4+ loss vs lossyear)
- [EE forest tutorial series](https://developers.google.com/earth-engine/tutorials/tutorial_forest_02)
