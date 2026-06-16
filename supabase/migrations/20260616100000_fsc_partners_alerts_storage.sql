-- CLOUD FSC – Fornitori/Terzisti: status history terzisti, alert controlli, storage allegati

-- Status history table for subcontractors (mirror suppliers)
CREATE TABLE IF NOT EXISTS public.fsc_subcontractor_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES public.fsc_subcontractors (id) ON DELETE CASCADE,
  old_status public.fsc_supplier_status,
  new_status public.fsc_supplier_status NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

ALTER TABLE public.fsc_subcontractor_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fsc_subcontractor_history_select" ON public.fsc_subcontractor_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fsc_subcontractors t WHERE t.id = subcontractor_id AND public.fsc_is_company_member(t.company_id)));

CREATE OR REPLACE FUNCTION public.fsc_subcontractor_status_change_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.fsc_subcontractor_status_history (subcontractor_id, old_status, new_status, changed_by)
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

DROP TRIGGER IF EXISTS fsc_subcontractors_status_log ON public.fsc_subcontractors;
CREATE TRIGGER fsc_subcontractors_status_log
  BEFORE UPDATE ON public.fsc_subcontractors
  FOR EACH ROW
  EXECUTE FUNCTION public.fsc_subcontractor_status_change_log();

-- Supplier periodic control alerts (30 days before due)
CREATE OR REPLACE FUNCTION public.fsc_queue_supplier_control_alerts(_tool_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
  _row record;
BEGIN
  FOR _row IN
    SELECT
      s.id AS supplier_id,
      s.company_id,
      c.tool_id,
      s.ragione_sociale,
      s.last_control_date,
      s.control_frequency,
      CASE
        WHEN s.control_frequency = 'semiannual' THEN (s.last_control_date + interval '6 months')::date
        ELSE (s.last_control_date + interval '1 year')::date
      END AS control_due,
      m.user_id AS recipient_id
    FROM public.fsc_suppliers s
    INNER JOIN public.fsc_companies c ON c.id = s.company_id
    INNER JOIN public.fsc_company_members m ON m.company_id = s.company_id
    WHERE c.tool_id = _tool_id
      AND s.status = 'active'
      AND s.last_control_date IS NOT NULL
      AND (
        CASE
          WHEN s.control_frequency = 'semiannual' THEN (s.last_control_date + interval '6 months')::date
          ELSE (s.last_control_date + interval '1 year')::date
        END
      ) = (CURRENT_DATE + interval '30 days')::date
  LOOP
    INSERT INTO public.fsc_alert_outbox (
      company_id, tool_id, alert_kind, source_table, source_id,
      target_date, title, message, recipient_user_id
    )
    VALUES (
      _row.company_id,
      _row.tool_id,
      'supplier_control_30d',
      'fsc_suppliers',
      _row.supplier_id,
      _row.control_due,
      'Controllo periodico fornitore',
      format('Controllo periodico del fornitore "%s" in scadenza il %s.', _row.ragione_sociale, to_char(_row.control_due, 'DD/MM/YYYY')),
      _row.recipient_id
    )
    ON CONFLICT ON CONSTRAINT fsc_alert_outbox_idempotency DO NOTHING;
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- Subcontractor certificate expiry alerts
CREATE OR REPLACE FUNCTION public.fsc_queue_subcontractor_certificate_alerts(_tool_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
  _row record;
BEGIN
  FOR _row IN
    SELECT
      t.id AS subcontractor_id,
      t.company_id,
      c.tool_id,
      t.ragione_sociale,
      t.certificate_valid_until,
      m.user_id AS recipient_id
    FROM public.fsc_subcontractors t
    INNER JOIN public.fsc_companies c ON c.id = t.company_id
    INNER JOIN public.fsc_company_members m ON m.company_id = t.company_id
    WHERE c.tool_id = _tool_id
      AND t.status = 'active'
      AND t.is_certified = true
      AND t.certificate_valid_until IS NOT NULL
      AND t.certificate_valid_until = (CURRENT_DATE + interval '30 days')::date
  LOOP
    INSERT INTO public.fsc_alert_outbox (
      company_id, tool_id, alert_kind, source_table, source_id,
      target_date, title, message, recipient_user_id
    )
    VALUES (
      _row.company_id,
      _row.tool_id,
      'subcontractor_certificate_30d',
      'fsc_subcontractors',
      _row.subcontractor_id,
      _row.certificate_valid_until,
      'Scadenza certificato terzista',
      format('Il certificato del terzista "%s" scade il %s.', _row.ragione_sociale, to_char(_row.certificate_valid_until, 'DD/MM/YYYY')),
      _row.recipient_id
    )
    ON CONFLICT ON CONSTRAINT fsc_alert_outbox_idempotency DO NOTHING;
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- Subcontractor periodic control alerts
CREATE OR REPLACE FUNCTION public.fsc_queue_subcontractor_control_alerts(_tool_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
  _row record;
BEGIN
  FOR _row IN
    SELECT
      t.id AS subcontractor_id,
      t.company_id,
      c.tool_id,
      t.ragione_sociale,
      t.last_control_date,
      t.control_frequency,
      CASE
        WHEN t.control_frequency = 'semiannual' THEN (t.last_control_date + interval '6 months')::date
        ELSE (t.last_control_date + interval '1 year')::date
      END AS control_due,
      m.user_id AS recipient_id
    FROM public.fsc_subcontractors t
    INNER JOIN public.fsc_companies c ON c.id = t.company_id
    INNER JOIN public.fsc_company_members m ON m.company_id = t.company_id
    WHERE c.tool_id = _tool_id
      AND t.status = 'active'
      AND t.last_control_date IS NOT NULL
      AND (
        CASE
          WHEN t.control_frequency = 'semiannual' THEN (t.last_control_date + interval '6 months')::date
          ELSE (t.last_control_date + interval '1 year')::date
        END
      ) = (CURRENT_DATE + interval '30 days')::date
  LOOP
    INSERT INTO public.fsc_alert_outbox (
      company_id, tool_id, alert_kind, source_table, source_id,
      target_date, title, message, recipient_user_id
    )
    VALUES (
      _row.company_id,
      _row.tool_id,
      'subcontractor_control_30d',
      'fsc_subcontractors',
      _row.subcontractor_id,
      _row.control_due,
      'Controllo periodico terzista',
      format('Controllo periodico del terzista "%s" in scadenza il %s.', _row.ragione_sociale, to_char(_row.control_due, 'DD/MM/YYYY')),
      _row.recipient_id
    )
    ON CONFLICT ON CONSTRAINT fsc_alert_outbox_idempotency DO NOTHING;
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

-- Update alert processor to include new queues
CREATE OR REPLACE FUNCTION public.fsc_process_alert_outbox(_tool_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row record;
  _processed integer := 0;
  _notif_id uuid;
BEGIN
  PERFORM public.fsc_queue_document_expiry_alerts(_tool_id);
  PERFORM public.fsc_queue_supplier_certificate_alerts(_tool_id);
  PERFORM public.fsc_queue_supplier_control_alerts(_tool_id);
  PERFORM public.fsc_queue_subcontractor_certificate_alerts(_tool_id);
  PERFORM public.fsc_queue_subcontractor_control_alerts(_tool_id);
  PERFORM public.fsc_queue_ilo_reminder_alerts(_tool_id);

  FOR _row IN
    SELECT * FROM public.fsc_alert_outbox
    WHERE tool_id = _tool_id AND sent_at IS NULL
    ORDER BY created_at
    LIMIT 500
  LOOP
    INSERT INTO public.notifications (tool_id, title, message, is_active, expires_at)
    VALUES (
      _row.tool_id,
      _row.title,
      _row.message,
      true,
      (_row.target_date + interval '90 days')::timestamptz
    )
    RETURNING id INTO _notif_id;

    UPDATE public.fsc_alert_outbox
    SET sent_at = now(), notification_id = _notif_id
    WHERE id = _row.id;

    _processed := _processed + 1;
  END LOOP;

  RETURN _processed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fsc_queue_supplier_control_alerts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fsc_queue_subcontractor_certificate_alerts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fsc_queue_subcontractor_control_alerts(uuid) TO service_role;

-- Storage: supplier attachments
CREATE POLICY "fsc_supplier_attachments_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'suppliers'
    AND EXISTS (
      SELECT 1 FROM public.fsc_supplier_attachments a
      INNER JOIN public.fsc_suppliers s ON s.id = a.supplier_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_editor(s.company_id)
    )
  );

CREATE POLICY "fsc_supplier_attachments_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'suppliers'
    AND EXISTS (
      SELECT 1 FROM public.fsc_supplier_attachments a
      INNER JOIN public.fsc_suppliers s ON s.id = a.supplier_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_member(s.company_id)
    )
  );

CREATE POLICY "fsc_supplier_attachments_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'suppliers'
    AND EXISTS (
      SELECT 1 FROM public.fsc_supplier_attachments a
      INNER JOIN public.fsc_suppliers s ON s.id = a.supplier_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_editor(s.company_id)
    )
  );

-- Storage: subcontractor attachments
CREATE POLICY "fsc_subcontractor_attachments_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'subcontractors'
    AND EXISTS (
      SELECT 1 FROM public.fsc_subcontractor_attachments a
      INNER JOIN public.fsc_subcontractors t ON t.id = a.subcontractor_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_editor(t.company_id)
    )
  );

CREATE POLICY "fsc_subcontractor_attachments_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'subcontractors'
    AND EXISTS (
      SELECT 1 FROM public.fsc_subcontractor_attachments a
      INNER JOIN public.fsc_subcontractors t ON t.id = a.subcontractor_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_member(t.company_id)
    )
  );

CREATE POLICY "fsc_subcontractor_attachments_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'fsc-documents'
    AND (storage.foldername(name))[2] = 'subcontractors'
    AND EXISTS (
      SELECT 1 FROM public.fsc_subcontractor_attachments a
      INNER JOIN public.fsc_subcontractors t ON t.id = a.subcontractor_id
      WHERE a.storage_path = name
        AND public.fsc_is_company_editor(t.company_id)
    )
  );
