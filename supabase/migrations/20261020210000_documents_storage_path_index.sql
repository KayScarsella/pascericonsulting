-- Speed up download ACL lookups and storage RLS joins on documents.storage_path.
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_storage_path
  ON public.documents (storage_path)
  WHERE storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_tool_storage_path
  ON public.documents (tool_id, storage_path)
  WHERE storage_path IS NOT NULL;
