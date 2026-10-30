# How the due diligence analysis works (and Code Editor vs this app)

## Is it the same as the Code Editor?

**Yes — same engine, same datasets.**

- The **Code Editor** and your **Node/server app** both talk to **Google Earth Engine’s backend**.
- They use the same **public image assets** (e.g. Hansen GFC) and the same operations (`reduceRegion`, masks, histograms).
- There is no separate “file” to download for the app: the **asset ID** is a reference to Google’s catalog. If `ee.Image('...')` fails in Node, the same string would fail in the Code Editor **for the same identity** (same Cloud project / service account).

So you do **not** need to “run it first in GEE and then bring the file here” **unless** you want a manual workflow (export GeoJSON/raster and upload). For automation, fixing the **asset ID** and **service account project** is enough.

## Why did you get “asset not found”?

1. **Asset IDs change** when Hansen releases a new version.  
   `UMD/HANSEN/GFC2023/v1.11` is an old-style path; the current catalog uses IDs like:
   `UMD/hansen/global_forest_change_2024_v1_12`
2. **Caller must have access** — the **service account’s Cloud project** must be registered for Earth Engine and able to read that public asset. If the project isn’t set up, you get “does not exist or caller does not have access” even though the asset exists.

## What the app actually does (step by step)

1. **AOI** — You send a polygon (or Feature/FeatureCollection). It is turned into `ee.Geometry(...)`.
2. **Load Hansen image** — `ee.Image('<catalog_id>')` loads the global raster (tree cover, loss, lossyear, etc.).
3. **Mask** — `lossyear` is masked so only pixels where **`loss` > 0** are kept (actual forest loss events).
4. **reduceRegion** — Inside your AOI only, Earth Engine runs a **frequency histogram** on `lossyear`: how many pixels per loss “year” band value (Hansen encodes 1–24 → 2001–2024 in the 2024 v1.12 product).
5. **Result** — Counts per year class are returned as JSON and stored with your session; the map shows your AOI boundary (not every loss pixel as vectors — that would be huge).

So the “analysis” is **server-side raster statistics over your polygon**, not a file you copy from your PC.

## When to use the Code Editor anyway

- **Prototype** the expression (exact asset, bands, mask) until it runs.
- **Debug** permission issues: if `ee.Image('UMD/hansen/global_forest_change_2024_v1_12')` works in the Code Editor under your user but fails in Node, the **service account’s project** is the problem, not the logic.
- **Export** large or custom outputs (e.g. vectors) via `Export` if you ever need files outside what `reduceRegion` returns.

## Summary

| Question | Answer |
|----------|--------|
| Same as Code Editor? | Same EE backend; same asset string should work in both if the caller is allowed. |
| Need to run in GEE first? | No — unless you choose a manual export/upload flow. |
| What failed before? | Wrong/deprecated asset ID (and/or service account project not seeing the catalog). |

The code in this repo uses the catalog snippet for **Hansen Global Forest Change v1.12 (2000–2024)**. If Google publishes a newer version, update `HANSEN_ASSET` in `runForestLossForAoi.ts` to match the [Earth Engine Data Catalog](https://developers.google.com/earth-engine/datasets/catalog).

**Informational due diligence (full picture vs this tool):** see the short checklist in [METHODOLOGY.md — Informational due diligence checklist](./METHODOLOGY.md#informational-due-diligence-checklist).
