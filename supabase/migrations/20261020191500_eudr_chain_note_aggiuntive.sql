-- EUDR: add optional free-text notes at end of supply-chain section (no risk/DDS impact).

INSERT INTO public.questions (id, section_id, text, type, config, order_index)
VALUES (
  'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
  'f8a1b2c3-4d5e-4f60-9a7b-8c9d0e1f2a3b',
  '5) Note aggiuntive',
  'text',
  jsonb_build_object(
    'optional', true,
    'multiline', true,
    'placeholder', 'Inserisci eventuali note…'
  ),
  50
)
ON CONFLICT (id) DO NOTHING;
