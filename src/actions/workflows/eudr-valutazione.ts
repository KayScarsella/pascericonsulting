'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { EUDR_TOOL_ID } from '@/lib/constants'
import { SessionMetadata } from '@/types/session'
import {
  EUDR_PREFILL_DERIVED_QUESTION_ID_SET,
  EUDR_Q_FLEGT,
  EUDR_SPEC_PAESE_GRID_QUESTION_ID,
  isYesLikeAnswer,
} from '@/lib/eudr-question-ids'
import { validateSessionAccess } from '@/actions/questions'
import { TablesInsert, Json, Database } from '@/types/supabase'
import { completeSessionAsExempt, extractNomeCommerciale, upsertUserResponses } from '@/actions/workflows/shared'
import { materializeEudrFinalPrefillForParent } from '@/actions/workflows/eudr-prefill'

type ValutazioneException = { isBlocked: boolean; blockReason: string; blockVariant: 'success' | 'warning' | 'error' }

const NOME_COMMERCIALE_ID = '85161065-5a74-4fc6-8965-279f2bfb870c'

const ERR_FLEGT_NOT_PRESENT =
  'FLEGT attivo: almeno uno dei Paesi selezionati non rientra tra i Paesi con accordo/licenza FLEGT (es. Indonesia, Ghana). Correggi i Paesi selezionati oppure disattiva FLEGT.'
const ERR_FLEGT_MIXED_COUNTRIES =
  'FLEGT attivo: non è consentito combinare nella stessa configurazione Paesi con licenza FLEGT e Paesi senza licenza FLEGT. Seleziona solo Paesi FLEGT (es. Indonesia, Ghana) oppure disattiva FLEGT.'
const FLEGT_FALLBACK_COUNTRY_NAMES = ['indonesia', 'ghana'] as const

function responseValueForQuestion(
  responses: { question_id: string; answer_text: string | null; answer_json: Json | null }[] | null | undefined,
  questionId: string
): unknown {
  const r = responses?.find((x) => x.question_id === questionId)
  if (!r) return undefined
  if (r.answer_text != null && String(r.answer_text).trim() !== '') return r.answer_text
  if (r.answer_json != null && typeof r.answer_json === 'object' && !Array.isArray(r.answer_json)) {
    const o = r.answer_json as Record<string, Json>
    const v = o.value ?? o.text
    if (v !== undefined && v !== null) return v
  }
  return r.answer_json
}


