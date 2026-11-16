-- DD04-A00-022 | SQL DESIGN CANDIDATE — STAGING ONLY — DO NOT RUN.
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
COMMIT;
