import { sanitizeFscDocumentFileName } from '@/lib/fsc/documents-upload'
import type {
  FscCompanyProductGroup,
  FscCompanyProductGroupWithDetails,
  FscProductGroupCatalog,
} from '@/types/fsc'

export const FSC_PRODUCT_GROUPS_PATH = '/cloud-fsc/gruppi-prodotto'
export const FSC_MASTER_PRODUCT_GROUPS_PATH = '/cloud-fsc/master/product-groups'

export const FSC_PRODUCT_GROUP_STATUS_OPTIONS = [
  { value: 'active', label: 'Attivi' },
  { value: 'inactive', label: 'Inattivi' },
] as const

export type FscProductGroupStatusFilter = 'active' | 'inactive' | 'all'

export function getFscProductGroupDisplayName(
  group: Pick<FscCompanyProductGroup, 'custom_label'> & {
    catalog?: FscProductGroupCatalog | null
  }
): string {
  if (group.catalog?.name) return group.catalog.name
  if (group.custom_label?.trim()) return group.custom_label.trim()
  return 'Gruppo senza nome'
}

export function getFscProductGroupCode(
  group: Pick<FscCompanyProductGroupWithDetails, 'catalog'>
): string | null {
  return group.catalog?.code ?? null
}

export function formatFscSpeciesLabel(species: {
  common_name: string | null
  scientific_name: string | null
}): string {
  const common = species.common_name?.trim()
  const scientific = species.scientific_name?.trim()
  if (common && scientific) return `${common} (${scientific})`
  return common ?? scientific ?? '—'
}

export function buildFscProductGroupAddendumPath(
  companyId: string,
  groupId: string,
  addendumId: string,
  fileName: string
): string {
  const safeName = sanitizeFscDocumentFileName(fileName)
  return `${companyId}/product-groups/${groupId}/addenda/${addendumId}_${safeName}`
}

export function createEmptyAddendumMetadata() {
  return {
    rows: [
      { id: crypto.randomUUID(), label: 'Input 1', value: '' },
      { id: crypto.randomUUID(), label: 'Input 2', value: '' },
    ],
  }
}
