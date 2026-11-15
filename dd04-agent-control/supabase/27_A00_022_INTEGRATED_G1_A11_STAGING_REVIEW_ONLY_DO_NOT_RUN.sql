-- DD04-A00-022 | INTEGRATED MIGRATION CANDIDATE | STAGING ONLY | CEO SHA256 APPROVAL REQUIRED
-- WARNING: This is a schema proposal, NOT a migration authorization.
-- Supabase project wbvkqfnrlasmtizjszab / schema dd04_stage.
-- Current canonical G1 is PENDING and existing guard functions reject changes.
-- The final integration/authority migration MUST be reviewed and approved
-- by CEO with a separate filename and SHA256. Never disable these guards.
BEGIN;
SET LOCAL statement_timeout='25s';
SET LOCAL lock_timeout='5s';

-- Policy proposals may be reviewed before activation; a proposal NEVER grants
-- the ability to commit spend or move a task.
CREATE TABLE dd04_stage.a00_022_delegation_policies (
 tenant_id uuid NOT NULL,
 policy_id uuid NOT NULL DEFAULT gen_random_uuid(),
 version integer NOT NULL CHECK(version>=1),
 policy_sha256 text NOT NULL CHECK(policy_sha256 ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'PROPOSED'
   CHECK(status IN ('PROPOSED','ACTIVE','REVOKED')),
 scope text NOT NULL CHECK(scope='DD04_INTERNAL_CONTENT_ONLY'),
 effective_from timestamptz,
 expires_at timestamptz,
 authorized_ceo_id uuid NOT NULL,
 max_single_spend_vnd bigint NOT NULL CHECK(max_single_spend_vnd>=0),
 max_campaign_spend_vnd bigint NOT NULL CHECK(max_campaign_spend_vnd>=0),
 requires_agents text[] NOT NULL DEFAULT ARRAY['A00','A02','A09','A11']::text[],
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,policy_id),
 UNIQUE(tenant_id,version),
 CHECK(status<>'ACTIVE' OR (effective_from IS NOT NULL AND expires_at>effective_from)),
 CHECK(requires_agents @> ARRAY['A00','A02','A09','A11']::text[])
);
-- Only PROPOSED is insertable. No RLS writer policy activating policy.
CREATE FUNCTION dd04_stage.a00_022_guard_policy()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog,dd04_stage AS $policy$
BEGIN
 IF TG_OP='INSERT' AND NEW.status<>'PROPOSED' THEN
   RAISE EXCEPTION 'CEO_DELEGATION_POLICY_ACTIVATION_NOT_CONFIGURED';
 END IF;
 IF TG_OP='UPDATE' OR TG_OP='DELETE' THEN
   RAISE EXCEPTION 'DELEGATION_POLICY_IMMUTABLE_PENDING_CEO_GATE';
 END IF;
 RETURN NEW;
END $policy$;
CREATE TRIGGER a00_022_policy_guard BEFORE INSERT OR UPDATE OR DELETE
 ON dd04_stage.a00_022_delegation_policies FOR EACH ROW
 EXECUTE FUNCTION dd04_stage.a00_022_guard_policy();

-- Independent QC and finance attestations must originate from DB-authenticated
-- worker; no direct HTTP approval payload is trustworthy.
CREATE TABLE dd04_stage.a00_022_review_events (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,command_id text NOT NULL,
 policy_id uuid NOT NULL,agent_id text NOT NULL
    CHECK(agent_id IN ('A00','A02','A09','A11')),
 actor_subject_id uuid NOT NULL,
 packet_sha256 text NOT NULL CHECK(packet_sha256 ~ '^[a-f0-9]{64}$'),
 review_sha256 text NOT NULL CHECK(review_sha256 ~ '^[a-f0-9]{64}$'),
 verdict text NOT NULL CHECK(verdict IN ('PASS','FAIL','HOLD')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,command_id)
   REFERENCES dd04_stage.commands(tenant_id,command_id),
 FOREIGN KEY (tenant_id,policy_id)
   REFERENCES dd04_stage.a00_022_delegation_policies(tenant_id,policy_id),
 UNIQUE(tenant_id,command_id,policy_id,packet_sha256,agent_id)
);
CREATE TRIGGER a00_022_review_events_immutable
 BEFORE UPDATE OR DELETE ON dd04_stage.a00_022_review_events
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();

-- Ledger amounts are reserved; no DB table transfers funds or pays vendors.
-- A11/CEO approve the budget per active POLICY in a separate gated procedure.
CREATE TABLE dd04_stage.a00_022_finance_reservations (
 reservation_id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,command_id text NOT NULL,
 campaign_id text NOT NULL,policy_id uuid NOT NULL,
 packet_sha256 text NOT NULL CHECK(packet_sha256 ~ '^[a-f0-9]{64}$'),
 amount_vnd bigint NOT NULL CHECK(amount_vnd>=0),
 period_key text NOT NULL CHECK(period_key ~ '^[0-9]{4}-[0-9]{2}$'),
 state text NOT NULL DEFAULT 'PENDING'
  CHECK(state IN ('PENDING','RESERVED','RELEASED','EXCEPTION')),
 reservation_revision integer NOT NULL DEFAULT 1 CHECK(reservation_revision>=1),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,reservation_id),
 FOREIGN KEY(tenant_id,command_id)
  REFERENCES dd04_stage.commands(tenant_id,command_id),
 FOREIGN KEY(tenant_id,policy_id)
  REFERENCES dd04_stage.a00_022_delegation_policies(tenant_id,policy_id),
 UNIQUE(tenant_id,command_id,packet_sha256),
 UNIQUE(tenant_id,period_key,campaign_id,command_id)
);
CREATE INDEX a00_022_reservation_aggregate_idx ON
 dd04_stage.a00_022_finance_reservations(tenant_id,period_key,campaign_id,state);
