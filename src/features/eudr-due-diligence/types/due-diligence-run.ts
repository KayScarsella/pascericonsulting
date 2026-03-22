/**
 * Types for EUDR due diligence AOI runs (Earth Engine – Hansen GFC).
 * Artifacts are stored under user-uploads with paths from storage/paths.ts
 */

export type DueDiligenceRunStatus = 'pending' | 'running' | 'completed' | 'failed'

/** Histogram keyed by loss year (string) -> pixel count */
export type LossYearHistogram = Record<string, number>

export interface RunMetadata {
  run_id: string
  session_id: string
  user_id: string
  status: DueDiligenceRunStatus
  created_at: string
  completed_at?: string
  error?: string
  /** Hansen dataset id used */
  dataset_id: string
  /** EUDR-relevant cutoff (ISO date) – informational for UI/report */
  eudr_cutoff_date: string
  /** Area of AOI in hectares (approx) */
  aoi_area_ha?: number
  /** Total forest loss pixels in AOI (masked loss) */
  loss_pixel_count?: number
  /** Pixel area in m² (Hansen 30m) */
  pixel_area_m2: number
  /** Frequency histogram lossyear -> count (tutti gli anni Hansen con loss nell'AOI) */
  lossyear_histogram?: LossYearHistogram
  /**
   * Valutazione raffinata EUDR: intersect Hansen post-2020 con JRC GFC2020 (foresta al 31/12/2020).
   * Se presente e jrc_assessment_ok, il gate dovrebbe basarsi su questa evidenza + soglia ha.
   */
  eudr_refined?: {
    jrc_gfc2020_dataset_id: string
    forest_2020_ha_in_aoi: number | null
    forest_2020_pct_aoi: number | null
    loss_on_forest_2020_post_eudr_ha: number | null
    loss_pixel_count_on_forest_2020_post_eudr: number | null
    jrc_assessment_ok: boolean
    jrc_assessment_error?: string
  }
  /**
   * Contesto degrado forestale: tipi foresta JRC al 2020 nell'AOI (snapshot, non gate).
   */
  forest_types_2020?: {
    dataset_id: string
    ha_naturally_regenerating: number | null
    ha_primary: number | null
    ha_planted: number | null
    ha_forest_typed_total: number | null
    ok: boolean
    error?: string
  }
  /**
   * Optional: date of cutting/harvest declared by user (ISO date YYYY-MM-DD).
   * Used to interpret loss pixels relative to operation date (due diligence context).
   */
  cutting_date_iso?: string
  /** Paths in bucket user-uploads */
  artifact_paths: {
    aoi_geojson: string
    metadata_json: string
  }
}

export interface AoiGeoJson {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}
