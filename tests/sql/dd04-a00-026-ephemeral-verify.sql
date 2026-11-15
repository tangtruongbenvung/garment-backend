-- CI disposable PostgreSQL 17 ONLY — A00-026 staging candidate security validation.
DO $verify$
DECLARE total integer;
BEGIN
 SELECT count(*) INTO total FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE ns.nspname='dd04_stage' AND c.relkind='r' AND c.relname LIKE 'a00_026_%'
 AND c.relrowsecurity;
 IF total<>4 THEN RAISE EXCEPTION 'A00_026_FOUR_RLS_TABLES_REQUIRED: %',total; END IF;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='dd04_stage'
    AND tablename LIKE 'a00_026_%')
 THEN RAISE EXCEPTION 'A00_026_DIRECT_RUNTIME_POLICY_FORBIDDEN'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'a00_026_%immutability'
    AND tgenabled='O')<>4
 THEN RAISE EXCEPTION 'A00_026_IMMUTABLE_TRIGGER_MISSING'; END IF;
 IF has_table_privilege('dd04_a00_runtime','dd04_stage.a00_026_reference_assets','INSERT')
 OR has_table_privilege('anon','dd04_stage.a00_026_identity_versions','SELECT')
 OR has_table_privilege('authenticated','dd04_stage.a00_026_qc_evidence','INSERT')
 OR has_table_privilege('service_role','dd04_stage.a00_026_scene_image_assets','UPDATE')
 THEN RAISE EXCEPTION 'A00_026_DIRECT_TABLE_GRANT_FORBIDDEN'; END IF;
 RAISE NOTICE 'PASS_A00_026_FOUR_PRIVATE_RLS_IMMUTABLE_TABLES_AND_NO_WRITER';
END $verify$;
