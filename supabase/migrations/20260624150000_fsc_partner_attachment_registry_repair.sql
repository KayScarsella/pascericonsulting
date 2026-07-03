-- Ripara allegati fornitori/terzisti senza link nel registry o con upload non finalizzato

-- 1) Attiva oggetti pending_upload se il file esiste già in storage
UPDATE public.fsc_storage_objects o
SET
  status = 'active',
  activated_at = COALESCE(o.activated_at, now()),
  upload_expires_at = NULL
FROM public.fsc_storage_object_links l
WHERE l.storage_object_id = o.id
  AND o.status = 'pending_upload'
  AND l.owner_type IN ('fsc_supplier_attachment', 'fsc_subcontractor_attachment')
  AND EXISTS (
    SELECT 1
    FROM storage.objects so
    WHERE so.bucket_id = o.bucket
      AND so.name = o.storage_path
  );

-- 2) Fornitori: registra file in storage senza link registry
INSERT INTO public.fsc_storage_objects (
  company_id, bucket, storage_path, status, original_filename,
  mime_type, size_bytes, activated_at, created_by, created_at
)
SELECT DISTINCT ON (a.id)
  s.company_id,
  'fsc-documents',
  o.name,
  'active',
  COALESCE(a.file_name, regexp_replace(o.name, '^.*/', '')),
  a.mime_type,
  a.size,
  COALESCE(a.created_at, o.created_at),
  a.created_by,
  COALESCE(a.created_at, o.created_at)
FROM public.fsc_supplier_attachments a
JOIN public.fsc_suppliers s ON s.id = a.supplier_id
JOIN storage.objects o ON o.bucket_id = 'fsc-documents'
  AND (
    o.name = s.company_id::text
      || '/suppliers/' || a.attachment_type::text
      || '/' || a.supplier_id::text || '_' || a.id::text
      || '/' || a.id::text || '_'
      || regexp_replace(COALESCE(a.file_name, ''), '[^a-zA-Z0-9.-]', '_', 'g')
    OR (
      o.name LIKE s.company_id::text
        || '/suppliers/' || a.supplier_id::text
        || '/' || a.attachment_type::text || '/%'
      AND a.file_name IS NOT NULL
      AND o.name LIKE '%_' || regexp_replace(a.file_name, '[^a-zA-Z0-9.-]', '_', 'g')
    )
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.fsc_storage_object_links l
  WHERE l.owner_type = 'fsc_supplier_attachment'
    AND l.owner_id = a.id
    AND l.slot = 'primary'
)
ORDER BY a.id, o.created_at DESC
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_supplier_attachment', a.id, 'primary'
FROM public.fsc_supplier_attachments a
JOIN public.fsc_storage_objects o ON o.storage_path IN (
  SELECT so.name
  FROM storage.objects so
  JOIN public.fsc_suppliers s ON s.id = a.supplier_id
  WHERE so.bucket_id = 'fsc-documents'
    AND (
      so.name = s.company_id::text
        || '/suppliers/' || a.attachment_type::text
        || '/' || a.supplier_id::text || '_' || a.id::text
        || '/' || a.id::text || '_'
        || regexp_replace(COALESCE(a.file_name, ''), '[^a-zA-Z0-9.-]', '_', 'g')
      OR (
        so.name LIKE s.company_id::text
          || '/suppliers/' || a.supplier_id::text
          || '/' || a.attachment_type::text || '/%'
        AND a.file_name IS NOT NULL
        AND so.name LIKE '%_' || regexp_replace(a.file_name, '[^a-zA-Z0-9.-]', '_', 'g')
      )
    )
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.fsc_storage_object_links l
  WHERE l.owner_type = 'fsc_supplier_attachment'
    AND l.owner_id = a.id
    AND l.slot = 'primary'
)
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;

-- 3) Terzisti: stesso schema
INSERT INTO public.fsc_storage_objects (
  company_id, bucket, storage_path, status, original_filename,
  mime_type, size_bytes, activated_at, created_by, created_at
)
SELECT DISTINCT ON (a.id)
  s.company_id,
  'fsc-documents',
  o.name,
  'active',
  COALESCE(a.file_name, regexp_replace(o.name, '^.*/', '')),
  a.mime_type,
  a.size,
  COALESCE(a.created_at, o.created_at),
  a.created_by,
  COALESCE(a.created_at, o.created_at)
FROM public.fsc_subcontractor_attachments a
JOIN public.fsc_subcontractors s ON s.id = a.subcontractor_id
JOIN storage.objects o ON o.bucket_id = 'fsc-documents'
  AND (
    o.name = s.company_id::text
      || '/subcontractors/' || a.attachment_type::text
      || '/' || a.subcontractor_id::text || '_' || a.id::text
      || '/' || a.id::text || '_'
      || regexp_replace(COALESCE(a.file_name, ''), '[^a-zA-Z0-9.-]', '_', 'g')
    OR (
      o.name LIKE s.company_id::text
        || '/subcontractors/' || a.subcontractor_id::text
        || '/' || a.attachment_type::text || '/%'
      AND a.file_name IS NOT NULL
      AND o.name LIKE '%_' || regexp_replace(a.file_name, '[^a-zA-Z0-9.-]', '_', 'g')
    )
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.fsc_storage_object_links l
  WHERE l.owner_type = 'fsc_subcontractor_attachment'
    AND l.owner_id = a.id
    AND l.slot = 'primary'
)
ORDER BY a.id, o.created_at DESC
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_subcontractor_attachment', a.id, 'primary'
FROM public.fsc_subcontractor_attachments a
JOIN public.fsc_storage_objects o ON o.storage_path IN (
  SELECT so.name
  FROM storage.objects so
  JOIN public.fsc_subcontractors s ON s.id = a.subcontractor_id
  WHERE so.bucket_id = 'fsc-documents'
    AND (
      so.name = s.company_id::text
        || '/subcontractors/' || a.attachment_type::text
        || '/' || a.subcontractor_id::text || '_' || a.id::text
        || '/' || a.id::text || '_'
        || regexp_replace(COALESCE(a.file_name, ''), '[^a-zA-Z0-9.-]', '_', 'g')
      OR (
        so.name LIKE s.company_id::text
          || '/subcontractors/' || a.subcontractor_id::text
          || '/' || a.attachment_type::text || '/%'
        AND a.file_name IS NOT NULL
        AND so.name LIKE '%_' || regexp_replace(a.file_name, '[^a-zA-Z0-9.-]', '_', 'g')
      )
    )
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.fsc_storage_object_links l
  WHERE l.owner_type = 'fsc_subcontractor_attachment'
    AND l.owner_id = a.id
    AND l.slot = 'primary'
)
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;
