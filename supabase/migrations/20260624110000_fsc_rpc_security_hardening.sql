-- Hardening RPC exposure for Supabase database linter (SECURITY DEFINER + PUBLIC grants).
-- Pattern: REVOKE FROM PUBLIC first, then GRANT only required roles.
-- Manual (Dashboard): Authentication → Password → Leaked password protection;
--   Authentication → Email → Email OTP expiration ≤ 3600s.

-- ---------------------------------------------------------------------------
-- 1) Trigger helpers: immutable search_path (lint 0011)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fsc_supplier_claims_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.fsc_supplier_product_claims WHERE supplier_id = COALESCE(NEW.supplier_id, OLD.supplier_id)) > 2 THEN
    RAISE EXCEPTION 'Massimo 2 claim per fornitore';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_companies_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_logos_set_progressive_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.progressive_code IS NULL OR trim(NEW.progressive_code) = '' THEN
    NEW.progressive_code := public.fsc_next_logo_code(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) RLS helpers + document min_role (authenticated + service_role only)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.document_min_role_satisfied(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.document_min_role_satisfied(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.document_min_role_satisfied(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_min_role_satisfied(uuid, public.app_role) TO service_role;

REVOKE ALL ON FUNCTION public.is_admin_of_tool(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_of_tool(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_of_tool(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_tool(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_admin_any_tool() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_any_tool() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_any_tool() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_any_tool() TO service_role;

REVOKE ALL ON FUNCTION public.fsc_company_tool_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_company_tool_id(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_company_tool_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_company_tool_id(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_is_company_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_is_company_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_is_company_member(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_is_company_editor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_is_company_editor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_is_company_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_is_company_editor(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_is_company_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_is_company_owner(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_is_company_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_is_company_owner(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3) FSC company RPC (server actions; authenticated + service_role)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.fsc_current_user_company_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_current_user_company_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_current_user_company_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_current_user_company_ids() TO service_role;

REVOKE ALL ON FUNCTION public.fsc_ensure_company_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_ensure_company_for_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_ensure_company_for_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_ensure_company_for_user(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_create_company_for_user(uuid, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_create_company_for_user(uuid, text, text, text, text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_create_company_for_user(uuid, text, text, text, text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_create_company_for_user(uuid, text, text, text, text, text, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_set_active_company(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_set_active_company(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_set_active_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_set_active_company(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_list_companies_for_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_list_companies_for_admin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_list_companies_for_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_list_companies_for_admin(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_resolve_active_company_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_resolve_active_company_id(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_resolve_active_company_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_resolve_active_company_id(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 4) Storage path RPC + logo code (authenticated + service_role)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.get_recursive_storage_paths(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_recursive_storage_paths(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_recursive_storage_paths(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recursive_storage_paths(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_storage_paths_recursive(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_storage_paths_recursive(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_storage_paths_recursive(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_paths_recursive(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_next_logo_code(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_next_logo_code(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fsc_next_logo_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_next_logo_code(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Alert cron/job RPC (service_role only)
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.fsc_queue_document_expiry_alerts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_queue_document_expiry_alerts(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_queue_document_expiry_alerts(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_queue_document_expiry_alerts(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_queue_supplier_certificate_alerts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_queue_supplier_certificate_alerts(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_queue_supplier_certificate_alerts(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_queue_supplier_certificate_alerts(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_queue_ilo_reminder_alerts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_queue_ilo_reminder_alerts(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_queue_ilo_reminder_alerts(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_queue_ilo_reminder_alerts(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_queue_supplier_control_alerts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_queue_supplier_control_alerts(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_queue_supplier_control_alerts(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_queue_supplier_control_alerts(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_queue_subcontractor_certificate_alerts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_queue_subcontractor_certificate_alerts(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_queue_subcontractor_certificate_alerts(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_queue_subcontractor_certificate_alerts(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_queue_subcontractor_control_alerts(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_queue_subcontractor_control_alerts(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_queue_subcontractor_control_alerts(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_queue_subcontractor_control_alerts(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.fsc_process_alert_outbox(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_process_alert_outbox(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.fsc_process_alert_outbox(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fsc_process_alert_outbox(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Trigger-only functions: not callable via PostgREST RPC
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.fsc_supplier_status_change_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_supplier_status_change_log() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_supplier_status_change_log() FROM authenticated;

REVOKE ALL ON FUNCTION public.fsc_subcontractor_status_change_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_subcontractor_status_change_log() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_subcontractor_status_change_log() FROM authenticated;

REVOKE ALL ON FUNCTION public.fsc_supplier_claims_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_supplier_claims_limit() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_supplier_claims_limit() FROM authenticated;

REVOKE ALL ON FUNCTION public.fsc_set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_set_updated_at() FROM authenticated;

REVOKE ALL ON FUNCTION public.fsc_companies_set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_companies_set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_companies_set_updated_at() FROM authenticated;

REVOKE ALL ON FUNCTION public.fsc_logos_set_progressive_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fsc_logos_set_progressive_code() FROM anon;
REVOKE ALL ON FUNCTION public.fsc_logos_set_progressive_code() FROM authenticated;
