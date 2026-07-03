-- CLOUD FSC – Registry centralizzato file storage + outbox delete + reconciliation

CREATE TYPE public.fsc_storage_object_status AS ENUM (
  'pending_upload',
  'active',
  'delete_pending',
  'deleted',
  'broken'
);

CREATE TABLE public.fsc_storage_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  bucket text NOT NULL DEFAULT 'fsc-documents',
  storage_path text NOT NULL,
  status public.fsc_storage_object_status NOT NULL DEFAULT 'pending_upload',
  original_filename text NOT NULL,
  mime_type text,
  size_bytes bigint,
  upload_expires_at timestamptz,
  activated_at timestamptz,
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsc_storage_objects_path_unique UNIQUE (storage_path),
  CONSTRAINT fsc_storage_objects_bucket_path_unique UNIQUE (bucket, storage_path)
);

CREATE INDEX idx_fsc_storage_objects_pending_expiry
  ON public.fsc_storage_objects (upload_expires_at)
  WHERE status = 'pending_upload';

CREATE INDEX idx_fsc_storage_objects_company_status
  ON public.fsc_storage_objects (company_id, status);

CREATE TABLE public.fsc_storage_object_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_object_id uuid NOT NULL REFERENCES public.fsc_storage_objects (id) ON DELETE CASCADE,
  owner_type text NOT NULL,
  owner_id uuid NOT NULL,
  slot text NOT NULL DEFAULT 'primary',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsc_storage_object_links_owner_slot_unique UNIQUE (owner_type, owner_id, slot)
);

CREATE INDEX idx_fsc_storage_object_links_owner
  ON public.fsc_storage_object_links (owner_type, owner_id);

CREATE INDEX idx_fsc_storage_object_links_object
  ON public.fsc_storage_object_links (storage_object_id);

CREATE TABLE public.fsc_storage_delete_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_object_id uuid NOT NULL REFERENCES public.fsc_storage_objects (id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  bucket text NOT NULL DEFAULT 'fsc-documents',
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsc_storage_delete_outbox_object_unique UNIQUE (storage_object_id)
);

CREATE INDEX idx_fsc_storage_delete_outbox_pending
  ON public.fsc_storage_delete_outbox (created_at)
  WHERE processed_at IS NULL;

CREATE TABLE public.fsc_storage_reconcile_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  storage_path text,
  storage_object_id uuid REFERENCES public.fsc_storage_objects (id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  grace_until timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fsc_storage_reconcile_queue_pending
  ON public.fsc_storage_reconcile_queue (grace_until, created_at)
  WHERE processed_at IS NULL;

-- RLS: registry tables
ALTER TABLE public.fsc_storage_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_storage_object_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_storage_delete_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_storage_reconcile_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fsc_storage_objects_select"
  ON public.fsc_storage_objects FOR SELECT TO authenticated
  USING (public.fsc_is_company_member(company_id));

CREATE POLICY "fsc_storage_objects_insert"
  ON public.fsc_storage_objects FOR INSERT TO authenticated
  WITH CHECK (
    public.fsc_is_company_editor(company_id)
    AND status = 'pending_upload'
    AND created_by = (SELECT auth.uid())
  );

CREATE POLICY "fsc_storage_objects_update"
  ON public.fsc_storage_objects FOR UPDATE TO authenticated
  USING (public.fsc_is_company_editor(company_id))
  WITH CHECK (public.fsc_is_company_editor(company_id));

CREATE POLICY "fsc_storage_objects_delete"
  ON public.fsc_storage_objects FOR DELETE TO authenticated
  USING (
    public.fsc_is_company_editor(company_id)
    AND status = 'pending_upload'
  );

CREATE POLICY "fsc_storage_object_links_select"
  ON public.fsc_storage_object_links FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fsc_storage_objects o
      WHERE o.id = storage_object_id
        AND public.fsc_is_company_member(o.company_id)
    )
  );

CREATE POLICY "fsc_storage_object_links_insert"
  ON public.fsc_storage_object_links FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fsc_storage_objects o
      WHERE o.id = storage_object_id
        AND public.fsc_is_company_editor(o.company_id)
    )
  );

CREATE POLICY "fsc_storage_object_links_delete"
  ON public.fsc_storage_object_links FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fsc_storage_objects o
      WHERE o.id = storage_object_id
        AND public.fsc_is_company_editor(o.company_id)
    )
  );

CREATE POLICY "fsc_storage_delete_outbox_select"
  ON public.fsc_storage_delete_outbox FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fsc_storage_objects o
      WHERE o.id = storage_object_id
        AND public.fsc_is_company_member(o.company_id)
    )
  );

CREATE POLICY "fsc_storage_reconcile_queue_select"
  ON public.fsc_storage_reconcile_queue FOR SELECT TO authenticated
  USING (
    company_id IS NULL
    OR public.fsc_is_company_member(company_id)
  );

