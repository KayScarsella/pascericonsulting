-- EUDR: update question texts, remove struck questions, adjust section titles/logic.
-- Certification Q4 already hidden when FSC/PEFC = No via section silent stop_section.

-- ── A) Section titles: drop letter prefixes (PDF no longer re-letters) ──
UPDATE public.sections
SET title = regexp_replace(trim(title), '^[A-H]\s*\)\s*', '', 'i')
WHERE tool_id = '69d3d115-acc1-49f3-8d39-a003df7145be'
  AND title ~* '^[A-H]\s*\)';

-- ── B) Applicability logic: drop agente-based CASO 7/8; substitute OPERATORE rule ──
UPDATE public.sections
SET logic_rules = COALESCE(
  (
    SELECT jsonb_agg(elem ORDER BY ord)
    FROM jsonb_array_elements(COALESCE(logic_rules, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
    WHERE NOT (
      elem->'conditions' @> '[{"question_id":"4ae1429a-4eaf-4bde-b357-61d49fa620b7"}]'::jsonb
    )
  ),
  '[]'::jsonb
) || jsonb_build_array(
  jsonb_build_object(
    'action', 'stop_section',
    'comment', 'CASO 7/8 sostitutivo: senza domanda agente → OPERATORE (analisi rischi)',
    'message', 'Il prodotto è soggetto al Regolamento UE 1115/2023 (EUDR) ZERO DEFORESTAZIONE. Attività eseguita in qualità di OPERATORE. Per tale approvvigionamento DEVE ESSERE ESEGUITA un''analisi dei rischi. Si ricorda di generare il cod. N° TRACES',
    'variant', 'warning',
    'conditions', jsonb_build_array(
      jsonb_build_object(
        'value', '3',
        'operator', 'neq',
        'question_id', '552f0207-b8ae-4989-8e8b-9c86dd0351f4'
      ),
      jsonb_build_object(
        'value', 'no',
        'operator', 'eq',
        'question_id', 'ff1527a0-8d4d-4b3d-8b66-11b668d66bd7'
      )
    )
  )
)
WHERE id = '915f7f72-5964-4698-9fb1-63a9ac8b99e6';

-- ── C) Text updates (diritti terzi + legislazione + catena) ──
UPDATE public.questions
SET text = '1) Sono rispettati i requisiti legali relativi alla salute e alla sicurezza sul lavoro nelle attività connesse alla raccolta, trasformazione e fornitura del legname?'
WHERE id = 'a3b4c5d6-e7f8-4a9b-8c0d-1e2f3a4b5c31';

UPDATE public.questions
SET text = '2) I diritti umani tutelati dal diritto internazionale e dal diritto nazionale sono rispettati lungo la catena di approvvigionamento del prodotto interessato?'
WHERE id = 'd7e8f9a0-b1c2-4d3e-9f4a-5b6c7d8e9f42';

UPDATE public.questions
SET text = '3) Sono rispettati i diritti dei Popoli Tradizionali, delle popolazioni indigene e delle comunità locali, compresi il possesso e la gestione della terra e i principi della FPIC, e non risultano segnalazioni debitamente motivate, basate su informazioni oggettive e verificabili, riguardanti l''uso o la proprietà della superficie utilizzata ai fini della produzione della materia prima?'
WHERE id = 'b8c9d0e1-f2a3-4b4c-8d5e-9f0a1b2c3d53';

UPDATE public.questions
SET text = '1) Evidenze su diritti d''uso del suolo, tutela ambiente, norme forestali'
WHERE id = 'd3e4f5a6-b7c8-4d9e-8f0a-1b2c3d4e5f81';

UPDATE public.questions
SET
  text = '2) esistenza di evidenze sul rispetto delle leggi applicabili nel paese di produzione per quanto riguarda lo status giuridico della zona di produzione in termini di: disciplina fiscale, sull''anticorruzione, commerciale, doganale e l''assenza di pratiche di falsificazione di documenti e dati.',
  order_index = 20
WHERE id = 'e8f9a0b1-c2d3-4e4f-8a9b-5c6d7e8f9a25';

UPDATE public.questions
SET
  text = '3) esistenza di informazioni adeguatamente probanti e verificabili secondo cui i prodotti interessati sono a deforestazione zero',
  order_index = 30
WHERE id = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d36';

-- Complessità della catena: replaces "numero imprese" (+ delete paesi Q)
UPDATE public.questions
SET
  text = '4) Complessità della catena',
  type = 'select',
  config = jsonb_build_object(
    'options', jsonb_build_array(
      jsonb_build_object(
        'label', 'Semplice (meno di 4 fornitori extraUE e 1 paese extraUE)',
        'value', 'semplice'
      ),
      jsonb_build_object(
        'label', 'Non semplice (4 o più fornitori extraUE e/o più di 1 paese extraUE)',
        'value', 'non_semplice'
      )
    ),
    'optional', false
  )
WHERE id = 'a5b6c7d8-e9f0-4a1b-9c2d-3e4f5a6b7c81';

-- ── D) Clean mitigation rows then hard-delete struck questions (CASCADE clears user_responses) ──
DELETE FROM public.mitigation_history
WHERE question_id IN (
  '4ae1429a-4eaf-4bde-b357-61d49fa620b7',
  'e2f3a4b5-c6d7-4e8f-9a0b-1c2d3e4f5a64',
  'f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f7a8b92',
  'a4b5c6d7-e8f9-4a0b-9c1d-2e3f4a5b6c03',
  'c7d8e9f0-a1b2-4c3d-9e4f-5a6b7c8d9e14',
  'd5e6f7a8-b9c0-4d1e-9f2a-3c4d5e6f7a47',
  'c8d9e0f1-a2b3-4c4d-9e5f-6a7b8c9d0e92'
);

DELETE FROM public.questions
WHERE id IN (
  '4ae1429a-4eaf-4bde-b357-61d49fa620b7', -- 7) agente fuori UE
  'e2f3a4b5-c6d7-4e8f-9a0b-1c2d3e4f5a64', -- segnalazioni popoli
  'f6a7b8c9-d0e1-4f2a-9b3c-4d5e6f7a8b92', -- tutela ambiente
  'a4b5c6d7-e8f9-4a0b-9c1d-2e3f4a5b6c03', -- norme foreste
  'c7d8e9f0-a1b2-4c3d-9e4f-5a6b7c8d9e14', -- rispetto legislazione
  'd5e6f7a8-b9c0-4d1e-9f2a-3c4d5e6f7a47', -- preoccupazioni paese
  'c8d9e0f1-a2b3-4c4d-9e5f-6a7b8c9d0e92'  -- numero paesi extra-UE
);
