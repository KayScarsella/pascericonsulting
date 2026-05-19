-- Allinea base_path dei tool principali (evita alert "Configurazione mancante" in landing).

update public.tools
set base_path = '/EUDR'
where id = '69d3d115-acc1-49f3-8d39-a003df7145be'::uuid
  and (base_path is null or trim(base_path) = '');

update public.tools
set base_path = '/timberRegulation'
where id = 'e963a607-477c-4afe-bf43-7c9f512771e9'::uuid
  and (base_path is null or trim(base_path) = '');

update public.tools
set base_path = '/cloud-fsc'
where id = '50cd9969-0300-4d41-b807-1a88088d07e1'::uuid
  and (base_path is null or trim(base_path) = '');
