export type BoscologModeId =
  | 'diretta'
  | 'trasformazione'
  | 'bioenergia'
  | 'corta'
  | 'arredo'

export type BoscologProductCategoryId = 'energia' | 'opera' | 'residui' | 'altro'

export type BoscologProductTypeId =
  | 'legna_ardere'
  | 'cippato'
  | 'pellet'
  | 'bricchette'
  | 'carbone'
  | 'tondame'
  | 'paleria'
  | 'travame'
  | 'tavolame'
  | 'trancia'
  | 'opera_altro'
  | 'ramaglie'
  | 'corteccia'
  | 'segatura'
  | 'manutenzione'
  | 'altro'

export const BOSCOLOG_MODES: { id: BoscologModeId; label: string }[] = [
  { id: 'diretta', label: 'Filiera diretta' },
  { id: 'trasformazione', label: 'Filiera di trasformazione' },
  { id: 'bioenergia', label: 'Filiera bioenergia' },
  { id: 'corta', label: 'Filiera corta / km zero' },
  { id: 'arredo', label: 'Filiera arredo e mobili' },
]

export const BOSCOLOG_PRODUCT_CATEGORIES: {
  id: BoscologProductCategoryId
  label: string
}[] = [
  { id: 'energia', label: 'Prodotti energetici' },
  { id: 'opera', label: 'Legname da opera' },
  { id: 'residui', label: 'Biomassa e residui' },
  { id: 'altro', label: 'Altro' },
]

export const BOSCOLOG_PRODUCT_TYPES: {
  id: BoscologProductTypeId
  label: string
  cat: BoscologProductCategoryId
}[] = [
  { id: 'legna_ardere', label: 'legna da ardere', cat: 'energia' },
  { id: 'cippato', label: 'cippato', cat: 'energia' },
  { id: 'pellet', label: 'pellet', cat: 'energia' },
  { id: 'bricchette', label: 'bricchette', cat: 'energia' },
  { id: 'carbone', label: 'carbone di legna', cat: 'energia' },
  { id: 'tondame', label: 'tondame da sega', cat: 'opera' },
  { id: 'paleria', label: 'paleria', cat: 'opera' },
  { id: 'travame', label: 'travame / legno strutturale', cat: 'opera' },
  { id: 'tavolame', label: 'tavolame', cat: 'opera' },
  { id: 'trancia', label: 'trancia / sfogliato (compensato)', cat: 'opera' },
  { id: 'opera_altro', label: 'legname da opera (altro)', cat: 'opera' },
  { id: 'ramaglie', label: 'ramaglie e cimali', cat: 'residui' },
  { id: 'corteccia', label: 'corteccia', cat: 'residui' },
  { id: 'segatura', label: 'segatura / trucioli', cat: 'residui' },
  { id: 'manutenzione', label: 'biomassa da manutenzione', cat: 'residui' },
  { id: 'altro', label: 'altro (specificare)', cat: 'altro' },
]

export const BOSCOLOG_QUICK_UNITS = ['m³', 't', 'q', 'mst'] as const

export const BOSCOLOG_UNITS = ['m³', 'mst', 't', 'q', 'kg'] as const

export const BOSCOLOG_PERMIT_TYPES: { id: string; label: string }[] = [
  { id: 'paesaggistica', label: 'Autorizzazione paesaggistica' },
  { id: 'idrologica', label: 'Autorizzazione idrologica / idraulica' },
  { id: 'idrogeologico', label: 'Nulla osta vincolo idrogeologico' },
  { id: 'forestale', label: 'Autorizzazione / comunicazione forestale' },
  { id: 'vinca', label: 'VINCA (Valutazione Incidenza)' },
  { id: 'altro', label: 'Altro' },
]

export const BOSCOLOG_MOVEMENT_TYPES: { id: string; label: string }[] = [
  { id: 'ingresso', label: 'Ingresso (approvvigionamento)' },
  { id: 'stoccaggio', label: 'Stoccaggio' },
  { id: 'lavorazione', label: 'Lavorazione (cippatura, segagione, ecc.)' },
  { id: 'trasferimento', label: 'Trasferimento interno' },
  { id: 'uscita', label: 'Uscita (vendita/consegna)' },
]

export const BOSCOLOG_COMMON_SPECIES = [
  'faggio',
  'castagno',
  'rovere',
  'roverella',
  'cerro',
  'carpino',
  'ontano',
  'frassino',
  'acero',
  'betulla',
  'pioppo',
  'salice',
  'abete rosso',
  'abete bianco',
  'larice',
  'pino silvestre',
  'pino cembro',
] as const

export const BOSCOLOG_ORIGIN_OPTIONS: { id: string; label: string }[] = [
  { id: 'UE', label: 'UE' },
  { id: 'extraUE', label: 'Extra UE' },
]

export const BOSCOLOG_RISK_QUESTIONS: {
  id:
    | 'supplierVerified'
    | 'permitsComplete'
    | 'geolocAvailable'
    | 'protectedArea'
    | 'pastNonCompliance'
    | 'chainSeparated'
    | 'ddDocs'
  label: string
  hint?: string
}[] = [
  { id: 'supplierVerified', label: 'Fornitore verificato / affidabile?' },
  { id: 'permitsComplete', label: 'Autorizzazioni complete e valide?' },
  { id: 'geolocAvailable', label: 'Geolocalizzazione disponibile?' },
  {
    id: 'protectedArea',
    label: 'Area protetta / vincoli ambientali rilevanti?',
    hint: 'Sì = fattore di rischio',
  },
  {
    id: 'pastNonCompliance',
    label: 'Non conformità passate note?',
    hint: 'Sì = fattore di rischio',
  },
  { id: 'chainSeparated', label: 'Catena di custodia segregata / tracciabile?' },
  { id: 'ddDocs', label: 'Documentazione due diligence disponibile?' },
]

export const BOSCOLOG_DD_OUTCOMES: { id: string; label: string }[] = [
  { id: 'ok', label: 'OK – basso rischio' },
  { id: 'monitora', label: 'Monitora' },
  { id: 'blocca', label: 'Blocca / non procedere' },
]

export const BOSCOLOG_TRI_OPTIONS: { id: string; label: string }[] = [
  { id: '', label: '—' },
  { id: 'yes', label: 'Sì' },
  { id: 'no', label: 'No' },
]

export function modeLabel(id: string | null | undefined): string {
  return BOSCOLOG_MODES.find((m) => m.id === id)?.label ?? id ?? '—'
}

export function productLabel(id: string | null | undefined): string {
  return BOSCOLOG_PRODUCT_TYPES.find((p) => p.id === id)?.label ?? id ?? '—'
}

export function permitLabel(id: string | null | undefined): string {
  return BOSCOLOG_PERMIT_TYPES.find((p) => p.id === id)?.label ?? id ?? '—'
}

export function movementLabel(id: string | null | undefined): string {
  return BOSCOLOG_MOVEMENT_TYPES.find((m) => m.id === id)?.label ?? id ?? '—'
}

export function isBoscologMode(value: string): value is BoscologModeId {
  return BOSCOLOG_MODES.some((m) => m.id === value)
}
