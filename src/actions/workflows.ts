'use server'

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database, TablesInsert, Json } from "@/types/supabase" // 🛠️ Importato Json e Database
import { TIMBER_TOOL_ID, EUDR_TOOL_ID } from "@/lib/constants"
import { SessionMetadata } from "@/types/session" // 🛠️ Importata la nostra nuova interfaccia
import { calculateRisk, SCORED_QUESTIONS, getCanonicalValueForRiskQuestion } from "@/lib/risk-calculator"
import {
  calculateEudrRisk,
  EUDR_SCORED_QUESTIONS,
  getCanonicalValueForEudrRiskQuestion,
} from "@/lib/eudr-risk-calculator"
import { validateSessionAccess } from "@/actions/questions"


export async function processPrimaFaseTimber(
  sessionId: string,
  exceptionData?: { isBlocked: boolean; blockReason: string; blockVariant: 'success' | 'warning' | 'error' }
): Promise<{ redirectUrl?: string, error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )

  try {
    await validateSessionAccess(supabase, TIMBER_TOOL_ID, sessionId)
    // ── 1. CASO ESENTE (Success) -> Chiudiamo l'analisi e andiamo all'archivio ──
    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'success') {
      
      const metadata: SessionMetadata = {
        is_blocked: true,
        block_reason: exceptionData.blockReason,
        block_variant: 'success'
      };

      await supabase.from('assessment_sessions').update({
        status: 'completed', // L'analisi è considerata chiusa
        final_outcome: 'Esente / Non Soggetto', // Apparirà così nella tabella Cerca
        metadata: metadata as unknown as Json
      }).eq('id', sessionId);

      return { redirectUrl: '/timberRegulation/search' }; // Fine della corsa.
    }

    // ── 2. CASO SOGGETTO (Warning) OPPURE NESSUN BLOCCO -> Andiamo ad Evaluation ──
    // Se è un "warning" (es. Proprietario Forestale) o se l'utente non ha innescato nessuna regola,
    // significa che DEVE fare l'analisi. Lo mandiamo alla pagina "evaluation".
    
    // Aggiorniamo il metadata per tenere traccia dell'avviso (opzionale)
    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'warning') {
        const metadata: SessionMetadata = {
            is_blocked: false, // Non blocchiamo il workflow
            block_reason: exceptionData.blockReason, // Salviamo il motivo dell'alert
            block_variant: 'warning'
        };
        await supabase.from('assessment_sessions').update({
            metadata: metadata as unknown as Json
        }).eq('id', sessionId);
    }

    // Rimandiamo l'utente alla pagina successiva con nuove domande!
    return { redirectUrl: `/timberRegulation/evaluation?session_id=${sessionId}` };

  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Errore elaborazione workflow" };
  }
}

// ── EUDR: Prima fase (Analisi Rischio) → redirect a Evaluation o Search ───────
export async function processPrimaFaseEUDR(
  sessionId: string,
  exceptionData?: { isBlocked: boolean; blockReason: string; blockVariant: 'success' | 'warning' | 'error' }
): Promise<{ redirectUrl?: string, error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )

  try {
    await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)

    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'success') {
      const metadata: SessionMetadata = {
        is_blocked: true,
        block_reason: exceptionData.blockReason,
        block_variant: 'success'
      }
      await supabase.from('assessment_sessions').update({
        status: 'completed',
        final_outcome: 'Esente / Non Soggetto',
        metadata: metadata as unknown as Json
      }).eq('id', sessionId)
      return { redirectUrl: '/EUDR/search' }
    }

    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'warning') {
      const metadata: SessionMetadata = {
        is_blocked: false,
        block_reason: exceptionData.blockReason,
        block_variant: 'warning'
      }
      await supabase.from('assessment_sessions').update({
        metadata: metadata as unknown as Json
      }).eq('id', sessionId)
    }

    return { redirectUrl: `/EUDR/evaluation?session_id=${sessionId}` }
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Errore elaborazione workflow" }
  }
}

