create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

create type "public"."Corruption_Code" as enum ('AA', 'MA', 'MB', 'MM', 'TT');

create type "public"."app_role" as enum ('standard', 'premium', 'admin');

create type "public"."country_risk" as enum ('RA', 'RB', 'RS');

create sequence "public"."assessment_sessions_evaluation_code_seq";


  create table "public"."assessment_sessions" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "tool_id" uuid not null,
    "session_type" text not null,
    "status" text default 'in_progress'::text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "parent_session_id" uuid,
    "final_outcome" text,
    "metadata" jsonb default '{}'::jsonb,
    "evaluation_code" integer not null default nextval('public.assessment_sessions_evaluation_code_seq'::regclass)
      );


alter table "public"."assessment_sessions" enable row level security;


  create table "public"."country" (
    "id" uuid not null default gen_random_uuid(),
    "country_name" text,
    "corruption_code" public."Corruption_Code",
    "extra_eu" boolean,
    "conflicts" boolean,
    "sanction" boolean,
    "country_risk" public.country_risk,
    "fao" real,
    "cpi" real,
    "FSI" real,
    "RLI" real,
    "ILO" real
      );


alter table "public"."country" enable row level security;


  create table "public"."documents" (
    "id" uuid not null default gen_random_uuid(),
    "tool_id" uuid not null,
    "parent_id" uuid,
    "name" text not null,
    "type" text not null,
    "storage_path" text,
    "mime_type" text,
    "size" bigint,
    "created_at" timestamp with time zone default now(),
    "created_by" uuid
      );


alter table "public"."documents" enable row level security;


  create table "public"."eu_products" (
    "id" uuid not null default gen_random_uuid(),
    "eu_code" text,
    "description" text,
    "order" numeric default '0'::numeric
      );


alter table "public"."eu_products" enable row level security;


  create table "public"."mitigation_history" (
    "id" uuid not null default gen_random_uuid(),
    "session_id" uuid not null,
    "question_id" uuid not null,
    "previous_answer" text,
    "new_answer" text not null,
    "mitigated_at" timestamp with time zone not null default now(),
    "comment" text,
    "file_path" text
      );


alter table "public"."mitigation_history" enable row level security;


  create table "public"."notifications" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "message" text,
    "created_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone,
    "is_active" boolean not null default true,
    "tool_id" uuid not null
      );


alter table "public"."notifications" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "full_name" text,
    "avatar_url" text,
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "username" text,
    "ragione_sociale" text,
    "cf_partita_iva" text,
    "indirizzo" text,
    "cap" text,
    "citta" text,
    "provincia" text,
    "email" text,
    "recapito_telefonico" text,
    "sito_internet" text,
    "settore_merceologico" text,
    "attivita" text
      );


alter table "public"."profiles" enable row level security;


  create table "public"."questions" (
    "id" uuid not null default gen_random_uuid(),
    "section_id" uuid not null,
    "text" text not null,
    "type" text not null,
    "config" jsonb default '{}'::jsonb,
    "order_index" integer default 0
      );


alter table "public"."questions" enable row level security;


  create table "public"."sections" (
    "id" uuid not null default gen_random_uuid(),
    "tool_id" uuid not null,
    "title" text not null,
    "order_index" integer default 0,
    "group_name" text,
    "render_mode" text default 'list'::text,
    "logic_rules" jsonb default '[]'::jsonb
      );


alter table "public"."sections" enable row level security;


  create table "public"."species" (
    "id" uuid not null default gen_random_uuid(),
    "common_name" text,
    "scientific_name" text,
    "cites" numeric
      );


alter table "public"."species" enable row level security;


  create table "public"."suppliers" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "vat_number" text,
    "eori_number" text,
    "address" text,
    "phone" text,
    "email" text,
    "website" text,
    "contact_person" text,
    "user_id" uuid not null,
    "tool_id" uuid not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now())
      );


alter table "public"."suppliers" enable row level security;


  create table "public"."tool_access" (
    "user_id" uuid not null,
    "tool_id" uuid not null,
    "role" public.app_role not null default 'standard'::public.app_role,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
      );


alter table "public"."tool_access" enable row level security;


  create table "public"."tools" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "description" text,
    "is_active" boolean default true,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "base_path" text
      );


alter table "public"."tools" enable row level security;


  create table "public"."user_responses" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "tool_id" uuid not null,
    "question_id" uuid not null,
    "answer_text" text,
    "answer_json" jsonb,
    "file_path" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now()),
    "updated_at" timestamp with time zone default timezone('utc'::text, now()),
    "session_id" uuid not null
      );


alter table "public"."user_responses" enable row level security;

alter sequence "public"."assessment_sessions_evaluation_code_seq" owned by "public"."assessment_sessions"."evaluation_code";

CREATE UNIQUE INDEX assessment_sessions_pkey ON public.assessment_sessions USING btree (id);

CREATE UNIQUE INDEX country_pkey ON public.country USING btree (id);

CREATE UNIQUE INDEX documents_pkey ON public.documents USING btree (id);

CREATE UNIQUE INDEX eu_products_pkey ON public.eu_products USING btree (id);