async function assertFlegtCountryRulesIfNeeded(
  supabase: SupabaseClient<Database>,
  distinctPaeseIds: string[],
  flegtRaw: unknown
): Promise<{ error?: string }> {
  // #region agent log
  fetch('http://127.0.0.1:7443/ingest/e3f27f07-b7f1-4eb5-9645-5d724b3a3d9b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6a4099'},body:JSON.stringify({sessionId:'6a4099',runId:'pre-fix',hypothesisId:'H1',location:'src/actions/workflows/eudr-valutazione.ts:assertFlegtCountryRulesIfNeeded:entry',message:'FLEGT check entry',data:{distinctPaeseIds,flegtRawType:typeof flegtRaw,flegtRaw:String(flegtRaw ?? '')},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log
  if (!isYesLikeAnswer(flegtRaw) || distinctPaeseIds.length === 0) return {}

  const { data: rows, error } = await supabase
    .from('country')
    .select('id, country_name')
    .in('id', distinctPaeseIds)

  if (error) return { error: error.message }

  const eligibleNames = new Set<string>(FLEGT_FALLBACK_COUNTRY_NAMES)
  const rowById = new Map((rows || []).map((r) => [r.id, r]))

  const eligible: string[] = []
  const ineligible: string[] = []
  const missing: string[] = []

  for (const id of distinctPaeseIds) {
    const r = rowById.get(id)
    if (!r) {
      missing.push(id)
      continue
    }
    const name = String(r.country_name ?? '').trim() || 'Paese sconosciuto'
    const normalized = name.trim().toLowerCase()
    if (eligibleNames.has(normalized)) eligible.push(name)
    else ineligible.push(name)
  }

  // #region agent log
  fetch('http://127.0.0.1:7443/ingest/e3f27f07-b7f1-4eb5-9645-5d724b3a3d9b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6a4099'},body:JSON.stringify({sessionId:'6a4099',runId:'pre-fix',hypothesisId:'H2',location:'src/actions/workflows/eudr-valutazione.ts:assertFlegtCountryRulesIfNeeded:classified',message:'FLEGT country classification',data:{rowsCount:rows?.length ?? 0,rowsPreview:(rows||[]).slice(0,10).map(r=>({id:r.id,country_name:r.country_name})),eligible,ineligible,missing},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log

  const hasEligible = eligible.length > 0
  const hasIneligible = ineligible.length > 0 || missing.length > 0

  const fmt = (xs: string[]) => [...new Set(xs)].join(', ')
  if (hasEligible && hasIneligible) {
    const parts: string[] = []
    if (eligible.length) parts.push(`Paesi FLEGT: ${fmt(eligible)}`)
    if (ineligible.length) parts.push(`Paesi non FLEGT: ${fmt(ineligible)}`)
    if (missing.length) parts.push(`Paesi non riconosciuti (id): ${fmt(missing)}`)
    return { error: `${ERR_FLEGT_MIXED_COUNTRIES} (${parts.join(' — ')})` }
  }
  if (hasIneligible || !hasEligible) {
    const parts: string[] = []
    if (ineligible.length) parts.push(`Paesi non FLEGT: ${fmt(ineligible)}`)
    if (missing.length) parts.push(`Paesi non riconosciuti (id): ${fmt(missing)}`)
    return { error: `${ERR_FLEGT_NOT_PRESENT}${parts.length ? ` (${parts.join(' — ')})` : ''}` }
  }
  return {}
}

export async function processEudrValutazione(
  sessionId: string,
  exceptionData?: ValutazioneException
): Promise<{ redirectUrl?: string; error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  try {
    await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)

    const { data: responses, error: fetchError } = await supabase
      .from('user_responses')
      .select('question_id, answer_text, answer_json')
      .eq('session_id', sessionId)
      .in('question_id', [EUDR_SPEC_PAESE_GRID_QUESTION_ID, NOME_COMMERCIALE_ID, EUDR_Q_FLEGT])

    if (fetchError) throw fetchError

    const nomeCommerciale = extractNomeCommerciale(responses, NOME_COMMERCIALE_ID)

    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'success') {
      const metadata: SessionMetadata = {
        nome_commerciale: nomeCommerciale,
        nome_operazione: nomeCommerciale,
        is_blocked: true,
        block_reason: exceptionData.blockReason,
        block_variant: 'success',
      }
      await completeSessionAsExempt(supabase, sessionId, metadata)
      return { redirectUrl: '/EUDR/search' }
    }

    let warningData: Record<string, unknown> = {}
    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'warning') {
      warningData = {
        block_reason: exceptionData.blockReason,
        block_variant: 'warning',
      }
    }

    const allPairs: string[] = []
    const pairDetails: Record<string, { specie_id: string; paese_id: string }> = {}

    const gridResponse = responses?.find((r) => r.question_id === EUDR_SPEC_PAESE_GRID_QUESTION_ID)

    if (gridResponse && Array.isArray(gridResponse.answer_json)) {
      gridResponse.answer_json.forEach((item) => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const itemRecord = item as Record<string, Json>
          const paesiStr = String(itemRecord.paesi_id || '')
          const specieStr = String(itemRecord.specie_id || '')

          if (paesiStr && specieStr) {
            paesiStr
              .split(',')
              .map((p) => p.trim())
              .filter(Boolean)
              .forEach((paese_id) => {
                const pairKey = `${specieStr}_${paese_id}`
                allPairs.push(pairKey)
                pairDetails[pairKey] = { specie_id: specieStr, paese_id }
              })
          }
        }
      })
    }

    const currentPairs = [...new Set(allPairs)]
    const distinctPaeseIds = [...new Set(Object.values(pairDetails).map((p) => p.paese_id))]

    const flegtRaw = responseValueForQuestion(responses, EUDR_Q_FLEGT)
    // #region agent log
    fetch('http://127.0.0.1:7443/ingest/e3f27f07-b7f1-4eb5-9645-5d724b3a3d9b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6a4099'},body:JSON.stringify({sessionId:'6a4099',runId:'pre-fix',hypothesisId:'H3',location:'src/actions/workflows/eudr-valutazione.ts:processEudrValutazione:gridParsed',message:'Parsed grid + FLEGT raw',data:{sessionId,currentPairsCount:currentPairs.length,distinctPaeseIdsCount:distinctPaeseIds.length,distinctPaeseIds:distinctPaeseIds.slice(0,50),flegtRaw:String(flegtRaw ?? ''),flegtYesLike:isYesLikeAnswer(flegtRaw)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    const flegtCheck = await assertFlegtCountryRulesIfNeeded(supabase, distinctPaeseIds, flegtRaw)
    if (flegtCheck.error) return { error: flegtCheck.error }

    const { data: existingSessions } = await supabase
      .from('assessment_sessions')
      .select('id, metadata')
      .eq('parent_session_id', sessionId)
      .eq('session_type', 'analisi_finale')

    const existingPairs = (existingSessions || [])
      .map((s) => {
        const meta = s.metadata as unknown as SessionMetadata | null
        if (!meta?.country) return null
        return meta.specie ? `${meta.specie}_${meta.country}` : null
      })
      .filter((c): c is string => Boolean(c))

    const removedPairs = existingPairs.filter((p) => !currentPairs.includes(p))
    const addedPairs = currentPairs.filter((p) => !existingPairs.includes(p))

    const pairsToCreate: string[] = addedPairs

    if (currentPairs.length === 0 && pairsToCreate.length === 0) {
      return { redirectUrl: '/EUDR/search' }
    }

    if (removedPairs.length > 0) {
      const removedSessionIds = (existingSessions || [])
        .filter((s) => {
          const meta = s.metadata as unknown as SessionMetadata | null
          if (!meta?.country || !meta.specie) return false
          return removedPairs.includes(`${meta.specie}_${meta.country}`)
        })
        .map((s) => s.id)
      if (removedSessionIds.length > 0) {
        await supabase
          .from('assessment_sessions')
          .delete()
          .in('id', removedSessionIds)
      }
    }

    if (pairsToCreate.length > 0) {
      const specieIdsToFetch = [...new Set(pairsToCreate.map((p) => pairDetails[p].specie_id))]
      const paeseIdsToFetch = [...new Set(pairsToCreate.map((p) => pairDetails[p].paese_id))]

      const [{ data: speciesData }, { data: countriesData }] = await Promise.all([
        supabase.from('species').select('id, common_name').in('id', specieIdsToFetch),
        supabase.from('country').select('id, country_name').in('id', paeseIdsToFetch),
      ])

      const speciesMap = new Map(speciesData?.map((s) => [s.id, s.common_name]) || [])
      const countriesMap = new Map(countriesData?.map((c) => [c.id, c.country_name]) || [])

      const nowStr = new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date())
      const formatDataOra = nowStr.replace(/\//g, '-').replace(', ', ' ')

      const payloads: TablesInsert<'assessment_sessions'>[] = pairsToCreate.map((pairKey) => {
        const { specie_id, paese_id } = pairDetails[pairKey]
        const specieName = speciesMap.get(specie_id) || 'Specie Sconosciuta'
        const paeseName = countriesMap.get(paese_id) || 'Paese Sconosciuto'

        const metadata: SessionMetadata = {
          country: paese_id,
          specie: specie_id,
          nome_operazione: `Valutazione Rischio del ${formatDataOra} ${specieName} ${paeseName}`,
        }

        return {
          user_id: user.id,
          tool_id: EUDR_TOOL_ID,
          session_type: 'analisi_finale',
          parent_session_id: sessionId,
          status: 'in_progress',
          metadata: metadata as unknown as Json,
        }
      })

      await supabase.from('assessment_sessions').insert(payloads)

      const { data: createdEudrSessions } = await supabase
        .from('assessment_sessions')
        .select('id')
        .eq('parent_session_id', sessionId)
        .eq('session_type', 'analisi_finale')
        .eq('tool_id', EUDR_TOOL_ID)

      const { data: parentRows } = await supabase
        .from('user_responses')
        .select('question_id, answer_text, answer_json, file_path')
        .eq('session_id', sessionId)

      if (createdEudrSessions?.length && parentRows?.length) {
        const isoDate = new Date().toISOString()
        const prefill: TablesInsert<'user_responses'>[] = []
        for (const sess of createdEudrSessions) {
          for (const row of parentRows) {
            if (EUDR_PREFILL_DERIVED_QUESTION_ID_SET.has(row.question_id)) continue
            if (row.answer_text == null && row.answer_json == null && row.file_path == null) continue
            prefill.push({
              user_id: user.id,
              tool_id: EUDR_TOOL_ID,
              session_id: sess.id,
              question_id: row.question_id,
              answer_text: row.answer_text,
              answer_json: row.answer_json as Json | null,
              file_path: row.file_path,
              updated_at: isoDate,
            })
          }
        }
        if (prefill.length > 0) {
          await upsertUserResponses(supabase, prefill)
        }
      }
    }

    if (currentPairs.length > 0) {
      await materializeEudrFinalPrefillForParent(supabase, user.id, sessionId, 'evaluation-save')
    }

    const { data: rootSession } = await supabase
      .from("assessment_sessions")
      .select("metadata")
      .eq("id", sessionId)
      .single()

    const previousMeta = (rootSession?.metadata as SessionMetadata | null) ?? {}

    const finalMetadata: SessionMetadata = {
      ...previousMeta,
      nome_commerciale: nomeCommerciale,
      nome_operazione: nomeCommerciale,
      is_blocked: false,
      step2_saved_at: new Date().toISOString(),
      resume_step: currentPairs.length > 0 ? "valutazione-finale" : "evaluation",
      ...warningData,
    }

    await supabase
      .from('assessment_sessions')
      .update({
        status: 'completed',
        final_outcome: 'Verifica Completata',
        metadata: finalMetadata as unknown as Json,
      })
      .eq('id', sessionId)

    if (currentPairs.length === 1) {
      const { data: singleSession } = await supabase
        .from('assessment_sessions')
        .select('id')
        .eq('parent_session_id', sessionId)
        .eq('session_type', 'analisi_finale')
        .single()
      if (singleSession) {
        return { redirectUrl: `/EUDR/valutazione-finale?session_id=${singleSession.id}` }
      }
    }

    return { redirectUrl: '/EUDR/search' }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : 'Errore elaborazione workflow' }
  }
}