// ── EUDR: Valutazione → completa sessione e redirect a Search ─────────────────
export async function processEudrValutazione(
  sessionId: string,
  exceptionData?: { isBlocked: boolean; blockReason: string; blockVariant: 'success' | 'warning' | 'error' }
): Promise<{ redirectUrl?: string, error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )

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

    const nomeCommRes = responses?.find(r => r.question_id === NOME_COMMERCIALE_ID);
    let extractedName = nomeCommRes?.answer_text;

    if (!extractedName && typeof nomeCommRes?.answer_json === 'object' && nomeCommRes?.answer_json !== null && !Array.isArray(nomeCommRes.answer_json)) {
      const jsonObj = nomeCommRes.answer_json as Record<string, Json>;
      extractedName = String(jsonObj.value || jsonObj.text || '');
    }
    const nomeCommerciale = extractedName || "Operazione Senza Nome";

    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'success') {
      const metadata: SessionMetadata = {
        nome_commerciale: nomeCommerciale,
        nome_operazione: nomeCommerciale,
        is_blocked: true,
        block_reason: exceptionData.blockReason,
        block_variant: 'success'
      };

      await supabase.from('assessment_sessions').update({
        status: 'completed',
        final_outcome: 'Esente / Non Soggetto',
        metadata: metadata as unknown as Json
      }).eq('id', sessionId);

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
        supabase.from('country').select('id, country_name').in('id', paeseIdsToFetch)
      ]);

      const speciesMap = new Map(speciesData?.map(s => [s.id, s.common_name]) || []);
      const countriesMap = new Map(countriesData?.map(c => [c.id, c.country_name]) || []);

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

      if (createdEudrSessions?.length && parentRows?.length) {
        const isoDate = new Date().toISOString()
        const prefill: TablesInsert<'user_responses'>[] = []
        for (const sess of createdEudrSessions) {
          for (const row of parentRows) {
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
          await supabase.from('user_responses').upsert(prefill, { onConflict: 'session_id, question_id' })
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

// ── 1. GESTIONE VERIFICA PRELIMINARE E PRE-FILL ──────────────────────────────
export async function processTimberValutazione(
  sessionId: string,
  exceptionData?: { isBlocked: boolean; blockReason: string; blockVariant: 'success' | 'warning' | 'error' }
): Promise<{ redirectUrl?: string, error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  try {
    await validateSessionAccess(supabase, TIMBER_TOOL_ID, sessionId)
    const TARGET_QUESTION_ID = '23ea972c-e1bd-459b-a8e0-3d0376539e96'; // Array Specie-Paesi
    const NOME_COMMERCIALE_ID = '8e2d4d57-161c-4f37-8089-04ab947389e1'; // Domanda Nome Commerciale

    const { data: responses, error: fetchError } = await supabase
      .from('user_responses')
      .select('question_id, answer_text, answer_json')
      .eq('session_id', sessionId)
      .in('question_id', [TARGET_QUESTION_ID, NOME_COMMERCIALE_ID])

    if (fetchError) throw fetchError;

    // Estrazione del Nome Commerciale 
    const nomeCommRes = responses?.find(r => r.question_id === NOME_COMMERCIALE_ID);
    let extractedName = nomeCommRes?.answer_text;
    
    if (!extractedName && typeof nomeCommRes?.answer_json === 'object' && nomeCommRes?.answer_json !== null && !Array.isArray(nomeCommRes.answer_json)) {
        const jsonObj = nomeCommRes.answer_json as Record<string, Json>;
        extractedName = String(jsonObj.value || jsonObj.text || '');
    }
    const nomeCommerciale = extractedName || "Operazione Senza Nome";

    // 🛠️ CASO 1: Esente (Success) - Chiudiamo e fermiamo l'analisi
    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'success') {
      const metadata: SessionMetadata = {
        nome_commerciale: nomeCommerciale,
        nome_operazione: nomeCommerciale,
        is_blocked: true,
        block_reason: exceptionData.blockReason,
        block_variant: 'success'
      };

      await supabase.from('assessment_sessions').update({
        status: 'completed',
        final_outcome: 'Esente / Non Soggetto',
        metadata: metadata as unknown as Json 
      }).eq('id', sessionId);

      return { redirectUrl: '/timberRegulation/search' };
    }

    // 🛠️ CASO 2: Warning - Appuntiamo l'avviso ma andiamo avanti
    let warningData = {};
    if (exceptionData?.isBlocked && exceptionData.blockVariant === 'warning') {
        warningData = {
            block_reason: exceptionData.blockReason,
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
        // Se non ci sono specie inserite e non era esente, lo rimandiamo fuori
        return { redirectUrl: '/timberRegulation/search' };
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
          await supabase.from('user_responses').upsert(prefillPayloads, { onConflict: 'session_id, question_id' });
        }
      }
    }

    // Aggiorniamo la Verifica madre segnandola come completata
    const finalMetadata: SessionMetadata = { 
        nome_commerciale: nomeCommerciale, 
        nome_operazione: nomeCommerciale, 
        is_blocked: false, // I figli sono stati creati!
        ...warningData     // Salviamo l'eventuale warning
    };

    await supabase.from('assessment_sessions').update({
      status: 'completed',
      final_outcome: 'Verifica Completata',
      metadata: finalMetadata as unknown as Json 
    }).eq('id', sessionId);

    // Redirect al form figlio se ce n'è solo 1
    if (currentPairs.length === 1) {
      const { data: singleSession } = await supabase.from('assessment_sessions')
        .select('id').eq('parent_session_id', sessionId).eq('session_type', 'analisi_finale').single();
      if (singleSession) {
        return { redirectUrl: `/timberRegulation/valutazione-finale?session_id=${singleSession.id}` };
      }
    }

    return { redirectUrl: '/timberRegulation/search' };

  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Errore elaborazione workflow" };
  }
}

// ── 2. CONCLUSIONE ANALISI FINALE (CALCOLO RISCHIO CENTRALIZZATO) ─────────────
export async function finalizeTimberAnalisi(sessionId: string): Promise<{ redirectUrl?: string, error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )

  try {
    await validateSessionAccess(supabase, TIMBER_TOOL_ID, sessionId)
    const { data: responses } = await supabase
      .from('user_responses')
      .select('question_id, answer_text')
      .eq('session_id', sessionId);

    const answersMap: Record<string, string | null> = {};
    responses?.forEach(r => { answersMap[r.question_id] = r.answer_text });

    const riskResult = calculateRisk(answersMap);

    const { data: sessionData } = await supabase.from('assessment_sessions').select('metadata').eq('id', sessionId).single();
    
    const oldMeta = (sessionData?.metadata as unknown as SessionMetadata) || {};

    const updatedMeta: SessionMetadata = {
      ...oldMeta,
      risk_score: riskResult.overallRisk,
      expiry_date: riskResult.expiryDate || undefined
    };

    await supabase.from('assessment_sessions').update({
      status: 'completed',
      final_outcome: riskResult.outcome === 'accettabile' ? 'Rischio Accettabile' : 'Rischio Non Accettabile',
      metadata: updatedMeta as unknown as Json 
    }).eq('id', sessionId);

    return { redirectUrl: `/timberRegulation/risultato?session_id=${sessionId}` };
  } catch (e) {
    return { error: "Errore durante il calcolo del rischio" };
  }
}