-- Unified storage RLS (coexists with legacy per-module policies during migration)
CREATE POLICY "fsc_registry_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fsc-documents'
    AND EXISTS (
      SELECT 1 FROM public.fsc_storage_objects o
      WHERE o.storage_path = objects.name
        AND o.bucket = 'fsc-documents'
        AND o.status = 'pending_upload'
        AND public.fsc_is_company_editor(o.company_id)
    )
  );

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

CREATE POLICY "fsc_registry_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND EXISTS (
      SELECT 1 FROM public.fsc_storage_objects o
      WHERE o.storage_path = objects.name
        AND o.bucket = 'fsc-documents'
        AND o.status IN ('pending_upload', 'active')
        AND public.fsc_is_company_editor(o.company_id)
    )
  );

CREATE POLICY "fsc_registry_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND EXISTS (
      SELECT 1 FROM public.fsc_storage_objects o
      WHERE o.storage_path = objects.name
        AND o.bucket = 'fsc-documents'
        AND public.fsc_is_company_editor(o.company_id)
    )
  );

-- Backfill existing storage paths into registry (status = active)
INSERT INTO public.fsc_storage_objects (
  id, company_id, bucket, storage_path, status, original_filename,
  mime_type, size_bytes, activated_at, created_by, created_at
)
SELECT
  gen_random_uuid(),
  d.company_id,
  'fsc-documents',
  d.storage_path,
  'active',
  COALESCE(
    NULLIF(regexp_replace(d.storage_path, '^.*/', ''), ''),
    d.name
  ),
  d.mime_type,
  d.size,
  d.created_at,
  d.created_by,
  d.created_at
FROM public.fsc_documents d
WHERE d.storage_path IS NOT NULL
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_document', d.id, 'primary'
FROM public.fsc_documents d
JOIN public.fsc_storage_objects o ON o.storage_path = d.storage_path
WHERE d.storage_path IS NOT NULL
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;

INSERT INTO public.fsc_storage_objects (
  company_id, bucket, storage_path, status, original_filename, activated_at, created_by, created_at
)
SELECT
  l.company_id,
  'fsc-documents',
  l.approval_email_path,
  'active',
  COALESCE(NULLIF(regexp_replace(l.approval_email_path, '^.*/', ''), ''), 'approval'),
  l.created_at,
  l.created_by,
  l.created_at
FROM public.fsc_logos l
WHERE l.approval_email_path IS NOT NULL
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_logo', l.id, 'approval'
FROM public.fsc_logos l
JOIN public.fsc_storage_objects o ON o.storage_path = l.approval_email_path
WHERE l.approval_email_path IS NOT NULL
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;

INSERT INTO public.fsc_storage_objects (
  company_id, bucket, storage_path, status, original_filename, activated_at, created_by, created_at
)
SELECT
  l.company_id,
  'fsc-documents',
  l.graphic_path,
  'active',
  COALESCE(NULLIF(regexp_replace(l.graphic_path, '^.*/', ''), ''), 'graphic'),
  l.created_at,
  l.created_by,
  l.created_at
FROM public.fsc_logos l
WHERE l.graphic_path IS NOT NULL
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_logo', l.id, 'graphic'
FROM public.fsc_logos l
JOIN public.fsc_storage_objects o ON o.storage_path = l.graphic_path
WHERE l.graphic_path IS NOT NULL
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;

INSERT INTO public.fsc_storage_objects (
  company_id, bucket, storage_path, status, original_filename, mime_type, size_bytes, activated_at, created_by, created_at
)
SELECT
  s.company_id,
  'fsc-documents',
  a.storage_path,
  'active',
  a.file_name,
  a.mime_type,
  a.size,
  a.created_at,
  a.created_by,
  a.created_at
FROM public.fsc_supplier_attachments a
JOIN public.fsc_suppliers s ON s.id = a.supplier_id
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_supplier_attachment', a.id, 'primary'
FROM public.fsc_supplier_attachments a
JOIN public.fsc_storage_objects o ON o.storage_path = a.storage_path
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;

INSERT INTO public.fsc_storage_objects (
  company_id, bucket, storage_path, status, original_filename, mime_type, size_bytes, activated_at, created_by, created_at
)
SELECT
  s.company_id,
  'fsc-documents',
  a.storage_path,
  'active',
  a.file_name,
  a.mime_type,
  a.size,
  a.created_at,
  a.created_by,
  a.created_at
FROM public.fsc_subcontractor_attachments a
JOIN public.fsc_subcontractors s ON s.id = a.subcontractor_id
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_subcontractor_attachment', a.id, 'primary'
FROM public.fsc_subcontractor_attachments a
JOIN public.fsc_storage_objects o ON o.storage_path = a.storage_path
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;

INSERT INTO public.fsc_storage_objects (
  company_id, bucket, storage_path, status, original_filename, activated_at, created_at
)
SELECT
  cpg.company_id,
  'fsc-documents',
  ad.storage_path,
  'active',
  COALESCE(NULLIF(regexp_replace(ad.storage_path, '^.*/', ''), ''), 'addendum'),
  ad.generated_at,
  ad.generated_at
