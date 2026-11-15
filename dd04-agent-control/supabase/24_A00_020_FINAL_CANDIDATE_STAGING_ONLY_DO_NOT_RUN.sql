-- DD04 A00-020 | FINAL CANDIDATE V1 | STAGING ONLY | DO NOT EXECUTE UNTIL CEO APPROVES EXACT SHA256.
-- Project wbvkqfnrlasmtizjszab, schema dd04_stage. No production, G1/G2 overrides, finance or A07 grants.
-- Prerequisites: PostgreSQL 17, pg_catalog.sha256(bytea), existing 14 dd04_stage tables and guards.
-- Runtime role is NOLOGIN and has NO password; separate credentials and worker enrollment are not part of this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $role$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='dd04_a00_runtime') THEN
    CREATE ROLE dd04_a00_runtime NOLOGIN NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='dd04_a00_runtime'
    AND (rolcanlogin OR rolbypassrls OR rolsuper)) THEN
    RAISE EXCEPTION 'DD04_RUNTIME_ROLE_UNSAFE';
  END IF;
END;
$role$;

CREATE TABLE dd04_stage.a00_worker_identities (
  tenant_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  agent_id text NOT NULL CHECK(agent_id ~ '^A(0[0-9]|1[0-7])$'),
  credential_sha256 text NOT NULL UNIQUE CHECK(credential_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'REVOKED' CHECK(status IN ('ACTIVE','REVOKED')),
  allowed_actions text[] NOT NULL DEFAULT '{}'::text[],
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,subject_id,agent_id),
  CHECK(allowed_actions <@ ARRAY['READ','SAVE_PLAN','START','ATTACH','SUBMIT','QC_PASS','REVIEW_PASS','REVIEW_FAIL','REWORK','AUTO_READY']::text[])
);

CREATE TABLE dd04_stage.a00_workflow_instances (
  tenant_id uuid NOT NULL, workflow_id text NOT NULL, command_id text NOT NULL,
  campaign_id text NOT NULL, workflow_kind text NOT NULL
    CHECK(workflow_kind IN ('CONTENT','TREND','SALES','COMMUNITY','FINANCE')),
  input_sha256 text NOT NULL CHECK(input_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'DRAFT_LOCKED'
    CHECK(state IN ('DRAFT_LOCKED','READY_INTERNAL','HOLD','CLOSED')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,workflow_id),
  FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id),
  UNIQUE(tenant_id,workflow_id,command_id)
);

CREATE TABLE dd04_stage.a00_task_contexts (
  tenant_id uuid NOT NULL, command_id text NOT NULL, task_id text NOT NULL,
  workflow_id text NOT NULL, campaign_id text NOT NULL,
  channel_id text, profile_version integer, profile_sha256 text,
  dependency_task_ids text[] NOT NULL DEFAULT '{}'::text[],
  state text NOT NULL DEFAULT 'BLOCKED'
    CHECK(state IN ('BLOCKED','READY','IN_PROGRESS','INTERNAL_REVIEW','NEEDS_FIX','APPROVED_INTERNAL','HOLD')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
  output_sha256 text CHECK(output_sha256 ~ '^[a-f0-9]{64}$'),
  output_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(output_refs)='array'),
  last_reviewer_agent text CHECK(last_reviewer_agent ~ '^A(0[0-9]|1[0-7])$'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,command_id,task_id),
  FOREIGN KEY(tenant_id,command_id,task_id)
    REFERENCES dd04_stage.tasks(tenant_id,command_id,task_id),
  FOREIGN KEY(tenant_id,workflow_id,command_id)
    REFERENCES dd04_stage.a00_workflow_instances(tenant_id,workflow_id,command_id),
  CHECK((channel_id IS NULL AND profile_version IS NULL AND profile_sha256 IS NULL)
    OR(channel_id IS NOT NULL AND profile_version>=1 AND profile_sha256 ~ '^[a-f0-9]{64}$'))
);

