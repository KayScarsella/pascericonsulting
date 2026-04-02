'use server'

import { createClient } from '@/utils/supabase/server'
import { EUDR_TOOL_ID } from '@/lib/constants'
import { SessionMetadata } from '@/types/session'
import { EUDR_COUNTRY_PREFILL_QUESTION_IDS } from '@/lib/eudr-risk-calculator'
import { validateSessionAccess } from '@/actions/questions'
import { TablesInsert, Json } from '@/types/supabase'
import { completeSessionAsExempt, extractNomeCommerciale, upsertUserResponses } from '@/actions/workflows/shared'

type ValutazioneException = { isBlocked: boolean; blockReason: string; blockVariant: 'success' | 'warning' | 'error' }

export async function processEudrValutazione(
  sessionId: string,
  exceptionData?: ValutazioneException
): Promise<{ redirectUrl?: string, error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  try {
    await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)

    const TARGET_QUESTION_ID = '03dd3221-ba2f-4c83-9148-8fd06f389b0a'; // Repeater Specie-Paesi EUDR
    const NOME_COMMERCIALE_ID = '85161065-5a74-4fc6-8965-279f2bfb870c'; // Domanda Nome Commerciale EUDR

    const { data: responses, error: fetchError } = await supabase
      .from('user_responses')
      .select('question_id, answer_text, answer_json')
      .eq('session_id', sessionId)
      .in('question_id', [TARGET_QUESTION_ID, NOME_COMMERCIALE_ID])

    if (fetchError) throw fetchError;

    const nomeCommerciale = extractNomeCommerciale(responses, NOME_COMMERCIALE_ID)

    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'success') {
      const metadata: SessionMetadata = {
        nome_commerciale: nomeCommerciale,
        nome_operazione: nomeCommerciale,
        is_blocked: true,
        block_reason: exceptionData.blockReason,
        block_variant: 'success'
      };
      await completeSessionAsExempt(supabase, sessionId, metadata)
      return { redirectUrl: '/EUDR/search' };
    }

    let warningData: Record<string, unknown> = {};
    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'warning') {
      warningData = {
        block_reason: exceptionData.blockReason,
        block_variant: 'warning'
      };
    }

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

    const { data: existingSessions } = await supabase
      .from('assessment_sessions')
      .select('id, metadata')
      .eq('parent_session_id', sessionId)
      .eq('session_type', 'analisi_finale');

    const existingPairs = (existingSessions || []).map(s => {
      const meta = s.metadata as unknown as SessionMetadata | null;
      if (!meta?.country) return null;
      return meta.specie ? `${meta.specie}_${meta.country}` : null;
    }).filter((c): c is string => Boolean(c));

    const removedPairs = existingPairs.filter(p => !currentPairs.includes(p));
    const addedPairs = currentPairs.filter(p => !existingPairs.includes(p));

    let pairsToCreate: string[] = [];

    if (removedPairs.length > 0) {
      await supabase.from('assessment_sessions').delete()
        .eq('parent_session_id', sessionId)
        .eq('session_type', 'analisi_finale');
      pairsToCreate = currentPairs;
    } else if (addedPairs.length > 0) {
      pairsToCreate = addedPairs;
    }

    if (currentPairs.length === 0 && pairsToCreate.length === 0) {
      return { redirectUrl: '/EUDR/search' };
    }

    if (pairsToCreate.length > 0) {
      const specieIdsToFetch = [...new Set(pairsToCreate.map(p => pairDetails[p].specie_id))];
      const paeseIdsToFetch = [...new Set(pairsToCreate.map(p => pairDetails[p].paese_id))];

      const [{ data: speciesData }, { data: countriesData }] = await Promise.all([
        supabase.from('species').select('id, common_name').in('id', specieIdsToFetch),
        supabase.from('country').select('id, country_name, conflicts, sanction, country_risk, fao').in('id', paeseIdsToFetch)
      ]);

      const speciesMap = new Map(speciesData?.map(s => [s.id, s.common_name]) || []);
      const countriesMap = new Map(countriesData?.map(c => [c.id, c.country_name]) || []);
      const eudrConflictsMap = new Map(countriesData?.map(c => [c.id, c.conflicts ?? false]) || []);
      const eudrSanctionMap = new Map(countriesData?.map(c => [c.id, c.sanction ?? false]) || []);
      const eudrCountryRiskMap = new Map(
        (countriesData || []).map(c => [c.id, c.country_risk as string | null | undefined])
      );
      const eudrFaoMap = new Map((countriesData || []).map(c => [c.id, c.fao]));

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
          nome_operazione: `Valutazione Rischio del ${formatDataOra} ${specieName} ${paeseName}`
        };

        return {
          user_id: user.id,
          tool_id: EUDR_TOOL_ID,
          session_type: 'analisi_finale',
          parent_session_id: sessionId,
          status: 'in_progress',
          metadata: metadata as unknown as Json
        };
      });

      await supabase.from('assessment_sessions').insert(payloads);

      // Copia tutte le risposte della verifica padre nelle sessioni analisi_finale appena create
      // così i form si riempiono subito (stesso pattern Timber prefill, ma generico su tutte le domande)
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

      // Non copiare sul figlio le domande paese/specie Valutazione Finale: le valorizziamo dopo da metadata (evita righe vuote che mascherano il prefill)
      const eudrPrefillOnlyQuestionIds = new Set<string>([
        EUDR_COUNTRY_PREFILL_QUESTION_IDS.SPECIE,
        EUDR_COUNTRY_PREFILL_QUESTION_IDS.PAESE_RACCOLTA,
      ])

      if (createdEudrSessions?.length && parentRows?.length) {
        const isoDate = new Date().toISOString()
        const prefill: TablesInsert<'user_responses'>[] = []
        for (const sess of createdEudrSessions) {
          for (const row of parentRows) {
            if (eudrPrefillOnlyQuestionIds.has(row.question_id)) continue
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

      // EUDR: prefill da tabella country per ogni sessione analisi_finale (sovrascrive copia padre dove serve)
      const { data: eudrSessionsWithMeta } = await supabase
        .from('assessment_sessions')
        .select('id, metadata')
        .eq('parent_session_id', sessionId)
        .eq('session_type', 'analisi_finale')
        .eq('tool_id', EUDR_TOOL_ID);

      if (eudrSessionsWithMeta?.length) {
        const isoDate = new Date().toISOString();
        const countryPrefill: TablesInsert<'user_responses'>[] = [];

        let qFaoId: string | null = null;
        const { data: faoRow } = await supabase
          .from('questions')
          .select('id')
          .eq('tool_id', EUDR_TOOL_ID)
          .ilike('text', '%FAO Naturally regenerating%')
          .limit(1)
          .maybeSingle();
        if (faoRow?.id) qFaoId = faoRow.id;

        const Q_EUDR_PAESE = EUDR_COUNTRY_PREFILL_QUESTION_IDS.PAESE_RACCOLTA;
        const Q_EUDR_SPECIE = EUDR_COUNTRY_PREFILL_QUESTION_IDS.SPECIE;

        for (const sess of eudrSessionsWithMeta) {
          const meta = sess.metadata as unknown as SessionMetadata | null;
          const countryId = meta?.country;
          const specieId = meta?.specie;
          if (!countryId) continue;

          // 1) Paese di raccolta — id da export Supabase EUDR (come Timber Q_COUNTRY)
          countryPrefill.push({
            user_id: user.id,
            tool_id: EUDR_TOOL_ID,
            session_id: sess.id,
            question_id: Q_EUDR_PAESE,
            answer_text: countryId,
            updated_at: isoDate,
          });
          // 2) Nome specie — id da export Supabase EUDR (come Timber Q_SPECIES)
          if (specieId) {
            countryPrefill.push({
              user_id: user.id,
              tool_id: EUDR_TOOL_ID,
              session_id: sess.id,
              question_id: Q_EUDR_SPECIE,
              answer_text: specieId,
              updated_at: isoDate,
            });
          }

          const hasConflicts = eudrConflictsMap.get(countryId) ?? false;
          const hasSanction = eudrSanctionMap.get(countryId) ?? false;
          countryPrefill.push(
            {
              user_id: user.id,
              tool_id: EUDR_TOOL_ID,
              session_id: sess.id,
              question_id: EUDR_COUNTRY_PREFILL_QUESTION_IDS.CONFLITTI,
              answer_text: hasConflicts ? 'si' : 'no',
              updated_at: isoDate,
            },
            {
              user_id: user.id,
              tool_id: EUDR_TOOL_ID,
              session_id: sess.id,
              question_id: EUDR_COUNTRY_PREFILL_QUESTION_IDS.SANZIONI,
              answer_text: hasSanction ? 'si' : 'no',
              updated_at: isoDate,
            }
          );

          const risk = eudrCountryRiskMap.get(countryId);
          if (risk && ['RB', 'RS', 'RA'].includes(String(risk).toUpperCase())) {
            countryPrefill.push({
              user_id: user.id,
              tool_id: EUDR_TOOL_ID,
              session_id: sess.id,
              question_id: EUDR_COUNTRY_PREFILL_QUESTION_IDS.RISCHIO_PAESE,
              answer_text: String(risk).toUpperCase(),
              updated_at: isoDate,
            });
          }

          const fao = eudrFaoMap.get(countryId);
          if (qFaoId != null && fao != null && typeof fao === 'number') {
            countryPrefill.push({
              user_id: user.id,
              tool_id: EUDR_TOOL_ID,
              session_id: sess.id,
              question_id: qFaoId,
              answer_text: String(fao),
              updated_at: isoDate,
            });
          }
        }

        if (countryPrefill.length > 0) {
          await upsertUserResponses(supabase, countryPrefill)
        }

        // Ultimo passaggio: solo paese + specie (garantisce che nulla nel batch precedente li azzeri)
        const paeseSpecieOnly: TablesInsert<'user_responses'>[] = [];
        for (const sess of eudrSessionsWithMeta) {
          const meta = sess.metadata as unknown as SessionMetadata | null;
          if (!meta?.country) continue;
          paeseSpecieOnly.push({
            user_id: user.id,
            tool_id: EUDR_TOOL_ID,
            session_id: sess.id,
            question_id: EUDR_COUNTRY_PREFILL_QUESTION_IDS.PAESE_RACCOLTA,
            answer_text: meta.country,
            updated_at: isoDate,
          });
          if (meta.specie) {
            paeseSpecieOnly.push({
              user_id: user.id,
              tool_id: EUDR_TOOL_ID,
              session_id: sess.id,
              question_id: EUDR_COUNTRY_PREFILL_QUESTION_IDS.SPECIE,
              answer_text: meta.specie,
              updated_at: isoDate,
            });
          }
        }
        if (paeseSpecieOnly.length > 0) {
          await upsertUserResponses(supabase, paeseSpecieOnly)
        }
      }
    }

    const finalMetadata: SessionMetadata = { 
      nome_commerciale: nomeCommerciale, 
      nome_operazione: nomeCommerciale, 
      is_blocked: false,
      ...warningData
    };

    await supabase.from('assessment_sessions').update({
      status: 'completed',
      final_outcome: 'Verifica Completata',
      metadata: finalMetadata as unknown as Json 
    }).eq('id', sessionId);

    if (currentPairs.length === 1) {
      const { data: singleSession } = await supabase.from('assessment_sessions')
        .select('id').eq('parent_session_id', sessionId).eq('session_type', 'analisi_finale').single();
      if (singleSession) {
        return { redirectUrl: `/EUDR/valutazione-finale?session_id=${singleSession.id}` };
      }
    }

    return { redirectUrl: '/EUDR/search' };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Errore elaborazione workflow" }
  }
}