'use client'

import { SectionList } from '@/components/questions/SectionList'
import { CLOUD_FSC_TOOL_ID } from '@/lib/constants'
import { FSC_ILO_GROUP_NAME } from '@/lib/fsc/ilo/question-ids'
import type { Tables } from '@/types/supabase'

type SectionWithQuestions = Tables<'sections'> & {
  questions: Tables<'questions'>[]
}

type FscIloSectionListProps = {
  sections: SectionWithQuestions[]
  userResponses: Tables<'user_responses'>[]
  sessionId: string
  canEdit: boolean
}

export function FscIloSectionList({
  sections,
  userResponses,
  sessionId,
  canEdit,
}: FscIloSectionListProps) {
  const configuredSections = sections.map((section) => ({
    ...section,
    default_open: true,
    default_mode: canEdit ? ('edit' as const) : ('view' as const),
  }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Gruppo domande: <span className="font-medium text-slate-700">{FSC_ILO_GROUP_NAME}</span>
        {' — '}
        modello FSC Italia Parte 2 (V1.2).
      </p>
      <SectionList
        sections={configuredSections}
        userResponses={userResponses}
        toolId={CLOUD_FSC_TOOL_ID}
        sessionId={sessionId}
        defaultOpen
        defaultMode={canEdit ? 'edit' : 'view'}
        saveRequiresFullCompletion={canEdit}
      />
    </div>
  )
}
