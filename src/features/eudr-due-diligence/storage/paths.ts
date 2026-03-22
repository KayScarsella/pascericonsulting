/**
 * Storage path conventions for due diligence runs.
 * Bucket: user-uploads (same as mitigations – validateSessionAccess already used).
 */

export function ddRunBasePath(userId: string, sessionId: string, runId: string): string {
  return `${userId}/eudr-due-diligence/${sessionId}/${runId}`
}

export function aoiGeoJsonPath(userId: string, sessionId: string, runId: string): string {
  return `${ddRunBasePath(userId, sessionId, runId)}/aoi.geojson`
}

export function metadataJsonPath(userId: string, sessionId: string, runId: string): string {
  return `${ddRunBasePath(userId, sessionId, runId)}/run_metadata.json`
}

/** Single JSON: AOI stats + UI text + histogram — PDF/replica senza GEE */
export function ddReportJsonPath(userId: string, sessionId: string, runId: string): string {
  return `${ddRunBasePath(userId, sessionId, runId)}/dd_report.json`
}

/** Map screenshot PNG (client upload after map paints) */
export function mapSnapshotPath(userId: string, sessionId: string, runId: string): string {
  return `${ddRunBasePath(userId, sessionId, runId)}/aoi_map_snapshot.png`
}
