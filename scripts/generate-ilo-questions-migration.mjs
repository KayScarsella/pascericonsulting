/**
 * Generates supabase/migrations/*_fsc_ilo_sections_questions.sql from seed definition.
 * Run: node scripts/generate-ilo-questions-migration.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const CLOUD_FSC_TOOL_ID = '50cd9969-0300-4d41-b807-1a88088d07e1'
const GROUP = 'Autovalutazione ILO'

const SECTION_IDS = {
  ATTESTAZIONE: 'b0100001-0001-4000-8000-000000000001',
  ORGANIZZAZIONE: 'b0100001-0001-4000-8000-000000000002',
  CLR_72: 'b0100001-0001-4000-8000-000000000003',
  CLR_73: 'b0100001-0001-4000-8000-000000000004',
  CLR_74: 'b0100001-0001-4000-8000-000000000005',
  CLR_75: 'b0100001-0001-4000-8000-000000000006',
  TERZISTI: 'b0100001-0001-4000-8000-000000000007',
}

const YES_NO = [
  { label: 'Sì', value: 'si' },
  { label: 'No', value: 'no' },
]

function yesNoQuestion(id, sectionId, text, exportKey, orderIndex, optional = false) {
  return {
    id,
    section_id: sectionId,
    text,
    type: 'select',
    order_index: orderIndex,
    config: {
      options: YES_NO,
      export_key: exportKey,
      optional,
    },
  }
}

function textQuestion(id, sectionId, text, exportKey, orderIndex, opts = {}) {
  return {
    id,
    section_id: sectionId,
    text,
    type: 'text',
    order_index: orderIndex,
    config: {
      export_key: exportKey,
      optional: opts.optional ?? false,
      multiline: opts.multiline ?? false,
      placeholder: opts.placeholder,
    },
  }
}

function numberQuestion(id, sectionId, text, exportKey, orderIndex) {
  return {
    id,
    section_id: sectionId,
    text,
    type: 'number',
    order_index: orderIndex,
    config: { export_key: exportKey },
  }
}

function evidenceQuestion(id, sectionId, text, exportKey, orderIndex, options) {
  return {
    id,
    section_id: sectionId,
    text,
    type: 'select',
    order_index: orderIndex,
    config: {
      is_multi: true,
      export_key: exportKey,
      placeholder: 'Seleziona le evidenze applicabili...',
      optional: true,
      options,
    },
  }
}

const WORKFORCE_ROWS = [
  { key: 'operai', label: 'Operai' },
  { key: 'impiegati', label: 'Impiegati' },
  { key: 'quadri', label: 'Quadri' },
  { key: 'dirigenti', label: 'Dirigenti' },
  { key: 'totale', label: 'Totale' },
]

const WORKFORCE_COLS = [
  { key: 'm', label: 'Uomini' },
  { key: 'f', label: 'Donne' },
  { key: 'it', label: 'Naz. italiana' },
  { key: 'foreign', label: 'Naz. straniera' },
  { key: 'age_under16', label: '< 16 anni' },
  { key: 'age_16_18', label: '16-18 anni' },
  { key: 'age_18_25', label: '18-25 anni' },
  { key: 'age_25_29', label: '25-29 anni' },
  { key: 'age_29_50', label: '29-50 anni' },
  { key: 'age_over50', label: '> 50 anni' },
]

function buildWorkforceFields() {
  const fields = []
  for (const row of WORKFORCE_ROWS) {
    for (const col of WORKFORCE_COLS) {
      fields.push({
        key: `qual_${row.key}_${col.key}`,
        label: `${row.label} — ${col.label}`,
      })
    }
  }
  return fields
}

const EVIDENCE_72E = [
  { label: 'Politica occupazionale e procedure di assunzione (verifica età)', value: 'politica' },
  { label: 'Registri dipendenti (età e documenti identità)', value: 'registri' },
  { label: 'Contratti o accordi di lavoro / agenzie', value: 'contratti' },
  { label: 'Contratti per assunzione minori (se applicabile)', value: 'minori' },
  { label: 'Altro', value: 'altro' },
]

const EVIDENCE_73F = [
  { label: 'Politica e procedure su lavoro forzato', value: 'politica' },
  { label: 'Registri presenze e retribuzioni', value: 'registri' },
  { label: 'Contratti di lavoro', value: 'contratti' },
  { label: 'Procedure reclami lavoratori', value: 'reclami' },
  { label: 'Verifiche fornitori/terzisti', value: 'terzisti' },
  { label: 'Formazione del personale', value: 'formazione' },
  { label: 'Audit interni', value: 'audit' },
  { label: 'Altro', value: 'altro' },
]

const EVIDENCE_74E = [
  { label: 'Politica pari opportunità / anti-discriminazione', value: 'politica' },
  { label: 'Procedure di assunzione e promozione', value: 'assunzione' },
  { label: 'Retribuzione e benefit', value: 'retribuzione' },
  { label: 'Formazione anti-discriminazione', value: 'formazione' },
  { label: 'Procedure reclami', value: 'reclami' },
  { label: 'Registri e monitoraggio diversità', value: 'registri' },
  { label: 'Consultazione lavoratori', value: 'consultazione' },
  { label: 'Accordi sindacali / RSU', value: 'sindacati' },
  { label: 'Misure accessibilità', value: 'accessibilita' },
  { label: 'Verifiche fornitori', value: 'fornitori' },
  { label: 'Audit interni', value: 'audit' },
  { label: 'Altro', value: 'altro' },
]

const EVIDENCE_75F = [
  { label: 'Riconoscimento diritto di associazione sindacale', value: 'associazione' },
  { label: 'Contrattazione collettiva applicata', value: 'ccnl' },
  { label: 'Consultazione lavoratori / RSU', value: 'consultazione' },
  { label: 'Procedure reclami', value: 'reclami' },
  { label: 'Formazione manager', value: 'formazione' },
  { label: 'Comunicazioni interne', value: 'comunicazioni' },
  { label: 'Altro', value: 'altro' },
]

const sections = [
  { id: SECTION_IDS.ATTESTAZIONE, title: 'Attestazione', order_index: 1 },
  { id: SECTION_IDS.ORGANIZZAZIONE, title: "Informazioni sull'organizzazione", order_index: 2 },
  { id: SECTION_IDS.CLR_72, title: '7.2 — Lavoro minorile', order_index: 3 },
  { id: SECTION_IDS.CLR_73, title: '7.3 — Lavoro forzato', order_index: 4 },
  { id: SECTION_IDS.CLR_74, title: '7.4 — Discriminazione', order_index: 5 },
  { id: SECTION_IDS.CLR_75, title: '7.5 — Libertà sindacale', order_index: 6 },
  { id: SECTION_IDS.TERZISTI, title: 'Appendice — Gestione terzisti', order_index: 7 },
]

const Q = {
  ATTESTOR_NAME: 'b0200001-0001-4000-8000-000000000001',
  ATTESTOR_DATE: 'b0200001-0001-4000-8000-000000000002',
  WORKERS_TOTAL: 'b0200001-0001-4000-8000-000000000010',
  WORKERS_EXTERNAL: 'b0200001-0001-4000-8000-000000000011',
  CCNL_APPLIED: 'b0200001-0001-4000-8000-000000000012',
  WORKING_HOURS: 'b0200001-0001-4000-8000-000000000013',
  WORKFORCE_TABLE: 'b0200001-0001-4000-8000-000000000014',
  CLR_72_A: 'b0200001-0001-4000-8000-000000000020',
  CLR_72_B: 'b0200001-0001-4000-8000-000000000021',
  CLR_72_C: 'b0200001-0001-4000-8000-000000000022',
  CLR_72_D: 'b0200001-0001-4000-8000-000000000023',
  CLR_72_E: 'b0200001-0001-4000-8000-000000000024',
  CLR_72_E_ALTRO: 'b0200001-0001-4000-8000-000000000025',
  CLR_72_F: 'b0200001-0001-4000-8000-000000000026',
  CLR_73_A: 'b0200001-0001-4000-8000-000000000030',
  CLR_73_B: 'b0200001-0001-4000-8000-000000000031',
  CLR_73_C: 'b0200001-0001-4000-8000-000000000032',
  CLR_73_D: 'b0200001-0001-4000-8000-000000000033',
  CLR_73_E: 'b0200001-0001-4000-8000-000000000034',
  CLR_73_F_EVIDENCE: 'b0200001-0001-4000-8000-000000000035',
  CLR_73_F_ALTRO: 'b0200001-0001-4000-8000-000000000036',
  CLR_73_G: 'b0200001-0001-4000-8000-000000000037',
  CLR_74_A: 'b0200001-0001-4000-8000-000000000040',
  CLR_74_B: 'b0200001-0001-4000-8000-000000000041',
  CLR_74_C: 'b0200001-0001-4000-8000-000000000042',
  CLR_74_D: 'b0200001-0001-4000-8000-000000000043',
  CLR_74_E_EVIDENCE: 'b0200001-0001-4000-8000-000000000044',
  CLR_74_E_ALTRO: 'b0200001-0001-4000-8000-000000000045',
  CLR_74_F: 'b0200001-0001-4000-8000-000000000046',
  CLR_75_A: 'b0200001-0001-4000-8000-000000000050',
  CLR_75_B: 'b0200001-0001-4000-8000-000000000051',
  CLR_75_C: 'b0200001-0001-4000-8000-000000000052',
  CLR_75_D: 'b0200001-0001-4000-8000-000000000053',
  CLR_75_D_UNION: 'b0200001-0001-4000-8000-000000000054',
  CLR_75_E: 'b0200001-0001-4000-8000-000000000055',
  CLR_75_F_EVIDENCE: 'b0200001-0001-4000-8000-000000000056',
  CLR_75_F_ALTRO: 'b0200001-0001-4000-8000-000000000057',
  CLR_75_G: 'b0200001-0001-4000-8000-000000000058',
  SUBCONTRACTOR_NARRATIVE: 'b0200001-0001-4000-8000-000000000060',
}

const questions = [
  textQuestion(Q.ATTESTOR_NAME, SECTION_IDS.ATTESTAZIONE, 'Nome e cognome del dichiarante', 'attestor_name', 1),
  textQuestion(Q.ATTESTOR_DATE, SECTION_IDS.ATTESTAZIONE, 'Data', 'attestor_date', 2, { placeholder: 'GG/MM/AAAA' }),

  numberQuestion(Q.WORKERS_TOTAL, SECTION_IDS.ORGANIZZAZIONE, 'Numero complessivo di lavoratori in azienda', 'workers_total', 1),
  numberQuestion(Q.WORKERS_EXTERNAL, SECTION_IDS.ORGANIZZAZIONE, 'Lavoratori esterni (cooperative, agenzie, ecc.)', 'workers_external', 2),
  textQuestion(Q.CCNL_APPLIED, SECTION_IDS.ORGANIZZAZIONE, 'CCNL applicato', 'ccnl_applied', 3),
  textQuestion(Q.WORKING_HOURS, SECTION_IDS.ORGANIZZAZIONE, 'Orario di lavoro aziendale', 'working_hours', 4),
  {
    id: Q.WORKFORCE_TABLE,
    section_id: SECTION_IDS.ORGANIZZAZIONE,
    text: "Tabella lavoratori per qualifica, genere, nazionalità e fascia d'età",
    type: 'year_values',
    order_index: 5,
    config: {
      export_key: 'workforce_table',
      fields: buildWorkforceFields(),
      optional: true,
    },
  },

  yesNoQuestion(Q.CLR_72_A, SECTION_IDS.CLR_72, 'a) La vostra organizzazione è conforme alla clausola 7.2 (lavoro minorile)?', 'clr_72_a', 1),
  yesNoQuestion(Q.CLR_72_B, SECTION_IDS.CLR_72, "b) Avete procedure per verificare l'età dei lavoratori all'assunzione?", 'clr_72_b', 2),
  yesNoQuestion(Q.CLR_72_C, SECTION_IDS.CLR_72, 'c) Sono presenti lavoratori minori di 18 anni?', 'clr_72_c', 3),
  yesNoQuestion(Q.CLR_72_D, SECTION_IDS.CLR_72, 'd) Per i minori sono rispettate le norme su orario, mansioni e sicurezza?', 'clr_72_d', 4),
  evidenceQuestion(Q.CLR_72_E, SECTION_IDS.CLR_72, 'e) Evidenze documentali disponibili (selezionare tutte le applicabili)', 'clr_72_e', 5, EVIDENCE_72E),
  textQuestion(Q.CLR_72_E_ALTRO, SECTION_IDS.CLR_72, 'e) Altro — specificare', 'clr_72_e_altro', 6, { optional: true, placeholder: 'Specificare altro...' }),
  textQuestion(
    Q.CLR_72_F,
    SECTION_IDS.CLR_72,
    'f) Identificate gli obblighi giuridici nazionali che incidono sulla clausola 7.2',
    'clr_72_f',
    7,
    { multiline: true, optional: true }
  ),

  yesNoQuestion(Q.CLR_73_A, SECTION_IDS.CLR_73, 'a) La vostra organizzazione è conforme alla clausola 7.3 (lavoro forzato)?', 'clr_73_a', 1),
  yesNoQuestion(Q.CLR_73_B, SECTION_IDS.CLR_73, 'b) Sono presenti procedure per prevenire il lavoro forzato?', 'clr_73_b', 2),
  yesNoQuestion(Q.CLR_73_C, SECTION_IDS.CLR_73, 'c) I lavoratori possono lasciare liberamente il posto di lavoro?', 'clr_73_c', 3),
  yesNoQuestion(Q.CLR_73_D, SECTION_IDS.CLR_73, 'd) Sono rispettati i termini di preavviso e le condizioni di recesso?', 'clr_73_d', 4),
  yesNoQuestion(Q.CLR_73_E, SECTION_IDS.CLR_73, 'e) Non sono trattenuti documenti di identità dei lavoratori?', 'clr_73_e', 5),
  evidenceQuestion(Q.CLR_73_F_EVIDENCE, SECTION_IDS.CLR_73, 'f) Evidenze documentali disponibili', 'clr_73_f', 6, EVIDENCE_73F),
  textQuestion(Q.CLR_73_F_ALTRO, SECTION_IDS.CLR_73, 'f) Altro — specificare', 'clr_73_f_altro', 7, { optional: true }),
  textQuestion(Q.CLR_73_G, SECTION_IDS.CLR_73, 'g) Obblighi giuridici nazionali sulla clausola 7.3', 'clr_73_g', 8, { multiline: true, optional: true }),

  yesNoQuestion(Q.CLR_74_A, SECTION_IDS.CLR_74, 'a) La vostra organizzazione è conforme alla clausola 7.4 (discriminazione)?', 'clr_74_a', 1),
  yesNoQuestion(Q.CLR_74_B, SECTION_IDS.CLR_74, 'b) È adottata una politica di pari opportunità / anti-discriminazione?', 'clr_74_b', 2),
  yesNoQuestion(Q.CLR_74_C, SECTION_IDS.CLR_74, 'c) Le procedure di assunzione e promozione sono eque?', 'clr_74_c', 3),
  yesNoQuestion(Q.CLR_74_D, SECTION_IDS.CLR_74, 'd) La retribuzione è equa per lavoro di pari valore?', 'clr_74_d', 4),
  evidenceQuestion(Q.CLR_74_E_EVIDENCE, SECTION_IDS.CLR_74, 'e) Evidenze documentali disponibili', 'clr_74_e', 5, EVIDENCE_74E),
  textQuestion(Q.CLR_74_E_ALTRO, SECTION_IDS.CLR_74, 'e) Altro — specificare', 'clr_74_e_altro', 6, { optional: true }),
  textQuestion(Q.CLR_74_F, SECTION_IDS.CLR_74, 'f) Obblighi giuridici nazionali sulla clausola 7.4', 'clr_74_f', 7, { multiline: true, optional: true }),

  yesNoQuestion(Q.CLR_75_A, SECTION_IDS.CLR_75, 'a) La vostra organizzazione è conforme alla clausola 7.5 (libertà sindacale)?', 'clr_75_a', 1),
  yesNoQuestion(Q.CLR_75_B, SECTION_IDS.CLR_75, 'b) I lavoratori possono associarsi liberamente?', 'clr_75_b', 2),
  yesNoQuestion(Q.CLR_75_C, SECTION_IDS.CLR_75, 'c) Non sono praticate discriminazioni per attività sindacale?', 'clr_75_c', 3),
  yesNoQuestion(Q.CLR_75_D, SECTION_IDS.CLR_75, 'd) È riconosciuta la rappresentanza sindacale in azienda?', 'clr_75_d', 4),
  textQuestion(
    Q.CLR_75_D_UNION,
    SECTION_IDS.CLR_75,
    'd) Se sì, quale sindacato / rappresentanza?',
    'clr_75_d_union_name',
    5,
    { optional: true, placeholder: 'Compilare solo se risposta Sì alla domanda precedente' }
  ),
  yesNoQuestion(Q.CLR_75_E, SECTION_IDS.CLR_75, 'e) È applicata la contrattazione collettiva?', 'clr_75_e', 6),
  evidenceQuestion(Q.CLR_75_F_EVIDENCE, SECTION_IDS.CLR_75, 'f) Evidenze documentali disponibili', 'clr_75_f', 7, EVIDENCE_75F),
  textQuestion(Q.CLR_75_F_ALTRO, SECTION_IDS.CLR_75, 'f) Altro — specificare', 'clr_75_f_altro', 8, { optional: true }),
  textQuestion(Q.CLR_75_G, SECTION_IDS.CLR_75, 'g) Obblighi giuridici nazionali sulla clausola 7.5', 'clr_75_g', 9, { multiline: true, optional: true }),

  textQuestion(
    Q.SUBCONTRACTOR_NARRATIVE,
    SECTION_IDS.TERZISTI,
    'Descrizione della gestione dei terzisti non certificati (richiamo Parte 1 guida FSC)',
    'subcontractor_narrative',
    1,
    { multiline: true, optional: true }
  ),
]

function sqlEscape(str) {
  return str.replace(/'/g, "''")
}

function jsonSql(obj) {
  return `'${sqlEscape(JSON.stringify(obj))}'::jsonb`
}

const lines = [
  '-- CLOUD FSC ILO: seed sections + questions (Parte 2 V1.2 ufficiale)',
  '-- Generated by scripts/generate-ilo-questions-migration.mjs',
  '',
  'DELETE FROM public.questions q',
  'USING public.sections s',
  'WHERE q.section_id = s.id',
  `  AND s.tool_id = '${CLOUD_FSC_TOOL_ID}'::uuid`,
  `  AND s.group_name = '${GROUP}';`,
  '',
  'DELETE FROM public.sections',
  `WHERE tool_id = '${CLOUD_FSC_TOOL_ID}'::uuid`,
  `  AND group_name = '${GROUP}';`,
  '',
]

for (const s of sections) {
  lines.push(
    'INSERT INTO public.sections (id, tool_id, title, order_index, group_name, render_mode, logic_rules)',
    'VALUES (',
    `  '${s.id}'::uuid,`,
    `  '${CLOUD_FSC_TOOL_ID}'::uuid,`,
    `  '${sqlEscape(s.title)}',`,
    `  ${s.order_index},`,
    `  '${GROUP}',`,
    "  'list',",
    "  '[]'::jsonb",
    ') ON CONFLICT (id) DO UPDATE SET',
    '  title = EXCLUDED.title,',
    '  order_index = EXCLUDED.order_index,',
    '  group_name = EXCLUDED.group_name;',
    ''
  )
}

for (const q of questions) {
  lines.push(
    'INSERT INTO public.questions (id, section_id, text, type, config, order_index)',
    'VALUES (',
    `  '${q.id}'::uuid,`,
    `  '${q.section_id}'::uuid,`,
    `  '${sqlEscape(q.text)}',`,
    `  '${q.type}',`,
    `  ${jsonSql(q.config)},`,
    `  ${q.order_index}`,
    ') ON CONFLICT (id) DO UPDATE SET',
    '  section_id = EXCLUDED.section_id,',
    '  text = EXCLUDED.text,',
    '  type = EXCLUDED.type,',
    '  config = EXCLUDED.config,',
    '  order_index = EXCLUDED.order_index;',
    ''
  )
}

const outPath = path.join(ROOT, 'supabase', 'migrations', '20260612110000_fsc_ilo_sections_questions.sql')
fs.writeFileSync(outPath, lines.join('\n'))
console.log(`Wrote ${questions.length} questions in ${sections.length} sections → ${outPath}`)
