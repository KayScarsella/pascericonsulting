'use server'

import { createClient } from '@/utils/supabase/server'
import { TIMBER_TOOL_ID } from '@/lib/constants'
import { SessionMetadata } from '@/types/session'
import { validateSessionAccess } from '@/actions/questions'
import { TablesInsert, Json } from '@/types/supabase'
import { completeSessionAsExempt, extractNomeCommerciale, upsertUserResponses } from '@/actions/workflows/shared'
import { isYesLikeAnswer } from '@/lib/eudr-question-ids'

type ValutazioneException = { isBlocked: boolean; blockReason: string; blockVariant: 'success' | 'warning' | 'error' }

async function hasTimberFlegtOrCitesYes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string
): Promise<boolean> {
  const { data: timberSections } = await supabase
    .from('sections')
    .select('id')
    .eq('tool_id', TIMBER_TOOL_ID)

  const timberSectionIds = (timberSections || []).map((section) => section.id)
  if (timberSectionIds.length === 0) return false

  const { data: flegtCitesQuestions } = await supabase
    .from('questions')
    .select('id')
    .in('section_id', timberSectionIds)
    .or('text.ilike.%flegt%,text.ilike.%cites%')

  const flegtCitesQuestionIds = (flegtCitesQuestions || []).map((question) => question.id)
  if (flegtCitesQuestionIds.length === 0) return false

  const { data: responses } = await supabase
    .from('user_responses')
    .select('answer_text')
    .eq('session_id', sessionId)
    .in('question_id', flegtCitesQuestionIds)

  return (responses || []).some((response) => isYesLikeAnswer(response.answer_text))
}

