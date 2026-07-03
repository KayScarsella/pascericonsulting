-- CLOUD FSC – Modulo 7: storage RLS per file loghi (email approvazione + grafica)

CREATE POLICY "fsc_logos_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.fsc_logos l
      WHERE (l.approval_email_path = name OR l.graphic_path = name)
        AND public.fsc_is_company_editor(l.company_id)
    )
  );

CREATE POLICY "fsc_logos_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.fsc_logos l
      WHERE (l.approval_email_path = name OR l.graphic_path = name)
        AND public.fsc_is_company_member(l.company_id)
    )
  );

CREATE POLICY "fsc_logos_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.fsc_logos l
      WHERE (l.approval_email_path = name OR l.graphic_path = name)
        AND public.fsc_is_company_editor(l.company_id)
    )
  );

CREATE POLICY "fsc_logos_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'logos'
    AND EXISTS (
      SELECT 1 FROM public.fsc_logos l
      WHERE (l.approval_email_path = name OR l.graphic_path = name)
        AND public.fsc_is_company_editor(l.company_id)
    )
  );
