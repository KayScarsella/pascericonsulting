-- Batch-update allowed_roles for an entire folder subtree (replaces N+1 app recursion).
CREATE OR REPLACE FUNCTION public.cascade_document_allowed_roles(
  p_folder_id uuid,
  p_tool_id uuid,
  p_allowed_roles public.app_role[],
  p_min_role text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH RECURSIVE tree AS (
    SELECT d.id
    FROM public.documents d
    WHERE d.parent_id = p_folder_id
      AND d.tool_id = p_tool_id
    UNION ALL
    SELECT c.id
    FROM public.documents c
    INNER JOIN tree t ON c.parent_id = t.id
    WHERE c.tool_id = p_tool_id
  )
  UPDATE public.documents d
  SET
    allowed_roles = p_allowed_roles,
    min_role = p_min_role
  FROM tree
  WHERE d.id = tree.id
    AND d.tool_id = p_tool_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cascade_document_allowed_roles(uuid, uuid, public.app_role[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cascade_document_allowed_roles(uuid, uuid, public.app_role[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cascade_document_allowed_roles(uuid, uuid, public.app_role[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cascade_document_allowed_roles(uuid, uuid, public.app_role[], text) TO service_role;
