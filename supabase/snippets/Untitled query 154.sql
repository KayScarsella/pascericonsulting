-- 1. Cancella la vecchia policy complessa
DROP POLICY IF EXISTS "Gestione Risposte Complessa" ON public.user_responses;

-- 2. Crea la nuova versione usando la funzione sicura che abbiamo appena fatto
CREATE POLICY "Gestione Risposte Complessa"
ON public.user_responses
FOR SELECT
TO authenticated  -- Meglio 'authenticated' di 'public' per sicurezza
USING (
  -- L'utente vede le PROPRIE risposte
  user_id = auth.uid()
  
  OR 
  
  -- Oppure vede tutto se è ADMIN del tool relativo
  is_admin_of_tool(tool_id)
);