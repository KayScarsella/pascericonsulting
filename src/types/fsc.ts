/** Types for CLOUD FSC tables (align with supabase migrations 20260528*). */

export type FscMemberType = 'owner' | 'employee' | 'consultant'
export type FscSupplierStatus = 'active' | 'inactive' | 'reactivated'
export type FscControlFrequency = 'annual' | 'semiannual'
export type FscProductClaim = 'fsc_100' | 'fsc_mix' | 'fsc_recycled'
export type FscDocumentModule = 'gestione' | 'ente'
export type FscDocumentStatus = 'active' | 'archived'
export type FscLogoType = 'product' | 'promotional'

export type FscCompany = {
  id: string
  tool_id: string
  ragione_sociale: string
  cf_partita_iva: string | null
  indirizzo: string | null
  cap: string | null
  citta: string | null
  provincia: string | null
  recapito_telefonico: string | null
  sito_internet: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export type FscCompanyMember = {
  company_id: string
  user_id: string
  member_type: FscMemberType
  can_edit: boolean
  created_at: string
}

export type FscSupplier = {
  id: string
  company_id: string
  ragione_sociale: string
  certificate_number: string | null
  certificate_valid_until: string | null
  last_control_date: string | null
  control_frequency: FscControlFrequency
  status: FscSupplierStatus
  deactivated_at: string | null
  created_at: string
  updated_at: string
}

export type FscSubcontractor = {
  id: string
  company_id: string
  ragione_sociale: string
  is_certified: boolean
  work_type: string | null
  coc_risk: boolean
  certificate_number: string | null
  certificate_valid_until: string | null
  last_control_date: string | null
  control_frequency: FscControlFrequency
  status: FscSupplierStatus
  deactivated_at: string | null
  created_at: string
  updated_at: string
}

export type FscDocument = {
  id: string
  company_id: string
  tool_id: string
  module: FscDocumentModule
  category: string
  name: string
  reference_year: number | null
  expires_at: string | null
  reviewed_at: string | null
  storage_path: string | null
  mime_type: string | null
  size: number | null
  version: number
  parent_document_id: string | null
  status: FscDocumentStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export type FscIloAssessment = {
  id: string
  company_id: string
  reference_year: number
  template_storage_path: string | null
  compiled_doc_path: string | null
  compiled_pdf_path: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type FscLogo = {
  id: string
  company_id: string
  logo_type: FscLogoType
  progressive_code: string
  notes: string | null
  approval_email_path: string | null
  graphic_path: string | null
  created_by: string | null
  created_at: string
}

export type FscCompanyProductGroup = {
  id: string
  company_id: string
  catalog_group_id: string | null
  custom_label: string | null
  species_id: string | null
  is_active: boolean
  activated_at: string
  created_at: string
  updated_at: string
}

export type FscProductGroupCatalog = {
  id: string
  code: string | null
  name: string
  keywords: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
