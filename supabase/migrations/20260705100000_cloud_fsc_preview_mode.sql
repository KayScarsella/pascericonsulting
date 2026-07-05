-- CLOUD FSC: anteprima (is_active = false).
-- Gli utenti con riga in tool_access entrano con il proprio ruolo (standard/premium/admin).
-- Launch GA: UPDATE tools SET is_active = true WHERE id = '50cd9969-0300-4d41-b807-1a88088d07e1';

UPDATE public.tools
SET is_active = false
WHERE id = '50cd9969-0300-4d41-b807-1a88088d07e1';
