-- Fix infinite RLS recursion on fsc_company_members UPDATE (titolare editing team).
-- INSERT/DELETE already use fsc_is_company_owner; UPDATE was left with a direct subquery.

-- Hardening: row_security = off on membership helpers used in RLS policies.
CREATE OR REPLACE FUNCTION public.fsc_is_company_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fsc_company_members m
    WHERE m.company_id = _company_id
      AND m.user_id = (SELECT auth.uid())
  )
  OR public.is_admin_of_tool(public.fsc_company_tool_id(_company_id));
$$;

CREATE OR REPLACE FUNCTION public.fsc_is_company_editor(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_admin_of_tool(public.fsc_company_tool_id(_company_id))
  OR EXISTS (
    SELECT 1
    FROM public.fsc_company_members m
    WHERE m.company_id = _company_id
      AND m.user_id = (SELECT auth.uid())
      AND m.can_edit = true
  );
$$;

CREATE OR REPLACE FUNCTION public.fsc_is_company_owner(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT public.is_admin_of_tool(public.fsc_company_tool_id(_company_id))
  OR EXISTS (
    SELECT 1
    FROM public.fsc_company_members m
    WHERE m.company_id = _company_id
      AND m.user_id = (SELECT auth.uid())
      AND m.member_type = 'owner'
  );
$$;

DROP POLICY IF EXISTS "fsc_company_members_update" ON public.fsc_company_members;

CREATE POLICY "fsc_company_members_update"
  ON public.fsc_company_members
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_of_tool(public.fsc_company_tool_id(company_id))
    OR public.fsc_is_company_owner(company_id)
  )
  WITH CHECK (
    public.is_admin_of_tool(public.fsc_company_tool_id(company_id))
    OR public.fsc_is_company_owner(company_id)
  );

-- Repair uploads stuck in pending_upload when the blob already exists in storage.
UPDATE public.fsc_storage_objects o
SET
  status = 'active',
  activated_at = COALESCE(o.activated_at, now()),
  upload_expires_at = NULL,
  size_bytes = COALESCE(
    o.size_bytes,
    (
      SELECT NULLIF(so.metadata ->> 'size', '')::bigint
      FROM storage.objects so
      WHERE so.bucket_id = 'fsc-documents'
        AND so.name = o.storage_path
    )
  )
WHERE o.status = 'pending_upload'
  AND EXISTS (
    SELECT 1
    FROM storage.objects so
    WHERE so.bucket_id = 'fsc-documents'
      AND so.name = o.storage_path
  );
