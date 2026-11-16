-- DD04 A00-020 | POST-APPROVAL STAGING ACCEPTANCE QUERIES, READ-ONLY.
-- This is NOT a migration. Run only after exact SQL candidate has been separately approved and applied.
-- Target: wbvkqfnrlasmtizjszab / dd04_stage.
SELECT current_database() AS database_name,current_user AS executing_user,
 current_setting('server_version') AS pg_version;

SELECT to_regclass('dd04_stage.a00_worker_identities') IS NOT NULL AS workers_present,
 to_regclass('dd04_stage.a00_workflow_instances') IS NOT NULL AS workflow_present,
 to_regclass('dd04_stage.a00_task_contexts') IS NOT NULL AS contexts_present,
 to_regclass('dd04_stage.a00_transition_events') IS NOT NULL AS events_present;

SELECT rolname,rolcanlogin,rolbypassrls,rolsuper
 FROM pg_roles WHERE rolname='dd04_a00_runtime';

SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,
 count(DISTINCT p.policyname) AS policy_count
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_policies p ON p.schemaname=n.nspname AND p.tablename=c.relname
 WHERE n.nspname='dd04_stage' AND c.relkind='r'
 AND c.relname IN ('a00_worker_identities','a00_workflow_instances',
  'a00_task_contexts','a00_transition_events')
 GROUP BY c.relname,c.relrowsecurity,c.relforcerowsecurity ORDER BY 1;

SELECT c.relname,has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
 has_table_privilege('authenticated',c.oid,'INSERT') AS authenticated_insert,
 has_table_privilege('service_role',c.oid,'UPDATE') AS service_role_update
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='dd04_stage' AND c.relkind='r'
 AND c.relname LIKE 'a00_%' ORDER BY 1;

SELECT tgrelid::regclass::text AS table_name,tgname,tgenabled
 FROM pg_trigger
 WHERE tgrelid IN (
  'dd04_stage.a00_transition_events'::regclass,
  'dd04_stage.a00_task_contexts'::regclass,
  'dd04_stage.v55_agent_handoff_events'::regclass
 ) AND NOT tgisinternal ORDER BY 1,2;

SELECT count(*)::int AS workers_configured,
 count(*) FILTER(WHERE status='ACTIVE')::int AS active_workers
 FROM dd04_stage.a00_worker_identities;
SELECT count(*)::int AS legacy_tasks,
 count(*) FILTER(WHERE status='PLANNED_WAIT_G1')::int AS waiting_g1
 FROM dd04_stage.tasks;
SELECT gate,decision,count(*)::int AS records
 FROM dd04_stage.approvals GROUP BY 1,2 ORDER BY 1,2;
SELECT count(*)::int AS publish_jobs FROM dd04_stage.v55_publish_jobs;
-- PASS in schema-only deployment: 4 new tables + RLS, role NOLOGIN/NOBYPASSRLS,
-- 0 ACTIVE workers, G1 and A07 remain locked. Operational PASS requires controlled
-- authenticated worker tests, cross-tenant negative checks and artifact provenance.