CREATE INDEX idx_assessment_sessions_parent_id ON public.assessment_sessions USING btree (parent_session_id);

CREATE INDEX idx_assessment_sessions_parent_type ON public.assessment_sessions USING btree (parent_session_id, session_type) WHERE (parent_session_id IS NOT NULL);

CREATE INDEX idx_assessment_sessions_tool_id ON public.assessment_sessions USING btree (tool_id);

CREATE INDEX idx_assessment_sessions_tool_type_created ON public.assessment_sessions USING btree (tool_id, session_type, created_at DESC NULLS LAST);

CREATE INDEX idx_assessment_sessions_user_id ON public.assessment_sessions USING btree (user_id);

CREATE INDEX idx_documents_created_by ON public.documents USING btree (created_by);

CREATE INDEX idx_documents_parent_id ON public.documents USING btree (parent_id);

CREATE INDEX idx_documents_tool_parent ON public.documents USING btree (tool_id, parent_id);

CREATE INDEX idx_mitigation_history_session ON public.mitigation_history USING btree (session_id);

CREATE INDEX idx_mitigation_history_session_mitigated ON public.mitigation_history USING btree (session_id, mitigated_at DESC);

CREATE INDEX idx_notifications_tool_active_expires_created ON public.notifications USING btree (tool_id, is_active, expires_at NULLS FIRST, created_at DESC NULLS LAST) WHERE (is_active = true);

CREATE INDEX idx_questions_section ON public.questions USING btree (section_id) INCLUDE (order_index);

CREATE INDEX idx_questions_section_order ON public.questions USING btree (section_id, order_index);

CREATE INDEX idx_response_lookup ON public.user_responses USING btree (user_id, tool_id);

CREATE INDEX idx_responses_lookup ON public.user_responses USING btree (user_id, tool_id, question_id);

CREATE INDEX idx_sections_tool_group_order ON public.sections USING btree (tool_id, group_name, order_index);

CREATE INDEX idx_sections_tool_id ON public.sections USING btree (tool_id);

CREATE INDEX idx_suppliers_tool_id ON public.suppliers USING btree (tool_id);

CREATE INDEX idx_suppliers_tool_name ON public.suppliers USING btree (tool_id, name);

CREATE INDEX idx_suppliers_user_id ON public.suppliers USING btree (user_id);

CREATE INDEX idx_tool_access_tool_created ON public.tool_access USING btree (tool_id, created_at DESC NULLS LAST);

CREATE INDEX idx_tool_access_tool_id ON public.tool_access USING btree (tool_id);

CREATE INDEX idx_tool_access_user_tool ON public.tool_access USING btree (user_id, tool_id);

CREATE INDEX idx_tool_access_user_tool_role ON public.tool_access USING btree (user_id, tool_id, role);

CREATE INDEX idx_user_responses_question_id ON public.user_responses USING btree (question_id);

CREATE INDEX idx_user_responses_session_question ON public.user_responses USING btree (session_id, question_id);

CREATE INDEX idx_user_responses_tool_id ON public.user_responses USING btree (tool_id);

CREATE INDEX idx_user_responses_tool_user ON public.user_responses USING btree (tool_id, user_id);

CREATE UNIQUE INDEX mitigation_history_pkey ON public.mitigation_history USING btree (id);

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX questions_pkey ON public.questions USING btree (id);

CREATE UNIQUE INDEX sections_pkey ON public.sections USING btree (id);

CREATE UNIQUE INDEX specie_pkey ON public.species USING btree (id);

CREATE UNIQUE INDEX suppliers_pkey ON public.suppliers USING btree (id);

CREATE UNIQUE INDEX tool_access_pkey ON public.tool_access USING btree (user_id, tool_id);

CREATE UNIQUE INDEX tools_pkey ON public.tools USING btree (id);

CREATE UNIQUE INDEX user_responses_pkey ON public.user_responses USING btree (id);

CREATE UNIQUE INDEX user_responses_session_question_key ON public.user_responses USING btree (session_id, question_id);

alter table "public"."assessment_sessions" add constraint "assessment_sessions_pkey" PRIMARY KEY using index "assessment_sessions_pkey";

alter table "public"."country" add constraint "country_pkey" PRIMARY KEY using index "country_pkey";

alter table "public"."documents" add constraint "documents_pkey" PRIMARY KEY using index "documents_pkey";

alter table "public"."eu_products" add constraint "eu_products_pkey" PRIMARY KEY using index "eu_products_pkey";

alter table "public"."mitigation_history" add constraint "mitigation_history_pkey" PRIMARY KEY using index "mitigation_history_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."questions" add constraint "questions_pkey" PRIMARY KEY using index "questions_pkey";

alter table "public"."sections" add constraint "sections_pkey" PRIMARY KEY using index "sections_pkey";

alter table "public"."species" add constraint "specie_pkey" PRIMARY KEY using index "specie_pkey";

alter table "public"."suppliers" add constraint "suppliers_pkey" PRIMARY KEY using index "suppliers_pkey";

alter table "public"."tool_access" add constraint "tool_access_pkey" PRIMARY KEY using index "tool_access_pkey";

alter table "public"."tools" add constraint "tools_pkey" PRIMARY KEY using index "tools_pkey";

