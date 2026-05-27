-- CLOUD FSC – Fase B: fornitori, terzisti, gruppi prodotto

CREATE TYPE public.fsc_supplier_status AS ENUM ('active', 'inactive', 'reactivated');
CREATE TYPE public.fsc_control_frequency AS ENUM ('annual', 'semiannual');
CREATE TYPE public.fsc_product_claim AS ENUM ('fsc_100', 'fsc_mix', 'fsc_recycled');
CREATE TYPE public.fsc_supplier_attachment_type AS ENUM ('visura', 'due_diligence', 'dichiarazione');
CREATE TYPE public.fsc_subcontractor_attachment_type AS ENUM ('certificato', 'accordo_conto_lavoro');

CREATE TABLE public.fsc_suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  ragione_sociale text NOT NULL,
  certificate_number text,
  certificate_valid_until date,
  last_control_date date,
  control_frequency public.fsc_control_frequency NOT NULL DEFAULT 'annual',
  status public.fsc_supplier_status NOT NULL DEFAULT 'active',
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fsc_supplier_product_claims (
  supplier_id uuid NOT NULL REFERENCES public.fsc_suppliers (id) ON DELETE CASCADE,
  claim public.fsc_product_claim NOT NULL,
  PRIMARY KEY (supplier_id, claim)
);

CREATE TABLE public.fsc_supplier_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.fsc_suppliers (id) ON DELETE CASCADE,
  attachment_type public.fsc_supplier_attachment_type NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE TABLE public.fsc_supplier_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.fsc_suppliers (id) ON DELETE CASCADE,
  old_status public.fsc_supplier_status,
  new_status public.fsc_supplier_status NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE TABLE public.fsc_subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  ragione_sociale text NOT NULL,
  is_certified boolean NOT NULL DEFAULT false,
  work_type text,
  coc_risk boolean NOT NULL DEFAULT false,
  certificate_number text,
  certificate_valid_until date,
  last_control_date date,
  control_frequency public.fsc_control_frequency NOT NULL DEFAULT 'annual',
  status public.fsc_supplier_status NOT NULL DEFAULT 'active',
  deactivated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fsc_subcontractor_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES public.fsc_subcontractors (id) ON DELETE CASCADE,
  attachment_type public.fsc_subcontractor_attachment_type NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  mime_type text,
  size bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE TABLE public.fsc_product_groups_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text,
  name text NOT NULL,
  keywords text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fsc_product_groups_catalog_code_key
  ON public.fsc_product_groups_catalog (code)
  WHERE code IS NOT NULL;

CREATE TABLE public.fsc_company_product_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  catalog_group_id uuid REFERENCES public.fsc_product_groups_catalog (id) ON DELETE SET NULL,
  custom_label text,
  species_id uuid REFERENCES public.species (id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  activated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fsc_company_product_group_claims (
  company_product_group_id uuid NOT NULL REFERENCES public.fsc_company_product_groups (id) ON DELETE CASCADE,
  claim public.fsc_product_claim NOT NULL,
  PRIMARY KEY (company_product_group_id, claim)
);

CREATE TABLE public.fsc_product_group_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_product_group_id uuid NOT NULL REFERENCES public.fsc_company_product_groups (id) ON DELETE CASCADE,
  storage_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fsc_suppliers_company ON public.fsc_suppliers (company_id);
CREATE INDEX idx_fsc_suppliers_status ON public.fsc_suppliers (company_id, status);
CREATE INDEX idx_fsc_subcontractors_company ON public.fsc_subcontractors (company_id);
CREATE INDEX idx_fsc_company_product_groups_company ON public.fsc_company_product_groups (company_id);

-- Max 2 claims per supplier
CREATE OR REPLACE FUNCTION public.fsc_supplier_claims_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM public.fsc_supplier_product_claims WHERE supplier_id = COALESCE(NEW.supplier_id, OLD.supplier_id)) > 2 THEN
    RAISE EXCEPTION 'Massimo 2 claim per fornitore';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE CONSTRAINT TRIGGER fsc_supplier_claims_limit_trg
  AFTER INSERT OR UPDATE ON public.fsc_supplier_product_claims
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.fsc_supplier_claims_limit();

