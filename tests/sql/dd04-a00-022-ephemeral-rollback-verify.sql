-- DD04 A00-022 admin-only rollback verification, disposable PostgreSQL 17 CI.
DO $rollback$
BEGIN
 IF EXISTS(SELECT 1 FROM dd04_stage.a00_022_internal_g1_events)
 OR EXISTS(SELECT 1 FROM dd04_stage.a00_022_finance_reservations)
 OR EXISTS(SELECT 1 FROM dd04_stage.a00_022_review_events)
 OR EXISTS(SELECT 1 FROM dd04_stage.a00_022_ceo_finance_queue)
 THEN RAISE EXCEPTION 'G1_FINANCE_TEST_ROLLBACK_FAILED'; END IF;
 IF (SELECT count(*) FROM dd04_stage.approvals WHERE gate='G1'
   AND decision='PENDING')<>1 THEN RAISE EXCEPTION 'CEO_G1_LEGACY_MUTATED'; END IF;
 RAISE NOTICE 'PASS_G1_FINANCE_AUDIT_TRANSACTION_ROLLBACK';
END $rollback$;
