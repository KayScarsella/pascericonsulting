-- ACL cartelle: allowlist per ruolo (allowed_roles) + seed EUDR + RLS.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS allowed_roles public.app_role[] NOT NULL
    DEFAULT ARRAY['standard', 'premium', 'admin']::public.app_role[];

COMMENT ON COLUMN public.documents.allowed_roles IS
  'Ruoli tool_access che possono aprire/scaricare questo documento. Admin vede sempre (anche se non in lista).';

-- Backfill da min_role legacy
UPDATE public.documents
SET allowed_roles = CASE
  WHEN min_role = 'premium'::public.app_role THEN
    ARRAY['premium', 'admin']::public.app_role[]
  ELSE
    ARRAY['standard', 'premium', 'admin']::public.app_role[]
END
WHERE allowed_roles = ARRAY['standard', 'premium', 'admin']::public.app_role[]
   OR allowed_roles IS NULL;

-- Seed cartelle root EUDR (per nome)
UPDATE public.documents
SET allowed_roles = ARRAY['standard', 'premium', 'admin']::public.app_role[]
WHERE tool_id = '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid
  AND type = 'folder'
  AND parent_id IS NULL
  AND name = 'DOCUMENTI OPERATIVI';

UPDATE public.documents
SET allowed_roles = ARRAY['standard', 'tool', 'premium', 'admin']::public.app_role[]
WHERE tool_id = '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid
  AND type = 'folder'
  AND parent_id IS NULL
  AND name = 'FAQ-GUIDANCE-REGOLAMENTI';

UPDATE public.documents
SET allowed_roles = ARRAY['tool', 'premium', 'admin']::public.app_role[]
WHERE tool_id = '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid
  AND type = 'folder'
  AND parent_id IS NULL
  AND name = 'LEGISLAZIONE PAESI';

-- Propaga allowlist root → discendenti
WITH RECURSIVE tree AS (
  SELECT id, tool_id, allowed_roles
  FROM public.documents
  WHERE tool_id = '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid
    AND type = 'folder'
    AND parent_id IS NULL
    AND name IN ('DOCUMENTI OPERATIVI', 'FAQ-GUIDANCE-REGOLAMENTI', 'LEGISLAZIONE PAESI')
  UNION ALL
  SELECT d.id, d.tool_id, t.allowed_roles
  FROM public.documents d
  JOIN tree t ON d.parent_id = t.id AND d.tool_id = t.tool_id
)
UPDATE public.documents d
SET allowed_roles = tree.allowed_roles
FROM tree
WHERE d.id = tree.id
  AND d.parent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.document_role_allowed(
  _tool_id uuid,
  _allowed_roles public.app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tool_access ta
    WHERE ta.user_id = (SELECT auth.uid())
      AND ta.tool_id = _tool_id
      AND (
        ta.role = 'admin'::public.app_role
        OR ta.role = ANY (_allowed_roles)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.document_role_allowed(uuid, public.app_role[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.document_role_allowed(uuid, public.app_role[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.document_role_allowed(uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_role_allowed(uuid, public.app_role[]) TO service_role;

CREATE OR REPLACE FUNCTION public.document_min_role_satisfied(
  _tool_id uuid,
  _min_role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.document_role_allowed(
    _tool_id,
    CASE
      WHEN _min_role = 'premium'::public.app_role THEN
        ARRAY['premium', 'admin']::public.app_role[]
      ELSE
        ARRAY['standard', 'premium', 'admin']::public.app_role[]
    END
  );
$$;

DROP POLICY IF EXISTS "View documents" ON public.documents;

CREATE POLICY "View documents"
  ON public.documents
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.document_role_allowed(tool_id, allowed_roles)
    OR (
      type = 'folder'
      AND EXISTS (
        SELECT 1
        FROM public.tool_access ta
        WHERE ta.user_id = (SELECT auth.uid())
          AND ta.tool_id = documents.tool_id
      )
    )
  );

DROP POLICY IF EXISTS "Read documents" ON storage.objects;

CREATE POLICY "Read documents"
  ON storage.objects
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      EXISTS (
        SELECT 1
        FROM public.documents d
        WHERE d.storage_path = objects.name
          AND d.type = 'file'
          AND public.document_role_allowed(d.tool_id, d.allowed_roles)
      )
      OR EXISTS (
        SELECT 1
        FROM public.tool_access ta
        WHERE ta.user_id = (SELECT auth.uid())
          AND ta.role = 'admin'::public.app_role
          AND (ta.tool_id)::text = split_part(objects.name, '/'::text, 1)
      )
    )
  );