CREATE OR REPLACE FUNCTION public.fsc_supplier_status_change_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.fsc_supplier_status_history (supplier_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
    IF NEW.status = 'inactive' AND NEW.deactivated_at IS NULL THEN
      NEW.deactivated_at := now();
    ELSIF NEW.status = 'active' THEN
      NEW.deactivated_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fsc_suppliers_status_log
  BEFORE UPDATE ON public.fsc_suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.fsc_supplier_status_change_log();

CREATE OR REPLACE FUNCTION public.fsc_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER fsc_suppliers_updated_at BEFORE UPDATE ON public.fsc_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.fsc_set_updated_at();
CREATE TRIGGER fsc_subcontractors_updated_at BEFORE UPDATE ON public.fsc_subcontractors
  FOR EACH ROW EXECUTE FUNCTION public.fsc_set_updated_at();
CREATE TRIGGER fsc_company_product_groups_updated_at BEFORE UPDATE ON public.fsc_company_product_groups
  FOR EACH ROW EXECUTE FUNCTION public.fsc_set_updated_at();
CREATE TRIGGER fsc_product_groups_catalog_updated_at BEFORE UPDATE ON public.fsc_product_groups_catalog
  FOR EACH ROW EXECUTE FUNCTION public.fsc_set_updated_at();

ALTER TABLE public.fsc_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_supplier_product_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_supplier_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_supplier_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_subcontractor_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_product_groups_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_company_product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_company_product_group_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_product_group_addenda ENABLE ROW LEVEL SECURITY;

-- RLS: company-scoped tables
CREATE POLICY "fsc_suppliers_select" ON public.fsc_suppliers FOR SELECT TO authenticated
  USING (public.fsc_is_company_member(company_id));
CREATE POLICY "fsc_suppliers_insert" ON public.fsc_suppliers FOR INSERT TO authenticated
  WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_suppliers_update" ON public.fsc_suppliers FOR UPDATE TO authenticated
  USING (public.fsc_is_company_editor(company_id)) WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_suppliers_delete" ON public.fsc_suppliers FOR DELETE TO authenticated
  USING (public.fsc_is_company_editor(company_id));

CREATE POLICY "fsc_subcontractors_select" ON public.fsc_subcontractors FOR SELECT TO authenticated
  USING (public.fsc_is_company_member(company_id));
CREATE POLICY "fsc_subcontractors_insert" ON public.fsc_subcontractors FOR INSERT TO authenticated
  WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_subcontractors_update" ON public.fsc_subcontractors FOR UPDATE TO authenticated
  USING (public.fsc_is_company_editor(company_id)) WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_subcontractors_delete" ON public.fsc_subcontractors FOR DELETE TO authenticated
  USING (public.fsc_is_company_editor(company_id));

CREATE POLICY "fsc_company_product_groups_select" ON public.fsc_company_product_groups FOR SELECT TO authenticated
  USING (public.fsc_is_company_member(company_id));
CREATE POLICY "fsc_company_product_groups_insert" ON public.fsc_company_product_groups FOR INSERT TO authenticated
  WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_company_product_groups_update" ON public.fsc_company_product_groups FOR UPDATE TO authenticated
  USING (public.fsc_is_company_editor(company_id)) WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_company_product_groups_delete" ON public.fsc_company_product_groups FOR DELETE TO authenticated
  USING (public.fsc_is_company_editor(company_id));

-- Child tables via parent company
CREATE POLICY "fsc_supplier_claims_all" ON public.fsc_supplier_product_claims FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fsc_suppliers s WHERE s.id = supplier_id AND public.fsc_is_company_member(s.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fsc_suppliers s WHERE s.id = supplier_id AND public.fsc_is_company_editor(s.company_id)));

CREATE POLICY "fsc_supplier_attachments_all" ON public.fsc_supplier_attachments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fsc_suppliers s WHERE s.id = supplier_id AND public.fsc_is_company_member(s.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fsc_suppliers s WHERE s.id = supplier_id AND public.fsc_is_company_editor(s.company_id)));

CREATE POLICY "fsc_supplier_history_select" ON public.fsc_supplier_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fsc_suppliers s WHERE s.id = supplier_id AND public.fsc_is_company_member(s.company_id)));

CREATE POLICY "fsc_subcontractor_attachments_all" ON public.fsc_subcontractor_attachments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fsc_subcontractors t WHERE t.id = subcontractor_id AND public.fsc_is_company_member(t.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fsc_subcontractors t WHERE t.id = subcontractor_id AND public.fsc_is_company_editor(t.company_id)));

CREATE POLICY "fsc_group_claims_all" ON public.fsc_company_product_group_claims FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fsc_company_product_groups g
    WHERE g.id = company_product_group_id AND public.fsc_is_company_member(g.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fsc_company_product_groups g
    WHERE g.id = company_product_group_id AND public.fsc_is_company_editor(g.company_id)
  ));

CREATE POLICY "fsc_addenda_all" ON public.fsc_product_group_addenda FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.fsc_company_product_groups g
    WHERE g.id = company_product_group_id AND public.fsc_is_company_member(g.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.fsc_company_product_groups g
    WHERE g.id = company_product_group_id AND public.fsc_is_company_editor(g.company_id)
  ));

-- Catalog: read all authenticated, write tool admin
CREATE POLICY "fsc_catalog_select" ON public.fsc_product_groups_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "fsc_catalog_insert" ON public.fsc_product_groups_catalog FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid));
CREATE POLICY "fsc_catalog_update" ON public.fsc_product_groups_catalog FOR UPDATE TO authenticated
  USING (public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid))
  WITH CHECK (public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid));
CREATE POLICY "fsc_catalog_delete" ON public.fsc_product_groups_catalog FOR DELETE TO authenticated
  USING (public.is_admin_of_tool('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid));

-- Seed iniziale catalogo (estendibile da Master FSC)
INSERT INTO public.fsc_product_groups_catalog (code, name, keywords, is_active)
SELECT v.code, v.name, v.keywords, v.is_active
FROM (VALUES
  ('W9.2'::text, 'Legno da costruzione'::text, 'legno costruzione timber'::text, true),
  ('W9.3', 'Pannelli di legno', 'pannelli plywood', true),
  ('W9.4', 'Carta e cartone', 'carta cartone paper', true)
) AS v(code, name, keywords, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.fsc_product_groups_catalog c WHERE c.code = v.code
);
