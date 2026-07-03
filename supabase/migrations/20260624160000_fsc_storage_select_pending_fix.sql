-- Consente la lettura in storage dei file in pending_upload durante finalize (editor della company).
-- Senza questa policy createSignedUrl fallisce e finalize resta bloccato su pending_upload.

DROP POLICY IF EXISTS "fsc_registry_storage_select" ON storage.objects;

CREATE POLICY "fsc_registry_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND EXISTS (
      SELECT 1 FROM public.fsc_storage_objects o
      WHERE o.storage_path = objects.name
        AND o.bucket = 'fsc-documents'
        AND (
          (
            o.status IN ('active', 'delete_pending')
            AND public.fsc_is_company_member(o.company_id)
          )
          OR (
            o.status = 'pending_upload'
            AND public.fsc_is_company_editor(o.company_id)
          )
        )
    )
  );

-- Attiva upload già presenti in storage ma mai finalizzati
UPDATE public.fsc_storage_objects o
SET
  status = 'active',
  activated_at = COALESCE(o.activated_at, now()),
  upload_expires_at = NULL,
  size_bytes = COALESCE(
    o.size_bytes,
    (
      SELECT NULLIF(so.metadata ->> 'size', '')::bigint
      FROM storage.objects so
      WHERE so.bucket_id = 'fsc-documents'
        AND so.name = o.storage_path
    )
  )
WHERE o.status = 'pending_upload'
  AND EXISTS (
    SELECT 1
    FROM storage.objects so
    WHERE so.bucket_id = 'fsc-documents'
      AND so.name = o.storage_path
  );
