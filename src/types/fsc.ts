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

export type FscSupplierAttachmentType = 'visura' | 'due_diligence' | 'dichiarazione'
export type FscSubcontractorAttachmentType = 'certificato' | 'accordo_conto_lavoro'

export type FscSupplierAttachment = {
  id: string
  supplier_id: string
  attachment_type: FscSupplierAttachmentType
  file_name: string | null
  mime_type: string | null
  size: number | null
  created_at: string
  created_by: string | null
  has_file?: boolean
}

export type FscSubcontractorAttachment = {
  id: string
  subcontractor_id: string
  attachment_type: FscSubcontractorAttachmentType
  file_name: string | null
  mime_type: string | null
  size: number | null
  created_at: string
  created_by: string | null
  has_file?: boolean
}

export type FscSupplierStatusHistory = {
  id: string
  supplier_id: string
  old_status: FscSupplierStatus | null
  new_status: FscSupplierStatus
  changed_at: string
  changed_by: string | null
}

export type FscSubcontractorStatusHistory = {
  id: string
  subcontractor_id: string
  old_status: FscSupplierStatus | null
  new_status: FscSupplierStatus
  changed_at: string
  changed_by: string | null
}

export type FscSupplierWithDetails = FscSupplier & {
  claims: FscProductClaim[]
  attachments: FscSupplierAttachment[]
  status_history?: FscSupplierStatusHistory[]
}

export type FscSubcontractorWithDetails = FscSubcontractor & {
  attachments: FscSubcontractorAttachment[]
  status_history?: FscSubcontractorStatusHistory[]
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
  mime_type: string | null
  size: number | null
  version: number
  parent_document_id: string | null
  status: FscDocumentStatus
  created_by: string | null
  created_at: string
  updated_at: string
  has_file?: boolean
}

export type FscIloAssessment = {
  id: string
  company_id: string
  reference_year: number
  completed_at: string | null
  form_data: Record<string, unknown>
  schema_version: string
  duplicated_from_year: number | null
  compiled_word_uploaded_at: string | null
  session_id: string | null
  created_at: string
  updated_at: string
  has_compiled_word?: boolean
  has_compiled_pdf?: boolean
}

export type FscIloTemplateMaster = {
  id: string
  version: string
  storage_path: string
  schema_version: string
  is_active: boolean
  uploaded_by: string | null
  created_at: string
}

export type FscLogo = {
  id: string
  company_id: string
  logo_type: FscLogoType
  progressive_code: string
  notes: string | null
  created_by: string | null
  created_at: string
  approval_file_path?: string | null
  graphic_file_path?: string | null
}

export type FscCompanyProductGroup = {
  id: string
  company_id: string
  catalog_group_id: string
  species_id: string | null
  required_inputs: string | null
  is_active: boolean
  activated_at: string
  created_at: string
  updated_at: string
}

export type FscProductGroupAddendumRow = {
  id: string
  label: string
  value: string
}

export type FscProductGroupAddendumMetadata = {
  rows?: FscProductGroupAddendumRow[]
}

export type FscProductGroupAddendum = {
  id: string
  company_product_group_id: string
  metadata: FscProductGroupAddendumMetadata
  generated_at: string
  has_file?: boolean
}

export type FscSpeciesOption = {
  id: string
  common_name: string | null
  scientific_name: string | null
}

export type FscCompanyProductGroupWithDetails = FscCompanyProductGroup & {
  catalog: FscProductGroupCatalog | null
  species: FscSpeciesOption | null
  claims: FscProductClaim[]
  addenda: FscProductGroupAddendum[]
}

export type FscProductGroupCatalog = {
  id: string
  code: string
  name: string
  keywords: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type FscGestioneCategory =
  | 'manuale'
  | 'politica'
  | 'procedure'
  | 'allegati'

export type FscEnteCategory =
  | 'visura'
  | 'm210'
  | 'fatturato'
  | 'certificato'
  | 'contratto'
  | 'sicurezza'

export type FscGestioneDocument = FscDocument & {
  version_count?: number
  has_file?: boolean
}
