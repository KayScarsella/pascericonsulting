-- CLOUD FSC – Fase E: alert scadenze (outbox + notifiche in-app)

CREATE TABLE public.fsc_alert_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.fsc_companies (id) ON DELETE CASCADE,
  tool_id uuid NOT NULL REFERENCES public.tools (id) ON DELETE CASCADE,
  alert_kind text NOT NULL,
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  target_date date NOT NULL,
  title text NOT NULL,
  message text,
  recipient_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  sent_at timestamptz,
  notification_id uuid REFERENCES public.notifications (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fsc_alert_outbox_idempotency UNIQUE (alert_kind, source_id, recipient_user_id, target_date)
);

CREATE INDEX idx_fsc_alert_outbox_pending
  ON public.fsc_alert_outbox (target_date, sent_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.fsc_alert_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fsc_alert_outbox_select"
  ON public.fsc_alert_outbox FOR SELECT TO authenticated
  USING (
    recipient_user_id = (SELECT auth.uid())
    OR public.is_admin_of_tool(tool_id)
  );

-- Service role / cron inserts via SECURITY DEFINER functions below

CREATE OR REPLACE FUNCTION public.fsc_queue_document_expiry_alerts(_tool_id uuid)
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
      d.id AS doc_id,
      d.company_id,
      d.tool_id,
      d.name,
      d.expires_at,
      m.user_id AS recipient_id
    FROM public.fsc_documents d
    INNER JOIN public.fsc_company_members m ON m.company_id = d.company_id
    WHERE d.tool_id = _tool_id
      AND d.status = 'active'
      AND d.expires_at IS NOT NULL
      AND d.expires_at = (CURRENT_DATE + interval '30 days')::date
  LOOP
    INSERT INTO public.fsc_alert_outbox (
      company_id, tool_id, alert_kind, source_table, source_id,
      target_date, title, message, recipient_user_id
    )
    VALUES (
      _row.company_id,
      _row.tool_id,
      'document_expiry_30d',
      'fsc_documents',
      _row.doc_id,
      _row.expires_at,
      'Scadenza documento FSC',
      format('Il documento "%s" scade il %s.', _row.name, to_char(_row.expires_at, 'DD/MM/YYYY')),
      _row.recipient_id
    )
    ON CONFLICT ON CONSTRAINT fsc_alert_outbox_idempotency DO NOTHING;
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_queue_supplier_certificate_alerts(_tool_id uuid)
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
      s.certificate_valid_until,
      m.user_id AS recipient_id
    FROM public.fsc_suppliers s
    INNER JOIN public.fsc_companies c ON c.id = s.company_id
    INNER JOIN public.fsc_company_members m ON m.company_id = s.company_id
    WHERE c.tool_id = _tool_id
      AND s.status = 'active'
      AND s.certificate_valid_until IS NOT NULL
      AND s.certificate_valid_until = (CURRENT_DATE + interval '30 days')::date
  LOOP
    INSERT INTO public.fsc_alert_outbox (
      company_id, tool_id, alert_kind, source_table, source_id,
      target_date, title, message, recipient_user_id
    )
    VALUES (
      _row.company_id,
      _row.tool_id,
      'supplier_certificate_30d',
      'fsc_suppliers',
      _row.supplier_id,
      _row.certificate_valid_until,
      'Scadenza certificato fornitore',
      format('Il certificato del fornitore "%s" scade il %s.', _row.ragione_sociale, to_char(_row.certificate_valid_until, 'DD/MM/YYYY')),
      _row.recipient_id
    )
    ON CONFLICT ON CONSTRAINT fsc_alert_outbox_idempotency DO NOTHING;
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.fsc_queue_ilo_reminder_alerts(_tool_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer := 0;
  _row record;
  _threshold date := (CURRENT_DATE - interval '10 months')::date;
BEGIN
  FOR _row IN
    SELECT
      c.id AS company_id,
      c.tool_id,
      c.ragione_sociale,
      max(a.completed_at)::date AS last_completed,
      m.user_id AS recipient_id
    FROM public.fsc_companies c
    INNER JOIN public.fsc_company_members m ON m.company_id = c.id
    LEFT JOIN public.fsc_ilo_assessments a ON a.company_id = c.id AND a.completed_at IS NOT NULL
    WHERE c.tool_id = _tool_id
    GROUP BY c.id, c.tool_id, c.ragione_sociale, m.user_id
    HAVING max(a.completed_at) IS NULL OR max(a.completed_at)::date <= _threshold
  LOOP
    INSERT INTO public.fsc_alert_outbox (
      company_id, tool_id, alert_kind, source_table, source_id,
      target_date, title, message, recipient_user_id
    )
    VALUES (
      _row.company_id,
      _row.tool_id,
      'ilo_overdue_10m',
      'fsc_companies',
      _row.company_id,
      CURRENT_DATE,
      'Autovalutazione ILO da aggiornare',
      format('Per "%s": verificare autovalutazione ILO (ultima compilazione oltre 10 mesi o assente).', _row.ragione_sociale),
      _row.recipient_id
    )
    ON CONFLICT ON CONSTRAINT fsc_alert_outbox_idempotency DO NOTHING;
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

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

GRANT EXECUTE ON FUNCTION public.fsc_queue_document_expiry_alerts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fsc_queue_supplier_certificate_alerts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fsc_queue_ilo_reminder_alerts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fsc_process_alert_outbox(uuid) TO service_role, authenticated;

-- Optional: pg_cron daily job (no-op if extension unavailable)
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('fsc_daily_alerts');
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;

    PERFORM cron.schedule(
      'fsc_daily_alerts',
      '0 7 * * *',
      $job$SELECT public.fsc_process_alert_outbox('50cd9969-0300-4d41-b807-1a88088d07e1'::uuid);$job$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'fsc_daily_alerts cron not scheduled: %', SQLERRM;
END;
$cron$;