// ── EUDR: CONCLUSIONE ANALISI FINALE (calcolo rischio + metadata come timber) ─
export async function finalizeEudrAnalisi(sessionId: string): Promise<{ redirectUrl?: string, error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )

  try {
    await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)

    const { data: sessionRow } = await supabase
      .from("assessment_sessions")
      .select("parent_session_id, metadata")
      .eq("id", sessionId)
      .single()

    const answersMap: Record<string, string | null> = {}
    if (sessionRow?.parent_session_id) {
      const { data: parentResponses } = await supabase
        .from("user_responses")
        .select("question_id, answer_text")
        .eq("session_id", sessionRow.parent_session_id)
      parentResponses?.forEach((r) => {
        answersMap[r.question_id] = r.answer_text
      })
    }
    const { data: childResponses } = await supabase
      .from("user_responses")
      .select("question_id, answer_text")
      .eq("session_id", sessionId)
    childResponses?.forEach((r) => {
      answersMap[r.question_id] = r.answer_text
    })

    const riskResult = calculateEudrRisk(answersMap)
    const oldMeta = (sessionRow?.metadata as Record<string, unknown>) || {}
    const updatedMeta: Record<string, unknown> = {
      ...oldMeta,
      risk_score: riskResult.overallRisk,
      risk_details: riskResult.details.map((d) => ({
        shortLabel: d.shortLabel,
        riskIndex: d.riskIndex,
      })),
      expiry_date: riskResult.expiryDate || undefined,
      completed_at: new Date().toISOString(),
    }

    await supabase
      .from("assessment_sessions")
      .update({
        status: "completed",
        final_outcome:
          riskResult.outcome === "accettabile"
            ? "Rischio Accettabile"
            : "Rischio Non Accettabile",
        metadata: updatedMeta as Json,
      })
      .eq("id", sessionId)

    return { redirectUrl: `/EUDR/risultato?session_id=${sessionId}` }
  } catch (e) {
    return { error: "Errore durante la conclusione dell'analisi finale EUDR" }
  }
}

