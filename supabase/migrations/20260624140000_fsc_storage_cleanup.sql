-- CLOUD FSC – Cleanup: rimuove policy storage legacy e colonne storage_path deprecate

-- Legacy per-modulo storage policies (sostituite da fsc_registry_storage_*)
DROP POLICY IF EXISTS "fsc_documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "fsc_documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "fsc_documents_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "fsc_documents_storage_delete" ON storage.objects;

DROP POLICY IF EXISTS "fsc_logos_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "fsc_logos_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "fsc_logos_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "fsc_logos_storage_update" ON storage.objects;

DROP POLICY IF EXISTS "fsc_supplier_attachments_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "fsc_supplier_attachments_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "fsc_supplier_attachments_storage_delete" ON storage.objects;

DROP POLICY IF EXISTS "fsc_subcontractor_attachments_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "fsc_subcontractor_attachments_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "fsc_subcontractor_attachments_storage_delete" ON storage.objects;

DROP POLICY IF EXISTS "fsc_product_group_addenda_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "fsc_product_group_addenda_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "fsc_product_group_addenda_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "fsc_product_group_addenda_storage_update" ON storage.objects;

DROP POLICY IF EXISTS "fsc_ilo_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "fsc_ilo_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "fsc_ilo_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "fsc_ilo_storage_delete" ON storage.objects;

-- Colonne storage deprecate (registry = fonte di verità)
ALTER TABLE public.fsc_documents DROP COLUMN IF EXISTS storage_path;

ALTER TABLE public.fsc_logos DROP COLUMN IF EXISTS approval_email_path;
ALTER TABLE public.fsc_logos DROP COLUMN IF EXISTS graphic_path;

ALTER TABLE public.fsc_supplier_attachments DROP COLUMN IF EXISTS storage_path;
ALTER TABLE public.fsc_subcontractor_attachments DROP COLUMN IF EXISTS storage_path;

ALTER TABLE public.fsc_product_group_addenda DROP COLUMN IF EXISTS storage_path;

ALTER TABLE public.fsc_ilo_assessments DROP COLUMN IF EXISTS compiled_doc_path;
ALTER TABLE public.fsc_ilo_assessments DROP COLUMN IF EXISTS compiled_pdf_path;
ALTER TABLE public.fsc_ilo_assessments DROP COLUMN IF EXISTS template_storage_path;

-- Hardening RPC reconciliation (service_role only)
REVOKE ALL ON FUNCTION public.fsc_process_storage_reconciliation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_process_storage_reconciliation() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_process_storage_reconciliation() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_process_storage_reconciliation() TO service_role;

REVOKE ALL ON FUNCTION public.fsc_expire_pending_storage_uploads() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_expire_pending_storage_uploads() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_expire_pending_storage_uploads() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_expire_pending_storage_uploads() TO service_role;

REVOKE ALL ON FUNCTION public.fsc_mark_broken_active_without_storage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_mark_broken_active_without_storage() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_mark_broken_active_without_storage() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_mark_broken_active_without_storage() TO service_role;
