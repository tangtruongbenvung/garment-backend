-- DD04-A00-020 | STAGING READ-ONLY PREFLIGHT | SAFE TO RUN
-- Project: wbvkqfnrlasmtizjszab. No DDL, DML, locks or permissions changed.
-- PASS criteria described in acceptance report. An empty/zero result is not a migration approval.
SELECT current_database() AS database_name, current_user AS database_reader;
SELECT table_name FROM information_schema.tables
 WHERE table_schema='dd04_stage'
 AND table_name IN ('a00_workflow_instances','a00_task_contexts','a00_transition_events')
 ORDER BY table_name;
SELECT count(*)::int AS tasks_total,
 count(*) FILTER (WHERE status='PLANNED_WAIT_G1')::int AS pending_g1_tasks
 FROM dd04_stage.tasks;
SELECT gate,decision,count(*)::int AS count FROM dd04_stage.approvals GROUP BY gate,decision ORDER BY gate,decision;
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled,
 (SELECT count(*)::int FROM pg_policies p WHERE p.schemaname='dd04_stage' AND p.tablename=c.relname) AS policies
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='dd04_stage' AND c.relkind='r'
 ORDER BY c.relname;
SELECT tgrelid::regclass::text AS protected_table,tgname,tgenabled
 FROM pg_trigger
 WHERE tgrelid IN ('dd04_stage.tasks'::regclass,'dd04_stage.approvals'::regclass,'dd04_stage.task_events'::regclass)
 AND NOT tgisinternal ORDER BY protected_table,tgname;
-- This query is deliberately NOT executing the A00-020 transaction writer.
