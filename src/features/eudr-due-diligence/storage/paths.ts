/**
 * Storage path conventions for due diligence AOI.
 * Bucket: user-uploads — one flat folder per session (no runId subfolder).
 */

/** PNG map asset filename (server-rendered, PDF). */
export const AOI_MAP_RENDER_FILENAME = 'aoi_map_render.png'

export function ddSessionFolderPath(userId: string, sessionId: string): string {
  return `${userId}/eudr-due-diligence/${sessionId}`
}

export function aoiGeoJsonSessionPath(userId: string, sessionId: string): string {
  return `${ddSessionFolderPath(userId, sessionId)}/aoi.geojson`
}

export function ddReportJsonSessionPath(userId: string, sessionId: string): string {
  return `${ddSessionFolderPath(userId, sessionId)}/dd_report.json`
}

export function aoiMapRenderSessionPath(userId: string, sessionId: string): string {
  return `${ddSessionFolderPath(userId, sessionId)}/${AOI_MAP_RENDER_FILENAME}`
}

/** @deprecated Legacy layout with UUID subfolder — kept for reading old artifacts */
export function ddRunBasePath(userId: string, sessionId: string, runId: string): string {
  return `${userId}/eudr-due-diligence/${sessionId}/${runId}`
}

/** @deprecated Use aoiGeoJsonSessionPath */
export function aoiGeoJsonPath(userId: string, sessionId: string, runId: string): string {
  return `${ddRunBasePath(userId, sessionId, runId)}/aoi.geojson`
}

/** @deprecated */
export function metadataJsonPath(userId: string, sessionId: string, runId: string): string {
  return `${ddRunBasePath(userId, sessionId, runId)}/run_metadata.json`
}

/** @deprecated Use ddReportJsonSessionPath */
export function ddReportJsonPath(userId: string, sessionId: string, runId: string): string {
  return `${ddRunBasePath(userId, sessionId, runId)}/dd_report.json`
}

/** @deprecated */
export function mapSnapshotPath(userId: string, sessionId: string, runId: string): string {
  return `${ddRunBasePath(userId, sessionId, runId)}/aoi_map_snapshot.png`
}
