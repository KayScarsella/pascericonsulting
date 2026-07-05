-- =============================================================================
-- CLOUD FSC — run in Supabase SQL Editor as postgres / service role
-- Tool id (must match src/lib/constants.ts CLOUD_FSC_TOOL_ID)
--
-- Preview mode: tools.is_active = false (migration 20260705100000_cloud_fsc_preview_mode).
-- Con is_active = false il tool resta visibile in landing a tutti; chi ha riga in
-- tool_access entra con il proprio ruolo (standard/premium/admin), non solo admin.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Bulk grant: users who already have Timber or EUDR (role: standard)
-- -----------------------------------------------------------------------------
insert into public.tool_access (user_id, tool_id, role)
select distinct ta.user_id, '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid, 'standard'::public.app_role
from public.tool_access ta
where ta.tool_id in (
  'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid,  -- TIMBER
  '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid   -- EUDR
)
on conflict (user_id, tool_id) do nothing;

-- -----------------------------------------------------------------------------
-- 1b) Alternative: every profile with a row (use instead of 1 if you prefer)
-- -----------------------------------------------------------------------------
-- insert into public.tool_access (user_id, tool_id, role)
-- select p.id, '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid, 'standard'::public.app_role
-- from public.profiles p
-- on conflict (user_id, tool_id) do nothing;

-- -----------------------------------------------------------------------------
-- 2) Verification
-- -----------------------------------------------------------------------------
select role, count(*) as n
from public.tool_access
where tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
group by role;

-- -----------------------------------------------------------------------------
-- 3) Promote admins (edit user_id list)
-- -----------------------------------------------------------------------------
-- update public.tool_access
-- set role = 'admin'::public.app_role
-- where tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
--   and user_id in (
--     '00000000-0000-0000-0000-000000000001'::uuid
--   );

-- -----------------------------------------------------------------------------
-- 4) Launch: enable tool for all assigned roles (run when ready for GA)
--     Rimuove anteprima: banner in-app e badge landing spariscono automaticamente.
-- -----------------------------------------------------------------------------
-- update public.tools
-- set is_active = true
-- where id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid;
