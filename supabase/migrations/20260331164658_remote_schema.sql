drop extension if exists "pg_net";

drop policy "profiles_update_as_tool_admin" on "public"."profiles";

drop policy "profiles_update_own" on "public"."profiles";

alter table "public"."country" drop column "cpi";

alter table "public"."profiles" add column "invited_at" timestamp with time zone;

alter table "public"."profiles" add column "onboarding_completed" boolean not null default false;

alter table "public"."profiles" add column "onboarding_completed_at" timestamp with time zone;

CREATE INDEX idx_profiles_onboarding_pending ON public.profiles USING btree (onboarding_completed, invited_at);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;


  create policy "profiles_insert_own"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((id = ( SELECT auth.uid() AS uid)));



  create policy "profiles_update_authenticated"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (((id = ( SELECT auth.uid() AS uid)) OR ((id <> ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.tool_access admin_ta
     JOIN public.tool_access member_ta ON ((admin_ta.tool_id = member_ta.tool_id)))
  WHERE ((admin_ta.user_id = ( SELECT auth.uid() AS uid)) AND (admin_ta.role = 'admin'::public.app_role) AND (member_ta.user_id = profiles.id)))))))
with check (((id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM (public.tool_access admin_ta
     JOIN public.tool_access member_ta ON ((admin_ta.tool_id = member_ta.tool_id)))
  WHERE ((admin_ta.user_id = ( SELECT auth.uid() AS uid)) AND (admin_ta.role = 'admin'::public.app_role) AND (member_ta.user_id = profiles.id))))));