CREATE TABLE dd04_stage.a00_transition_events (
  tenant_id uuid NOT NULL,
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  command_id text NOT NULL, task_id text NOT NULL,
  actor_user_id uuid NOT NULL,
  agent_id text NOT NULL CHECK(agent_id ~ '^A(0[0-9]|1[0-7])$'),
  action text NOT NULL CHECK(action IN ('START','ATTACH','SUBMIT','QC_PASS','REVIEW_PASS','REVIEW_FAIL','REWORK','AUTO_READY')),
  from_state text NOT NULL, to_state text NOT NULL,
  evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
  report_sha256 text CHECK(report_sha256 ~ '^[a-f0-9]{64}$'),
  request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
  expected_revision integer NOT NULL CHECK(expected_revision>=1),
  idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tenant_id,command_id,task_id)
    REFERENCES dd04_stage.a00_task_contexts(tenant_id,command_id,task_id),
  UNIQUE(tenant_id,idempotency_key)
);

CREATE INDEX a00_task_context_state_idx
  ON dd04_stage.a00_task_contexts(tenant_id,state,updated_at DESC);
CREATE INDEX a00_transition_task_idx
  ON dd04_stage.a00_transition_events(tenant_id,command_id,task_id,created_at DESC);
CREATE TRIGGER a00_transition_events_immutable
  BEFORE UPDATE OR DELETE ON dd04_stage.a00_transition_events
  FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();

-- Authentication helper: never accept tenant/agent from an untrusted JWT or HTTP body.
-- Worker secret must be a 256-bit random secret stored ONLY server-side.
-- SECURITY DEFINER is restricted to a fixed SELECT, fixed search_path, narrow EXECUTE grant.
CREATE FUNCTION dd04_stage.a00_authorized(p_tenant uuid,p_action text,p_agent text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,dd04_stage AS $auth$
  SELECT EXISTS(
    SELECT 1 FROM dd04_stage.a00_worker_identities w
    WHERE w.tenant_id=p_tenant AND w.status='ACTIVE'
      AND w.expires_at > now()
      AND w.credential_sha256 =
        encode(pg_catalog.sha256(pg_catalog.convert_to(
          coalesce(pg_catalog.current_setting('dd04.worker_credential',true),''),
          'UTF8')), 'hex')
      AND p_action=ANY(w.allowed_actions)
      AND (p_agent IS NULL OR w.agent_id=p_agent)
  );
$auth$;

CREATE FUNCTION dd04_stage.a00_current_agent()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,dd04_stage AS $actor$
  SELECT w.agent_id FROM dd04_stage.a00_worker_identities w
  WHERE w.status='ACTIVE' AND w.expires_at>now()
    AND w.credential_sha256 =
      encode(pg_catalog.sha256(pg_catalog.convert_to(
        coalesce(pg_catalog.current_setting('dd04.worker_credential',true),''),
        'UTF8')), 'hex')
  LIMIT 1;
$actor$;

REVOKE ALL ON FUNCTION dd04_stage.a00_authorized(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION dd04_stage.a00_current_agent() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION dd04_stage.a00_authorized(uuid,text,text) TO dd04_a00_runtime;
GRANT EXECUTE ON FUNCTION dd04_stage.a00_current_agent() TO dd04_a00_runtime;

ALTER TABLE dd04_stage.a00_worker_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_task_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_transition_events ENABLE ROW LEVEL SECURITY;

-- Both PostgreSQL GRANT and RLS are required; PUBLIC and browser roles remain denied.
REVOKE ALL ON dd04_stage.a00_worker_identities,dd04_stage.a00_workflow_instances,
  dd04_stage.a00_task_contexts,dd04_stage.a00_transition_events
  FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA dd04_stage TO dd04_a00_runtime;
GRANT SELECT ON dd04_stage.commands,dd04_stage.tasks,dd04_stage.task_events,
  dd04_stage.approvals,dd04_stage.artifacts,dd04_stage.v55_agent_handoff_events
  TO dd04_a00_runtime;
GRANT INSERT ON dd04_stage.tasks,dd04_stage.task_events,
  dd04_stage.v55_agent_handoff_events TO dd04_a00_runtime;
GRANT SELECT,INSERT ON dd04_stage.a00_workflow_instances TO dd04_a00_runtime;
GRANT SELECT,INSERT,UPDATE ON dd04_stage.a00_task_contexts TO dd04_a00_runtime;
GRANT SELECT,INSERT ON dd04_stage.a00_transition_events TO dd04_a00_runtime;
GRANT USAGE ON SEQUENCE dd04_stage.a00_transition_events_event_id_seq TO dd04_a00_runtime;
GRANT USAGE ON SEQUENCE dd04_stage.task_events_event_id_seq TO dd04_a00_runtime;

-- Existing tables are RLS-enabled but no-policy; add only tenant/credential-scoped policies.
CREATE POLICY a00_rt_commands_select ON dd04_stage.commands FOR SELECT TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'READ'));
CREATE POLICY a00_rt_tasks_select ON dd04_stage.tasks FOR SELECT TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'READ'));
CREATE POLICY a00_rt_tasks_insert ON dd04_stage.tasks FOR INSERT TO dd04_a00_runtime
  WITH CHECK(dd04_stage.a00_authorized(tenant_id,'SAVE_PLAN','A00') AND status='PLANNED_WAIT_G1');
