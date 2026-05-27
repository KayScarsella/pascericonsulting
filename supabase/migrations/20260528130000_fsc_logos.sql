-- CLOUD FSC – Fase D: loghi prodotto / promozionali

CREATE TYPE public.fsc_logo_type AS ENUM ('product', 'promotional');

CREATE TABLE public.fsc_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  logo_type public.fsc_logo_type NOT NULL,
  progressive_code text NOT NULL,
  notes text,
  approval_email_path text,
  graphic_path text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsc_logos_company_code_unique UNIQUE (company_id, progressive_code)
);

CREATE INDEX idx_fsc_logos_company_type_created
  ON public.fsc_logos (company_id, logo_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.fsc_next_logo_code(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _next integer;
BEGIN
  SELECT COALESCE(max((progressive_code)::integer), 0) + 1
  INTO _next
  FROM public.fsc_logos
  WHERE company_id = _company_id
    AND progressive_code ~ '^[0-9]+$';

  RETURN _next::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_logos_set_progressive_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.progressive_code IS NULL OR trim(NEW.progressive_code) = '' THEN
    NEW.progressive_code := public.fsc_next_logo_code(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fsc_logos_progressive_code
  BEFORE INSERT ON public.fsc_logos
  FOR EACH ROW
  EXECUTE FUNCTION public.fsc_logos_set_progressive_code();

ALTER TABLE public.fsc_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fsc_logos_select" ON public.fsc_logos FOR SELECT TO authenticated
  USING (public.fsc_is_company_member(company_id));
CREATE POLICY "fsc_logos_insert" ON public.fsc_logos FOR INSERT TO authenticated
  WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_logos_update" ON public.fsc_logos FOR UPDATE TO authenticated
  USING (public.fsc_is_company_editor(company_id)) WITH CHECK (public.fsc_is_company_editor(company_id));
CREATE POLICY "fsc_logos_delete" ON public.fsc_logos FOR DELETE TO authenticated
  USING (public.fsc_is_company_editor(company_id));

GRANT EXECUTE ON FUNCTION public.fsc_next_logo_code(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.fsc_next_logo_code(uuid) FROM anon;

-- Logo files live in fsc-documents bucket (paths stored on row)
