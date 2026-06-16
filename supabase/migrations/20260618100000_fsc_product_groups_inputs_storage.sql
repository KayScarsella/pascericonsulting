-- CLOUD FSC – Modulo 6: input necessari, unique index, storage addendum

ALTER TABLE public.fsc_company_product_groups
  ADD COLUMN IF NOT EXISTS required_inputs text;

CREATE UNIQUE INDEX IF NOT EXISTS fsc_company_product_groups_catalog_unique
  ON public.fsc_company_product_groups (company_id, catalog_group_id)
  WHERE catalog_group_id IS NOT NULL;

-- Storage: product group addendum files
CREATE POLICY "fsc_product_group_addenda_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'product-groups'
    AND EXISTS (
      SELECT 1 FROM public.fsc_product_group_addenda a
      INNER JOIN public.fsc_company_product_groups g ON g.id = a.company_product_group_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_editor(g.company_id)
    )
  );

CREATE POLICY "fsc_product_group_addenda_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'product-groups'
    AND EXISTS (
      SELECT 1 FROM public.fsc_product_group_addenda a
      INNER JOIN public.fsc_company_product_groups g ON g.id = a.company_product_group_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_member(g.company_id)
    )
  );

CREATE POLICY "fsc_product_group_addenda_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'product-groups'
    AND EXISTS (
      SELECT 1 FROM public.fsc_product_group_addenda a
      INNER JOIN public.fsc_company_product_groups g ON g.id = a.company_product_group_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_editor(g.company_id)
    )
  );

CREATE POLICY "fsc_product_group_addenda_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'product-groups'
    AND EXISTS (
      SELECT 1 FROM public.fsc_product_group_addenda a
      INNER JOIN public.fsc_company_product_groups g ON g.id = a.company_product_group_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_editor(g.company_id)
    )
  );