CREATE POLICY a00_rt_task_events_select ON dd04_stage.task_events FOR SELECT TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'READ'));
CREATE POLICY a00_rt_task_events_insert ON dd04_stage.task_events FOR INSERT TO dd04_a00_runtime
  WITH CHECK(dd04_stage.a00_authorized(tenant_id,'SAVE_PLAN','A00')
    AND event_name='TASK_PLAN_SAVED' AND actor_ref='A00');
CREATE POLICY a00_rt_approvals_select ON dd04_stage.approvals FOR SELECT TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'READ'));
CREATE POLICY a00_rt_artifacts_select ON dd04_stage.artifacts FOR SELECT TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'READ'));
CREATE POLICY a00_rt_v55_select ON dd04_stage.v55_agent_handoff_events FOR SELECT TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'READ'));
CREATE POLICY a00_rt_v55_insert ON dd04_stage.v55_agent_handoff_events FOR INSERT TO dd04_a00_runtime
  WITH CHECK(dd04_stage.a00_authorized(tenant_id,'SUBMIT',from_agent) AND verdict='PENDING');

CREATE POLICY a00_rt_workflow_select ON dd04_stage.a00_workflow_instances FOR SELECT TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'READ'));
CREATE POLICY a00_rt_workflow_insert ON dd04_stage.a00_workflow_instances FOR INSERT TO dd04_a00_runtime
  WITH CHECK(dd04_stage.a00_authorized(tenant_id,'SAVE_PLAN','A00') AND state='DRAFT_LOCKED');
CREATE POLICY a00_rt_context_select ON dd04_stage.a00_task_contexts FOR SELECT TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'READ'));
CREATE POLICY a00_rt_context_insert ON dd04_stage.a00_task_contexts FOR INSERT TO dd04_a00_runtime
  WITH CHECK(dd04_stage.a00_authorized(tenant_id,'SAVE_PLAN','A00') AND state='BLOCKED');
