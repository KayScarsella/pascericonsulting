const UTF8_BOM = 0xfeff

/** JSON.parse after dropping a leading UTF-8 BOM. GIS exports often include one. */
export function parseGeoJsonText(text: string): unknown {
  const body = text.charCodeAt(0) === UTF8_BOM ? text.slice(1) : text
  return JSON.parse(body)
}