FROM public.fsc_product_group_addenda ad
JOIN public.fsc_company_product_groups cpg ON cpg.id = ad.company_product_group_id
WHERE ad.storage_path IS NOT NULL
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_product_group_addendum', ad.id, 'primary'
FROM public.fsc_product_group_addenda ad
JOIN public.fsc_storage_objects o ON o.storage_path = ad.storage_path
WHERE ad.storage_path IS NOT NULL
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;

INSERT INTO public.fsc_storage_objects (
  company_id, bucket, storage_path, status, original_filename, activated_at, created_at
)
SELECT
  a.company_id,
  'fsc-documents',
  a.compiled_doc_path,
  'active',
  COALESCE(NULLIF(regexp_replace(a.compiled_doc_path, '^.*/', ''), ''), 'autovalutazione.docx'),
  COALESCE(a.compiled_word_uploaded_at, a.created_at),
  a.created_at
FROM public.fsc_ilo_assessments a
WHERE a.compiled_doc_path IS NOT NULL
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_ilo_assessment', a.id, 'compiled_word'
FROM public.fsc_ilo_assessments a
JOIN public.fsc_storage_objects o ON o.storage_path = a.compiled_doc_path
WHERE a.compiled_doc_path IS NOT NULL
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;

INSERT INTO public.fsc_storage_objects (
  company_id, bucket, storage_path, status, original_filename, activated_at, created_at
)
SELECT
  a.company_id,
  'fsc-documents',
  a.compiled_pdf_path,
  'active',
  COALESCE(NULLIF(regexp_replace(a.compiled_pdf_path, '^.*/', ''), ''), 'autovalutazione.pdf'),
  a.created_at,
  a.created_at
FROM public.fsc_ilo_assessments a
WHERE a.compiled_pdf_path IS NOT NULL
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO public.fsc_storage_object_links (storage_object_id, owner_type, owner_id, slot)
SELECT o.id, 'fsc_ilo_assessment', a.id, 'compiled_pdf'
FROM public.fsc_ilo_assessments a
JOIN public.fsc_storage_objects o ON o.storage_path = a.compiled_pdf_path
WHERE a.compiled_pdf_path IS NOT NULL
ON CONFLICT ON CONSTRAINT fsc_storage_object_links_owner_slot_unique DO NOTHING;

-- Reconciliation RPC (service_role)
CREATE OR REPLACE FUNCTION public.fsc_expire_pending_storage_uploads()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
  _row record;
BEGIN
  FOR _row IN
    SELECT id, storage_path, bucket
    FROM public.fsc_storage_objects
    WHERE status = 'pending_upload'
      AND upload_expires_at IS NOT NULL
      AND upload_expires_at < now()
  LOOP
    INSERT INTO public.fsc_storage_reconcile_queue (kind, storage_path, storage_object_id, payload)
    VALUES (
      'expire_pending_upload',
      _row.storage_path,
      _row.id,
      jsonb_build_object('bucket', _row.bucket)
    );

    DELETE FROM public.fsc_storage_object_links WHERE storage_object_id = _row.id;
    DELETE FROM public.fsc_storage_objects WHERE id = _row.id;
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_mark_broken_active_without_storage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
BEGIN
  -- Application layer verifies storage; DB marks candidates queued for manual review.
  INSERT INTO public.fsc_storage_reconcile_queue (kind, storage_object_id, company_id, storage_path, payload)
  SELECT
    'verify_active_exists',
    o.id,
    o.company_id,
    o.storage_path,
    jsonb_build_object('bucket', o.bucket)
  FROM public.fsc_storage_objects o
  WHERE o.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.fsc_storage_reconcile_queue q
      WHERE q.storage_object_id = o.id
        AND q.kind = 'verify_active_exists'
        AND q.processed_at IS NULL
    )
  LIMIT 200;

  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_process_storage_reconciliation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expired integer;
  _queued integer;
BEGIN
  _expired := public.fsc_expire_pending_storage_uploads();
  _queued := public.fsc_mark_broken_active_without_storage();

  RETURN jsonb_build_object(
    'expired_pending_uploads', _expired,
    'verify_active_queued', _queued
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fsc_expire_pending_storage_uploads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_expire_pending_storage_uploads() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_expire_pending_storage_uploads() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_expire_pending_storage_uploads() TO service_role;

REVOKE ALL ON FUNCTION public.fsc_mark_broken_active_without_storage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_mark_broken_active_without_storage() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_mark_broken_active_without_storage() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_mark_broken_active_without_storage() TO service_role;

REVOKE ALL ON FUNCTION public.fsc_process_storage_reconciliation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_process_storage_reconciliation() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_process_storage_reconciliation() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_process_storage_reconciliation() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('fsc_daily_storage_reconcile');
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
      'fsc_daily_storage_reconcile',
      '30 7 * * *',
      $job$SELECT public.fsc_process_storage_reconciliation();$job$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'fsc_daily_storage_reconcile cron not scheduled: %', SQLERRM;
END;
$cron$;
