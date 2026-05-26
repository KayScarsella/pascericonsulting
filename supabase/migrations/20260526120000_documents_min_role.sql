-- Cartelle/file documentazione: visibilità per ruolo (standard vs premium)

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS min_role public.app_role NOT NULL DEFAULT 'standard';

COMMENT ON COLUMN public.documents.min_role IS
  'Ruolo minimo richiesto: standard = tutti; premium = solo premium e admin.';

-- Confronto ruolo utente vs min_role riga documento (allineato a topBar canView)
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
  SELECT EXISTS (
    SELECT 1
    FROM public.tool_access ta
    WHERE ta.user_id = auth.uid()
      AND ta.tool_id = _tool_id
      AND (
        ta.role = 'admin'::public.app_role
        OR (_min_role = 'standard'::public.app_role AND ta.role IN ('standard'::public.app_role, 'premium'::public.app_role))
        OR (_min_role = 'premium'::public.app_role AND ta.role = 'premium'::public.app_role)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.document_min_role_satisfied(uuid, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "View documents" ON public.documents;

CREATE POLICY "View documents"
  ON public.documents
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.document_min_role_satisfied(tool_id, min_role)
  );

-- Storage: lettura solo se esiste riga documents accessibile per quel path
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
          AND public.document_min_role_satisfied(d.tool_id, d.min_role)
      )
      OR EXISTS (
        SELECT 1
        FROM public.tool_access ta
        WHERE ta.user_id = auth.uid()
          AND ta.role = 'admin'::public.app_role
          AND (ta.tool_id)::text = split_part(objects.name, '/'::text, 1)
      )
    )
  );
