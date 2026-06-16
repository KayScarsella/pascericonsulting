import Link from 'next/link'
import { ArrowLeft, Copy } from 'lucide-react'
import { getFscIloAssessment, listFscIloAssessments } from '@/actions/fsc/ilo'
import { getCurrentFscCompany } from '@/actions/fsc/company'
import { FscIloDuplicateFromYearPanel } from '@/components/cloud-fsc/ilo/FscIloDuplicateFromYearPanel'
import { FscIloSectionList } from '@/components/cloud-fsc/ilo/FscIloSectionList'
import { FscIloStatusBadge } from '@/components/cloud-fsc/ilo/FscIloStatusBadge'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { FSC_ILO_PATH } from '@/lib/fsc/constants'
import { FSC_ILO_GROUP_NAME } from '@/lib/fsc/ilo/question-ids'
import { getToolAccess } from '@/lib/tool-auth'
import { createClient } from '@/utils/supabase/server'

type FscIloEditViewProps = {
  referenceYear: number
}

export async function FscIloEditView({ referenceYear }: FscIloEditViewProps) {
  await getToolAccess(CLOUD_FSC_TOOL_ID)
  const companyCtx = await getCurrentFscCompany()

  if (!companyCtx.success || !companyCtx.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
        {companyCtx.error ?? 'Impossibile caricare i dati dell\'impresa FSC.'}
      </div>
    )
  }

  const result = await getFscIloAssessment(referenceYear)
  if (!result.success || !result.data) {
    return (
      <div className="space-y-4">
        <Link
          href={FSC_ILO_PATH}
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Torna all&apos;elenco
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
          {result.error ?? 'Autovalutazione non trovata.'}
        </div>
      </div>
    )
  }

  const assessment = result.data
  const canEdit = companyCtx.data.membership.can_edit
  const allAssessments = await listFscIloAssessments()
  const duplicateSourceYears = allAssessments
    .filter((a) => a.reference_year !== referenceYear && a.reference_year < referenceYear)
    .map((a) => a.reference_year)
    .sort((a, b) => b - a)

  let sections = null
  let userResponses = null

  if (assessment.session_id) {
    const supabase = await createClient()
    const [{ data: sectionRows }, { data: responseRows }] = await Promise.all([
      supabase
        .from('sections')
        .select('*, questions(*)')
        .eq('tool_id', CLOUD_FSC_TOOL_ID)
        .eq('group_name', FSC_ILO_GROUP_NAME)
        .order('order_index', { ascending: true })
        .order('order_index', { foreignTable: 'questions', ascending: true }),
      supabase
        .from('user_responses')
        .select('*')
        .eq('session_id', assessment.session_id),
    ])
    sections = sectionRows
    userResponses = responseRows
  }

  const hasResponses = (userResponses?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <Link
          href={FSC_ILO_PATH}
          className="inline-flex w-fit items-center text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Torna all&apos;elenco
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Autovalutazione {referenceYear}
          </h1>
          <FscIloStatusBadge status={assessment.status} />
        </div>

        <p className="text-sm text-slate-500">
          Compila tutte le sezioni del questionario FSC Italia Parte 2 (V1.2). Il salvataggio
          si abilita quando tutte le domande obbligatorie sono complete.
        </p>
      </div>

      {canEdit && !hasResponses && duplicateSourceYears.length > 0 && (
        <FscIloDuplicateFromYearPanel
          targetYear={referenceYear}
          sourceYears={duplicateSourceYears}
        />
      )}

      {assessment.duplicated_from_year && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Copy className="h-3.5 w-3.5" />
          Duplicata dall&apos;autovalutazione {assessment.duplicated_from_year}
        </p>
      )}

      {assessment.session_id && sections ? (
        <FscIloSectionList
          sections={sections}
          userResponses={userResponses ?? []}
          sessionId={assessment.session_id}
          canEdit={canEdit}
        />
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900 text-sm">
          Sessione autovalutazione non disponibile. Ricarica la pagina o contatta il supporto.
        </div>
      )}
    </div>
  )
}
