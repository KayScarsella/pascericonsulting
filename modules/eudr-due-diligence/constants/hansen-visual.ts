/**
 * Palette condivisa mappa + grafico (Hansen post-EUDR / post-taglio).
 * Nessuna dipendenza da Earth Engine — sicuro per client.
 */

export const HANSEN_EUDR_MIN_BAND = 21 // lossyear ≥ 21 → anno ≥ 2021

/** Loss post-2020 ma ancora prima dell'anno di taglio (2021…anno-1) — layer blu. */
export const COLOR_POST_EU_ONLY = '#2563eb'

/** Loss dall'anno di taglio in poi (≥) — layer rosso; così la loss nell'anno inserito è visibile. */
export const COLOR_POST_CUT = '#dc2626'
