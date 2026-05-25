-- Country: rename FSI/RLI/ILO → CPI per anno (2023/2024/2025)
-- EUDR Section E: new year_values question + extend Paese di raccolta extra cols

alter table public.country rename column "FSI" to cpi_23;
alter table public.country rename column "RLI" to cpi_24;
alter table public.country rename column "ILO" to cpi_25;

-- Shift order_index after Paese di raccolta to make room for CPI question
update public.questions q
set order_index = q.order_index + 1
where q.section_id = '8e3c8459-5a9b-4ecf-8a4e-9f9da2b53cc1'
  and q.order_index > (
    select p.order_index
    from public.questions p
    where p.id = 'd5e6f7a8-b9c0-4d1e-9f2a-3b4c5d6e7f54'
  );

insert into public.questions (id, section_id, text, type, config, order_index)
select
  'f1a2b3c4-d5e6-4789-a012-3456789abcde',
  '8e3c8459-5a9b-4ecf-8a4e-9f9da2b53cc1',
  'INDICE DI CORRUZIONE PAESE DI RACCOLTA CPI',
  'year_values',
  '{
    "optional": true,
    "fields": [
      { "key": "cpi_23", "label": "CPI 2023" },
      { "key": "cpi_24", "label": "CPI 2024" },
      { "key": "cpi_25", "label": "CPI 2025" }
    ]
  }'::jsonb,
  p.order_index + 1
from public.questions p
where p.id = 'd5e6f7a8-b9c0-4d1e-9f2a-3b4c5d6e7f54'
on conflict (id) do nothing;

-- Merge CPI columns into async_select source_extra_cols for Paese di raccolta
update public.questions
set config = jsonb_set(
  coalesce(config, '{}'::jsonb),
  '{source_extra_cols}',
  (
    select coalesce(jsonb_agg(distinct elem), '[]'::jsonb)
    from (
      select jsonb_array_elements_text(coalesce(config->'source_extra_cols', '[]'::jsonb)) as elem
      union all
      select 'cpi_23'
      union all
      select 'cpi_24'
      union all
      select 'cpi_25'
    ) merged
  )
)
where id = 'd5e6f7a8-b9c0-4d1e-9f2a-3b4c5d6e7f54';