CREATE POLICY a00_rt_context_update ON dd04_stage.a00_task_contexts FOR UPDATE TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'START') OR dd04_stage.a00_authorized(tenant_id,'ATTACH') OR dd04_stage.a00_authorized(tenant_id,'SUBMIT')
    OR dd04_stage.a00_authorized(tenant_id,'REVIEW_PASS')
    OR dd04_stage.a00_authorized(tenant_id,'REVIEW_FAIL')
    OR dd04_stage.a00_authorized(tenant_id,'REWORK'))
  WITH CHECK(dd04_stage.a00_authorized(tenant_id,'START') OR dd04_stage.a00_authorized(tenant_id,'SUBMIT')
    OR dd04_stage.a00_authorized(tenant_id,'REVIEW_PASS')
    OR dd04_stage.a00_authorized(tenant_id,'REVIEW_FAIL')
    OR dd04_stage.a00_authorized(tenant_id,'REWORK'));
CREATE POLICY a00_rt_transition_select ON dd04_stage.a00_transition_events FOR SELECT TO dd04_a00_runtime
  USING(dd04_stage.a00_authorized(tenant_id,'READ'));
CREATE POLICY a00_rt_transition_insert ON dd04_stage.a00_transition_events FOR INSERT TO dd04_a00_runtime
  WITH CHECK(dd04_stage.a00_authorized(tenant_id,action,agent_id)
    AND agent_id=dd04_stage.a00_current_agent());

-- Defense in depth: the runtime login cannot directly forge approval or state.
-- These guard triggers run as the restricted invoker, not SECURITY DEFINER.
CREATE FUNCTION dd04_stage.a00_guard_transition_event()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,dd04_stage AS $guard_event$
DECLARE owner text;
BEGIN
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
  IF NEW.action='REVIEW_PASS' AND (
    NOT EXISTS (SELECT 1 FROM dd04_stage.a00_transition_events e
       WHERE e.tenant_id=NEW.tenant_id AND e.command_id=NEW.command_id
       AND e.task_id=NEW.task_id AND e.action='QC_PASS'
       AND e.agent_id='A08' AND e.evidence_sha256=NEW.evidence_sha256)
    OR NOT EXISTS (SELECT 1 FROM dd04_stage.a00_transition_events e
       WHERE e.tenant_id=NEW.tenant_id AND e.command_id=NEW.command_id
       AND e.task_id=NEW.task_id AND e.action='QC_PASS'
       AND e.agent_id='A09' AND e.evidence_sha256=NEW.evidence_sha256)
  ) THEN RAISE EXCEPTION 'A00_DUAL_QC_MISSING'; END IF;
  RETURN NEW;
END;
$guard_event$;

CREATE FUNCTION dd04_stage.a00_guard_context_transition()
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
  IF legacy_status NOT IN ('READY','IN_PROGRESS','REVIEW','DONE')
    OR NOT EXISTS(SELECT 1 FROM dd04_stage.approvals
      WHERE tenant_id=NEW.tenant_id AND command_id=NEW.command_id
        AND gate='G1' AND decision='APPROVED')
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
  IF NOT EXISTS(SELECT 1 FROM dd04_stage.a00_transition_events e
    WHERE e.tenant_id=NEW.tenant_id AND e.command_id=NEW.command_id
      AND e.task_id=NEW.task_id AND e.from_state=OLD.state
      AND e.to_state=NEW.state AND e.expected_revision=OLD.revision
      AND e.action=expected_action AND e.agent_id=dd04_stage.a00_current_agent())
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

REVOKE ALL ON FUNCTION dd04_stage.a00_guard_transition_event() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION dd04_stage.a00_guard_context_transition() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER a00_transition_event_guard
  BEFORE INSERT ON dd04_stage.a00_transition_events
  FOR EACH ROW EXECUTE FUNCTION dd04_stage.a00_guard_transition_event();
CREATE TRIGGER a00_context_transition_guard
  BEFORE UPDATE ON dd04_stage.a00_task_contexts
  FOR EACH ROW EXECUTE FUNCTION dd04_stage.a00_guard_context_transition();

-- Preserve all existing production-like gate triggers; NO worker records are activated.
-- No backfill or legacy task updates, no approval changes, no publish/write API.
COMMIT;
