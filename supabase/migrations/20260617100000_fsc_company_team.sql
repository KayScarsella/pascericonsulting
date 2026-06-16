-- CLOUD FSC – Team: active company, owner invites, explicit company creation

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fsc_active_company_id uuid REFERENCES public.fsc_companies (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_fsc_active_company_id
  ON public.profiles (fsc_active_company_id)
  WHERE fsc_active_company_id IS NOT NULL;

-- Resolve active company for current user (respects fsc_active_company_id when valid)
CREATE OR REPLACE FUNCTION public.fsc_resolve_active_company_id(_tool_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _active uuid;
  _fallback uuid;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.fsc_active_company_id INTO _active
  FROM public.profiles p
  WHERE p.id = _uid;

  IF _active IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.fsc_company_members m
    INNER JOIN public.fsc_companies c ON c.id = m.company_id
    WHERE m.user_id = _uid
      AND m.company_id = _active
      AND c.tool_id = _tool_id
  ) THEN
    RETURN _active;
  END IF;

  SELECT m.company_id INTO _fallback
  FROM public.fsc_company_members m
  INNER JOIN public.fsc_companies c ON c.id = m.company_id
  WHERE m.user_id = _uid AND c.tool_id = _tool_id
  ORDER BY m.created_at
  LIMIT 1;

  RETURN _fallback;
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_set_active_company(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.fsc_is_company_member(_company_id) THEN
    RAISE EXCEPTION 'Not a member of this company';
  END IF;

  UPDATE public.profiles
  SET fsc_active_company_id = _company_id,
      updated_at = now()
  WHERE id = _uid;
END;
$$;

-- Explicit company creation (wizard); one owned company per tool per user
CREATE OR REPLACE FUNCTION public.fsc_create_company_for_user(
  _tool_id uuid,
  _ragione_sociale text,
  _cf_partita_iva text DEFAULT NULL,
  _indirizzo text DEFAULT NULL,
  _cap text DEFAULT NULL,
  _citta text DEFAULT NULL,
  _provincia text DEFAULT NULL,
  _recapito_telefonico text DEFAULT NULL,
  _sito_internet text DEFAULT NULL,
  _email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _company_id uuid;
  _rs text := NULLIF(trim(_ragione_sociale), '');
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _rs IS NULL THEN
    RAISE EXCEPTION 'Ragione sociale obbligatoria';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tool_access ta
    WHERE ta.user_id = _uid AND ta.tool_id = _tool_id
  ) THEN
    RAISE EXCEPTION 'No tool access';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.fsc_company_members m
    INNER JOIN public.fsc_companies c ON c.id = m.company_id
    WHERE m.user_id = _uid
      AND c.tool_id = _tool_id
      AND m.member_type = 'owner'
  ) THEN
    RAISE EXCEPTION 'User already owns a company for this tool';
  END IF;

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
    _rs,
    NULLIF(trim(_cf_partita_iva), ''),
    NULLIF(trim(_indirizzo), ''),
    NULLIF(trim(_cap), ''),
    NULLIF(trim(_citta), ''),
    NULLIF(trim(_provincia), ''),
    NULLIF(trim(_recapito_telefonico), ''),
    NULLIF(trim(_sito_internet), ''),
    NULLIF(trim(_email), '')
  )
  RETURNING id INTO _company_id;

  INSERT INTO public.fsc_company_members (company_id, user_id, member_type, can_edit)
  VALUES (_company_id, _uid, 'owner', true);

  UPDATE public.profiles
  SET fsc_active_company_id = _company_id,
      updated_at = now()
  WHERE id = _uid;

  RETURN _company_id;
END;
$$;

-- No longer auto-creates; returns NULL when user has no membership
CREATE OR REPLACE FUNCTION public.fsc_ensure_company_for_user(_tool_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.fsc_resolve_active_company_id(_tool_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_is_company_owner(_company_id uuid)
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
      AND m.member_type = 'owner'
  );
$$;

-- Admin listing helper
CREATE OR REPLACE FUNCTION public.fsc_list_companies_for_admin(_tool_id uuid)
RETURNS TABLE (
  id uuid,
  ragione_sociale text,
  cf_partita_iva text,
  email text,
  member_count bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.ragione_sociale,
    c.cf_partita_iva,
    c.email,
    COUNT(m.user_id) AS member_count,
    c.created_at
  FROM public.fsc_companies c
  LEFT JOIN public.fsc_company_members m ON m.company_id = c.id
  WHERE c.tool_id = _tool_id
    AND public.is_admin_of_tool(_tool_id)
  GROUP BY c.id
  ORDER BY c.ragione_sociale;
$$;

-- RLS: owners can add non-owner members to their company
DROP POLICY IF EXISTS "fsc_company_members_insert" ON public.fsc_company_members;

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
    OR (
      member_type <> 'owner'::public.fsc_member_type
      AND public.fsc_is_company_owner(company_id)
      AND user_id <> (SELECT auth.uid())
    )
  );

-- RLS: owners can remove employees/consultants (not themselves or other owners)
DROP POLICY IF EXISTS "fsc_company_members_delete" ON public.fsc_company_members;

CREATE POLICY "fsc_company_members_delete"
  ON public.fsc_company_members
  FOR DELETE
  TO authenticated
  USING (
    public.is_admin_of_tool(public.fsc_company_tool_id(company_id))
    OR (
      public.fsc_is_company_owner(company_id)
      AND fsc_company_members.member_type <> 'owner'::public.fsc_member_type
      AND fsc_company_members.user_id <> (SELECT auth.uid())
    )
  );

GRANT EXECUTE ON FUNCTION public.fsc_resolve_active_company_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsc_set_active_company(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsc_create_company_for_user(uuid, text, text, text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsc_is_company_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fsc_list_companies_for_admin(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.fsc_resolve_active_company_id(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_set_active_company(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_create_company_for_user(uuid, text, text, text, text, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_is_company_owner(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_list_companies_for_admin(uuid) FROM anon;
