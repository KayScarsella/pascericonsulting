-- EUDR + Timber: allow tool admins to INSERT/UPDATE/DELETE analysis data for support / impersonation.
-- Scoped strictly to EUDR and Timber tool_ids; FSC ILO editor paths unchanged.

-- ---------------------------------------------------------------------------
-- assessment_sessions
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Insert for owner" ON public.assessment_sessions;
CREATE POLICY "Insert for owner"
  ON public.assessment_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid, -- EUDR
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid  -- Timber
      )
      AND public.is_admin_of_tool(tool_id)
    )
  );

DROP POLICY IF EXISTS "assessment_sessions_update" ON public.assessment_sessions;
CREATE POLICY "assessment_sessions_update"
  ON public.assessment_sessions
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
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
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
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

DROP POLICY IF EXISTS "Delete for owner" ON public.assessment_sessions;
CREATE POLICY "Delete for owner"
  ON public.assessment_sessions
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
  );

-- ---------------------------------------------------------------------------
-- user_responses
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_responses_insert" ON public.user_responses;
CREATE POLICY "user_responses_insert"
  ON public.user_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
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

DROP POLICY IF EXISTS "user_responses_update" ON public.user_responses;
CREATE POLICY "user_responses_update"
  ON public.user_responses
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
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
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
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

DROP POLICY IF EXISTS "user_responses_delete" ON public.user_responses;
CREATE POLICY "user_responses_delete"
  ON public.user_responses
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
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

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can insert their own suppliers" ON public.suppliers;
CREATE POLICY "Users can insert their own suppliers"
  ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
  );

DROP POLICY IF EXISTS "Users can update their own suppliers" ON public.suppliers;
CREATE POLICY "Users can update their own suppliers"
  ON public.suppliers
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete their own suppliers" ON public.suppliers;
CREATE POLICY "Users can delete their own suppliers"
  ON public.suppliers
  FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR (
      tool_id IN (
        '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid,
        'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
      )
      AND public.is_admin_of_tool(tool_id)
    )
  );

-- ---------------------------------------------------------------------------
-- storage: tool admins can INSERT into user-uploads under {owner}/{toolId}/...
-- (SELECT/DELETE already exist; mitigation paths will use toolId as folder[2])
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tool Admins insert tool files" ON storage.objects;
CREATE POLICY "Tool Admins insert tool files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-uploads'
    AND public.is_admin_of_tool(((storage.foldername(name))[2])::uuid)
  );
