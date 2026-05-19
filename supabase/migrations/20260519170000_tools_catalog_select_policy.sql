-- Landing page: utenti autenticati vedono tutti i tool (catalogo).
-- I dati esposti sono solo metadati pubblici (nome, descrizione, is_active, base_path).
-- Le policy permissive si combinano in OR con "Vedo tool se ho accesso".
create policy "Catalogo tool per utenti autenticati"
  on public.tools
  as permissive
  for select
  to authenticated
  using (true);
