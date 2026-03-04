'use server'

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database, TablesInsert } from "@/types/supabase"
import { TIMBER_TOOL_ID } from "@/lib/constants"

export async function processTimberValutazione(sessionId: string): Promise<{ redirectUrl?: string, error?: string }> {
  const cookieStore = await cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autenticato" }

  try {
    const TARGET_QUESTION_ID = '23ea972c-e1bd-459b-a8e0-3d0376539e96';

    const { data: responses, error: fetchError } = await supabase
      .from('user_responses')
      .select('answer_json')
      .eq('session_id', sessionId)
      .eq('question_id', TARGET_QUESTION_ID)
      .not('answer_json', 'is', null)

    if (fetchError) throw fetchError;

    // 🛠️ 1. Costruiamo l'array delle COMBINAZIONI [Specie + Paese] attuali
    const allPairs: string[] = [];
    const pairDetails: Record<string, { specie_id: string, paese_id: string }> = {};
    
    responses?.forEach(res => {
      const jsonArr = res.answer_json;
      if (Array.isArray(jsonArr)) {
        jsonArr.forEach(item => {
          if (typeof item === 'object' && item !== null && 'paesi_id' in item && 'specie_id' in item) {
             const itemRecord = item as Record<string, unknown>;
             const paesiStr = String(itemRecord.paesi_id || '');
             const specieStr = String(itemRecord.specie_id || '');
             
             if (paesiStr && specieStr) {
                 const paesiList = paesiStr.split(',').map(p => p.trim()).filter(Boolean);
                 // Creiamo una combinazione unica per ogni specie e paese
                 paesiList.forEach(paese_id => {
                     const pairKey = `${specieStr}_${paese_id}`;
                     allPairs.push(pairKey);
                     pairDetails[pairKey] = { specie_id: specieStr, paese_id };
                 });
             }
          }
        })
      }
    });

    const currentPairs = [...new Set(allPairs)];

    // 2. RECUPERO STORICO: Controlliamo le "Analisi Finali" GIA' ESISTENTI per questa Verifica
    const { data: existingSessions, error: existingError } = await supabase
      .from('assessment_sessions')
      .select('id, metadata')
      .eq('parent_session_id', sessionId)
      .eq('session_type', 'analisi_finale');

    if (existingError) throw existingError;

    // 🛠️ Recuperiamo le combinazioni [Specie + Paese] storiche
    const existingPairs = (existingSessions || []).map(s => {
       const meta = s.metadata as { country?: string, specie?: string } | null;
       // Nota: Se ci sono vecchie sessioni senza la Specie salvata, questo le farà rigenerare formattate bene
       if (!meta?.country) return null;
       return meta.specie ? `${meta.specie}_${meta.country}` : `NO_SPECIE_${meta.country}`;
    }).filter((c): c is string => Boolean(c));

    // 3. LOGICA DI CONFRONTO
    const removedPairs = existingPairs.filter(p => !currentPairs.includes(p));
    const addedPairs = currentPairs.filter(p => !existingPairs.includes(p));

    let pairsToCreate: string[] = [];

    if (removedPairs.length > 0) {
        // Se l'utente ha tolto o modificato qualcosa, resettiamo e ricreiamo tutto pulito
        const { error: deleteError } = await supabase
            .from('assessment_sessions')
            .delete()
            .eq('parent_session_id', sessionId)
            .eq('session_type', 'analisi_finale');

        if (deleteError) throw deleteError;
        pairsToCreate = currentPairs;

    } else if (addedPairs.length > 0) {
        // Se ha solo aggiunto nuove specie/paesi, creiamo solo quelle nuove
        pairsToCreate = addedPairs;
    } else {
        pairsToCreate = [];
    }

    if (currentPairs.length === 0) {
        return { redirectUrl: '/timberRegulation/search' };
    }

    // 🛠️ 4. CREAZIONE DELLE SESSIONI MANCANTI E NOMENCLATURA
    if (pairsToCreate.length > 0) {
        
      // A. Estraiamo gli ID unici da cercare nel DB
      const specieIdsToFetch = [...new Set(pairsToCreate.map(p => pairDetails[p].specie_id))];
      const paeseIdsToFetch = [...new Set(pairsToCreate.map(p => pairDetails[p].paese_id))];

      // B. Andiamo a prendere i NOMI REALI dal database (in parallelo per essere veloci)
      const [{ data: speciesData }, { data: countriesData }] = await Promise.all([
          supabase.from('species').select('id, common_name').in('id', specieIdsToFetch),
          supabase.from('country').select('id, country_name').in('id', paeseIdsToFetch)
      ]);

      // Mettiamo i nomi in una mappa per recuperarli facilmente
      const speciesMap = new Map(speciesData?.map(s => [s.id, s.common_name]) || []);
      const countriesMap = new Map(countriesData?.map(c => [c.id, c.country_name]) || []);

      // C. Creiamo il timestamp formattato in ora italiana (es. 18-02-2026 15:01:18)
      const nowStr = new Intl.DateTimeFormat('it-IT', { 
        timeZone: 'Europe/Rome', 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
      }).format(new Date()); 
      const formatDataOra = nowStr.replace(/\//g, '-').replace(', ', ' ');

      // D. Costruiamo i payload da salvare nel database
      const payloads: TablesInsert<'assessment_sessions'>[] = pairsToCreate.map(pairKey => {
        const { specie_id, paese_id } = pairDetails[pairKey];
        
        const specieName = speciesMap.get(specie_id) || "Specie Sconosciuta";
        const paeseName = countriesMap.get(paese_id) || "Paese Sconosciuto";

        return {
            user_id: user.id,
            tool_id: TIMBER_TOOL_ID,
            session_type: 'analisi_finale',
            parent_session_id: sessionId,
            status: 'in_progress',
            metadata: { 
                country: paese_id,
                specie: specie_id, // 🛠️ Salviamo anche la specie nel metadata per i confronti futuri
                // 🛠️ ECCO IL FORMATO RICHIESTO
                nome_operazione: `Valutazione Rischio del ${formatDataOra} ${specieName} ${paeseName}`
            }
        };
      });

      const { error: insertError } = await supabase.from('assessment_sessions').insert(payloads);
      if (insertError) throw insertError;
    }
    
    // 5. DECISIONE REDIRECT FRONTEND
    if (currentPairs.length === 1) {
       const { data: singleSession } = await supabase
         .from('assessment_sessions')
         .select('id')
         .eq('parent_session_id', sessionId)
         .eq('session_type', 'analisi_finale')
         .single();
         
       if (singleSession) {
          return { redirectUrl: `/timberRegulation/valutazione-finale?session_id=${singleSession.id}` };
       }
    }

    return { redirectUrl: '/timberRegulation/search' };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Errore elaborazione workflow";
    return { error: msg };
  }
}