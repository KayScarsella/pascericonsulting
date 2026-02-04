-- 1. Risolviamo l'errore sulla tabella ROLES
-- Attiviamo la sicurezza
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
-- (La policy di lettura pubblica l'avevamo già creata, quindi ora funzionerà)


-- 2. Risolviamo l'errore sulla tabella USER_ROLES
-- Attiviamo la sicurezza
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Creiamo la regola: "Ognuno può leggere solo i propri ruoli"
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);


-- 3. Risolviamo l'errore sulla tabella TOOLS
-- Attiviamo la sicurezza
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

-- Creiamo la regola: "Tutti gli utenti loggati possono vedere i tools"
CREATE POLICY "Authenticated users can read tools" ON public.tools
  FOR SELECT
  TO authenticated
  USING (true);


-- 4. BONUS: Permessi per l'Admin (per il futuro)
-- Diamo all'utente "service_role" (il server) pieni poteri su tutto
-- (Questo è implicito in Supabase, ma rende le cose chiare)
GRANT ALL ON TABLE public.roles TO service_role;
GRANT ALL ON TABLE public.user_roles TO service_role;
GRANT ALL ON TABLE public.tools TO service_role;