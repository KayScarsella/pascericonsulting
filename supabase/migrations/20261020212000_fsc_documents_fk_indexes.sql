-- Hot-path indexes for FSC document listing / version trees (Advisors: unindexed FKs).
CREATE INDEX IF NOT EXISTS idx_fsc_documents_parent_document_id
  ON public.fsc_documents (parent_document_id)
  WHERE parent_document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsc_documents_created_by
  ON public.fsc_documents (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsc_documents_company_module_status_category
  ON public.fsc_documents (company_id, module, status, category);
