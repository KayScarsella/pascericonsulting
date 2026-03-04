-- 1. Ottimizziamo la Policy di LETTURA (View)
DROP POLICY IF EXISTS "View documents" ON public.documents;

CREATE POLICY "View documents" ON public.documents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tool_access ta
    WHERE ta.user_id = (select auth.uid()) -- <--- NOTA IL (select ...)
    AND ta.tool_id = documents.tool_id
  )
);

-- 2. Ottimizziamo la Policy di INSERIMENTO (Admin insert)
DROP POLICY IF EXISTS "Admin insert documents" ON public.documents;

CREATE POLICY "Admin insert documents" ON public.documents
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tool_access ta
    WHERE ta.user_id = (select auth.uid()) -- <--- NOTA IL (select ...)
    AND ta.tool_id = documents.tool_id
    AND ta.role = 'admin'::app_role
  )
);

-- 3. Ottimizziamo la Policy di CANCELLAZIONE (Admin delete)
DROP POLICY IF EXISTS "Admin delete documents" ON public.documents;

CREATE POLICY "Admin delete documents" ON public.documents
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tool_access ta
    WHERE ta.user_id = (select auth.uid()) -- <--- NOTA IL (select ...)
    AND ta.tool_id = documents.tool_id
    AND ta.role = 'admin'::app_role
  )
);