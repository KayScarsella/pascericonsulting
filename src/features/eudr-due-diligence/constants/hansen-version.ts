/**
 * Hansen GFC lossyear in EE v1.12: band 1..N → anni 2001..2000+N.
 * Catalogo attuale (2026): UMD/hansen/global_forest_change_2024_v1_12 → max band 24 = anno 2024.
 * Quando GLAD rilascia una versione successiva, aggiornare HANSEN_ASSET in runForestLossForAoi.ts
 * e queste costanti dopo verifica su Earth Engine Data Catalog.
 */
export const HANSEN_LOSSYEAR_MAX_BAND = 24
export const HANSEN_LAST_LOSS_CALENDAR_YEAR = 2000 + HANSEN_LOSSYEAR_MAX_BAND
