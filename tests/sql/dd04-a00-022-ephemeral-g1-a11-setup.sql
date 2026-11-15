-- DD04 A00-022 | EPHEMERAL CI ONLY — synthetic CEO AAL2 + 4 worker identities.
-- Never copy these fixture credentials/roles/policies into Supabase staging.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $f$ SELECT NULLIF(current_setting('dd04.test_ceo_id',true),'')::uuid $f$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
 $f$ SELECT jsonb_build_object('aal',current_setting('dd04.test_aal',true)) $f$;
CREATE TABLE dd04_stage.ceo_enrollments (
 tenant_id uuid NOT NULL,user_id uuid NOT NULL,role text NOT NULL,
 status text NOT NULL,verified_by_admin boolean NOT NULL
);
INSERT INTO dd04_stage.ceo_enrollments VALUES(
 '6bc73b49-a396-4c7d-b390-ab6339d547cd',
 '55555555-5555-4555-8555-555555555555','CEO','ACTIVE',true);
CREATE ROLE dd04_a00_backend LOGIN PASSWORD 'ci_ephemeral_only_not_production' NOINHERIT NOBYPASSRLS;
GRANT dd04_a00_runtime TO dd04_a00_backend WITH INHERIT FALSE, SET TRUE, ADMIN FALSE;
INSERT INTO dd04_stage.a00_022_delegation_policies (
 tenant_id,policy_id,version,policy_sha256,status,scope,effective_from,
 expires_at,authorized_ceo_id,max_single_spend_vnd,max_campaign_spend_vnd)
 VALUES ('6bc73b49-a396-4c7d-b390-ab6339d547cd',
 '99999999-9999-4999-8999-999999999999',1,repeat('b',64),
 'PROPOSED','DD04_INTERNAL_CONTENT_ONLY',now()-interval '1 day',
 now()+interval '7 days','55555555-5555-4555-8555-555555555555',500,700);
SELECT set_config('dd04.test_ceo_id','55555555-5555-4555-8555-555555555555',false);
SELECT set_config('dd04.test_aal','aal1',false);
DO $deny$
BEGIN
 BEGIN
  PERFORM dd04_stage.a00_022_ceo_policy_decision(
   '6bc73b49-a396-4c7d-b390-ab6339d547cd'::uuid,
   '99999999-9999-4999-8999-999999999999'::uuid,repeat('b',64),'ACTIVE');
  RAISE EXCEPTION 'UNVERIFIED_AAL1_CEO_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'CEO_MFA_AAL2_REQUIRED' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'PASS_CEO_AAL1_CANNOT_ACTIVATE_POLICY';
END $deny$;
SELECT set_config('dd04.test_aal','aal2',false);
SELECT dd04_stage.a00_022_ceo_policy_decision(
 '6bc73b49-a396-4c7d-b390-ab6339d547cd'::uuid,
 '99999999-9999-4999-8999-999999999999'::uuid,repeat('b',64),'ACTIVE');

INSERT INTO dd04_stage.commands(tenant_id,command_id,status,input_sha256)
 VALUES ('6bc73b49-a396-4c7d-b390-ab6339d547cd',
 'cmd_22222222222222222222','WAITING_CEO_PLAN',repeat('a',64));
INSERT INTO dd04_stage.a00_workflow_instances
 (tenant_id,workflow_id,command_id,campaign_id,workflow_kind,input_sha256)
 VALUES
 ('6bc73b49-a396-4c7d-b390-ab6339d547cd','ci_w1',
 'cmd_1234567890abcdef1234','same-campaign','CONTENT',repeat('a',64)),
 ('6bc73b49-a396-4c7d-b390-ab6339d547cd','ci_w2',
 'cmd_22222222222222222222','same-campaign','CONTENT',repeat('a',64));
INSERT INTO dd04_stage.tasks(tenant_id,command_id,task_id,owner_agent,status)
 SELECT '6bc73b49-a396-4c7d-b390-ab6339d547cd'::uuid,
 'cmd_1234567890abcdef1234',
 'cmd_1234567890abcdef1234_'||agent,agent,'PLANNED_WAIT_G1'
 FROM unnest(ARRAY['A00','A02','A09','A11']::text[]) AS agent;
INSERT INTO dd04_stage.artifacts(tenant_id,command_id,task_id,kind,sha256,storage_ref)
 SELECT '6bc73b49-a396-4c7d-b390-ab6339d547cd'::uuid,
 'cmd_1234567890abcdef1234',
 'cmd_1234567890abcdef1234_'||agent,'INTERNAL_G1_REVIEW',
 repeat(i::text,64),'ci-private://report/'||agent
 FROM (VALUES ('A00',1),('A02',2),('A09',3),('A11',4)) AS reports(agent,i);
INSERT INTO dd04_stage.a00_worker_identities
 (tenant_id,subject_id,agent_id,credential_sha256,status,allowed_actions,expires_at)
 SELECT '6bc73b49-a396-4c7d-b390-ab6339d547cd'::uuid,uuid,agent,
 encode(sha256(convert_to('dd04w_'||repeat(i::text,64),'UTF8')),'hex'),
 'ACTIVE',ARRAY['READ']::text[],now()+interval '60 minutes'
 FROM (VALUES
 ('A00',1,'11111111-1111-4111-8111-111111111111'::uuid),
 ('A02',2,'22222222-2222-4222-8222-222222222222'::uuid),
 ('A09',3,'33333333-3333-4333-8333-333333333333'::uuid),
 ('A11',4,'44444444-4444-4444-8444-444444444444'::uuid)) AS actors(agent,i,uuid);
