-- EUDR: apostrophe accent on non-mescolamento question (mockup DOCX uses «È»).
UPDATE public.questions
SET text = '2) È possibile avere ragionevole sicurezza circa il non mescolamento dei materiali oggetto di analisi con altri materiali in tutta la catena di fornitura?'
WHERE id = 'b3c4d5e6-f7a8-4b9c-9d0e-1f2a3b4c5d69'
  AND text LIKE '%E'' possibile%';
