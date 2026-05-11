-- Hardening + exposure reduction for Supabase database linter (SECURITY DEFINER RPC).
-- Manual (Dashboard, not SQL): Authentication → Password → enable "Leaked password protection".

-- 1) Storage path RPCs: only tool admins for the document root may list paths.
CREATE OR REPLACE FUNCTION public.get_recursive_storage_paths(target_id uuid)
 RETURNS TABLE(storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = target_id
      AND public.is_admin_of_tool(d.tool_id)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT id, parent_id, d.storage_path
    FROM public.documents d
    WHERE id = target_id
    UNION ALL
    SELECT child.id, child.parent_id, child.storage_path
    FROM public.documents child
    JOIN tree t ON child.parent_id = t.id
  )
  SELECT tree.storage_path
  FROM tree
  WHERE tree.storage_path IS NOT NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_storage_paths_recursive(target_id uuid)
 RETURNS TABLE(storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = target_id
      AND public.is_admin_of_tool(d.tool_id)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH RECURSIVE tree AS (
    SELECT id, parent_id, documents.storage_path
    FROM public.documents
    WHERE id = target_id
    UNION ALL
    SELECT d.id, d.parent_id, d.storage_path
    FROM public.documents d
    JOIN tree t ON d.parent_id = t.id
  )
  SELECT tree.storage_path
  FROM tree
  WHERE tree.storage_path IS NOT NULL;
END;
$function$;

-- 2) Do not expose helper / trigger RPCs to anon; keep authenticated + service_role where needed for RLS helpers.
REVOKE ALL ON FUNCTION public.get_recursive_storage_paths(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_storage_paths_recursive(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recursive_storage_paths(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_paths_recursive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recursive_storage_paths(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_storage_paths_recursive(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_admin_of_tool(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_any_tool() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_of_tool(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_any_tool() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_tool(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_any_tool() TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.get_recursive_storage_paths(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.get_storage_paths_recursive(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_admin_of_tool(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.is_admin_any_tool() FROM anon;
