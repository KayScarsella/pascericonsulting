-- Rimuove reminder automatici ILO (notifiche Home + outbox + funzione queue)

DELETE FROM public.fsc_alert_outbox
WHERE alert_kind = 'ilo_overdue_10m';

DELETE FROM public.notifications
WHERE tool_id = '50cd9969-0300-4d41-b807-1a88088d07e1'
  AND title = 'Autovalutazione ILO da aggiornare';

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

DROP FUNCTION IF EXISTS public.fsc_queue_ilo_reminder_alerts(uuid);
