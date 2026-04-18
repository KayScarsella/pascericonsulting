alter table "public"."profiles"
add column "must_reset_password" boolean not null default false;

create index if not exists "idx_profiles_must_reset_password"
on "public"."profiles" using btree ("must_reset_password");
