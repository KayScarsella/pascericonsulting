-- CLOUD FSC – Fase C: documenti FSC, autovalutazione ILO, storage bucket

CREATE TYPE public.fsc_document_module AS ENUM ('gestione', 'ente');
CREATE TYPE public.fsc_document_status AS ENUM ('active', 'archived');

CREATE TABLE public.fsc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.tools (id) ON DELETE CASCADE,
  module public.fsc_document_module NOT NULL,
  category text NOT NULL,
  name text NOT NULL,
  reference_year integer,
  expires_at date,
  reviewed_at date,
  storage_path text,
  mime_type text,
  size bigint,
  version integer NOT NULL DEFAULT 1,
  parent_document_id uuid REFERENCES public.fsc_documents (id) ON DELETE SET NULL,
  status public.fsc_document_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fsc_document_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.fsc_documents (id) ON DELETE CASCADE,
  alert_type text NOT NULL DEFAULT 'expiry_30d',
  sent_at timestamptz,
  recipient_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsc_document_alerts_unique UNIQUE (document_id, alert_type, recipient_user_id)
);

CREATE TABLE public.fsc_ilo_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  reference_year integer NOT NULL,
  template_storage_path text,
  compiled_doc_path text,
  compiled_pdf_path text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsc_ilo_assessments_company_year_unique UNIQUE (company_id, reference_year)
);

CREATE INDEX idx_fsc_documents_company_module ON public.fsc_documents (company_id, module);
CREATE INDEX idx_fsc_documents_expires ON public.fsc_documents (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_fsc_ilo_assessments_company ON public.fsc_ilo_assessments (company_id);

CREATE TRIGGER fsc_documents_updated_at BEFORE UPDATE ON public.fsc_documents
  FOR EACH ROW EXECUTE FUNCTION public.fsc_set_updated_at();
CREATE TRIGGER fsc_ilo_assessments_updated_at BEFORE UPDATE ON public.fsc_ilo_assessments
  FOR EACH ROW EXECUTE FUNCTION public.fsc_set_updated_at();

ALTER TABLE public.fsc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_document_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_ilo_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fsc_documents_select" ON public.fsc_documents FOR SELECT TO authenticated
  USING (public.fsc_is_company_member(company_id));
CREATE POLICY "fsc_documents_insert" ON public.fsc_documents FOR INSERT TO authenticated
  WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_documents_update" ON public.fsc_documents FOR UPDATE TO authenticated
  USING (public.fsc_is_company_editor(company_id)) WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_documents_delete" ON public.fsc_documents FOR DELETE TO authenticated
  USING (public.fsc_is_company_editor(company_id));

CREATE POLICY "fsc_document_alerts_select" ON public.fsc_document_alerts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fsc_documents d
    WHERE d.id = document_id AND public.fsc_is_company_member(d.company_id)
  ));

CREATE POLICY "fsc_ilo_select" ON public.fsc_ilo_assessments FOR SELECT TO authenticated
  USING (public.fsc_is_company_member(company_id));
CREATE POLICY "fsc_ilo_insert" ON public.fsc_ilo_assessments FOR INSERT TO authenticated
  WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_ilo_update" ON public.fsc_ilo_assessments FOR UPDATE TO authenticated
  USING (public.fsc_is_company_editor(company_id)) WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_ilo_delete" ON public.fsc_ilo_assessments FOR DELETE TO authenticated
  USING (public.fsc_is_company_editor(company_id));

-- Storage bucket fsc-documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fsc-documents',
  'fsc-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fsc_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND EXISTS (
      SELECT 1 FROM public.fsc_documents d
      WHERE d.storage_path = objects.name
        AND public.fsc_is_company_member(d.company_id)
    )
  );

CREATE POLICY "fsc_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[1] IS NOT NULL
  );

CREATE POLICY "fsc_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND EXISTS (
      SELECT 1 FROM public.fsc_documents d
      WHERE d.storage_path = objects.name AND public.fsc_is_company_editor(d.company_id)
    )
  )
  WITH CHECK (bucket_id = 'fsc-documents');

CREATE POLICY "fsc_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND EXISTS (
      SELECT 1 FROM public.fsc_documents d
      WHERE d.storage_path = objects.name AND public.fsc_is_company_editor(d.company_id)
    )
  );
