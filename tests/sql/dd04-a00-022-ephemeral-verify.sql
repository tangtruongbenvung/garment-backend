-- DD04-A00-022 — isolated PostgreSQL 17 CI postcheck; NEVER staging.
DO $checks$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns
   ON ns.oid=c.relnamespace
   WHERE ns.nspname='dd04_stage' AND c.relkind='r'
     AND c.relname LIKE 'a00_022_%' AND c.relrowsecurity;
 IF n<>5 THEN RAISE EXCEPTION 'A00_022_FIVE_RLS_TABLES_REQUIRED: %',n; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='dd04_stage'
   AND tablename LIKE 'a00_022_%') THEN
   RAISE EXCEPTION 'A00_022_ACCIDENTAL_ACTIVE_RLS_POLICY';
 END IF;
 IF has_table_privilege('dd04_a00_runtime','dd04_stage.a00_022_internal_g1_events','INSERT')
   OR has_table_privilege('dd04_a00_runtime','dd04_stage.a00_022_finance_reservations','UPDATE')
   OR has_table_privilege('anon','dd04_stage.a00_022_review_events','SELECT')
 THEN RAISE EXCEPTION 'A00_022_UNAUTHORIZED_GRANT'; END IF;
 IF (SELECT count(*) FROM dd04_stage.approvals
     WHERE decision='PENDING' AND gate='G1')<>1 THEN
    RAISE EXCEPTION 'A00_022_CANONICAL_G1_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM dd04_stage.a00_022_delegation_policies
      WHERE status='ACTIVE') THEN
   RAISE EXCEPTION 'A00_022_POLICY_ACTIVATED_WITHOUT_CEO'; END IF;
 IF (SELECT count(*) FROM pg_trigger
     WHERE tgname IN ('dd04_tasks_guard','dd04_approval_guard','a00_context_transition_guard')
     AND tgenabled='O')<>3 THEN
   RAISE EXCEPTION 'A00_022_EXISTING_GUARD_MISSING'; END IF;
 RAISE NOTICE 'PASS_A00_022_REVIEW_SCHEMA_RLS_AND_G1_UNCHANGED';
END $checks$;
