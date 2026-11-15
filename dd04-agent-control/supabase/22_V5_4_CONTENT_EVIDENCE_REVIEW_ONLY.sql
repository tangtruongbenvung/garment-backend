-- DD04 V5.4 / DD04-A00-016 — REVIEW ONLY. NOT EXECUTED.
-- Required additional CEO migration authorization after line-by-line review.
-- Target: staging project wbvkqfnrlasmtizjszab, schema dd04_stage only.
-- Creates evidence storage ONLY; DOES NOT modify approvals/triggers, grant G2, publish, or touch prod.
-- Legacy G1 PENDING is intentionally untouched.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE dd04_stage.v54_internal_policies (
 tenant_id uuid NOT NULL,
 policy_id uuid NOT NULL DEFAULT gen_random_uuid(),
 version integer NOT NULL CHECK (version>=1),
 status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED','ACTIVE','RETIRED')),
 max_budget_vnd bigint NOT NULL CHECK (max_budget_vnd>=0),
 channel_ids jsonb NOT NULL CHECK (jsonb_typeof(channel_ids)='array'),
 policy_sha256 text NOT NULL CHECK (policy_sha256 ~ '^[a-f0-9]{64}$'),
 owner_ceo_id uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,policy_id),
 UNIQUE(tenant_id,version),
 CHECK (status='PROPOSED') -- SAFETY: cannot activate policy until separately reviewed activation migration
);

CREATE TABLE dd04_stage.v54_internal_g1_evidence (
 tenant_id uuid NOT NULL,
 run_id uuid NOT NULL DEFAULT gen_random_uuid(),
 command_id text NOT NULL,
 policy_id uuid NOT NULL,
 plan_revision integer NOT NULL CHECK (plan_revision>=1),
 plan_sha256 text NOT NULL CHECK (plan_sha256 ~ '^[a-f0-9]{64}$'),
 budget_vnd bigint NOT NULL CHECK (budget_vnd>=0),
 channel_ids jsonb NOT NULL CHECK (jsonb_typeof(channel_ids)='array' AND jsonb_array_length(channel_ids)>0),
 script_refs jsonb NOT NULL CHECK (jsonb_typeof(script_refs)='array'),
 reviewer_results jsonb NOT NULL CHECK (jsonb_typeof(reviewer_results)='object'),
 result text NOT NULL DEFAULT 'PENDING' CHECK (result IN ('PENDING','PASS','HOLD','REJECT')),
 evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,run_id),
 FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id),
 FOREIGN KEY(tenant_id,policy_id) REFERENCES dd04_stage.v54_internal_policies(tenant_id,policy_id),
 CHECK (result='PENDING') -- review-only: no automatic G1 PASS yet
);

CREATE TABLE dd04_stage.v54_publish_packets (
 tenant_id uuid NOT NULL,
 command_id text NOT NULL,
 content_id text NOT NULL CHECK(length(content_id) BETWEEN 4 AND 150),
 channel_id text NOT NULL CHECK(length(channel_id) BETWEEN 4 AND 100),
 platform text NOT NULL CHECK(platform IN ('FANPAGE','TIKTOK')),
 revision integer NOT NULL CHECK(revision>=1),
 profile_sha256 text NOT NULL CHECK(profile_sha256 ~ '^[a-f0-9]{64}$'),
 video_sha256 text NOT NULL CHECK(video_sha256 ~ '^[a-f0-9]{64}$'),
 caption_sha256 text NOT NULL CHECK(caption_sha256 ~ '^[a-f0-9]{64}$'),
 packet_sha256 text NOT NULL CHECK(packet_sha256 ~ '^[a-f0-9]{64}$'),
 asset_manifest jsonb NOT NULL CHECK(jsonb_typeof(asset_manifest)='object'),
 schedule_at timestamptz NOT NULL,
 packet_state text NOT NULL DEFAULT 'PREVIEW' CHECK(packet_state IN ('PREVIEW','READY','RETIRED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,content_id,channel_id,revision),
 FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id),
 CHECK (packet_state='PREVIEW') -- review-only: no READY status until approved transaction
);

CREATE TABLE dd04_stage.v54_agent_qc_events (
 event_id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 content_id text NOT NULL,
 channel_id text NOT NULL,
 revision integer NOT NULL,
 agent_id text NOT NULL CHECK(agent_id IN ('A08','A09')),
 check_result text NOT NULL CHECK(check_result IN ('PASS','HOLD','REJECT')),
 packet_sha256 text NOT NULL CHECK(packet_sha256 ~ '^[a-f0-9]{64}$'),
 report_sha256 text NOT NULL CHECK(report_sha256 ~ '^[a-f0-9]{64}$'),
 source_ref text NOT NULL CHECK(length(source_ref) BETWEEN 4 AND 2048),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id),
 FOREIGN KEY(tenant_id,content_id,channel_id,revision)
   REFERENCES dd04_stage.v54_publish_packets(tenant_id,content_id,channel_id,revision)
);