// ── 3. SALVATAGGIO MITIGAZIONE E RICALCOLO AUTOMATICO ─────────────────────────
export type MitigationInput = {
  questionId: string
  newAnswer: string
  comment?: string | null
  filePath?: string | null
}

export async function saveMitigation(
  sessionId: string,
  mitigations: MitigationInput[]
): Promise<{ redirectUrl?: string; error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  const { sessionOwnerId } = await validateSessionAccess(supabase, TIMBER_TOOL_ID, sessionId)
  // Owner or tool admin can save mitigations (validateSessionAccess already allows admin)

  try {
    const scoredIds = new Set(SCORED_QUESTIONS.map((q) => q.id))
    const questionIds = mitigations.map((m) => m.questionId)
    const { data: currentResponses } = await supabase.from('user_responses')
      .select('question_id, answer_text').eq('session_id', sessionId).in('question_id', questionIds)

    const currentAnswersMap: Record<string, string | null> = {}
    currentResponses?.forEach((r) => (currentAnswersMap[r.question_id] = r.answer_text))

    const now = new Date().toISOString()

    // Normalize newAnswer to canonical code for risk questions (so DB always has value, not label)
    const normalizedMitigations = mitigations.map((m) => {
      const canonical =
        scoredIds.has(m.questionId) ? getCanonicalValueForRiskQuestion(m.questionId, m.newAnswer) : m.newAnswer
      return { ...m, newAnswer: canonical }
    })

    const upsertPayloads: TablesInsert<'user_responses'>[] = normalizedMitigations.map((m) => ({
      user_id: sessionOwnerId,
      tool_id: TIMBER_TOOL_ID,
      session_id: sessionId,
      question_id: m.questionId,
      answer_text: m.newAnswer,
      updated_at: now,
    }))

    // Upsert prima: se fallisce (es. RLS) non scriviamo mitigation_history e non lasciamo dati incoerenti
    const { error: upsertError } = await supabase.from('user_responses').upsert(upsertPayloads, { onConflict: 'session_id, question_id' })
    if (upsertError) throw new Error(`user_responses: ${upsertError.message}`)

    const historyPayloads: TablesInsert<'mitigation_history'>[] = normalizedMitigations.map((m) => ({
      session_id: sessionId,
      question_id: m.questionId,
      previous_answer: currentAnswersMap[m.questionId] ?? null,
      new_answer: m.newAnswer,
      mitigated_at: now,
      comment: m.comment ?? null,
      file_path: m.filePath ?? null,
    }))

    const { error: historyError } = await supabase.from('mitigation_history').insert(historyPayloads)
    if (historyError) throw new Error(`mitigation_history: ${historyError.message}`)

    const finalizeResult = await finalizeTimberAnalisi(sessionId)
    if (finalizeResult.error) throw new Error(`finalize: ${finalizeResult.error}`)

    return { redirectUrl: `/timberRegulation/risultato?session_id=${sessionId}` }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore durante il salvataggio della mitigazione"
    return { error: message }
  }
}