export async function processTimberValutazione(
  sessionId: string,
  exceptionData?: ValutazioneException
): Promise<{ redirectUrl?: string, error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  try {
    await validateSessionAccess(supabase, TIMBER_TOOL_ID, sessionId)
    const hasFlegtOrCites = await hasTimberFlegtOrCitesYes(supabase, sessionId)
    const effectiveExceptionData: ValutazioneException | undefined = hasFlegtOrCites
      ? {
          isBlocked: true,
          blockReason: 'Verifica non soggetta: presenza di licenza FLEGT/CITES nel flusso Timber.',
          blockVariant: 'success',
        }
      : exceptionData
    const TARGET_QUESTION_ID = '23ea972c-e1bd-459b-a8e0-3d0376539e96'; // Array Specie-Paesi
    const NOME_COMMERCIALE_ID = '8e2d4d57-161c-4f37-8089-04ab947389e1'; // Domanda Nome Commerciale

    const { data: responses, error: fetchError } = await supabase
      .from('user_responses')
      .select('question_id, answer_text, answer_json')
      .eq('session_id', sessionId)
      .in('question_id', [TARGET_QUESTION_ID, NOME_COMMERCIALE_ID])

    if (fetchError) throw fetchError;

    const nomeCommerciale = extractNomeCommerciale(responses, NOME_COMMERCIALE_ID)

    // 🛠️ CASO 1: Esente (Success) - Chiudiamo e fermiamo l'analisi
    if (effectiveExceptionData?.isBlocked && effectiveExceptionData.blockVariant === 'success') {
      await supabase
        .from('assessment_sessions')
        .delete()
        .eq('parent_session_id', sessionId)
        .eq('session_type', 'analisi_finale')
        .eq('tool_id', TIMBER_TOOL_ID)

      const { data: rootSession } = await supabase
        .from('assessment_sessions')
        .select('metadata')
        .eq('id', sessionId)
        .single()

      const previousMeta = (rootSession?.metadata as SessionMetadata | null) ?? {}

      const metadata: SessionMetadata = {
        ...previousMeta,
        nome_commerciale: nomeCommerciale,
        nome_operazione: nomeCommerciale,
        is_blocked: true,
        block_reason: effectiveExceptionData.blockReason,
        block_variant: 'success',
        // Esenzione rilevata nello step Evaluation: alla riapertura rientriamo qui.
        resume_step: 'evaluation',
      };
      await completeSessionAsExempt(supabase, sessionId, metadata)
      return { redirectUrl: '/timberRegulation/search' };
    }

    // 🛠️ CASO 2: Warning - Appuntiamo l'avviso ma andiamo avanti
    let warningData: Pick<SessionMetadata, "block_reason" | "block_variant"> = {}
    if (effectiveExceptionData?.isBlocked && effectiveExceptionData.blockVariant === 'warning') {
        warningData = {
            block_reason: effectiveExceptionData.blockReason,
            block_variant: 'warning'
        };
    }

    // Prepariamo i figli (Analisi Finali) dalla griglia
    const allPairs: string[] = [];
    const pairDetails: Record<string, { specie_id: string, paese_id: string }> = {};

    const gridResponse = responses?.find(r => r.question_id === TARGET_QUESTION_ID);
    
    if (gridResponse && Array.isArray(gridResponse.answer_json)) {
      gridResponse.answer_json.forEach(item => {
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          const itemRecord = item as Record<string, Json>;
          const paesiStr = String(itemRecord.paesi_id || '');
          const specieStr = String(itemRecord.specie_id || '');

          if (paesiStr && specieStr) {
            paesiStr.split(',').map(p => p.trim()).filter(Boolean).forEach(paese_id => {
              const pairKey = `${specieStr}_${paese_id}`;
              allPairs.push(pairKey);
              pairDetails[pairKey] = { specie_id: specieStr, paese_id };
            });
          }
        }
      })
    }

    const currentPairs = [...new Set(allPairs)];

    // Recupero storico figli già generati
    const { data: existingSessions } = await supabase
      .from('assessment_sessions')
      .select('id, metadata')
      .eq('parent_session_id', sessionId)
      .eq('session_type', 'analisi_finale')
      .eq('tool_id', TIMBER_TOOL_ID);

    const existingPairs = (existingSessions || []).map(s => {
      const meta = s.metadata as unknown as SessionMetadata | null;
      if (!meta?.country) return null;
      return meta.specie ? `${meta.specie}_${meta.country}` : null;
    }).filter((c): c is string => Boolean(c));

    const removedPairs = existingPairs.filter(p => !currentPairs.includes(p));
    const addedPairs = currentPairs.filter(p => !existingPairs.includes(p));

    const pairsToCreate: string[] = addedPairs

    if (currentPairs.length === 0 && pairsToCreate.length === 0) {
        // Se non ci sono specie inserite e non era esente, lo rimandiamo fuori
        return { redirectUrl: '/timberRegulation/search' };
    }

    if (removedPairs.length > 0) {
      const removedSessionIds = (existingSessions || [])
        .filter((s) => {
          const meta = s.metadata as SessionMetadata | null
          if (!meta?.country || !meta?.specie) return false
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

    // 🛠️ 3. CREAZIONE DELLE SESSIONI MANCANTI (CON NOME ORIGINALE E PRE-FILL)
    if (pairsToCreate.length > 0) {
      const specieIdsToFetch = [...new Set(pairsToCreate.map(p => pairDetails[p].specie_id))];
      const paeseIdsToFetch = [...new Set(pairsToCreate.map(p => pairDetails[p].paese_id))];

      const [{ data: speciesData }, { data: countriesData }] = await Promise.all([
        supabase.from('species').select('id, common_name').in('id', specieIdsToFetch),
        supabase.from('country').select('id, country_name, conflicts, corruption_code, sanction').in('id', paeseIdsToFetch)
      ]);

      const speciesMap = new Map(speciesData?.map(s => [s.id, s.common_name]) || []);
      const countriesMap = new Map(countriesData?.map(c => [c.id, c.country_name]) || []);
      const conflictsMap = new Map(countriesData?.map(c => [c.id, c.conflicts ?? false]) || []);
      const corruptionMap = new Map(countriesData?.map(c => [c.id, c.corruption_code ?? null]) || []);
      const sanctionMap = new Map(countriesData?.map(c => [c.id, c.sanction ?? false]) || []);

      // Data e Ora per il nome operazione
      const nowStr = new Intl.DateTimeFormat('it-IT', {
        timeZone: 'Europe/Rome',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
      const formatDataOra = nowStr.replace(/\//g, '-').replace(', ', ' ');

      const payloads: TablesInsert<'assessment_sessions'>[] = pairsToCreate.map(pairKey => {
        const { specie_id, paese_id } = pairDetails[pairKey];
        const specieName = speciesMap.get(specie_id) || "Specie Sconosciuta";
        const paeseName = countriesMap.get(paese_id) || "Paese Sconosciuto";

        const metadata: SessionMetadata = {
          country: paese_id,
          specie: specie_id,
          // 🛠️ RIPRISTINATO IL NOME OPERAZIONE ORIGINALE
          nome_operazione: `Valutazione Rischio del ${formatDataOra} ${specieName} ${paeseName}`
        };

        return {
          user_id: user.id,
          tool_id: TIMBER_TOOL_ID,
          session_type: 'analisi_finale',
          parent_session_id: sessionId,
          status: 'in_progress',
          metadata: metadata as unknown as Json 
        };
      });

      await supabase.from('assessment_sessions').insert(payloads);

      // 🛠️ RIPRISTINATO IL PRE-FILL DELLE RISPOSTE NELLE ANALISI FINALI
      const { data: createdSessions } = await supabase
        .from('assessment_sessions')
        .select('id, metadata')
        .eq('parent_session_id', sessionId)
        .eq('session_type', 'analisi_finale')
        .eq('tool_id', TIMBER_TOOL_ID)
        .in('metadata->>specie', specieIdsToFetch);

      if (createdSessions && createdSessions.length > 0) {
        const Q_SPECIES = '523e5630-7bb2-4ace-a873-bc616fba6540';
        const Q_COUNTRY = '2078a34e-d6b0-433d-a491-ffd5316a5ed5';
        const Q_CONFLICTS = '6cd9fa2e-ea94-4bb5-a32f-aff0a4bd2a87';
        const Q_CORRUPTION = '81a73979-beeb-4f30-b7b5-c42531b3acd2';
        const Q_SANCTIONS = 'a0a0703b-a343-423a-bce8-e9d3912e8e78';

        const prefillPayloads: TablesInsert<'user_responses'>[] = [];
        const isoDate = new Date().toISOString();

        for (const sess of createdSessions) {
          const meta = sess.metadata as unknown as SessionMetadata | null;
          if (!meta?.specie || !meta?.country) continue;

          const hasConflicts = conflictsMap.get(meta.country) ?? false;
          const corruptionCode = corruptionMap.get(meta.country) ?? null;
          const hasSanction = sanctionMap.get(meta.country) ?? false;

          prefillPayloads.push(
            { user_id: user.id, tool_id: TIMBER_TOOL_ID, session_id: sess.id, question_id: Q_SPECIES, answer_text: meta.specie, updated_at: isoDate },
            { user_id: user.id, tool_id: TIMBER_TOOL_ID, session_id: sess.id, question_id: Q_COUNTRY, answer_text: meta.country, updated_at: isoDate },
            { user_id: user.id, tool_id: TIMBER_TOOL_ID, session_id: sess.id, question_id: Q_CONFLICTS, answer_text: hasConflicts ? 'si' : 'no', updated_at: isoDate },
            { user_id: user.id, tool_id: TIMBER_TOOL_ID, session_id: sess.id, question_id: Q_SANCTIONS, answer_text: hasSanction ? 'si' : 'no', updated_at: isoDate }
          );

          if (corruptionCode) {
            prefillPayloads.push({ user_id: user.id, tool_id: TIMBER_TOOL_ID, session_id: sess.id, question_id: Q_CORRUPTION, answer_text: corruptionCode, updated_at: isoDate });
          }
        }

        if (prefillPayloads.length > 0) {
          await upsertUserResponses(supabase, prefillPayloads)
        }
      }
    }

    // Aggiorniamo la Verifica madre segnandola come completata
    const { data: rootSession } = await supabase
      .from('assessment_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .single()

    const previousMeta = (rootSession?.metadata as SessionMetadata | null) ?? {}

    const finalMetadata: SessionMetadata = {
        ...previousMeta,
        nome_commerciale: nomeCommerciale,
        nome_operazione: nomeCommerciale,
        is_blocked: false,
        step2_saved_at: new Date().toISOString(),
        // Manteniamo il resume sulla pagina Evaluation della verifica base.
        resume_step: 'evaluation',
        ...warningData
    };

    await supabase.from('assessment_sessions').update({
      status: 'completed',
      final_outcome: 'Verifica Completata',
      metadata: finalMetadata as unknown as Json 
    }).eq('id', sessionId);

    // Redirect al form figlio se ce n'è solo 1
    if (currentPairs.length === 1) {
      const { data: singleSession } = await supabase.from('assessment_sessions')
        .select('id')
        .eq('parent_session_id', sessionId)
        .eq('session_type', 'analisi_finale')
        .eq('tool_id', TIMBER_TOOL_ID)
        .single();
      if (singleSession) {
        return { redirectUrl: `/timberRegulation/valutazione-finale?session_id=${singleSession.id}` };
      }
    }

    return { redirectUrl: '/timberRegulation/search' };

  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Errore elaborazione workflow" };
  }
}