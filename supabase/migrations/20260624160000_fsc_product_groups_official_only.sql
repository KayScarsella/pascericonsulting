-- Solo gruppi prodotto FSC ufficiali: rimuove catalogo senza codice, gruppi custom,
-- pulisce storage registry e impone vincoli schema.

-- ---------------------------------------------------------------------------
-- 1) Gruppi azienda da eliminare (custom o collegati a catalogo non ufficiale)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE _fsc_pg_groups_to_delete ON COMMIT DROP AS
SELECT cpg.id
FROM public.fsc_company_product_groups cpg
WHERE (cpg.custom_label IS NOT NULL AND cpg.catalog_group_id IS NULL)
   OR cpg.catalog_group_id IN (
        SELECT id FROM public.fsc_product_groups_catalog
        WHERE code IS NULL OR trim(code) = ''
      );

CREATE TEMP TABLE _fsc_pg_addenda_to_delete ON COMMIT DROP AS
SELECT ad.id
FROM public.fsc_product_group_addenda ad
WHERE ad.company_product_group_id IN (SELECT id FROM _fsc_pg_groups_to_delete);

-- ---------------------------------------------------------------------------
-- 2) Storage: outbox + marca deleted + rimuovi link
-- ---------------------------------------------------------------------------
INSERT INTO public.fsc_storage_delete_outbox (storage_object_id, storage_path, bucket)
SELECT o.id, o.storage_path, o.bucket
FROM public.fsc_storage_object_links l
JOIN public.fsc_storage_objects o ON o.id = l.storage_object_id
WHERE l.owner_type = 'fsc_product_group_addendum'
  AND l.owner_id IN (SELECT id FROM _fsc_pg_addenda_to_delete)
  AND o.status IN ('active', 'pending_upload', 'delete_pending')
ON CONFLICT (storage_object_id) DO UPDATE
  SET processed_at = NULL,
      last_error = NULL,
      storage_path = EXCLUDED.storage_path,
      bucket = EXCLUDED.bucket;

UPDATE public.fsc_storage_objects o
SET
  status = 'deleted',
  deleted_at = COALESCE(o.deleted_at, now())
FROM public.fsc_storage_object_links l
WHERE l.storage_object_id = o.id
  AND l.owner_type = 'fsc_product_group_addendum'
  AND l.owner_id IN (SELECT id FROM _fsc_pg_addenda_to_delete)
  AND o.status IN ('active', 'pending_upload', 'delete_pending');

DELETE FROM public.fsc_storage_object_links l
WHERE l.owner_type = 'fsc_product_group_addendum'
  AND l.owner_id IN (SELECT id FROM _fsc_pg_addenda_to_delete);

-- ---------------------------------------------------------------------------
-- 3) Elimina gruppi azienda non ufficiali (CASCADE su claims + addenda)
-- ---------------------------------------------------------------------------
DELETE FROM public.fsc_company_product_groups
WHERE id IN (SELECT id FROM _fsc_pg_groups_to_delete);

DELETE FROM public.fsc_company_product_groups
WHERE catalog_group_id IS NULL;

-- ---------------------------------------------------------------------------
-- 4) Elimina voci catalogo non ufficiali
-- ---------------------------------------------------------------------------
DELETE FROM public.fsc_product_groups_catalog
WHERE code IS NULL OR trim(code) = '';

-- ---------------------------------------------------------------------------
-- 5) Vincoli: catalogo con codice obbligatorio, azienda solo da catalogo
-- ---------------------------------------------------------------------------
ALTER TABLE public.fsc_product_groups_catalog
  ALTER COLUMN code SET NOT NULL;

ALTER TABLE public.fsc_product_groups_catalog
  ADD CONSTRAINT fsc_product_groups_catalog_code_nonempty
  CHECK (trim(code) <> '');

ALTER TABLE public.fsc_company_product_groups
  DROP COLUMN custom_label;

ALTER TABLE public.fsc_company_product_groups
  ALTER COLUMN catalog_group_id SET NOT NULL;

ALTER TABLE public.fsc_company_product_groups
  DROP CONSTRAINT IF EXISTS fsc_company_product_groups_catalog_group_id_fkey;

ALTER TABLE public.fsc_company_product_groups
  ADD CONSTRAINT fsc_company_product_groups_catalog_group_id_fkey
    FOREIGN KEY (catalog_group_id)
    REFERENCES public.fsc_product_groups_catalog (id)
    ON DELETE RESTRICT;
