-- DD04 A00-022 | EPHEMERAL CI TEST executed by ci-only backend login.
-- Positive G1 commit with independent reviews, negative overspend, rollback.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL ROLE dd04_a00_runtime;
DO $integration$
DECLARE tenant constant uuid='6bc73b49-a396-4c7d-b390-ab6339d547cd';
DECLARE policy constant uuid='99999999-9999-4999-8999-999999999999';
DECLARE cmd constant text='cmd_1234567890abcdef1234';
DECLARE extra constant text='cmd_22222222222222222222';
DECLARE amount_one uuid;
DECLARE review_hash text;
DECLARE event_id bigint;
DECLARE rejected boolean:=false;
DECLARE i integer;
BEGIN
 PERFORM set_config('dd04.worker_credential','dd04w_'||repeat('4',64),true);
 amount_one:=dd04_stage.a00_022_reserve_finance(tenant,cmd,policy,repeat('a',64),
 'same-campaign',to_char(now() AT TIME ZONE 'Asia/Bangkok','YYYY-MM'),400);
 PERFORM dd04_stage.a00_022_reserve_finance(tenant,extra,policy,repeat('a',64),
 'same-campaign',to_char(now() AT TIME ZONE 'Asia/Bangkok','YYYY-MM'),250);
 BEGIN
  PERFORM dd04_stage.a00_022_reserve_finance(tenant,cmd,policy,repeat('a',64),
   'same-campaign',to_char(now() AT TIME ZONE 'Asia/Bangkok','YYYY-MM'),100);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='A11_CEO_FINANCE_EXCEPTION_REQUIRED' THEN
   rejected:=true; ELSE RAISE; END IF;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'A11_SPLIT_BUDGET_OVERRUN_ACCEPTED'; END IF;
 PERFORM dd04_stage.a00_022_queue_finance_exception(
  tenant,cmd,policy,repeat('a',64),100,'CAMPAIGN_LIMIT');
 RAISE NOTICE 'PASS_A11_CAMPAIGN_CAP_ACROSS_COMMANDS';
 FOR i IN 1..4 LOOP
  PERFORM set_config('dd04.worker_credential','dd04w_'||repeat(i::text,64),true);
  PERFORM dd04_stage.a00_022_record_review(tenant,cmd,policy,repeat('a',64),
  repeat(i::text,64),'PASS',now()+interval '30 minutes');
 END LOOP;
 PERFORM set_config('dd04.worker_credential','dd04w_'||repeat('1',64),true);
 review_hash:=dd04_stage.a00_022_review_manifest(tenant,cmd,policy,repeat('a',64));
 IF review_hash IS NULL OR length(review_hash)<>64
 THEN RAISE EXCEPTION 'G1_MANIFEST_NOT_HASHED'; END IF;
 event_id:=dd04_stage.a00_022_commit_g1(tenant,cmd,policy,repeat('a',64),
  amount_one,review_hash,'ci_g1_commit_001');
 IF event_id IS NULL OR NOT dd04_stage.a00_022_effective_g1(tenant,cmd)
 THEN RAISE EXCEPTION 'G1_NOT_EFFECTIVE_INSIDE_ATOMIC_TRANSACTION'; END IF;
 RAISE NOTICE 'PASS_FOUR_AGENTS_INDEPENDENT_INTERNAL_G1_ATOMIC';
END $integration$;
ROLLBACK;
-- Fixture setup survives; transaction-only finance + reviews + G1 do not.
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