alter table "public"."user_responses" add constraint "user_responses_pkey" PRIMARY KEY using index "user_responses_pkey";

alter table "public"."assessment_sessions" add constraint "assessment_sessions_parent_fk" FOREIGN KEY (parent_session_id) REFERENCES public.assessment_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."assessment_sessions" validate constraint "assessment_sessions_parent_fk";

alter table "public"."assessment_sessions" add constraint "assessment_sessions_status_check" CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'archived'::text]))) not valid;

alter table "public"."assessment_sessions" validate constraint "assessment_sessions_status_check";

alter table "public"."assessment_sessions" add constraint "assessment_sessions_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE not valid;

alter table "public"."assessment_sessions" validate constraint "assessment_sessions_tool_id_fkey";

alter table "public"."assessment_sessions" add constraint "assessment_sessions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."assessment_sessions" validate constraint "assessment_sessions_user_id_fkey";

alter table "public"."documents" add constraint "documents_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."documents" validate constraint "documents_created_by_fkey";

alter table "public"."documents" add constraint "documents_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES public.documents(id) ON DELETE CASCADE not valid;

alter table "public"."documents" validate constraint "documents_parent_id_fkey";

alter table "public"."documents" add constraint "documents_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE not valid;

alter table "public"."documents" validate constraint "documents_tool_id_fkey";

alter table "public"."documents" add constraint "documents_type_check" CHECK ((type = ANY (ARRAY['file'::text, 'folder'::text]))) not valid;

alter table "public"."documents" validate constraint "documents_type_check";

alter table "public"."mitigation_history" add constraint "mitigation_history_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.assessment_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."mitigation_history" validate constraint "mitigation_history_session_id_fkey";

alter table "public"."notifications" add constraint "notifications_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE not valid;

alter table "public"."notifications" validate constraint "notifications_tool_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."questions" add constraint "questions_section_id_fkey" FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE not valid;

alter table "public"."questions" validate constraint "questions_section_id_fkey";

alter table "public"."sections" add constraint "sections_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE not valid;

alter table "public"."sections" validate constraint "sections_tool_id_fkey";

alter table "public"."suppliers" add constraint "suppliers_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE not valid;

alter table "public"."suppliers" validate constraint "suppliers_tool_id_fkey";

alter table "public"."suppliers" add constraint "suppliers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."suppliers" validate constraint "suppliers_user_id_fkey";

alter table "public"."tool_access" add constraint "tool_access_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE not valid;

alter table "public"."tool_access" validate constraint "tool_access_tool_id_fkey";

alter table "public"."tool_access" add constraint "tool_access_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."tool_access" validate constraint "tool_access_user_id_fkey";

alter table "public"."user_responses" add constraint "user_responses_question_id_fkey" FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE not valid;

alter table "public"."user_responses" validate constraint "user_responses_question_id_fkey";

alter table "public"."user_responses" add constraint "user_responses_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.assessment_sessions(id) ON DELETE CASCADE not valid;

alter table "public"."user_responses" validate constraint "user_responses_session_id_fkey";

alter table "public"."user_responses" add constraint "user_responses_session_question_key" UNIQUE using index "user_responses_session_question_key";

alter table "public"."user_responses" add constraint "user_responses_tool_id_fkey" FOREIGN KEY (tool_id) REFERENCES public.tools(id) ON DELETE CASCADE not valid;

alter table "public"."user_responses" validate constraint "user_responses_tool_id_fkey";

alter table "public"."user_responses" add constraint "user_responses_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."user_responses" validate constraint "user_responses_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_orphaned_parent_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
    v_parent_is_root BOOLEAN;
    v_children_count INTEGER;
