declare module '@google/earthengine' {
  const ee: {
    data: {
      authenticateViaPrivateKey: (
        privateKey: object,
        success: () => void,
        error: (err: Error) => void
      ) => void
    }
    initialize: (
      opt1: null,
      opt2: null,
      success: () => void,
      error: (err: Error) => void
    ) => void
    Image: (id: string) => unknown
    Geometry: (geoJson: object) => unknown
    Reducer: { frequencyHistogram: () => unknown }
  }
  export = ee
}
