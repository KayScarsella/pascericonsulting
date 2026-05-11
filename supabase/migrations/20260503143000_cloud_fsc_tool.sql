-- CLOUD FSC: canonical tool row (inactive, preview path aligned with Next.js /cloud-fsc).
-- Id matches application constant CLOUD_FSC_TOOL_ID.

insert into public.tools (id, name, description, is_active, base_path)
values (
  '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid,
  'CLOUD FSC',
  'Modulo CLOUD FSC (in sviluppo).',
  false,
  '/cloud-fsc'
)
on conflict (id) do update set
  name = excluded.name,
  description = coalesce(excluded.description, public.tools.description),
  is_active = false,
  base_path = coalesce(nullif(excluded.base_path, ''), public.tools.base_path);
