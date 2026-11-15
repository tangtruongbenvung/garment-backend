-- DD04-A00-021 | ISOLATED PostgreSQL 17 CI ONLY. Never execute on Supabase staging.
-- Requires fixture and approved SQL24 schema from the CI job.
BEGIN;
GRANT dd04_a00_runtime TO postgres WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
DO $test$
DECLARE secret_key text;
DECLARE actor text;
DECLARE scoped boolean;
DECLARE cross_tenant boolean;
DECLARE visible_rows integer;
DECLARE handoff_rejected boolean := false;
BEGIN
 secret_key:='dd04w_'||encode(gen_random_bytes(48),'hex');
 INSERT INTO dd04_stage.a00_worker_identities
  (tenant_id,subject_id,agent_id,credential_sha256,status,allowed_actions,expires_at)
 VALUES ('6bc73b49-a396-4c7d-b390-ab6339d547cd',
  '15151515-1515-4515-8515-151515151515'::uuid,'A00',
  encode(sha256(convert_to(secret_key,'UTF8')),'hex'),'ACTIVE',
  ARRAY['READ','SAVE_PLAN'],now()+interval '3 minutes');
 PERFORM set_config('dd04.worker_credential',secret_key,true);
 EXECUTE 'SET LOCAL ROLE dd04_a00_runtime';
 SELECT dd04_stage.a00_current_agent(),
  dd04_stage.a00_authorized('6bc73b49-a396-4c7d-b390-ab6339d547cd','SAVE_PLAN','A00'),
  dd04_stage.a00_authorized('11111111-1111-4111-8111-111111111111','READ')
 INTO actor,scoped,cross_tenant;
 IF actor<>'A00' OR NOT scoped OR cross_tenant THEN
  RAISE EXCEPTION 'WORKER_TENANT_OR_CAPABILITY_INVALID';
 END IF;
 INSERT INTO dd04_stage.tasks
  (tenant_id,command_id,task_id,owner_agent,status,revision)
 VALUES ('6bc73b49-a396-4c7d-b390-ab6339d547cd',
  'cmd_1234567890abcdef1234','cmd_1234567890abcdef1234_A00',
  'A00','PLANNED_WAIT_G1',1);
 INSERT INTO dd04_stage.task_events
 (tenant_id,command_id,task_id,event_name,actor_kind,actor_ref,
   to_status,evidence_sha256,details)
 VALUES ('6bc73b49-a396-4c7d-b390-ab6339d547cd',
 'cmd_1234567890abcdef1234',NULL,'TASK_PLAN_SAVED','AGENT','A00',
 'PLANNED_WAIT_G1',repeat('a',64),'{"test":"ephemeral-only"}'::jsonb);
 SELECT count(*) INTO visible_rows FROM dd04_stage.tasks
 WHERE task_id='cmd_1234567890abcdef1234_A00';
 IF visible_rows<>1 THEN RAISE EXCEPTION 'TASK_SAVE_NOT_VISIBLE'; END IF;
 BEGIN
  INSERT INTO dd04_stage.v55_agent_handoff_events
   (tenant_id,command_id,task_id,from_agent,to_agent,revision,
    input_sha256,report_sha256,verdict)
  VALUES ('6bc73b49-a396-4c7d-b390-ab6339d547cd',
  'cmd_1234567890abcdef1234','cmd_1234567890abcdef1234_A00',
  'A00','A08',1,repeat('a',64),repeat('b',64),'PENDING');
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='A00_HANDOFF_UNVERIFIED' THEN
   handoff_rejected:=true;
   RAISE NOTICE 'PASS_UNAUTHORIZED_HANDOFF_REJECTED_BY_A00_GUARD';
  ELSE RAISE; END IF;
 END;
 IF NOT handoff_rejected THEN RAISE EXCEPTION 'UNAUTHORIZED_HANDOFF_ACCEPTED'; END IF;
 RAISE NOTICE 'PASS_WORKER_SCOPE_TASK_INSERT_AND_AUDIT';
 EXECUTE 'RESET ROLE';
END $test$;
ROLLBACK;
-- Assert test never modified the fixture after rollback.
DO $check$
BEGIN
 IF EXISTS(SELECT 1 FROM dd04_stage.tasks
   WHERE task_id='cmd_1234567890abcdef1234_A00') OR
   EXISTS(SELECT 1 FROM dd04_stage.a00_worker_identities)
 THEN RAISE EXCEPTION 'ROLLBACK_NOT_ATOMIC'; END IF;
 RAISE NOTICE 'PASS_ROLLBACK_LEFT_NO_TEST_WORKER_OR_TASK';
END $check$;
