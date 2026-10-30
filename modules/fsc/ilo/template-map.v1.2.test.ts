import assert from 'node:assert/strict'
import test from 'node:test'
import { responsesToExportContext } from './template-map.v1.2'

test('responsesToExportContext maps yes/no and multi-select', () => {
  const questions = [
    {
      id: 'q1',
      type: 'select',
      config: {
        export_key: 'clr_72_a',
        options: [
          { label: 'Sì', value: 'si' },
          { label: 'No', value: 'no' },
        ],
      },
    },
    {
      id: 'q2',
      type: 'select',
      config: {
        export_key: 'clr_72_e',
        is_multi: true,
        options: [
          { label: 'Politica', value: 'politica' },
          { label: 'Registri', value: 'registri' },
        ],
      },
    },
    {
      id: 'q3',
      type: 'year_values',
      config: { export_key: 'workforce_table' },
    },
  ]

  const responses = [
    { question_id: 'q1', answer_text: 'si', answer_json: null },
    { question_id: 'q2', answer_text: 'politica,registri', answer_json: null },
    {
      question_id: 'q3',
      answer_text: null,
      answer_json: { qual_operai_m: '3', qual_operai_f: '2' },
    },
  ]

  const ctx = responsesToExportContext(questions, responses, 2026)

  assert.equal(ctx.reference_year, '2026')
  assert.equal(ctx.clr_72_a, 'Sì')
  assert.equal(ctx.clr_72_e, 'Politica, Registri')
  assert.equal(ctx.qual_operai_m, '3')
  assert.equal(ctx.qual_operai_f, '2')
})