BEGIN
    -- Controlliamo se la riga appena eliminata (OLD) aveva un padre
    IF OLD.parent_session_id IS NOT NULL THEN
        
        -- Verifichiamo se il padre di questa riga è un "padre principale" (cioè ha parent_session_id a NULL)
        SELECT (parent_session_id IS NULL) INTO v_parent_is_root
        FROM public.assessment_sessions
        WHERE id = OLD.parent_session_id;

        -- Se il padre esiste ed è effettivamente un nodo radice (root)
        IF v_parent_is_root THEN
            
            -- Contiamo quanti figli sono rimasti a questo padre (escluso quello appena eliminato)
            SELECT COUNT(*) INTO v_children_count
            FROM public.assessment_sessions
            WHERE parent_session_id = OLD.parent_session_id;

            -- Se non ci sono più figli (count = 0), eliminiamo anche il padre!
            IF v_children_count = 0 THEN
                DELETE FROM public.assessment_sessions 
                WHERE id = OLD.parent_session_id;
            END IF;
            
        END IF;
    END IF;
    
    -- Restituiamo la riga eliminata (comportamento standard per i trigger AFTER DELETE)
    RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_recursive_storage_paths(target_id uuid)
 RETURNS TABLE(storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH RECURSIVE tree AS (
    -- 1. Caso base: l'elemento selezionato
    SELECT id, parent_id, d.storage_path 
    FROM public.documents d -- È buona norma specificare anche qui 'public.'
    WHERE id = target_id
    
    UNION ALL
    
    -- 2. Parte ricorsiva: trova tutti i figli
    SELECT child.id, child.parent_id, child.storage_path 
    FROM public.documents child
    JOIN tree t ON child.parent_id = t.id
  )
  -- 3. Restituisci solo i path che non sono null (i file)
  SELECT tree.storage_path 
  FROM tree 
  WHERE tree.storage_path IS NOT NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_storage_paths_recursive(target_id uuid)
 RETURNS TABLE(storage_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  return query
  with recursive tree as (
    -- Caso base
    select id, parent_id, documents.storage_path 
    from documents 
    where id = target_id
    
    union all
    
    -- Parte ricorsiva
    select d.id, d.parent_id, d.storage_path 
    from documents d
    join tree t on d.parent_id = t.id
  )
  select tree.storage_path 
  from tree 
  where tree.storage_path is not null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_of_tool(_tool_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$SELECT EXISTS (
    SELECT 1
    FROM tool_access
    WHERE user_id = (SELECT auth.uid())
    AND tool_id = _tool_id
    AND role = 'admin'
  );$function$
;

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

grant delete on table "public"."assessment_sessions" to "anon";

grant insert on table "public"."assessment_sessions" to "anon";

grant references on table "public"."assessment_sessions" to "anon";

grant select on table "public"."assessment_sessions" to "anon";

grant trigger on table "public"."assessment_sessions" to "anon";

grant truncate on table "public"."assessment_sessions" to "anon";

grant update on table "public"."assessment_sessions" to "anon";

grant delete on table "public"."assessment_sessions" to "authenticated";

grant insert on table "public"."assessment_sessions" to "authenticated";

grant references on table "public"."assessment_sessions" to "authenticated";

grant select on table "public"."assessment_sessions" to "authenticated";

grant trigger on table "public"."assessment_sessions" to "authenticated";

grant truncate on table "public"."assessment_sessions" to "authenticated";

grant update on table "public"."assessment_sessions" to "authenticated";

grant delete on table "public"."assessment_sessions" to "postgres";

grant insert on table "public"."assessment_sessions" to "postgres";

grant references on table "public"."assessment_sessions" to "postgres";

grant select on table "public"."assessment_sessions" to "postgres";

grant trigger on table "public"."assessment_sessions" to "postgres";

grant truncate on table "public"."assessment_sessions" to "postgres";

grant update on table "public"."assessment_sessions" to "postgres";

grant delete on table "public"."assessment_sessions" to "service_role";

grant insert on table "public"."assessment_sessions" to "service_role";

grant references on table "public"."assessment_sessions" to "service_role";

grant select on table "public"."assessment_sessions" to "service_role";

grant trigger on table "public"."assessment_sessions" to "service_role";

grant truncate on table "public"."assessment_sessions" to "service_role";

grant update on table "public"."assessment_sessions" to "service_role";

grant delete on table "public"."country" to "anon";

grant insert on table "public"."country" to "anon";

grant references on table "public"."country" to "anon";

grant select on table "public"."country" to "anon";

grant trigger on table "public"."country" to "anon";

grant truncate on table "public"."country" to "anon";

grant update on table "public"."country" to "anon";

grant delete on table "public"."country" to "authenticated";

grant insert on table "public"."country" to "authenticated";

grant references on table "public"."country" to "authenticated";

grant select on table "public"."country" to "authenticated";

grant trigger on table "public"."country" to "authenticated";

grant truncate on table "public"."country" to "authenticated";

grant update on table "public"."country" to "authenticated";

grant delete on table "public"."country" to "postgres";

grant insert on table "public"."country" to "postgres";

grant references on table "public"."country" to "postgres";

grant select on table "public"."country" to "postgres";

grant trigger on table "public"."country" to "postgres";

grant truncate on table "public"."country" to "postgres";

grant update on table "public"."country" to "postgres";

grant delete on table "public"."country" to "service_role";

grant insert on table "public"."country" to "service_role";

grant references on table "public"."country" to "service_role";

grant select on table "public"."country" to "service_role";

grant trigger on table "public"."country" to "service_role";

grant truncate on table "public"."country" to "service_role";

grant update on table "public"."country" to "service_role";

grant delete on table "public"."documents" to "anon";

grant insert on table "public"."documents" to "anon";

grant references on table "public"."documents" to "anon";

grant select on table "public"."documents" to "anon";

grant trigger on table "public"."documents" to "anon";

grant truncate on table "public"."documents" to "anon";

grant update on table "public"."documents" to "anon";

grant delete on table "public"."documents" to "authenticated";

grant insert on table "public"."documents" to "authenticated";

grant references on table "public"."documents" to "authenticated";

grant select on table "public"."documents" to "authenticated";

grant trigger on table "public"."documents" to "authenticated";

grant truncate on table "public"."documents" to "authenticated";

grant update on table "public"."documents" to "authenticated";

grant delete on table "public"."documents" to "postgres";

grant insert on table "public"."documents" to "postgres";

grant references on table "public"."documents" to "postgres";

grant select on table "public"."documents" to "postgres";

grant trigger on table "public"."documents" to "postgres";

grant truncate on table "public"."documents" to "postgres";

grant update on table "public"."documents" to "postgres";

grant delete on table "public"."documents" to "service_role";

grant insert on table "public"."documents" to "service_role";

grant references on table "public"."documents" to "service_role";

grant select on table "public"."documents" to "service_role";

grant trigger on table "public"."documents" to "service_role";

grant truncate on table "public"."documents" to "service_role";

grant update on table "public"."documents" to "service_role";

grant delete on table "public"."eu_products" to "anon";

grant insert on table "public"."eu_products" to "anon";

grant references on table "public"."eu_products" to "anon";

grant select on table "public"."eu_products" to "anon";

grant trigger on table "public"."eu_products" to "anon";

grant truncate on table "public"."eu_products" to "anon";

grant update on table "public"."eu_products" to "anon";

grant delete on table "public"."eu_products" to "authenticated";

grant insert on table "public"."eu_products" to "authenticated";

grant references on table "public"."eu_products" to "authenticated";

grant select on table "public"."eu_products" to "authenticated";

grant trigger on table "public"."eu_products" to "authenticated";

grant truncate on table "public"."eu_products" to "authenticated";

grant update on table "public"."eu_products" to "authenticated";

grant delete on table "public"."eu_products" to "postgres";

grant insert on table "public"."eu_products" to "postgres";

grant references on table "public"."eu_products" to "postgres";

grant select on table "public"."eu_products" to "postgres";

grant trigger on table "public"."eu_products" to "postgres";

grant truncate on table "public"."eu_products" to "postgres";

grant update on table "public"."eu_products" to "postgres";

grant delete on table "public"."eu_products" to "service_role";

grant insert on table "public"."eu_products" to "service_role";

grant references on table "public"."eu_products" to "service_role";

grant select on table "public"."eu_products" to "service_role";

grant trigger on table "public"."eu_products" to "service_role";

grant truncate on table "public"."eu_products" to "service_role";

grant update on table "public"."eu_products" to "service_role";

grant delete on table "public"."mitigation_history" to "anon";

grant insert on table "public"."mitigation_history" to "anon";

grant references on table "public"."mitigation_history" to "anon";

grant select on table "public"."mitigation_history" to "anon";

grant trigger on table "public"."mitigation_history" to "anon";

grant truncate on table "public"."mitigation_history" to "anon";

grant update on table "public"."mitigation_history" to "anon";

grant delete on table "public"."mitigation_history" to "authenticated";

grant insert on table "public"."mitigation_history" to "authenticated";

grant references on table "public"."mitigation_history" to "authenticated";

grant select on table "public"."mitigation_history" to "authenticated";

grant trigger on table "public"."mitigation_history" to "authenticated";

grant truncate on table "public"."mitigation_history" to "authenticated";

grant update on table "public"."mitigation_history" to "authenticated";

grant delete on table "public"."mitigation_history" to "postgres";

grant insert on table "public"."mitigation_history" to "postgres";

grant references on table "public"."mitigation_history" to "postgres";

grant select on table "public"."mitigation_history" to "postgres";

grant trigger on table "public"."mitigation_history" to "postgres";

grant truncate on table "public"."mitigation_history" to "postgres";

grant update on table "public"."mitigation_history" to "postgres";

grant delete on table "public"."mitigation_history" to "service_role";

grant insert on table "public"."mitigation_history" to "service_role";

grant references on table "public"."mitigation_history" to "service_role";

grant select on table "public"."mitigation_history" to "service_role";

grant trigger on table "public"."mitigation_history" to "service_role";

grant truncate on table "public"."mitigation_history" to "service_role";

grant update on table "public"."mitigation_history" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "postgres";

grant insert on table "public"."notifications" to "postgres";

grant references on table "public"."notifications" to "postgres";

grant select on table "public"."notifications" to "postgres";

grant trigger on table "public"."notifications" to "postgres";

grant truncate on table "public"."notifications" to "postgres";

grant update on table "public"."notifications" to "postgres";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "postgres";

grant insert on table "public"."profiles" to "postgres";

grant references on table "public"."profiles" to "postgres";

grant select on table "public"."profiles" to "postgres";

grant trigger on table "public"."profiles" to "postgres";

grant truncate on table "public"."profiles" to "postgres";

grant update on table "public"."profiles" to "postgres";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."questions" to "anon";

grant insert on table "public"."questions" to "anon";

grant references on table "public"."questions" to "anon";

grant select on table "public"."questions" to "anon";

grant trigger on table "public"."questions" to "anon";

grant truncate on table "public"."questions" to "anon";

grant update on table "public"."questions" to "anon";

grant delete on table "public"."questions" to "authenticated";

grant insert on table "public"."questions" to "authenticated";

grant references on table "public"."questions" to "authenticated";

grant select on table "public"."questions" to "authenticated";

grant trigger on table "public"."questions" to "authenticated";

grant truncate on table "public"."questions" to "authenticated";

grant update on table "public"."questions" to "authenticated";

grant delete on table "public"."questions" to "postgres";

grant insert on table "public"."questions" to "postgres";

grant references on table "public"."questions" to "postgres";

grant select on table "public"."questions" to "postgres";

grant trigger on table "public"."questions" to "postgres";

grant truncate on table "public"."questions" to "postgres";

grant update on table "public"."questions" to "postgres";

grant delete on table "public"."questions" to "service_role";

grant insert on table "public"."questions" to "service_role";

grant references on table "public"."questions" to "service_role";

grant select on table "public"."questions" to "service_role";

grant trigger on table "public"."questions" to "service_role";

grant truncate on table "public"."questions" to "service_role";

grant update on table "public"."questions" to "service_role";

grant delete on table "public"."sections" to "anon";

grant insert on table "public"."sections" to "anon";

grant references on table "public"."sections" to "anon";

grant select on table "public"."sections" to "anon";

grant trigger on table "public"."sections" to "anon";

grant truncate on table "public"."sections" to "anon";

grant update on table "public"."sections" to "anon";

grant delete on table "public"."sections" to "authenticated";

grant insert on table "public"."sections" to "authenticated";

grant references on table "public"."sections" to "authenticated";

grant select on table "public"."sections" to "authenticated";

grant trigger on table "public"."sections" to "authenticated";

grant truncate on table "public"."sections" to "authenticated";

grant update on table "public"."sections" to "authenticated";

grant delete on table "public"."sections" to "postgres";

grant insert on table "public"."sections" to "postgres";

grant references on table "public"."sections" to "postgres";

grant select on table "public"."sections" to "postgres";

grant trigger on table "public"."sections" to "postgres";

grant truncate on table "public"."sections" to "postgres";

grant update on table "public"."sections" to "postgres";

grant delete on table "public"."sections" to "service_role";

grant insert on table "public"."sections" to "service_role";

grant references on table "public"."sections" to "service_role";

grant select on table "public"."sections" to "service_role";

grant trigger on table "public"."sections" to "service_role";

grant truncate on table "public"."sections" to "service_role";

grant update on table "public"."sections" to "service_role";

grant delete on table "public"."species" to "anon";

grant insert on table "public"."species" to "anon";

grant references on table "public"."species" to "anon";

grant select on table "public"."species" to "anon";

grant trigger on table "public"."species" to "anon";

grant truncate on table "public"."species" to "anon";

grant update on table "public"."species" to "anon";

grant delete on table "public"."species" to "authenticated";

grant insert on table "public"."species" to "authenticated";

grant references on table "public"."species" to "authenticated";

grant select on table "public"."species" to "authenticated";

grant trigger on table "public"."species" to "authenticated";

grant truncate on table "public"."species" to "authenticated";

grant update on table "public"."species" to "authenticated";

grant delete on table "public"."species" to "postgres";

grant insert on table "public"."species" to "postgres";

grant references on table "public"."species" to "postgres";

grant select on table "public"."species" to "postgres";

grant trigger on table "public"."species" to "postgres";

grant truncate on table "public"."species" to "postgres";

grant update on table "public"."species" to "postgres";

grant delete on table "public"."species" to "service_role";

grant insert on table "public"."species" to "service_role";

grant references on table "public"."species" to "service_role";

grant select on table "public"."species" to "service_role";

grant trigger on table "public"."species" to "service_role";

grant truncate on table "public"."species" to "service_role";

grant update on table "public"."species" to "service_role";

grant delete on table "public"."suppliers" to "anon";

grant insert on table "public"."suppliers" to "anon";

grant references on table "public"."suppliers" to "anon";

grant select on table "public"."suppliers" to "anon";

grant trigger on table "public"."suppliers" to "anon";

grant truncate on table "public"."suppliers" to "anon";

grant update on table "public"."suppliers" to "anon";

grant delete on table "public"."suppliers" to "authenticated";

grant insert on table "public"."suppliers" to "authenticated";

grant references on table "public"."suppliers" to "authenticated";

grant select on table "public"."suppliers" to "authenticated";

grant trigger on table "public"."suppliers" to "authenticated";

grant truncate on table "public"."suppliers" to "authenticated";

grant update on table "public"."suppliers" to "authenticated";

grant delete on table "public"."suppliers" to "postgres";

grant insert on table "public"."suppliers" to "postgres";

grant references on table "public"."suppliers" to "postgres";

grant select on table "public"."suppliers" to "postgres";

grant trigger on table "public"."suppliers" to "postgres";

grant truncate on table "public"."suppliers" to "postgres";

grant update on table "public"."suppliers" to "postgres";

grant delete on table "public"."suppliers" to "service_role";

grant insert on table "public"."suppliers" to "service_role";

grant references on table "public"."suppliers" to "service_role";

grant select on table "public"."suppliers" to "service_role";

grant trigger on table "public"."suppliers" to "service_role";

grant truncate on table "public"."suppliers" to "service_role";

grant update on table "public"."suppliers" to "service_role";

grant delete on table "public"."tool_access" to "anon";

grant insert on table "public"."tool_access" to "anon";

grant references on table "public"."tool_access" to "anon";

grant select on table "public"."tool_access" to "anon";

grant trigger on table "public"."tool_access" to "anon";

grant truncate on table "public"."tool_access" to "anon";

grant update on table "public"."tool_access" to "anon";

grant delete on table "public"."tool_access" to "authenticated";

grant insert on table "public"."tool_access" to "authenticated";

grant references on table "public"."tool_access" to "authenticated";

grant select on table "public"."tool_access" to "authenticated";

grant trigger on table "public"."tool_access" to "authenticated";

grant truncate on table "public"."tool_access" to "authenticated";

grant update on table "public"."tool_access" to "authenticated";

grant delete on table "public"."tool_access" to "postgres";

grant insert on table "public"."tool_access" to "postgres";

grant references on table "public"."tool_access" to "postgres";

grant select on table "public"."tool_access" to "postgres";

grant trigger on table "public"."tool_access" to "postgres";

grant truncate on table "public"."tool_access" to "postgres";

grant update on table "public"."tool_access" to "postgres";

grant delete on table "public"."tool_access" to "service_role";

grant insert on table "public"."tool_access" to "service_role";

grant references on table "public"."tool_access" to "service_role";

grant select on table "public"."tool_access" to "service_role";

grant trigger on table "public"."tool_access" to "service_role";

grant truncate on table "public"."tool_access" to "service_role";

grant update on table "public"."tool_access" to "service_role";

grant delete on table "public"."tools" to "anon";

grant insert on table "public"."tools" to "anon";

grant references on table "public"."tools" to "anon";

grant select on table "public"."tools" to "anon";

grant trigger on table "public"."tools" to "anon";

grant truncate on table "public"."tools" to "anon";

grant update on table "public"."tools" to "anon";

grant delete on table "public"."tools" to "authenticated";

grant insert on table "public"."tools" to "authenticated";

grant references on table "public"."tools" to "authenticated";

grant select on table "public"."tools" to "authenticated";

grant trigger on table "public"."tools" to "authenticated";

grant truncate on table "public"."tools" to "authenticated";

grant update on table "public"."tools" to "authenticated";

grant delete on table "public"."tools" to "postgres";

grant insert on table "public"."tools" to "postgres";

grant references on table "public"."tools" to "postgres";

grant select on table "public"."tools" to "postgres";

grant trigger on table "public"."tools" to "postgres";

grant truncate on table "public"."tools" to "postgres";

grant update on table "public"."tools" to "postgres";

grant delete on table "public"."tools" to "service_role";

grant insert on table "public"."tools" to "service_role";

grant references on table "public"."tools" to "service_role";

grant select on table "public"."tools" to "service_role";

grant trigger on table "public"."tools" to "service_role";

grant truncate on table "public"."tools" to "service_role";

grant update on table "public"."tools" to "service_role";

grant delete on table "public"."user_responses" to "anon";

grant insert on table "public"."user_responses" to "anon";

grant references on table "public"."user_responses" to "anon";

grant select on table "public"."user_responses" to "anon";

grant trigger on table "public"."user_responses" to "anon";

grant truncate on table "public"."user_responses" to "anon";

grant update on table "public"."user_responses" to "anon";

grant delete on table "public"."user_responses" to "authenticated";

grant insert on table "public"."user_responses" to "authenticated";

grant references on table "public"."user_responses" to "authenticated";

grant select on table "public"."user_responses" to "authenticated";

grant trigger on table "public"."user_responses" to "authenticated";

grant truncate on table "public"."user_responses" to "authenticated";

grant update on table "public"."user_responses" to "authenticated";

grant delete on table "public"."user_responses" to "postgres";

grant insert on table "public"."user_responses" to "postgres";

grant references on table "public"."user_responses" to "postgres";

grant select on table "public"."user_responses" to "postgres";

grant trigger on table "public"."user_responses" to "postgres";

grant truncate on table "public"."user_responses" to "postgres";

grant update on table "public"."user_responses" to "postgres";

grant delete on table "public"."user_responses" to "service_role";

grant insert on table "public"."user_responses" to "service_role";

grant references on table "public"."user_responses" to "service_role";

grant select on table "public"."user_responses" to "service_role";

grant trigger on table "public"."user_responses" to "service_role";

grant truncate on table "public"."user_responses" to "service_role";

grant update on table "public"."user_responses" to "service_role";


  create policy "Delete for owner"
  on "public"."assessment_sessions"
  as permissive
  for delete
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Insert for owner"
  on "public"."assessment_sessions"
  as permissive
  for insert
  to authenticated
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Select for owner or admin"
  on "public"."assessment_sessions"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin_of_tool(tool_id)));



  create policy "Update for owner"
  on "public"."assessment_sessions"
  as permissive
  for update
  to authenticated
using ((user_id = ( SELECT auth.uid() AS uid)))
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Enable read access for all users"
  on "public"."country"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Admin delete documents"
  on "public"."documents"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.user_id = ( SELECT auth.uid() AS uid)) AND (ta.tool_id = documents.tool_id) AND (ta.role = 'admin'::public.app_role)))));



  create policy "Admin insert documents"
  on "public"."documents"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.user_id = ( SELECT auth.uid() AS uid)) AND (ta.tool_id = documents.tool_id) AND (ta.role = 'admin'::public.app_role)))));



  create policy "View documents"
  on "public"."documents"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.user_id = ( SELECT auth.uid() AS uid)) AND (ta.tool_id = documents.tool_id)))));



  create policy "Enable read access for all users"
  on "public"."eu_products"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users can insert their own mitigation history"
  on "public"."mitigation_history"
  as permissive
  for insert
  to public