-- Reservation updates are closed until atomic SERIALIZABLE A11 routine is approved.
CREATE FUNCTION dd04_stage.a00_022_deny_reservation_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog,dd04_stage AS $finance$
BEGIN
 RAISE EXCEPTION 'A11_FINANCE_RESERVATION_PROCEDURE_NOT_CONFIGURED';
END $finance$;
CREATE TRIGGER a00_022_finance_deny_update
 BEFORE UPDATE OR DELETE ON dd04_stage.a00_022_finance_reservations
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.a00_022_deny_reservation_update();

-- Dedicated G1 record: SEPARATE from existing legacy approvals, never forge CEO G1.
-- Approval events are append-only; only PENDING evidence can be proposed.
CREATE TABLE dd04_stage.a00_022_internal_g1_events (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,command_id text NOT NULL,
 policy_id uuid NOT NULL,packet_sha256 text NOT NULL
 CHECK(packet_sha256 ~ '^[a-f0-9]{64}$'),
 review_manifest_sha256 text NOT NULL CHECK(review_manifest_sha256 ~ '^[a-f0-9]{64}$'),
 finance_reservation_id uuid,
 decision text NOT NULL DEFAULT 'PENDING'
 CHECK(decision IN ('PENDING','APPROVED_INTERNAL','DENIED','CEO_FINANCE_HOLD')),
 actor_subject_id uuid NOT NULL,agent_id text NOT NULL CHECK(agent_id='A00'),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 120),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id),
 FOREIGN KEY(tenant_id,policy_id)
  REFERENCES dd04_stage.a00_022_delegation_policies(tenant_id,policy_id),
 FOREIGN KEY(tenant_id,finance_reservation_id)
  REFERENCES dd04_stage.a00_022_finance_reservations(tenant_id,reservation_id),
 UNIQUE(tenant_id,idempotency_key)
);
CREATE FUNCTION dd04_stage.a00_022_guard_internal_g1()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog,dd04_stage AS $guard$
BEGIN
 IF TG_OP='INSERT' AND NEW.decision<>'PENDING' THEN
  RAISE EXCEPTION 'INTERNAL_G1_COMMIT_NOT_CONFIGURED';
 ELSIF TG_OP IN ('UPDATE','DELETE') THEN
  RAISE EXCEPTION 'INTERNAL_G1_IMMUTABLE';
 END IF;
 RETURN NEW;
END $guard$;
CREATE TRIGGER a00_022_internal_g1_guard BEFORE INSERT OR UPDATE OR DELETE
 ON dd04_stage.a00_022_internal_g1_events FOR EACH ROW
 EXECUTE FUNCTION dd04_stage.a00_022_guard_internal_g1();

-- Finances above the CEO-approved delegation envelope go to CEO exception queue.
CREATE TABLE dd04_stage.a00_022_ceo_finance_queue (
 queue_id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,command_id text NOT NULL,
 policy_id uuid NOT NULL,requested_vnd bigint NOT NULL CHECK(requested_vnd>=0),
 reason text NOT NULL CHECK(reason IN ('SINGLE_LIMIT','CAMPAIGN_LIMIT','NO_ACTIVE_POLICY','UNVERIFIED_A11')),
 packet_sha256 text NOT NULL CHECK(packet_sha256 ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'WAITING_CEO'
 CHECK(status='WAITING_CEO'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,queue_id),
 FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id),
 FOREIGN KEY(tenant_id,policy_id)
  REFERENCES dd04_stage.a00_022_delegation_policies(tenant_id,policy_id)
);
CREATE TRIGGER a00_022_ceo_finance_immutable
 BEFORE UPDATE OR DELETE ON dd04_stage.a00_022_ceo_finance_queue
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();

-- RLS is turned on, browser/public/service_role have NO direct rights.
-- There are deliberately NO INSERT/UPDATE policies granting runtime approval.
ALTER TABLE dd04_stage.a00_022_delegation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_022_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_022_finance_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_022_internal_g1_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_022_ceo_finance_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dd04_stage.a00_022_delegation_policies,
 dd04_stage.a00_022_review_events,dd04_stage.a00_022_finance_reservations,
 dd04_stage.a00_022_internal_g1_events,dd04_stage.a00_022_ceo_finance_queue
 FROM PUBLIC,anon,authenticated,service_role,dd04_a00_runtime;

-- No ALTER of existing G1 / G2 / A07 triggers, no state migration or worker creation.

-- === A00-022 integrated authority (all writes are gated, never public) ===
-- Exactly one active CEO budget policy per tenant; changes must first revoke
-- the old policy in a separately audited CEO AAL2 decision.
CREATE UNIQUE INDEX a00_022_one_active_policy_per_tenant
 ON dd04_stage.a00_022_delegation_policies(tenant_id) WHERE status='ACTIVE';
-- Finance exceptions with NO active policy still reach CEO queue.
ALTER TABLE dd04_stage.a00_022_ceo_finance_queue
 ALTER COLUMN policy_id DROP NOT NULL;

-- Stop owner/worker from creating an active policy: only CEO signed-in with
-- MFA AAL2 and an ACTIVE verified enrollment can authorize activation.
CREATE OR REPLACE FUNCTION dd04_stage.a00_022_guard_policy()
 RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog,dd04_stage AS $policy$
