-- Consente agli admin del tool di aggiornare metadati documenti (es. min_role cartelle)

CREATE POLICY "Admin update documents"
  ON public.documents
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tool_access ta
      WHERE ta.user_id = auth.uid()
        AND ta.tool_id = documents.tool_id
        AND ta.role = 'admin'::public.app_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tool_access ta
      WHERE ta.user_id = auth.uid()
        AND ta.tool_id = documents.tool_id
        AND ta.role = 'admin'::public.app_role
    )
  );