with check ((session_id IN ( SELECT assessment_sessions.id
   FROM public.assessment_sessions
  WHERE ((assessment_sessions.user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin_of_tool(assessment_sessions.tool_id)))));



  create policy "Users can view their own mitigation history"
  on "public"."mitigation_history"
  as permissive
  for select
  to public
using ((session_id IN ( SELECT assessment_sessions.id
   FROM public.assessment_sessions
  WHERE ((assessment_sessions.user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin_of_tool(assessment_sessions.tool_id)))));



  create policy "notifications_delete_admin"
  on "public"."notifications"
  as permissive
  for delete
  to authenticated
using (public.is_admin_of_tool(tool_id));



  create policy "notifications_insert_admin"
  on "public"."notifications"
  as permissive
  for insert
  to authenticated
with check (public.is_admin_of_tool(tool_id));



  create policy "notifications_select_tool_users"
  on "public"."notifications"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.tool_access
  WHERE ((tool_access.user_id = ( SELECT auth.uid() AS uid)) AND (tool_access.tool_id = notifications.tool_id)))));



  create policy "notifications_update_admin"
  on "public"."notifications"
  as permissive
  for update
  to authenticated
using (public.is_admin_of_tool(tool_id))
with check (public.is_admin_of_tool(tool_id));



  create policy "Authenticated users view profiles"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Utenti modificano proprio profilo"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = id));



  create policy "Vedo domande se ho accesso al tool"
  on "public"."questions"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.sections s
     JOIN public.tool_access ta ON ((ta.tool_id = s.tool_id)))
  WHERE ((s.id = questions.section_id) AND (ta.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Vedo sezioni se ho accesso al tool"
  on "public"."sections"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.tool_id = sections.tool_id) AND (ta.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Enable read access for all users"
  on "public"."species"
  as permissive
  for select
  to authenticated
using (true);



  create policy "Users and admins can view suppliers"
  on "public"."suppliers"
  as permissive
  for select
  to public
using (((( SELECT auth.uid() AS uid) = user_id) OR public.is_admin_of_tool(tool_id)));



  create policy "Users can delete their own suppliers"
  on "public"."suppliers"
  as permissive
  for delete
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can insert their own suppliers"
  on "public"."suppliers"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Users can update their own suppliers"
  on "public"."suppliers"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = user_id))
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Admins delete tool members"
  on "public"."tool_access"
  as permissive
  for delete
  to authenticated