/** EUDR mitigazione: stesso flusso di saveMitigation ma tool_id e SCORED_QUESTIONS EUDR */
export async function saveEudrMitigation(
  sessionId: string,
  mitigations: MitigationInput[]
): Promise<{ redirectUrl?: string; error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  const { sessionOwnerId } = await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)

  try {
    const scoredIds = new Set(EUDR_SCORED_QUESTIONS.map((q) => q.id))
    const questionIds = mitigations.map((m) => m.questionId)
    const { data: currentResponses } = await supabase
      .from("user_responses")
      .select("question_id, answer_text")
      .eq("session_id", sessionId)
      .in("question_id", questionIds)

    const currentAnswersMap: Record<string, string | null> = {}
    currentResponses?.forEach((r) => {
      currentAnswersMap[r.question_id] = r.answer_text
    })

    const now = new Date().toISOString()
    const normalizedMitigations = mitigations.map((m) => {
      const canonical = scoredIds.has(m.questionId)
        ? getCanonicalValueForEudrRiskQuestion(m.questionId, m.newAnswer)
        : m.newAnswer
      return { ...m, newAnswer: canonical }
    })

    const upsertPayloads: TablesInsert<"user_responses">[] = normalizedMitigations.map((m) => ({
      user_id: sessionOwnerId,
      tool_id: EUDR_TOOL_ID,
      session_id: sessionId,
      question_id: m.questionId,
      answer_text: m.newAnswer,
      updated_at: now,
    }))

    const { error: upsertError } = await supabase
      .from("user_responses")
      .upsert(upsertPayloads, { onConflict: "session_id, question_id" })
    if (upsertError) throw new Error(`user_responses: ${upsertError.message}`)

    const historyPayloads: TablesInsert<"mitigation_history">[] = normalizedMitigations.map((m) => ({
      session_id: sessionId,
      question_id: m.questionId,
      previous_answer: currentAnswersMap[m.questionId] ?? null,
      new_answer: m.newAnswer,
      mitigated_at: now,
      comment: m.comment ?? null,
      file_path: m.filePath ?? null,
    }))

    const { error: historyError } = await supabase
      .from("mitigation_history")
      .insert(historyPayloads)
    if (historyError) throw new Error(`mitigation_history: ${historyError.message}`)

    const finalizeResult = await finalizeEudrAnalisi(sessionId)
    if (finalizeResult.error) throw new Error(`finalize: ${finalizeResult.error}`)

    return { redirectUrl: `/EUDR/risultato?session_id=${sessionId}` }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore durante il salvataggio della mitigazione"
    return { error: message }
  }
}

/** Upload a file for mitigation and return storage path. Only session owner or tool admin. */
export async function uploadMitigationFile(
  formData: FormData,
  sessionId: string,
  questionId: string
): Promise<{ path?: string; error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  await validateSessionAccess(supabase, TIMBER_TOOL_ID, sessionId)

  const file = formData.get('file') as File
  if (!file) return { error: "File mancante" }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = `${user.id}/mitigations/${sessionId}/${questionId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage
    .from('user-uploads')
    .upload(storagePath, file)

  if (error) return { error: error.message }
  return { path: storagePath }
}

/** Upload mitigation file for EUDR session */
export async function uploadEudrMitigationFile(
  formData: FormData,
  sessionId: string,
  questionId: string
): Promise<{ path?: string; error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)

  const file = formData.get("file") as File
  if (!file) return { error: "File mancante" }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_")
  const storagePath = `${user.id}/mitigations/${sessionId}/${questionId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage.from("user-uploads").upload(storagePath, file)
  if (error) return { error: error.message }
  return { path: storagePath }
}

/** Get signed download URL for a mitigation file. Only session owner or tool admin. */
export async function getMitigationFileDownloadUrl(
  sessionId: string,
  filePath: string
): Promise<{ signedUrl?: string; error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  // Session may be timber or EUDR analisi_finale
  try {
    await validateSessionAccess(supabase, TIMBER_TOOL_ID, sessionId)
  } catch {
    await validateSessionAccess(supabase, EUDR_TOOL_ID, sessionId)
  }
  if (!filePath.includes('/mitigations/')) return { error: "Percorso non valido" }

  const { data, error } = await supabase.storage
    .from('user-uploads')
    .createSignedUrl(filePath, 60, { download: true })

  if (error) return { error: error.message }
  return { signedUrl: data.signedUrl }
}