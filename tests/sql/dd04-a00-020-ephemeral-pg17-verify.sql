-- DD04 A00-020 | EPHEMERAL POSTGRES 17 ONLY | DO NOT RUN ON STAGING.
DO $check$
DECLARE invalids integer;
BEGIN
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='dd04_stage' AND c.relkind='r' AND c.relname IN
    ('a00_worker_identities','a00_workflow_instances','a00_task_contexts','a00_transition_events'))<>4
 THEN RAISE EXCEPTION 'FOUR_TABLES_REQUIRED'; END IF;
 IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='dd04_stage' AND c.relkind='r' AND c.relname LIKE 'a00_%'
      AND c.relrowsecurity)<>4
 THEN RAISE EXCEPTION 'RLS_NOT_ENABLED'; END IF;
 IF (SELECT rolcanlogin OR rolbypassrls FROM pg_roles WHERE rolname='dd04_a00_runtime')
 THEN RAISE EXCEPTION 'UNSAFE_RUNTIME_ROLE'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='dd04_stage'
   AND policyname LIKE 'a00_rt_%') < 12
 THEN RAISE EXCEPTION 'RLS_POLICY_COUNT_TOO_LOW'; END IF;
 IF has_table_privilege('anon','dd04_stage.a00_transition_events','INSERT')
    OR has_table_privilege('authenticated','dd04_stage.a00_task_contexts','UPDATE')
    OR has_table_privilege('service_role','dd04_stage.a00_worker_identities','SELECT')
 THEN RAISE EXCEPTION 'BROWSER_OR_SERVICE_DIRECT_GRANT'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgname IN
   ('a00_transition_event_guard','a00_context_transition_guard',
    'a00_v55_handoff_insert_guard','a00_transition_events_immutable')
   AND tgenabled='O') <>4
 THEN RAISE EXCEPTION 'GUARD_TRIGGERS_MISSING'; END IF;
 IF EXISTS (SELECT 1 FROM dd04_stage.a00_worker_identities WHERE status='ACTIVE')
 THEN RAISE EXCEPTION 'WORKER_ACTIVATED_WITHOUT_APPROVAL'; END IF;
 IF (SELECT count(*) FROM dd04_stage.tasks WHERE status='PLANNED_WAIT_G1')<>1
 THEN RAISE EXCEPTION 'CANONICAL_GATE_MODIFIED'; END IF;
 RAISE NOTICE 'PASS: 4 schema tables, RLS, no-login role, guards, public deny, G1 unchanged';
END;
$check$;

BEGIN;
SET LOCAL ROLE dd04_a00_runtime;
SELECT pg_catalog.set_config('dd04.worker_credential','dd04w_unprovisioned_invalid_key',true);
DO $security$
DECLARE visible_tasks integer;
BEGIN
 SELECT count(*) INTO visible_tasks FROM dd04_stage.tasks;
 IF visible_tasks<>0 THEN RAISE EXCEPTION 'RLS_BYPASS_VISIBLE_TASKS'; END IF;
 IF dd04_stage.a00_authorized(
    '6bc73b49-a396-4c7d-b390-ab6339d547cd'::uuid,'READ')
 THEN RAISE EXCEPTION 'FORGED_CREDENTIAL_ACCEPTED'; END IF;
 RAISE NOTICE 'PASS: unprovisioned worker has zero data visibility and zero authority';
END;
$security$;
ROLLBACK;
