-- DD04-A00-022 integrated SQL candidate postcheck, disposable PostgreSQL 17 only.
DO $check$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='dd04_stage' AND c.relkind='r'
 AND c.relname LIKE 'a00_022_%' AND c.relrowsecurity;
 IF n<>5 THEN RAISE EXCEPTION 'FIVE_PRIVATE_RLS_TABLES_REQUIRED: %',n; END IF;
 IF (SELECT count(*) FROM pg_trigger
 WHERE tgname IN ('a00_022_policy_guard','a00_022_review_events_immutable',
 'a00_022_finance_deny_update','a00_022_internal_g1_guard',
 'a00_022_ceo_finance_immutable','a00_context_transition_guard',
 'a00_transition_event_guard','a00_v55_handoff_insert_guard')
 AND tgenabled='O')<>8 THEN RAISE EXCEPTION 'INTEGRATED_GUARDS_MISSING'; END IF;
 IF (SELECT count(*) FROM dd04_stage.approvals WHERE gate='G1' AND decision='PENDING')<>1
 THEN RAISE EXCEPTION 'LEGACY_G1_MUTATED'; END IF;
 IF has_table_privilege('dd04_a00_runtime','dd04_stage.a00_022_internal_g1_events','INSERT')
 OR has_table_privilege('dd04_a00_runtime','dd04_stage.a00_022_finance_reservations','UPDATE')
 OR has_table_privilege('anon','dd04_stage.a00_022_delegation_policies','SELECT')
 THEN RAISE EXCEPTION 'UNAUTHORIZED_TABLE_GRANTS'; END IF;
 IF NOT has_function_privilege('dd04_a00_runtime',
 'dd04_stage.a00_022_reserve_finance(uuid,text,uuid,text,text,text,bigint)','EXECUTE')
 OR has_function_privilege('anon',
 'dd04_stage.a00_022_reserve_finance(uuid,text,uuid,text,text,text,bigint)','EXECUTE')
 OR has_function_privilege('authenticated',
 'dd04_stage.a00_022_commit_g1(uuid,text,uuid,text,uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'BAD_PROCEDURE_ACL'; END IF;
 IF dd04_stage.a00_022_effective_g1('6bc73b49-a396-4c7d-b390-ab6339d547cd'::uuid,
 'cmd_1234567890abcdef1234') THEN RAISE EXCEPTION 'UNAUTHORIZED_INTERNAL_G1'; END IF;
 RAISE NOTICE 'PASS_A00_022_INTEGRATED_SCHEMA_PRIVILEGES_AND_PENDING_G1';
END $check$;
