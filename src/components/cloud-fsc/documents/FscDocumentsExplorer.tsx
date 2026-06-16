'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { FileText, FolderOpen } from 'lucide-react'
import { FscCategoryPanel } from '@/components/cloud-fsc/documents/FscCategoryPanel'
import { cn } from '@/lib/utils'
import {
  getFscModuleCategories,
  getFscModuleDefaultCategory,
  getFscModulePath,
  isFscModuleCategorySlug,
  type FscDocumentModuleSlug,
} from '@/lib/fsc/constants'
import type { FscGestioneDocument } from '@/types/fsc'

type FscDocumentsExplorerProps = {
  module: FscDocumentModuleSlug
  documentsByCategory: Record<string, FscGestioneDocument[]>
  canEdit: boolean
  companyName: string
  initialCategory?: string
  availableYears?: number[]
  selectedYear?: number | null
}

const MODULE_TITLES: Record<FscDocumentModuleSlug, { title: string; subtitle: string }> = {
  gestione: {
    title: 'Documenti di gestione',
    subtitle: 'Manuale FSC, politica, procedure e allegati',
  },
  ente: {
    title: 'Documenti di interscambio con l\u2019ente',
    subtitle: 'Visura, M210, fatturato, certificato, contratto e documenti sicurezza',
  },
}

export function FscDocumentsExplorer({
  module,
  documentsByCategory,
  canEdit,
  companyName,
  initialCategory,
  availableYears = [],
  selectedYear = null,
}: FscDocumentsExplorerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const basePath = getFscModulePath(module)
  const categories = getFscModuleCategories(module)
  const defaultCategory = getFscModuleDefaultCategory(module)
  const isEnte = module === 'ente'
  const { title, subtitle } = MODULE_TITLES[module]

  const categoryParam = searchParams.get('category') ?? initialCategory ?? defaultCategory
  const activeCategory = isFscModuleCategorySlug(module, categoryParam)
    ? categoryParam
    : defaultCategory

  const navigate = (category: string, year: number | null) => {
    const params = new URLSearchParams()
    params.set('category', category)
    if (year !== null) params.set('year', String(year))
    router.push(`${basePath}?${params.toString()}`)
  }

  const setCategory = (slug: string) => navigate(slug, selectedYear)
  const setYear = (year: number | null) => navigate(activeCategory, year)

  const activeDocs = documentsByCategory[activeCategory] ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-slate-500">
          {subtitle} —{' '}
          <span className="font-medium text-slate-700">{companyName}</span>
        </p>
        {!canEdit && (
          <p className="mt-2 text-sm text-amber-700">
            Accesso in sola lettura: i documenti sono condivisi con tutti i membri dell&apos;impresa.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 lg:hidden">
          <label
            htmlFor="fsc-category-select"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Sezione
          </label>
          <select
            id="fsc-category-select"
            value={activeCategory}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {categories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.label} ({documentsByCategory[cat.slug]?.length ?? 0})
              </option>
            ))}
          </select>
        </div>

        {isEnte && (
          <div className="sm:w-48">
            <label
              htmlFor="fsc-year-select"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Anno
            </label>
            <select
              id="fsc-year-select"
              value={selectedYear ?? ''}
              onChange={(e) =>
                setYear(e.target.value === '' ? null : Number.parseInt(e.target.value, 10))
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Tutti gli anni</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="space-y-1 rounded-xl border border-slate-200 bg-white p-2">
            {categories.map((cat) => {
              const count = documentsByCategory[cat.slug]?.length ?? 0
              const isActive = activeCategory === cat.slug
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => setCategory(cat.slug)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {isActive ? (
                    <FolderOpen className="h-4 w-4 shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  <span className="flex-1">{cat.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <FscCategoryPanel
            module={module}
            category={activeCategory}
            documents={activeDocs}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  )
}
