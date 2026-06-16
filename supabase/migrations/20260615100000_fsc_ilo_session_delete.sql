-- CLOUD FSC ILO: allow company editors to delete ILO assessment sessions

CREATE POLICY "fsc_ilo_session_delete_editor"
  ON public.assessment_sessions
  FOR DELETE TO authenticated
  USING (
    session_type = 'ilo'
    AND tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    AND EXISTS (
      SELECT 1 FROM public.fsc_ilo_assessments a
      WHERE a.session_id = assessment_sessions.id
        AND public.fsc_is_company_editor(a.company_id)
    )
  );
