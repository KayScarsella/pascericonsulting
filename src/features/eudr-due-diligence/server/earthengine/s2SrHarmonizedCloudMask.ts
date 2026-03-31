/**
 * Per-pixel mask on COPERNICUS/S2_SR_HARMONIZED using SCL (Scene Classification).
 * Removes cloud shadow, medium/high cloud, thin cirrus, snow before compositing — much less haze than
 * CLOUDY_PIXEL_PERCENTAGE on the scene alone. See SCL legend in EE data catalog.
 */

export function maskS2SrHarmonizedClouds(image: unknown): unknown {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const ee = require('@google/earthengine') as any
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
  const img = ee.Image(image)
  const scl = img.select('SCL')
  const clear = scl
    .neq(3)
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10))
    .and(scl.neq(11))
  return img.updateMask(clear)
}
