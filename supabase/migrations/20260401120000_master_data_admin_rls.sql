-- Allow tool admins to manage global master-data tables (country/species).
-- These tables are not tool-scoped (no tool_id), so we authorize if the user
-- is admin of at least one tool.

create or replace function public.is_admin_any_tool()
returns boolean
language sql
security definer
set search_path = 'public'
as $$
  select exists (
    select 1
    from public.tool_access ta
    where ta.user_id = auth.uid()
      and ta.role = 'admin'::public.app_role
  );
$$;

-- COUNTRY: keep existing select policy; add write policies for admins.
drop policy if exists "country_admin_insert" on public.country;
drop policy if exists "country_admin_update" on public.country;
drop policy if exists "country_admin_delete" on public.country;

create policy "country_admin_insert"
on public.country
as permissive
for insert
to authenticated
with check (public.is_admin_any_tool());

create policy "country_admin_update"
on public.country
as permissive
for update
to authenticated
using (public.is_admin_any_tool())
with check (public.is_admin_any_tool());

create policy "country_admin_delete"
on public.country
as permissive
for delete
to authenticated
using (public.is_admin_any_tool());

-- SPECIES: keep existing select policy; add write policies for admins.
drop policy if exists "species_admin_insert" on public.species;
drop policy if exists "species_admin_update" on public.species;
drop policy if exists "species_admin_delete" on public.species;

create policy "species_admin_insert"
on public.species
as permissive
for insert
to authenticated
with check (public.is_admin_any_tool());

create policy "species_admin_update"
on public.species
as permissive
for update
to authenticated
using (public.is_admin_any_tool())
with check (public.is_admin_any_tool());

create policy "species_admin_delete"
on public.species
as permissive
for delete
to authenticated
using (public.is_admin_any_tool());

-- EU_PRODUCTS: keep existing select policy; add write policies for admins.
drop policy if exists "eu_products_admin_insert" on public.eu_products;
drop policy if exists "eu_products_admin_update" on public.eu_products;
drop policy if exists "eu_products_admin_delete" on public.eu_products;

create policy "eu_products_admin_insert"
on public.eu_products
as permissive
for insert
to authenticated
with check (public.is_admin_any_tool());

create policy "eu_products_admin_update"
on public.eu_products
as permissive
for update
to authenticated
using (public.is_admin_any_tool())
with check (public.is_admin_any_tool());

create policy "eu_products_admin_delete"
on public.eu_products
as permissive
for delete
to authenticated
using (public.is_admin_any_tool());

