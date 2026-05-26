-- Gli utenti standard possono vedere le cartelle premium (nome/teaser) ma non i file al loro interno.

DROP POLICY IF EXISTS "View documents" ON public.documents;

CREATE POLICY "View documents"
  ON public.documents
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.document_min_role_satisfied(tool_id, min_role)
    OR (
      type = 'folder'
      AND min_role = 'premium'::public.app_role
      AND EXISTS (
        SELECT 1
        FROM public.tool_access ta
        WHERE ta.user_id = auth.uid()
          AND ta.tool_id = documents.tool_id
      )
    )
  );
