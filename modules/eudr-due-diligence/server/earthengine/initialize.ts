/**
 * Earth Engine server-side init using service account JSON.
 * Set EARTH_ENGINE_PRIVATE_KEY_JSON to the full JSON string of the service account key
 * (or base64-encoded JSON in EARTH_ENGINE_PRIVATE_KEY_JSON_B64).
 * Service account must be registered for Earth Engine API.
 */

let initPromise: Promise<void> | null = null

function parsePrivateKeyJson(): object {
  const b64 = process.env.EARTH_ENGINE_PRIVATE_KEY_JSON_B64
  if (b64) {
    const json = Buffer.from(b64, 'base64').toString('utf8')
    return JSON.parse(json) as object
  }
  const raw = process.env.EARTH_ENGINE_PRIVATE_KEY_JSON
  if (!raw) {
    throw new Error(
      'Earth Engine not configured: set EARTH_ENGINE_PRIVATE_KEY_JSON or EARTH_ENGINE_PRIVATE_KEY_JSON_B64'
    )
  }
  return JSON.parse(raw) as object
}

/**
 * Initialize EE once per process; callbacks promisified.
 */
export function ensureEarthEngineInitialized(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = new Promise((resolve, reject) => {
    // Dynamic require so build doesn't fail if env missing (optional feature)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ee = require('@google/earthengine') as {
      data: {
        authenticateViaPrivateKey: (
          key: object,
          ok: () => void,
          err: (e: Error) => void
        ) => void
      }
      initialize: (a: null, b: null, ok: () => void, err: (e: Error) => void) => void
    }
    const privateKey = parsePrivateKeyJson()
    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => {
        ee.initialize(
          null,
          null,
          () => resolve(),
          (err: Error) => reject(err)
        )
      },
      (err: Error) => reject(err)
    )
  })
  return initPromise
}

export function isEarthEngineConfigured(): boolean {
  return Boolean(
    process.env.EARTH_ENGINE_PRIVATE_KEY_JSON || process.env.EARTH_ENGINE_PRIVATE_KEY_JSON_B64
  )
}
