-- RLS performance: auth initplan (select auth.uid()) + merge duplicate permissive policies.

-- ---------------------------------------------------------------------------
-- documents: auth_rls_initplan (lint 0003)
-- ---------------------------------------------------------------------------

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
        WHERE ta.user_id = (SELECT auth.uid())
          AND ta.tool_id = documents.tool_id
      )
    )
  );

DROP POLICY IF EXISTS "Admin update documents" ON public.documents;

CREATE POLICY "Admin update documents"
  ON public.documents
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tool_access ta
      WHERE ta.user_id = (SELECT auth.uid())
        AND ta.tool_id = documents.tool_id
        AND ta.role = 'admin'::public.app_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.tool_access ta
      WHERE ta.user_id = (SELECT auth.uid())
        AND ta.tool_id = documents.tool_id
        AND ta.role = 'admin'::public.app_role
    )
  );

-- ---------------------------------------------------------------------------
-- fsc_ilo_template_master: auth_rls_initplan
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "fsc_ilo_template_select" ON public.fsc_ilo_template_master;

CREATE POLICY "fsc_ilo_template_select"
  ON public.fsc_ilo_template_master
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tool_access ta
      WHERE ta.user_id = (SELECT auth.uid())
        AND ta.tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    )
  );

-- ---------------------------------------------------------------------------
-- assessment_sessions: merge permissive policies (lint 0006)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Select for owner or admin" ON public.assessment_sessions;
DROP POLICY IF EXISTS "fsc_ilo_session_select_member" ON public.assessment_sessions;

CREATE POLICY "assessment_sessions_select"
  ON public.assessment_sessions
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin_of_tool(tool_id)
    OR (
      session_type = 'ilo'
      AND tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
      AND EXISTS (
        SELECT 1
        FROM public.fsc_ilo_assessments a
        WHERE a.session_id = assessment_sessions.id
          AND public.fsc_is_company_member(a.company_id)
      )
    )
  );

DROP POLICY IF EXISTS "Update for owner" ON public.assessment_sessions;
DROP POLICY IF EXISTS "fsc_ilo_session_update_editor" ON public.assessment_sessions;

CREATE POLICY "assessment_sessions_update"
  ON public.assessment_sessions
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      session_type = 'ilo'
      AND tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
      AND EXISTS (
        SELECT 1
        FROM public.fsc_ilo_assessments a
        WHERE a.session_id = assessment_sessions.id
          AND public.fsc_is_company_editor(a.company_id)
      )
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      session_type = 'ilo'
      AND tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
      AND EXISTS (
        SELECT 1
        FROM public.fsc_ilo_assessments a
        WHERE a.session_id = assessment_sessions.id
          AND public.fsc_is_company_editor(a.company_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- tools: merge permissive SELECT policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Catalogo tool per utenti autenticati" ON public.tools;
DROP POLICY IF EXISTS "Vedo tool se ho accesso" ON public.tools;

CREATE POLICY "tools_select_authenticated"
  ON public.tools
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- user_responses: merge permissive policies per action
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Gestione Risposte Complessa" ON public.user_responses;
DROP POLICY IF EXISTS "fsc_ilo_responses_select_member" ON public.user_responses;

CREATE POLICY "user_responses_select"
  ON public.user_responses
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin_of_tool(tool_id)
    OR (
      tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
      AND session_id IN (
        SELECT a.session_id
        FROM public.fsc_ilo_assessments a
        WHERE a.session_id IS NOT NULL
          AND public.fsc_is_company_member(a.company_id)
      )
    )
  );

DROP POLICY IF EXISTS "Utente crea sue risposte" ON public.user_responses;
DROP POLICY IF EXISTS "fsc_ilo_responses_insert_editor" ON public.user_responses;

CREATE POLICY "user_responses_insert"
  ON public.user_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
      AND session_id IN (
        SELECT a.session_id
        FROM public.fsc_ilo_assessments a
        WHERE a.session_id IS NOT NULL
          AND public.fsc_is_company_editor(a.company_id)
      )
    )
  );

DROP POLICY IF EXISTS "Utente modifica sue risposte" ON public.user_responses;
DROP POLICY IF EXISTS "fsc_ilo_responses_update_editor" ON public.user_responses;

CREATE POLICY "user_responses_update"
  ON public.user_responses
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
      AND session_id IN (
        SELECT a.session_id
        FROM public.fsc_ilo_assessments a
        WHERE a.session_id IS NOT NULL
          AND public.fsc_is_company_editor(a.company_id)
      )
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
      AND session_id IN (
        SELECT a.session_id
        FROM public.fsc_ilo_assessments a
        WHERE a.session_id IS NOT NULL
          AND public.fsc_is_company_editor(a.company_id)
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete their own responses" ON public.user_responses;
DROP POLICY IF EXISTS "fsc_ilo_responses_delete_editor" ON public.user_responses;

CREATE POLICY "user_responses_delete"
  ON public.user_responses
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
      AND session_id IN (
        SELECT a.session_id
        FROM public.fsc_ilo_assessments a
        WHERE a.session_id IS NOT NULL
          AND public.fsc_is_company_editor(a.company_id)
      )
    )
  );
