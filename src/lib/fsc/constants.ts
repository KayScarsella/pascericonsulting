import type { FscMemberType } from '@/types/fsc'

export type FscDocumentModuleSlug = 'gestione' | 'ente'

export type FscDocumentCategoryDef = {
  slug: string
  label: string
}

export const FSC_GESTIONE_CATEGORIES = [
  { slug: 'manuale', label: 'Manuale FSC' },
  { slug: 'politica', label: 'Politica' },
  { slug: 'procedure', label: 'Procedure' },
  { slug: 'allegati', label: 'Allegati vari' },
] as const

export const FSC_ENTE_CATEGORIES = [
  { slug: 'visura', label: 'Visura annuale' },
  { slug: 'm210', label: 'M210' },
  { slug: 'fatturato', label: 'Fatturato' },
  { slug: 'certificato', label: 'Certificato' },
  { slug: 'contratto', label: 'Contratto' },
  { slug: 'sicurezza', label: 'Documenti sicurezza' },
] as const

export type FscGestioneCategorySlug = (typeof FSC_GESTIONE_CATEGORIES)[number]['slug']
export type FscEnteCategorySlug = (typeof FSC_ENTE_CATEGORIES)[number]['slug']

export const FSC_GESTIONE_CATEGORY_SLUGS = FSC_GESTIONE_CATEGORIES.map((c) => c.slug)
export const FSC_ENTE_CATEGORY_SLUGS = FSC_ENTE_CATEGORIES.map((c) => c.slug)

export const FSC_GESTIONE_PATH = '/cloud-fsc/documenti-gestione'
export const FSC_ENTE_PATH = '/cloud-fsc/documenti-ente'
export const FSC_ILO_PATH = '/cloud-fsc/autovalutazione-ilo'

export const FSC_MEMBER_TYPE_LABELS: Record<FscMemberType, string> = {
  owner: 'Titolare',
  employee: 'Dipendente',
  consultant: 'Consulente',
}

export function fscIloEditPath(referenceYear: number): string {
  return `${FSC_ILO_PATH}/${referenceYear}`
}

export function getFscModuleCategories(
  module: FscDocumentModuleSlug
): readonly FscDocumentCategoryDef[] {
  return module === 'gestione' ? FSC_GESTIONE_CATEGORIES : FSC_ENTE_CATEGORIES
}

export function isFscModuleCategorySlug(
  module: FscDocumentModuleSlug,
  value: string
): boolean {
  const slugs = module === 'gestione' ? FSC_GESTIONE_CATEGORY_SLUGS : FSC_ENTE_CATEGORY_SLUGS
  return (slugs as readonly string[]).includes(value)
}

export function getFscModuleCategoryLabel(
  module: FscDocumentModuleSlug,
  slug: string
): string {
  return getFscModuleCategories(module).find((c) => c.slug === slug)?.label ?? slug
}

export function getFscModulePath(module: FscDocumentModuleSlug): string {
  return module === 'gestione' ? FSC_GESTIONE_PATH : FSC_ENTE_PATH
}

export function getFscModuleDefaultCategory(module: FscDocumentModuleSlug): string {
  return getFscModuleCategories(module)[0].slug
}

export function isFscGestioneCategorySlug(value: string): value is FscGestioneCategorySlug {
  return isFscModuleCategorySlug('gestione', value)
}

export function getFscGestioneCategoryLabel(slug: string): string {
  return getFscModuleCategoryLabel('gestione', slug)
}

export function fscMemberTypeLabel(type: FscMemberType): string {
  return FSC_MEMBER_TYPE_LABELS[type] ?? type
}
