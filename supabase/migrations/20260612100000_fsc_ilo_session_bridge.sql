-- CLOUD FSC ILO: bridge fsc_ilo_assessments ↔ assessment_sessions

ALTER TABLE public.fsc_ilo_assessments
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.assessment_sessions (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fsc_ilo_assessments_session_id
  ON public.fsc_ilo_assessments (session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsc_ilo_assessments_company_year
  ON public.fsc_ilo_assessments (company_id, reference_year);

-- Company members can read ILO assessment sessions linked to their company
CREATE POLICY "fsc_ilo_session_select_member"
  ON public.assessment_sessions
  FOR SELECT TO authenticated
  USING (
    session_type = 'ilo'
    AND tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    AND EXISTS (
      SELECT 1 FROM public.fsc_ilo_assessments a
      WHERE a.session_id = assessment_sessions.id
        AND public.fsc_is_company_member(a.company_id)
    )
  );

-- Company editors can update ILO sessions (e.g. status)
CREATE POLICY "fsc_ilo_session_update_editor"
  ON public.assessment_sessions
  FOR UPDATE TO authenticated
  USING (
    session_type = 'ilo'
    AND tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    AND EXISTS (
      SELECT 1 FROM public.fsc_ilo_assessments a
      WHERE a.session_id = assessment_sessions.id
        AND public.fsc_is_company_editor(a.company_id)
    )
  )
  WITH CHECK (
    session_type = 'ilo'
    AND tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    AND EXISTS (
      SELECT 1 FROM public.fsc_ilo_assessments a
      WHERE a.session_id = assessment_sessions.id
        AND public.fsc_is_company_editor(a.company_id)
    )
  );

-- Company members can read responses on ILO company sessions
CREATE POLICY "fsc_ilo_responses_select_member"
  ON public.user_responses
  FOR SELECT TO authenticated
  USING (
    tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    AND session_id IN (
      SELECT a.session_id FROM public.fsc_ilo_assessments a
      WHERE a.session_id IS NOT NULL
        AND public.fsc_is_company_member(a.company_id)
    )
  );

-- Company editors can insert/update responses on ILO company sessions
CREATE POLICY "fsc_ilo_responses_insert_editor"
  ON public.user_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    AND session_id IN (
      SELECT a.session_id FROM public.fsc_ilo_assessments a
      WHERE a.session_id IS NOT NULL
        AND public.fsc_is_company_editor(a.company_id)
    )
  );

CREATE POLICY "fsc_ilo_responses_update_editor"
  ON public.user_responses
  FOR UPDATE TO authenticated
  USING (
    tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    AND session_id IN (
      SELECT a.session_id FROM public.fsc_ilo_assessments a
      WHERE a.session_id IS NOT NULL
        AND public.fsc_is_company_editor(a.company_id)
    )
  )
  WITH CHECK (
    tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    AND session_id IN (
      SELECT a.session_id FROM public.fsc_ilo_assessments a
      WHERE a.session_id IS NOT NULL
        AND public.fsc_is_company_editor(a.company_id)
    )
  );

CREATE POLICY "fsc_ilo_responses_delete_editor"
  ON public.user_responses
  FOR DELETE TO authenticated
  USING (
    tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    AND session_id IN (
      SELECT a.session_id FROM public.fsc_ilo_assessments a
      WHERE a.session_id IS NOT NULL
        AND public.fsc_is_company_editor(a.company_id)
    )
  );

-- Backfill sessions for existing assessments without session_id
DO $$
DECLARE
  rec RECORD;
  new_session_id uuid;
  editor_user_id uuid;
BEGIN
  FOR rec IN
    SELECT a.id, a.company_id, a.reference_year
    FROM public.fsc_ilo_assessments a
    WHERE a.session_id IS NULL
  LOOP
    SELECT m.user_id INTO editor_user_id
    FROM public.fsc_company_members m
    WHERE m.company_id = rec.company_id AND m.can_edit = true
    ORDER BY m.created_at
    LIMIT 1;

    IF editor_user_id IS NULL THEN
      SELECT m.user_id INTO editor_user_id
      FROM public.fsc_company_members m
      WHERE m.company_id = rec.company_id
      ORDER BY m.created_at
      LIMIT 1;
    END IF;

    IF editor_user_id IS NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.assessment_sessions (
      user_id, tool_id, session_type, status, metadata
    ) VALUES (
      editor_user_id,
      '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid,
      'ilo',
      'in_progress',
      jsonb_build_object('company_id', rec.company_id, 'reference_year', rec.reference_year)
    )
    RETURNING id INTO new_session_id;

    UPDATE public.fsc_ilo_assessments
    SET session_id = new_session_id
    WHERE id = rec.id;
  END LOOP;
END $$;