CREATE TABLE dd04_stage.v54_ceo_publish_decisions (
 decision_id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 content_id text NOT NULL,
 channel_id text NOT NULL,
 revision integer NOT NULL,
 packet_sha256 text NOT NULL CHECK(packet_sha256 ~ '^[a-f0-9]{64}$'),
 decision text NOT NULL DEFAULT 'PENDING' CHECK(decision IN ('PENDING','APPROVED','REJECTED')),
 ceo_user_id uuid,
 auth_session_id uuid,
 decided_at timestamptz,
 batch_id uuid,
 evidence_sha256 text CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(decision_id),
 FOREIGN KEY(tenant_id,content_id,channel_id,revision)
   REFERENCES dd04_stage.v54_publish_packets(tenant_id,content_id,channel_id,revision),
 FOREIGN KEY(ceo_user_id) REFERENCES auth.users(id),
 UNIQUE(tenant_id,content_id,channel_id,revision),
 CHECK(decision='PENDING' AND ceo_user_id IS NULL AND auth_session_id IS NULL
       AND decided_at IS NULL AND evidence_sha256 IS NULL)
       -- Review-only: decisions are structurally LOCKED, cannot be approved yet.
);

-- All records immutable even for privileged DB users unless a separately authorized
-- controlled migration replaces rules with audited, locked, transaction-only routines.
CREATE TRIGGER dd04_v54_internal_policies_immutable
 BEFORE UPDATE OR DELETE ON dd04_stage.v54_internal_policies
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();
CREATE TRIGGER dd04_v54_internal_g1_evidence_immutable
 BEFORE UPDATE OR DELETE ON dd04_stage.v54_internal_g1_evidence
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();
CREATE TRIGGER dd04_v54_publish_packets_immutable
 BEFORE UPDATE OR DELETE ON dd04_stage.v54_publish_packets
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();
CREATE TRIGGER dd04_v54_agent_qc_events_immutable
 BEFORE UPDATE OR DELETE ON dd04_stage.v54_agent_qc_events
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();
CREATE TRIGGER dd04_v54_ceo_publish_decisions_immutable
 BEFORE UPDATE OR DELETE ON dd04_stage.v54_ceo_publish_decisions
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();

ALTER TABLE dd04_stage.v54_internal_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.v54_internal_g1_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.v54_publish_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.v54_agent_qc_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.v54_ceo_publish_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dd04_stage.v54_internal_policies FROM PUBLIC,anon,authenticated;
REVOKE ALL ON dd04_stage.v54_internal_g1_evidence FROM PUBLIC,anon,authenticated;
REVOKE ALL ON dd04_stage.v54_publish_packets FROM PUBLIC,anon,authenticated;
REVOKE ALL ON dd04_stage.v54_agent_qc_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON dd04_stage.v54_ceo_publish_decisions FROM PUBLIC,anon,authenticated;
COMMIT;