using (public.is_admin_of_tool(tool_id));



  create policy "Admins update tool members"
  on "public"."tool_access"
  as permissive
  for update
  to authenticated
using (public.is_admin_of_tool(tool_id));



  create policy "Unified select for tool_access"
  on "public"."tool_access"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin_of_tool(tool_id)));



  create policy "Vedo tool se ho accesso"
  on "public"."tools"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.tool_id = tools.id) AND (ta.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Gestione Risposte Complessa"
  on "public"."user_responses"
  as permissive
  for select
  to authenticated
using (((user_id = ( SELECT auth.uid() AS uid)) OR public.is_admin_of_tool(tool_id)));



  create policy "Users can delete their own responses"
  on "public"."user_responses"
  as permissive
  for delete
  to public
using ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Utente crea sue risposte"
  on "public"."user_responses"
  as permissive
  for insert
  to public
with check ((( SELECT auth.uid() AS uid) = user_id));



  create policy "Utente modifica sue risposte"
  on "public"."user_responses"
  as permissive
  for update
  to public
using ((( SELECT auth.uid() AS uid) = user_id));


CREATE TRIGGER trigger_delete_orphaned_parent AFTER DELETE ON public.assessment_sessions FOR EACH ROW EXECUTE FUNCTION public.delete_orphaned_parent_session();

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Admin delete documents"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'documents'::text) AND (EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.user_id = auth.uid()) AND (ta.role = 'admin'::public.app_role) AND ((ta.tool_id)::text = split_part(objects.name, '/'::text, 1)))))));



  create policy "Admin upload documents"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'documents'::text) AND (EXISTS ( SELECT 1
   FROM public.tool_access ta
  WHERE ((ta.user_id = auth.uid()) AND (ta.role = 'admin'::public.app_role) AND ((ta.tool_id)::text = split_part(objects.name, '/'::text, 1)))))));



  create policy "Enable insert for authenticated users only"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (true);



  create policy "Read documents"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'documents'::text));



  create policy "Tool Admins delete tool files"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'user-uploads'::text) AND public.is_admin_of_tool(((storage.foldername(name))[2])::uuid)));



  create policy "Tool Admins manage tool files"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'user-uploads'::text) AND public.is_admin_of_tool(((storage.foldername(name))[2])::uuid)));



  create policy "Users manage own files"
  on "storage"."objects"
  as permissive
  for all
  to authenticated
using (((bucket_id = 'user-uploads'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)))
with check (((bucket_id = 'user-uploads'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



