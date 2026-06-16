-- CLOUD FSC: restringe INSERT su bucket fsc-documents alla riga fsc_documents precreata.

DROP POLICY IF EXISTS "fsc_documents_storage_insert" ON storage.objects;

CREATE POLICY "fsc_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fsc-documents'
    AND EXISTS (
      SELECT 1 FROM public.fsc_documents d
      WHERE d.storage_path = objects.name
        AND public.fsc_is_company_editor(d.company_id)
    )
  );
