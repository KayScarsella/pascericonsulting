-- CLOUD FSC – Fase A: imprese, membership, helper RLS

CREATE TYPE public.fsc_member_type AS ENUM ('owner', 'employee', 'consultant');

CREATE TABLE public.fsc_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.tools (id) ON DELETE CASCADE,
  ragione_sociale text NOT NULL,
  cf_partita_iva text,
  indirizzo text,
  cap text,
  citta text,
  provincia text,
  recapito_telefonico text,
  sito_internet text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsc_companies_tool_ragione_unique UNIQUE (tool_id, ragione_sociale)
);

CREATE TABLE public.fsc_company_members (
  company_id uuid NOT NULL REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  member_type public.fsc_member_type NOT NULL DEFAULT 'owner',
  can_edit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);

CREATE INDEX idx_fsc_companies_tool_id ON public.fsc_companies (tool_id);
CREATE INDEX idx_fsc_company_members_user_id ON public.fsc_company_members (user_id);

ALTER TABLE public.fsc_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fsc_company_members ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.fsc_company_tool_id(_company_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tool_id FROM public.fsc_companies WHERE id = _company_id;
$$;

CREATE OR REPLACE FUNCTION public.fsc_is_company_member(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fsc_company_members m
    WHERE m.company_id = _company_id
      AND m.user_id = (SELECT auth.uid())
  )
  OR public.is_admin_of_tool(public.fsc_company_tool_id(_company_id));
$$;

CREATE OR REPLACE FUNCTION public.fsc_is_company_editor(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin_of_tool(public.fsc_company_tool_id(_company_id))
  OR EXISTS (
    SELECT 1
    FROM public.fsc_company_members m
    WHERE m.company_id = _company_id
      AND m.user_id = (SELECT auth.uid())
      AND m.can_edit = true
  );
$$;

CREATE OR REPLACE FUNCTION public.fsc_current_user_company_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.company_id
  FROM public.fsc_company_members m
  WHERE m.user_id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.fsc_ensure_company_for_user(_tool_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
  _profile public.profiles%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.company_id INTO _company_id
  FROM public.fsc_company_members m
  INNER JOIN public.fsc_companies c ON c.id = m.company_id
  WHERE m.user_id = _uid AND c.tool_id = _tool_id
  ORDER BY m.created_at
  LIMIT 1;

  IF _company_id IS NOT NULL THEN
    RETURN _company_id;
  END IF;

  SELECT * INTO _profile FROM public.profiles WHERE id = _uid;

  INSERT INTO public.fsc_companies (
    tool_id,
    ragione_sociale,
    cf_partita_iva,
    indirizzo,
    cap,
    citta,
    provincia,
    recapito_telefonico,
    sito_internet,
    email
  )
  VALUES (
    _tool_id,
    COALESCE(NULLIF(trim(_profile.ragione_sociale), ''), NULLIF(trim(_profile.full_name), ''), 'Impresa FSC'),
    _profile.cf_partita_iva,
    _profile.indirizzo,
    _profile.cap,
    _profile.citta,
    _profile.provincia,
    _profile.recapito_telefonico,
    _profile.sito_internet,
    _profile.email
  )
  RETURNING id INTO _company_id;

  INSERT INTO public.fsc_company_members (company_id, user_id, member_type, can_edit)
  VALUES (_company_id, _uid, 'owner', true);

  RETURN _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_companies_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER fsc_companies_updated_at
  BEFORE UPDATE ON public.fsc_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.fsc_companies_set_updated_at();

-- RLS fsc_companies
CREATE POLICY "fsc_companies_select"
  ON public.fsc_companies
  FOR SELECT
  TO authenticated
  USING (
    public.fsc_is_company_member(id)
    OR public.is_admin_of_tool(tool_id)
  );

CREATE POLICY "fsc_companies_insert"
  ON public.fsc_companies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_of_tool(tool_id)
    OR (
      tool_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.tool_access ta
        WHERE ta.user_id = (SELECT auth.uid()) AND ta.tool_id = fsc_companies.tool_id
      )
    )
  );

CREATE POLICY "fsc_companies_update"
  ON public.fsc_companies
  FOR UPDATE
  TO authenticated
  USING (public.fsc_is_company_editor(id) OR public.is_admin_of_tool(tool_id))
  WITH CHECK (public.fsc_is_company_editor(id) OR public.is_admin_of_tool(tool_id));

-- RLS fsc_company_members
CREATE POLICY "fsc_company_members_select"
  ON public.fsc_company_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.fsc_is_company_member(company_id)
    OR public.is_admin_of_tool(public.fsc_company_tool_id(company_id))
  );

CREATE POLICY "fsc_company_members_insert"
  ON public.fsc_company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin_of_tool(public.fsc_company_tool_id(company_id))
    OR (
      user_id = (SELECT auth.uid())
      AND member_type = 'owner'
      AND NOT EXISTS (
        SELECT 1 FROM public.fsc_company_members m WHERE m.company_id = fsc_company_members.company_id
      )
    )
  );

CREATE POLICY "fsc_company_members_update"
  ON public.fsc_company_members
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_of_tool(public.fsc_company_tool_id(company_id))
    OR EXISTS (
      SELECT 1 FROM public.fsc_company_members o
      WHERE o.company_id = fsc_company_members.company_id
        AND o.user_id = (SELECT auth.uid())
        AND o.member_type = 'owner'
    )
  )
  WITH CHECK (
    public.is_admin_of_tool(public.fsc_company_tool_id(company_id))
    OR EXISTS (
      SELECT 1 FROM public.fsc_company_members o
      WHERE o.company_id = fsc_company_members.company_id
        AND o.user_id = (SELECT auth.uid())
        AND o.member_type = 'owner'
    )
  );

CREATE POLICY "fsc_company_members_delete"
  ON public.fsc_company_members
  FOR DELETE
  TO authenticated
  USING (public.is_admin_of_tool(public.fsc_company_tool_id(company_id)));

GRANT EXECUTE ON FUNCTION public.fsc_company_tool_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsc_is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsc_is_company_editor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsc_current_user_company_ids() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsc_ensure_company_for_user(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fsc_company_tool_id(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_is_company_member(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_is_company_editor(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_current_user_company_ids() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_ensure_company_for_user(uuid) FROM anon;