BEGIN
 IF TG_OP='INSERT' AND NEW.status<>'PROPOSED' THEN
  RAISE EXCEPTION 'CEO_POLICY_PROPOSAL_ONLY';
 ELSIF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'CEO_POLICY_AUDIT_IMMUTABLE';
 ELSIF TG_OP='UPDATE' THEN
  IF current_user<>'postgres'
     OR current_setting('dd04.ceo_policy_op',true)<>'CEO_VERIFIED'
     OR OLD.status NOT IN ('PROPOSED','ACTIVE')
     OR NEW.status NOT IN ('ACTIVE','REVOKED')
     OR NEW.status=OLD.status
     OR (to_jsonb(NEW)-'status')<>(to_jsonb(OLD)-'status')
  THEN RAISE EXCEPTION 'CEO_POLICY_ACTIVATION_LOCKED'; END IF;
 END IF;
 RETURN NEW;
END $policy$;

CREATE OR REPLACE FUNCTION dd04_stage.a00_022_ceo_policy_decision(
 p_tenant uuid,p_policy uuid,p_expected_hash text,p_decision text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,dd04_stage,pg_temp AS $ceo$
DECLARE ceo uuid;
DECLARE changed integer;
BEGIN
 ceo:=auth.uid();
 IF ceo IS NULL OR auth.jwt()->>'aal'<>'aal2'
  OR p_decision NOT IN ('ACTIVE','REVOKED') THEN
  RAISE EXCEPTION 'CEO_MFA_AAL2_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dd04_stage.ceo_enrollments
  WHERE tenant_id=p_tenant AND user_id=ceo AND role='ceo'
    AND status='ACTIVE' AND verified_by_admin=true)
 THEN RAISE EXCEPTION 'CEO_IDENTITY_UNVERIFIED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dd04_stage.a00_022_delegation_policies
   WHERE tenant_id=p_tenant AND policy_id=p_policy
     AND policy_sha256=p_expected_hash AND authorized_ceo_id=ceo
     AND (status='PROPOSED' OR (status='ACTIVE' AND p_decision='REVOKED'))
     AND (p_decision='REVOKED' OR (effective_from<=now() AND expires_at>now())))
 THEN RAISE EXCEPTION 'CEO_POLICY_VERSION_OR_SCOPE_INVALID'; END IF;
 PERFORM set_config('dd04.ceo_policy_op','CEO_VERIFIED',true);
 UPDATE dd04_stage.a00_022_delegation_policies
  SET status=p_decision
  WHERE tenant_id=p_tenant AND policy_id=p_policy
    AND policy_sha256=p_expected_hash
    AND (status='PROPOSED' OR (status='ACTIVE' AND p_decision='REVOKED'));
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'CEO_POLICY_CAS_CONFLICT'; END IF;
 PERFORM set_config('dd04.ceo_policy_op','',true);
 RETURN 'CEO_POLICY_'||p_decision;
