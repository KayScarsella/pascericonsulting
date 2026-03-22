-- Hardening: profiles visibility, admin updates, email guard; remove permissive storage insert.

-- ---------------------------------------------------------------------------
-- Storage: remove policy that allowed any authenticated insert on any bucket
-- ---------------------------------------------------------------------------
drop policy if exists "Enable insert for authenticated users only" on storage.objects;

-- ---------------------------------------------------------------------------
-- Profiles: replace permissive SELECT / UPDATE with scoped policies
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users view profiles" on public.profiles;
drop policy if exists "Utenti modificano proprio profilo" on public.profiles;

-- Standard / premium / admin: always see own row.
-- Tool admins: see profiles of users who share at least one tool where caller is admin.
create policy "profiles_select_own_or_managed"
  on public.profiles
  as permissive
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.tool_access admin_ta
      inner join public.tool_access member_ta
        on admin_ta.tool_id = member_ta.tool_id
      where admin_ta.user_id = (select auth.uid())
        and admin_ta.role = 'admin'::public.app_role
        and member_ta.user_id = profiles.id
    )
  );

-- Owner updates own row (including email — still guarded by trigger below).
create policy "profiles_update_own"
  on public.profiles
  as permissive
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Tool admin updates other users' rows in tools they administer (not own row; that uses policy above).
create policy "profiles_update_as_tool_admin"
  on public.profiles
  as permissive
  for update
  to authenticated
  using (
    id <> (select auth.uid())
    and exists (
      select 1
      from public.tool_access admin_ta
      inner join public.tool_access member_ta
        on admin_ta.tool_id = member_ta.tool_id
      where admin_ta.user_id = (select auth.uid())
        and admin_ta.role = 'admin'::public.app_role
        and member_ta.user_id = profiles.id
    )
  )
  with check (
    exists (
      select 1
      from public.tool_access admin_ta
      inner join public.tool_access member_ta
        on admin_ta.tool_id = member_ta.tool_id
      where admin_ta.user_id = (select auth.uid())
        and admin_ta.role = 'admin'::public.app_role
        and member_ta.user_id = profiles.id
    )
  );

-- Only the account owner may change email (admins cannot, even if client sends email).
create or replace function public.profiles_guard_email_update()
returns trigger
language plpgsql
set search_path to public
as $fn$
begin
  if old.email is distinct from new.email then
    if auth.uid() is distinct from old.id then
      raise exception 'Solo il titolare dell''account può modificare l''email';
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_guard_email_before_update on public.profiles;

create trigger profiles_guard_email_before_update
  before update on public.profiles
  for each row
  execute function public.profiles_guard_email_update();
