-- CLOUD FSC – Autovalutazione ILO: form_data, template master, storage RLS

ALTER TABLE public.fsc_ilo_assessments
  ADD COLUMN IF NOT EXISTS form_data jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS schema_version text NOT NULL DEFAULT 'it_coc_v1.2',
  ADD COLUMN IF NOT EXISTS duplicated_from_year integer,
  ADD COLUMN IF NOT EXISTS compiled_word_uploaded_at timestamptz;

CREATE TABLE public.fsc_ilo_template_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  storage_path text NOT NULL,
  schema_version text NOT NULL DEFAULT 'it_coc_v1.2',
  is_active boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsc_ilo_template_master_version_unique UNIQUE (version)
);

CREATE INDEX idx_fsc_ilo_template_master_active
  ON public.fsc_ilo_template_master (is_active)
  WHERE is_active = true;

ALTER TABLE public.fsc_ilo_template_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fsc_ilo_template_select" ON public.fsc_ilo_template_master
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tool_access ta
      WHERE ta.user_id = auth.uid()
        AND ta.tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
    )
  );

CREATE POLICY "fsc_ilo_template_insert" ON public.fsc_ilo_template_master
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid));

CREATE POLICY "fsc_ilo_template_update" ON public.fsc_ilo_template_master
  FOR UPDATE TO authenticated
  USING (public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid))
  WITH CHECK (public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid));

CREATE POLICY "fsc_ilo_template_delete" ON public.fsc_ilo_template_master
  FOR DELETE TO authenticated
  USING (public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid));

-- Storage: lettura file ILO azienda
CREATE POLICY "fsc_ilo_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (
      (
        (storage.foldername(name))[2] = 'ilo'
        AND EXISTS (
          SELECT 1 FROM public.fsc_ilo_assessments a
          WHERE a.company_id::text = (storage.foldername(name))[1]
            AND a.reference_year::text = (storage.foldername(name))[3]
            AND public.fsc_is_company_member(a.company_id)
            AND (
              a.compiled_doc_path = name
              OR a.compiled_pdf_path = name
              OR a.template_storage_path = name
            )
        )
      )
      OR (
        (storage.foldername(name))[1] = '_system'
        AND (storage.foldername(name))[2] = 'ilo'
        AND EXISTS (
          SELECT 1 FROM public.fsc_ilo_template_master t
          WHERE t.storage_path = name
        )
      )
    )
  );

-- Storage: insert file ILO (path già registrato su fsc_ilo_assessments o template master)
CREATE POLICY "fsc_ilo_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fsc-documents'
    AND (
      (
        (storage.foldername(name))[2] = 'ilo'
        AND EXISTS (
          SELECT 1 FROM public.fsc_ilo_assessments a
          WHERE a.company_id::text = (storage.foldername(name))[1]
            AND a.reference_year::text = (storage.foldername(name))[3]
            AND public.fsc_is_company_editor(a.company_id)
            AND (
              a.compiled_doc_path = name
              OR a.compiled_pdf_path = name
              OR a.template_storage_path = name
            )
        )
      )
      OR (
        (storage.foldername(name))[1] = '_system'
        AND (storage.foldername(name))[2] = 'ilo'
        AND public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid)
        AND EXISTS (
          SELECT 1 FROM public.fsc_ilo_template_master t
          WHERE t.storage_path = name
        )
      )
    )
  );

CREATE POLICY "fsc_ilo_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (
      (
        (storage.foldername(name))[2] = 'ilo'
        AND EXISTS (
          SELECT 1 FROM public.fsc_ilo_assessments a
          WHERE a.company_id::text = (storage.foldername(name))[1]
            AND public.fsc_is_company_editor(a.company_id)
            AND (a.compiled_doc_path = name OR a.compiled_pdf_path = name)
        )
      )
      OR (
        (storage.foldername(name))[1] = '_system'
        AND public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid)
      )
    )
  )
  WITH CHECK (bucket_id = 'fsc-documents');

CREATE POLICY "fsc_ilo_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (
      (
        (storage.foldername(name))[2] = 'ilo'
        AND EXISTS (
          SELECT 1 FROM public.fsc_ilo_assessments a
          WHERE a.company_id::text = (storage.foldername(name))[1]
            AND public.fsc_is_company_editor(a.company_id)
            AND (a.compiled_doc_path = name OR a.compiled_pdf_path = name)
        )
      )
      OR (
        (storage.foldername(name))[1] = '_system'
        AND public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid)
      )
    )
  );