END $ceo$;
REVOKE ALL ON FUNCTION dd04_stage.a00_022_ceo_policy_decision(uuid,uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role,dd04_a00_runtime;
GRANT EXECUTE ON FUNCTION dd04_stage.a00_022_ceo_policy_decision(uuid,uuid,text,text)
 TO authenticated;
GRANT USAGE ON SCHEMA dd04_stage TO authenticated;

-- The definer functions must be callable only after the backend has assumed
-- the dedicated restricted role and supplied a secret bound to the tenant.
CREATE FUNCTION dd04_stage.a00_022_check_worker(p_tenant uuid,p_action text,p_agent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,dd04_stage,pg_temp AS $caller$
BEGIN
 IF current_setting('role',true)<>'dd04_a00_runtime'
  OR session_user<>'dd04_a00_backend'
  OR NOT dd04_stage.a00_authorized(p_tenant,p_action,p_agent)
  OR dd04_stage.a00_current_agent() IS DISTINCT FROM p_agent
  OR dd04_stage.a00_current_subject() IS NULL
 THEN RAISE EXCEPTION 'A00_022_RESTRICTED_WORKER_REQUIRED'; END IF;
END $caller$;

-- Read-only effective delegated G1: does not mutate legacy CEO approvals
-- and never authorizes G2/A07/publication.
CREATE FUNCTION dd04_stage.a00_022_effective_g1(p_tenant uuid,p_command text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,dd04_stage,pg_temp AS $effective$
 SELECT EXISTS(
 SELECT 1 FROM dd04_stage.a00_022_internal_g1_events g
 JOIN dd04_stage.a00_022_delegation_policies p
 ON p.tenant_id=g.tenant_id AND p.policy_id=g.policy_id
 JOIN dd04_stage.a00_022_finance_reservations r
 ON r.tenant_id=g.tenant_id AND r.reservation_id=g.finance_reservation_id
 WHERE g.tenant_id=p_tenant AND g.command_id=p_command
 AND g.decision='APPROVED_INTERNAL' AND p.status='ACTIVE'
 AND p.effective_from<=now() AND p.expires_at>now()
 AND r.state='RESERVED' AND r.packet_sha256=g.packet_sha256
 AND r.command_id=g.command_id AND r.policy_id=g.policy_id
 AND EXISTS(SELECT 1 FROM dd04_stage.approvals a
   WHERE a.tenant_id=g.tenant_id AND a.command_id=g.command_id
   AND a.gate='G1' AND a.decision='PENDING')
 );
$effective$;

-- Evidence may be entered only by an active, tenant-scoped worker whose
-- agent identity matches the review; artifacts must have a registered hash.
CREATE FUNCTION dd04_stage.a00_022_record_review(
 p_tenant uuid,p_command text,p_policy uuid,p_packet text,
 p_review_hash text,p_verdict text,p_expiry timestamptz)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,dd04_stage,pg_temp AS $record$
DECLARE agent text; actor uuid; new_id bigint;
BEGIN
 agent:=dd04_stage.a00_current_agent();
 actor:=dd04_stage.a00_current_subject();
 PERFORM dd04_stage.a00_022_check_worker(p_tenant,'READ',agent);
 IF agent NOT IN ('A00','A02','A09','A11')
  OR p_verdict NOT IN ('PASS','FAIL','HOLD')
  OR p_review_hash !~ '^[a-f0-9]{64}$'
  OR p_expiry<=now() OR p_expiry>now()+interval '24 hours'
  OR NOT EXISTS(SELECT 1 FROM dd04_stage.commands
      WHERE tenant_id=p_tenant AND command_id=p_command
       AND input_sha256=p_packet)
  OR NOT EXISTS(SELECT 1 FROM dd04_stage.a00_022_delegation_policies
      WHERE tenant_id=p_tenant AND policy_id=p_policy AND status='ACTIVE'
       AND effective_from<=now() AND expires_at>now())
  OR NOT EXISTS(SELECT 1 FROM dd04_stage.artifacts a
      WHERE a.tenant_id=p_tenant AND a.command_id=p_command
      AND a.task_id=p_command||'_'||agent AND a.sha256=p_review_hash
      AND a.kind='INTERNAL_G1_REVIEW')
 THEN RAISE EXCEPTION 'A00_022_REVIEW_EVIDENCE_INVALID'; END IF;
 INSERT INTO dd04_stage.a00_022_review_events(
 tenant_id,command_id,policy_id,agent_id,actor_subject_id,
 packet_sha256,review_sha256,verdict,expires_at)
 VALUES(p_tenant,p_command,p_policy,agent,actor,p_packet,p_review_hash,p_verdict,p_expiry)
 RETURNING event_id INTO new_id;
 RETURN new_id;
END $record$;

-- Reservation is the ONLY way to increase campaign commitments.
-- A11 must run within SERIALIZABLE transaction: tenant/campaign/month lock
-- prevents concurrent limit splitting across commands AND policy versions.
CREATE FUNCTION dd04_stage.a00_022_reserve_finance(
 p_tenant uuid,p_command text,p_policy uuid,p_packet text,
 p_campaign text,p_period text,p_amount bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,dd04_stage,pg_temp AS $reserve$
DECLARE policy record; current_sum numeric; rid uuid;
BEGIN
 PERFORM dd04_stage.a00_022_check_worker(p_tenant,'READ','A11');
 IF current_setting('transaction_isolation')<>'serializable'
 THEN RAISE EXCEPTION 'A11_SERIALIZABLE_REQUIRED'; END IF;
 IF p_amount IS NULL OR p_amount<0 OR p_period !~ '^[0-9]{4}-[0-9]{2}$'
  OR p_period<>to_char((now() AT TIME ZONE 'Asia/Bangkok'),'YYYY-MM')
  OR length(p_campaign)<1 OR length(p_campaign)>128
 THEN RAISE EXCEPTION 'A11_REQUEST_INVALID'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
    p_tenant::text||':'||p_campaign,0));
 SELECT * INTO policy FROM dd04_stage.a00_022_delegation_policies
 WHERE tenant_id=p_tenant AND policy_id=p_policy AND status='ACTIVE'
  AND effective_from<=now() AND expires_at>now() FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'A11_ACTIVE_POLICY_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dd04_stage.commands
  WHERE tenant_id=p_tenant AND command_id=p_command AND input_sha256=p_packet)
 THEN RAISE EXCEPTION 'A11_COMMAND_PACKET_MISMATCH'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dd04_stage.a00_workflow_instances
  WHERE tenant_id=p_tenant AND command_id=p_command AND campaign_id=p_campaign)
 THEN RAISE EXCEPTION 'A11_CAMPAIGN_SCOPE_UNVERIFIED'; END IF;
 SELECT COALESCE(SUM(amount_vnd),0) INTO current_sum
 FROM dd04_stage.a00_022_finance_reservations
 WHERE tenant_id=p_tenant
 AND campaign_id=p_campaign AND state='RESERVED';
 IF p_amount>policy.max_single_spend_vnd
  OR current_sum + p_amount>policy.max_campaign_spend_vnd
 THEN RAISE EXCEPTION 'A11_CEO_FINANCE_EXCEPTION_REQUIRED'; END IF;
 INSERT INTO dd04_stage.a00_022_finance_reservations
 (tenant_id,command_id,campaign_id,policy_id,packet_sha256,
  amount_vnd,period_key,state)
 VALUES (p_tenant,p_command,p_campaign,p_policy,p_packet,
  p_amount,p_period,'RESERVED')
 RETURNING reservation_id INTO rid;
 RETURN rid;
END $reserve$;

