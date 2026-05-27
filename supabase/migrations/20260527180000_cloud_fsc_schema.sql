-- CLOUD FSC: attivazione tool (schema moduli da aggiungere in fasi successive).
-- Id must match src/lib/constants.ts CLOUD_FSC_TOOL_ID.

update public.tools
set
  is_active = true,
  description = 'Piattaforma cloud FSC/PEFC (moduli in sviluppo).',
  base_path = coalesce(nullif(base_path, ''), '/cloud-fsc')
where id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid;
