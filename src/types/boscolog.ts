export type BoscologPartyRole = 'Acquirente' | 'Fornitore' | 'Ente'

export type BoscologCompany = {
  id: string
  tool_id: string
  name: string
  vat: string | null
  cf: string | null
  address: string | null
  city: string | null
  province: string | null
  cap: string | null
  phone: string | null
  email: string | null
  pec: string | null
  rea: string | null
  legal_rep: string | null
  logo_path: string | null
  created_at: string
  updated_at: string
}

export type BoscologCompanyMember = {
  company_id: string
  user_id: string
  can_edit: boolean
  created_at: string
}

export type BoscologParty = {
  id: string
  company_id: string
  name: string
  role: BoscologPartyRole
  vat: string | null
  address: string | null
  notes: string | null
  bp_cert_id: string | null
  bp_expire: string | null
  bp_org: string | null
  created_at: string
  updated_at: string
}

export type BoscologCompanyInput = {
  name: string
  vat?: string | null
  cf?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  cap?: string | null
  phone?: string | null
  email?: string | null
  pec?: string | null
  rea?: string | null
  legal_rep?: string | null
}

export type BoscologPartyInput = {
  name: string
  role: BoscologPartyRole
  vat?: string | null
  address?: string | null
  notes?: string | null
  bp_cert_id?: string | null
  bp_expire?: string | null
  bp_org?: string | null
}

export const BOSCOLOG_PARTY_ROLES: BoscologPartyRole[] = [
  'Acquirente',
  'Fornitore',
  'Ente',
]

export type BoscologModeId =
  | 'diretta'
  | 'trasformazione'
  | 'bioenergia'
  | 'corta'
  | 'arredo'

export type BoscologLot = {
  id: string
  company_id: string
  name: string
  lot_date: string
  mode: BoscologModeId | string
  product_type: string | null
  product_other: string | null
  origin_eu: string | null
  state: string | null
  region: string | null
  province: string | null
  comune: string | null
  localita: string | null
  notes: string | null
  cutting_date: string | null
  supplier_id: string | null
  dds_ref: string | null
  deforestation_free: string | null
  custody_model: string | null
  quick_species: string | null
  quick_qty: string | null
  quick_unit: string | null
  risk?: BoscologRiskPayload | null
  risk_score?: number | null
  risk_level?: string | null
  geojson?: Record<string, unknown> | null
  geo_feature_count?: number | null
  geo_area_ha?: number | null
  created_at: string
  updated_at: string
  supplier_name?: string | null
}

export type BoscologRiskAnswersPayload = {
  supplierVerified?: string
  permitsComplete?: string
  geolocAvailable?: string
  protectedArea?: string
  pastNonCompliance?: string
  chainSeparated?: string
  ddDocs?: string
}

export type BoscologRiskPayload = {
  assessedAt?: string
  assessor?: string
  outcome?: string
  notes?: string
  mitigation?: string
  locked?: boolean
  lockedAt?: string
  lockedBy?: string
  answers?: BoscologRiskAnswersPayload
}

export type BoscologLotInput = {
  name: string
  lot_date?: string | null
  mode?: BoscologModeId | string
  product_type?: string | null
  product_other?: string | null
  origin_eu?: string | null
  state?: string | null
  region?: string | null
  province?: string | null
  comune?: string | null
  localita?: string | null
  notes?: string | null
  cutting_date?: string | null
  supplier_id?: string | null
  dds_ref?: string | null
  deforestation_free?: string | null
  custody_model?: string | null
  quick_species?: string | null
  quick_qty?: string | null
  quick_unit?: string | null
}

export type BoscologQuickLotInput = {
  name?: string | null
  product_type?: string | null
  product_other?: string | null
  comune?: string | null
  cutting_date?: string | null
  supplier_id?: string | null
  dds_ref?: string | null
  notes?: string | null
  quick_species?: string | null
  quick_qty?: string | null
  quick_unit?: string | null
  mode?: BoscologModeId | string
}

export type BoscologLotSpecies = {
  id: string
  lot_id: string
  common: string | null
  scientific: string | null
  assortment: string | null
  qty: string | null
  unit: string | null
  notes: string | null
  quality_class: string | null
  moisture_pct: string | null
  log_length: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type BoscologLotSpeciesInput = {
  common?: string | null
  scientific?: string | null
  assortment?: string | null
  qty?: string | null
  unit?: string | null
  notes?: string | null
  quality_class?: string | null
  moisture_pct?: string | null
  log_length?: string | null
}

export type BoscologLotExit = {
  id: string
  lot_id: string
  species_id: string | null
  buyer_id: string | null
  buyer_name: string | null
  exit_date: string | null
  product: string | null
  qty: string | null
  unit: string | null
  doc_ref: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type BoscologLotExitInput = {
  species_id?: string | null
  buyer_id?: string | null
  buyer_name?: string | null
  exit_date?: string | null
  product?: string | null
  qty?: string | null
  unit?: string | null
  doc_ref?: string | null
  notes?: string | null
}

export type BoscologLotMovement = {
  id: string
  lot_id: string
  type: string
  movement_date: string | null
  qty_in: string | null
  qty_out: string | null
  unit: string | null
  yield_pct: string | null
  loss_pct: string | null
  product: string | null
  party_id: string | null
  party_name: string | null
  doc_ref: string | null
  location: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type BoscologLotMovementInput = {
  type?: string
  movement_date?: string | null
  qty_in?: string | null
  qty_out?: string | null
  unit?: string | null
  yield_pct?: string | null
  loss_pct?: string | null
  product?: string | null
  party_id?: string | null
  party_name?: string | null
  doc_ref?: string | null
  location?: string | null
  notes?: string | null
}

export type BoscologLotPermit = {
  id: string
  lot_id: string
  type: string
  other: string | null
  protocol: string | null
  authority: string | null
  issue_date: string | null
  expire_date: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type BoscologLotPermitInput = {
  type?: string
  other?: string | null
  protocol?: string | null
  authority?: string | null
  issue_date?: string | null
  expire_date?: string | null
  notes?: string | null
}