-- Finance failure can be recorded in a SEPARATE transaction by A11;
-- a failed reservation must never be disguised as an approved commitment.
CREATE FUNCTION dd04_stage.a00_022_queue_finance_exception(
 p_tenant uuid,p_command text,p_policy uuid,p_packet text,
 p_amount bigint,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,dd04_stage,pg_temp AS $queue$
DECLARE id uuid;
BEGIN
 PERFORM dd04_stage.a00_022_check_worker(p_tenant,'READ','A11');
 IF p_amount IS NULL OR p_amount<0 OR
    p_reason NOT IN ('SINGLE_LIMIT','CAMPAIGN_LIMIT','NO_ACTIVE_POLICY','UNVERIFIED_A11')
    OR NOT EXISTS(SELECT 1 FROM dd04_stage.commands
     WHERE tenant_id=p_tenant AND command_id=p_command AND input_sha256=p_packet)
 THEN RAISE EXCEPTION 'FINANCE_EXCEPTION_INVALID'; END IF;
 IF p_policy IS NULL AND p_reason<>'NO_ACTIVE_POLICY'
 THEN RAISE EXCEPTION 'FINANCE_POLICY_ID_REQUIRED'; END IF;
 INSERT INTO dd04_stage.a00_022_ceo_finance_queue
 (tenant_id,command_id,policy_id,requested_vnd,reason,packet_sha256)
 VALUES(p_tenant,p_command,p_policy,p_amount,p_reason,p_packet)
 RETURNING queue_id INTO id;
 RETURN id;
END $queue$;

-- Only complete four-agent independent evidence + reserved finance amount
-- can create the immutable internal G1 authorization. No legacy G1/G2 writes.
CREATE OR REPLACE FUNCTION dd04_stage.a00_022_guard_internal_g1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,dd04_stage AS $guard$
BEGIN
 IF TG_OP='INSERT' AND
    (current_user<>'postgres'
     OR current_setting('dd04.internal_g1_commit',true)<>'WORKER_VERIFIED'
     OR NEW.decision<>'APPROVED_INTERNAL') THEN
  RAISE EXCEPTION 'INTERNAL_G1_COMMIT_DENIED';
 ELSIF TG_OP IN ('UPDATE','DELETE') THEN
  RAISE EXCEPTION 'INTERNAL_G1_IMMUTABLE';
 END IF;
 RETURN NEW;
END $guard$;

CREATE FUNCTION dd04_stage.a00_022_commit_g1(
 p_tenant uuid,p_command text,p_policy uuid,p_packet text,
 p_reservation uuid,p_manifest text,p_key text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,dd04_stage,pg_temp AS $commit$
DECLARE review_count integer; reviewer_count integer; new_event bigint;
DECLARE stored_hash text;
BEGIN
 PERFORM dd04_stage.a00_022_check_worker(p_tenant,'READ','A00');
 IF current_setting('transaction_isolation')<>'serializable'
 THEN RAISE EXCEPTION 'G1_SERIALIZABLE_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_command,0));
 IF p_manifest !~ '^[a-f0-9]{64}$' OR length(p_key) NOT BETWEEN 8 AND 120
  OR NOT EXISTS(SELECT 1 FROM dd04_stage.commands
    WHERE tenant_id=p_tenant AND command_id=p_command AND input_sha256=p_packet)
  OR NOT EXISTS(SELECT 1 FROM dd04_stage.approvals
    WHERE tenant_id=p_tenant AND command_id=p_command
     AND gate='G1' AND decision='PENDING')
  OR EXISTS(SELECT 1 FROM dd04_stage.a00_022_internal_g1_events
    WHERE tenant_id=p_tenant AND command_id=p_command AND decision='APPROVED_INTERNAL')
  OR NOT EXISTS(SELECT 1 FROM dd04_stage.a00_022_delegation_policies p
   WHERE p.tenant_id=p_tenant AND p.policy_id=p_policy
     AND p.status='ACTIVE' AND p.effective_from<=now() AND p.expires_at>now())
  OR NOT EXISTS(SELECT 1 FROM dd04_stage.a00_022_finance_reservations r
     JOIN dd04_stage.a00_022_delegation_policies p
       ON p.tenant_id=r.tenant_id AND p.policy_id=r.policy_id
     WHERE r.tenant_id=p_tenant AND r.command_id=p_command
       AND r.policy_id=p_policy AND r.reservation_id=p_reservation
       AND r.packet_sha256=p_packet AND r.state='RESERVED'
       AND p.status='ACTIVE' AND p.effective_from<=now() AND p.expires_at>now())
 THEN RAISE EXCEPTION 'G1_FINANCE_OR_AUTHORITY_MISSING'; END IF;
 SELECT count(*),count(DISTINCT actor_subject_id)
 INTO review_count,reviewer_count
 FROM dd04_stage.a00_022_review_events
 WHERE tenant_id=p_tenant AND command_id=p_command
   AND policy_id=p_policy AND packet_sha256=p_packet
   AND verdict='PASS' AND expires_at>now()
   AND agent_id IN ('A00','A02','A09','A11');
 SELECT encode(sha256(convert_to(string_agg(
  agent_id||':'||actor_subject_id::text||':'||review_sha256,'|' ORDER BY agent_id),
  'UTF8')),'hex')
 INTO stored_hash
 FROM dd04_stage.a00_022_review_events
 WHERE tenant_id=p_tenant AND command_id=p_command AND policy_id=p_policy
   AND packet_sha256=p_packet AND verdict='PASS' AND expires_at>now();
 IF stored_hash IS DISTINCT FROM p_manifest
 THEN RAISE EXCEPTION 'G1_MANIFEST_HASH_MISMATCH'; END IF;
 IF review_count<>4 OR reviewer_count<>4
  OR (SELECT count(DISTINCT agent_id) FROM dd04_stage.a00_022_review_events
     WHERE tenant_id=p_tenant AND command_id=p_command AND policy_id=p_policy
       AND packet_sha256=p_packet AND verdict='PASS' AND expires_at>now())<>4
 THEN RAISE EXCEPTION 'G1_FOUR_INDEPENDENT_REVIEWS_REQUIRED'; END IF;
 PERFORM set_config('dd04.internal_g1_commit','WORKER_VERIFIED',true);
 INSERT INTO dd04_stage.a00_022_internal_g1_events(
 tenant_id,command_id,policy_id,packet_sha256,review_manifest_sha256,
 finance_reservation_id,decision,actor_subject_id,agent_id,idempotency_key)
 VALUES(p_tenant,p_command,p_policy,p_packet,p_manifest,p_reservation,
  'APPROVED_INTERNAL',dd04_stage.a00_current_subject(),'A00',p_key)
 RETURNING event_id INTO new_event;
 PERFORM set_config('dd04.internal_g1_commit','',true);
 RETURN new_event;
END $commit$;

-- Narrow grants: only worker role can call the bounded definer functions.
-- ALL direct writes to private tables remain denied by RLS/REVOKE.
REVOKE ALL ON FUNCTION dd04_stage.a00_022_check_worker(uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION dd04_stage.a00_022_effective_g1(uuid,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION dd04_stage.a00_022_record_review(uuid,text,uuid,text,text,text,timestamptz)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION dd04_stage.a00_022_reserve_finance(uuid,text,uuid,text,text,text,bigint)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION dd04_stage.a00_022_queue_finance_exception(uuid,text,uuid,text,bigint,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION dd04_stage.a00_022_commit_g1(uuid,text,uuid,text,uuid,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION dd04_stage.a00_022_check_worker(uuid,text,text),
 dd04_stage.a00_022_effective_g1(uuid,text),
 dd04_stage.a00_022_record_review(uuid,text,uuid,text,text,text,timestamptz),
 dd04_stage.a00_022_reserve_finance(uuid,text,uuid,text,text,text,bigint),
 dd04_stage.a00_022_commit_g1(uuid,text,uuid,text,uuid,text,text),
 dd04_stage.a00_022_queue_finance_exception(uuid,text,uuid,text,bigint,text)
 TO dd04_a00_runtime;

-- Existing canonical G1/command/task triggers are RETAINED. Only the A00
-- context guard is revised to respect a separately audited internal G1;
-- legacy task status remains PLANNED_WAIT_G1 (visible in CEO dashboard).
CREATE OR REPLACE FUNCTION dd04_stage.a00_guard_context_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,dd04_stage AS $guard_context$
DECLARE expected_action text;
DECLARE legacy_status text;
DECLARE owner text;
BEGIN
  IF TG_OP<>'UPDATE' THEN RETURN NEW; END IF;
  IF (NEW.tenant_id,NEW.command_id,NEW.task_id,NEW.workflow_id,NEW.campaign_id,
      NEW.channel_id,NEW.profile_version,NEW.profile_sha256,NEW.dependency_task_ids) IS DISTINCT FROM
     (OLD.tenant_id,OLD.command_id,OLD.task_id,OLD.workflow_id,OLD.campaign_id,
      OLD.channel_id,OLD.profile_version,OLD.profile_sha256,OLD.dependency_task_ids)
    OR NEW.revision<>OLD.revision+1
  THEN RAISE EXCEPTION 'A00_CONTEXT_IDENTITY_REVISION_IMMUTABLE'; END IF;
  expected_action:=CASE
    WHEN OLD.state='READY' AND NEW.state='IN_PROGRESS' THEN 'START'
    WHEN OLD.state='IN_PROGRESS' AND NEW.state='IN_PROGRESS' THEN 'ATTACH'
    WHEN OLD.state='IN_PROGRESS' AND NEW.state='INTERNAL_REVIEW' THEN 'SUBMIT'
    WHEN OLD.state='INTERNAL_REVIEW' AND NEW.state='APPROVED_INTERNAL' THEN 'REVIEW_PASS'
    WHEN OLD.state='INTERNAL_REVIEW' AND NEW.state='NEEDS_FIX' THEN 'REVIEW_FAIL'
    WHEN OLD.state='NEEDS_FIX' AND NEW.state='IN_PROGRESS' THEN 'REWORK'
    WHEN OLD.state='BLOCKED' AND NEW.state='READY' THEN 'AUTO_READY'
    ELSE NULL END;
  IF expected_action IS NULL OR
    NOT dd04_stage.a00_authorized(NEW.tenant_id,expected_action,dd04_stage.a00_current_agent())
  THEN RAISE EXCEPTION 'A00_CONTEXT_TRANSITION_DENIED'; END IF;
  SELECT status,owner_agent INTO legacy_status,owner FROM dd04_stage.tasks
   WHERE tenant_id=NEW.tenant_id AND command_id=NEW.command_id AND task_id=NEW.task_id;
  IF legacy_status NOT IN ('PLANNED_WAIT_G1','READY','IN_PROGRESS','REVIEW','DONE')
    OR NOT dd04_stage.a00_022_effective_g1(NEW.tenant_id,NEW.command_id)
  THEN RAISE EXCEPTION 'A00_CANONICAL_G1_LOCKED'; END IF;
  IF expected_action IN ('START','ATTACH','SUBMIT','REWORK') AND owner<>dd04_stage.a00_current_agent()
  THEN RAISE EXCEPTION 'A00_OWNER_REQUIRED'; END IF;
  IF expected_action IN ('REVIEW_PASS','REVIEW_FAIL') AND owner=dd04_stage.a00_current_agent()
  THEN RAISE EXCEPTION 'A00_SELF_APPROVAL_DENIED'; END IF;
  IF expected_action<>'ATTACH' AND NEW.output_refs IS DISTINCT FROM OLD.output_refs
  THEN RAISE EXCEPTION 'A00_OUTPUT_REFS_IMMUTABLE'; END IF;
  IF expected_action='ATTACH' AND (
       NEW.output_sha256 IS NULL OR jsonb_array_length(NEW.output_refs)=0
       OR NOT EXISTS(SELECT 1 FROM dd04_stage.artifacts a
          WHERE a.tenant_id=NEW.tenant_id AND a.command_id=NEW.command_id
          AND a.task_id=NEW.task_id AND a.sha256=NEW.output_sha256)
  ) THEN RAISE EXCEPTION 'A00_OUTPUT_ATTACH_NOT_REGISTERED'; END IF;
  IF expected_action IN ('START','REVIEW_PASS','REVIEW_FAIL','AUTO_READY')
     AND NEW.output_sha256 IS DISTINCT FROM OLD.output_sha256
  THEN RAISE EXCEPTION 'A00_OUTPUT_HASH_IMMUTABLE'; END IF;
  IF expected_action='REWORK' AND NEW.output_sha256 IS NOT NULL
  THEN RAISE EXCEPTION 'A00_REWORK_MUST_CLEAR_OUTPUT'; END IF;
  IF expected_action IN ('REVIEW_PASS','REVIEW_FAIL') THEN
    IF NEW.last_reviewer_agent IS DISTINCT FROM dd04_stage.a00_current_agent()
    THEN RAISE EXCEPTION 'A00_REVIEWER_ID_MISMATCH'; END IF;
  ELSIF NEW.last_reviewer_agent IS DISTINCT FROM OLD.last_reviewer_agent
  THEN RAISE EXCEPTION 'A00_REVIEWER_FIELD_IMMUTABLE'; END IF;
  IF NOT EXISTS(SELECT 1 FROM dd04_stage.a00_transition_events e
    WHERE e.tenant_id=NEW.tenant_id AND e.command_id=NEW.command_id
      AND e.task_id=NEW.task_id AND e.from_state=OLD.state
      AND e.to_state=NEW.state AND e.expected_revision=OLD.revision
      AND e.action=expected_action AND e.agent_id=dd04_stage.a00_current_agent()
      AND (expected_action NOT IN ('ATTACH','SUBMIT') OR e.evidence_sha256=NEW.output_sha256)
      AND (expected_action NOT IN ('REVIEW_PASS','REVIEW_FAIL') OR e.evidence_sha256=OLD.output_sha256))
  THEN RAISE EXCEPTION 'A00_ATOMIC_AUDIT_REQUIRED'; END IF;
  IF expected_action='AUTO_READY' AND EXISTS(
    SELECT 1 FROM unnest(NEW.dependency_task_ids) AS dependency(id)
    LEFT JOIN dd04_stage.a00_task_contexts dep ON dep.tenant_id=NEW.tenant_id
      AND dep.command_id=NEW.command_id AND dep.task_id=dependency.id
    WHERE dep.state IS DISTINCT FROM 'APPROVED_INTERNAL'
  ) THEN RAISE EXCEPTION 'A00_DEPENDENCIES_NOT_APPROVED'; END IF;
  RETURN NEW;
END;
$guard_context$;


CREATE OR REPLACE FUNCTION dd04_stage.a00_guard_transition_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,dd04_stage AS $guard_event$
DECLARE owner text;
BEGIN
  IF NEW.actor_user_id IS DISTINCT FROM dd04_stage.a00_current_subject() THEN
    RAISE EXCEPTION 'A00_SUBJECT_SPOOF';
  END IF;
  IF NEW.agent_id IS DISTINCT FROM dd04_stage.a00_current_agent() THEN
    RAISE EXCEPTION 'A00_AGENT_EVENT_SPOOF';
  END IF;
  SELECT t.owner_agent INTO owner FROM dd04_stage.tasks t
   WHERE t.tenant_id=NEW.tenant_id AND t.command_id=NEW.command_id AND t.task_id=NEW.task_id;
  IF owner IS NULL THEN RAISE EXCEPTION 'A00_TASK_NOT_FOUND'; END IF;
  IF NEW.action IN ('START','ATTACH','SUBMIT','REWORK') AND owner<>NEW.agent_id THEN
    RAISE EXCEPTION 'A00_OWNER_REQUIRED';
  END IF;
  IF NEW.action IN ('QC_PASS','REVIEW_PASS','REVIEW_FAIL') AND owner=NEW.agent_id THEN
    RAISE EXCEPTION 'A00_SELF_APPROVAL_DENIED';
  END IF;
  IF NEW.action IN ('ATTACH','SUBMIT') AND NOT EXISTS (
    SELECT 1 FROM dd04_stage.artifacts a WHERE a.tenant_id=NEW.tenant_id
      AND a.command_id=NEW.command_id AND a.task_id=NEW.task_id
      AND a.sha256=NEW.evidence_sha256
  ) THEN RAISE EXCEPTION 'A00_OUTPUT_NOT_REGISTERED'; END IF;
  IF NEW.action='QC_PASS' THEN
    IF NEW.agent_id NOT IN ('A08','A09')
      OR NEW.from_state<>'INTERNAL_REVIEW' OR NEW.to_state<>'INTERNAL_REVIEW'
      OR NEW.report_sha256 IS NULL
      OR NEW.report_sha256=NEW.evidence_sha256
      OR NOT EXISTS (SELECT 1 FROM dd04_stage.artifacts a
         WHERE a.tenant_id=NEW.tenant_id AND a.command_id=NEW.command_id
           AND a.task_id=NEW.task_id
           AND a.kind='QC_REPORT_'||NEW.agent_id
           AND a.sha256=NEW.report_sha256)
    THEN RAISE EXCEPTION 'A00_QC_REPORT_NOT_VERIFIED'; END IF;
  END IF;
  IF NEW.action IN ('REVIEW_PASS','REVIEW_FAIL') AND (
    NEW.report_sha256 IS NULL OR NEW.report_sha256=NEW.evidence_sha256
    OR NOT EXISTS(SELECT 1 FROM dd04_stage.artifacts a
      WHERE a.tenant_id=NEW.tenant_id AND a.command_id=NEW.command_id
      AND a.task_id=NEW.task_id AND a.sha256=NEW.report_sha256
      AND a.kind='REVIEW_REPORT_'||NEW.agent_id)
  ) THEN RAISE EXCEPTION 'A00_REVIEW_REPORT_NOT_REGISTERED'; END IF;
  IF NEW.action='REVIEW_PASS' AND owner='A05' AND (
    NOT EXISTS (SELECT 1 FROM dd04_stage.a00_transition_events e
       WHERE e.tenant_id=NEW.tenant_id AND e.command_id=NEW.command_id
       AND e.task_id=NEW.task_id AND e.action='QC_PASS'
       AND e.agent_id='A08' AND e.evidence_sha256=NEW.evidence_sha256)
    OR NOT EXISTS (SELECT 1 FROM dd04_stage.a00_transition_events e
       WHERE e.tenant_id=NEW.tenant_id AND e.command_id=NEW.command_id
       AND e.task_id=NEW.task_id AND e.action='QC_PASS'
       AND e.agent_id='A09' AND e.evidence_sha256=NEW.evidence_sha256)
  ) THEN RAISE EXCEPTION 'A00_DUAL_QC_MISSING'; END IF;
  IF NEW.action='REVIEW_PASS' AND owner IN ('A03','A04')
     AND NEW.agent_id<>'A00' THEN
     RAISE EXCEPTION 'A00_STAGE_REVIEW_REQUIRED';
  END IF;
  RETURN NEW;
END;
$guard_event$;


CREATE OR REPLACE FUNCTION dd04_stage.a00_guard_handoff_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,dd04_stage AS $handoff$
BEGIN
  IF NEW.verdict<>'PENDING'
    OR NEW.from_agent IS DISTINCT FROM dd04_stage.a00_current_agent()
    OR NEW.to_agent IS DISTINCT FROM
       (CASE NEW.from_agent WHEN 'A00' THEN 'A03'
        WHEN 'A03' THEN 'A04' WHEN 'A04' THEN 'A05'
        WHEN 'A05' THEN 'A08' WHEN 'A08' THEN 'A09'
        ELSE NULL END)
    OR NOT EXISTS(SELECT 1 FROM dd04_stage.a00_transition_events e
      WHERE e.tenant_id=NEW.tenant_id AND e.command_id=NEW.command_id
        AND e.task_id=NEW.task_id AND e.action='SUBMIT'
        AND e.agent_id=NEW.from_agent AND e.evidence_sha256=NEW.input_sha256)
  THEN RAISE EXCEPTION 'A00_HANDOFF_UNVERIFIED'; END IF;
  RETURN NEW;
END;
$handoff$;


-- Fix the old RLS ATTACH WITH CHECK omission and root READY creation.
DROP POLICY a00_rt_context_insert ON dd04_stage.a00_task_contexts;
CREATE POLICY a00_rt_context_insert ON dd04_stage.a00_task_contexts
 FOR INSERT TO dd04_a00_runtime
 WITH CHECK(dd04_stage.a00_authorized(tenant_id,'SAVE_PLAN','A00')
 AND (state='BLOCKED' OR (state='READY'
    AND cardinality(dependency_task_ids)=0
    AND dd04_stage.a00_022_effective_g1(tenant_id,command_id))));
DROP POLICY a00_rt_context_update ON dd04_stage.a00_task_contexts;
CREATE POLICY a00_rt_context_update ON dd04_stage.a00_task_contexts
 FOR UPDATE TO dd04_a00_runtime
 USING(dd04_stage.a00_authorized(tenant_id,'START') OR
   dd04_stage.a00_authorized(tenant_id,'ATTACH') OR
   dd04_stage.a00_authorized(tenant_id,'SUBMIT') OR
   dd04_stage.a00_authorized(tenant_id,'REVIEW_PASS') OR
   dd04_stage.a00_authorized(tenant_id,'REVIEW_FAIL') OR
   dd04_stage.a00_authorized(tenant_id,'REWORK') OR
   dd04_stage.a00_authorized(tenant_id,'AUTO_READY'))
 WITH CHECK(dd04_stage.a00_authorized(tenant_id,'START') OR
   dd04_stage.a00_authorized(tenant_id,'ATTACH') OR
   dd04_stage.a00_authorized(tenant_id,'SUBMIT') OR
   dd04_stage.a00_authorized(tenant_id,'REVIEW_PASS') OR
   dd04_stage.a00_authorized(tenant_id,'REVIEW_FAIL') OR
   dd04_stage.a00_authorized(tenant_id,'REWORK') OR
   dd04_stage.a00_authorized(tenant_id,'AUTO_READY'));

-- Explicit safety invariant: no A07 publish, provider spend, production
-- credentials, CEO G2 or old approval decision touched here.
COMMIT;
