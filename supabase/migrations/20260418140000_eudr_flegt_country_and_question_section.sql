-- EUDR: FLEGT partner countries (Indonesia, Ghana) + grid question section placement

alter table public.country
  add column if not exists flegt_partner boolean not null default false;

update public.country
set flegt_partner = true
where lower(trim(country_name)) in ('indonesia', 'ghana');

update public.questions
set section_id = 'a3df1e07-a678-49d2-9a4d-f134fba3498c'
where id = '03dd3221-ba2f-4c83-9148-8fd06f389b0a';
