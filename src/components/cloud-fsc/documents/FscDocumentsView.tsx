import { getCurrentFscCompany } from '@/actions/fsc/company'
import {
  listFscCategoryCounts,
  listFscEnteDocuments,
  listFscEnteYears,
  listFscGestioneDocuments,
} from '@/actions/fsc/documents'
import { FscDocumentsExplorer } from '@/components/cloud-fsc/documents/FscDocumentsExplorer'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import {
  getFscModuleCategories,
  getFscModuleDefaultCategory,
  isFscModuleCategorySlug,
  type FscDocumentModuleSlug,
} from '@/lib/fsc/constants'
import { getToolAccess } from '@/lib/tool-auth'
import type { FscGestioneDocument } from '@/types/fsc'

type FscDocumentsViewProps = {
  module: FscDocumentModuleSlug
  initialCategory?: string
  initialYear?: string
}

export async function FscDocumentsView({
  module,
  initialCategory,
  initialYear,
}: FscDocumentsViewProps) {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getCurrentFscCompany()

  if (!companyCtx.success || !companyCtx.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        {companyCtx.error ?? 'Impossibile caricare i dati dell\'impresa FSC.'}
      </div>
    )
  }

  const isEnte = module === 'ente'
  const defaultCategory = getFscModuleDefaultCategory(module)
  const activeCategory =
    initialCategory && isFscModuleCategorySlug(module, initialCategory)
      ? initialCategory
      : defaultCategory

  let selectedYear: number | null = null
  if (isEnte && initialYear) {
    const parsed = Number.parseInt(initialYear, 10)
    if (!Number.isNaN(parsed)) selectedYear = parsed
  }

  const [activeDocs, categoryCounts, availableYears] = await Promise.all([
    isEnte
      ? listFscEnteDocuments(activeCategory, selectedYear ?? undefined)
      : listFscGestioneDocuments(activeCategory),
    listFscCategoryCounts(module, selectedYear ?? undefined),
    isEnte ? listFscEnteYears() : Promise.resolve([] as number[]),
  ])

  const documentsByCategory = getFscModuleCategories(module).reduce(
    (acc, cat) => {
      acc[cat.slug] = cat.slug === activeCategory ? activeDocs : []
      return acc
    },
    {} as Record<string, FscGestioneDocument[]>
  )

  return (
    <FscDocumentsExplorer
      module={module}
      documentsByCategory={documentsByCategory}
      categoryCounts={categoryCounts}
      canEdit={companyCtx.data.membership.can_edit}
      companyName={companyCtx.data.company.ragione_sociale}
      initialCategory={activeCategory}
      availableYears={availableYears}
      selectedYear={selectedYear}
    />
  )
}
