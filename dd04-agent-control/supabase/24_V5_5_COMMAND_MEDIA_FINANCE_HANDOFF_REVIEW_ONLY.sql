-- DD04-A00-018 V5.5 / STAGING ONLY / REVIEW ONLY — DO NOT APPLY.
-- This file is a proposed follow-on migration. It does NOT authorize automated
-- approval, platform publication, spending, or production changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE dd04_stage.v55_command_media (
 tenant_id uuid NOT NULL,
 command_id text NOT NULL,
 media_id uuid NOT NULL DEFAULT gen_random_uuid(),
 storage_ref text NOT NULL CHECK(length(storage_ref) BETWEEN 10 AND 2000),
 mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp','application/pdf','video/mp4')),
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 bytes bigint NOT NULL CHECK(bytes BETWEEN 1 AND 104857600),
 scan_status text NOT NULL DEFAULT 'PENDING' CHECK(scan_status IN ('PENDING','CLEAN','REJECTED')),
 source_kind text NOT NULL CHECK(source_kind IN ('CEO_UPLOAD','VERIFIED_GATEWAY')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,media_id),
 UNIQUE(tenant_id,command_id,sha256),
 FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id),
 CHECK(scan_status='PENDING')
);

CREATE TABLE dd04_stage.v55_finance_policies (
 tenant_id uuid NOT NULL,
 policy_id uuid NOT NULL DEFAULT gen_random_uuid(),
 version integer NOT NULL CHECK(version>=1),
 max_single_spend_vnd bigint NOT NULL CHECK(max_single_spend_vnd>=0),
 max_campaign_spend_vnd bigint NOT NULL CHECK(max_campaign_spend_vnd>=0),
 policy_sha256 text NOT NULL CHECK(policy_sha256 ~ '^[0-9a-f]{64}$'),
 owner_ceo_id uuid NOT NULL REFERENCES auth.users(id),
 status text NOT NULL DEFAULT 'PROPOSED' CHECK(status IN ('PROPOSED','ACTIVE','RETIRED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,policy_id),
 UNIQUE(tenant_id,version),
 CHECK(status='PROPOSED') -- no active financial policy without CEO approval transaction
);

CREATE TABLE dd04_stage.v55_finance_cases (
 tenant_id uuid NOT NULL,
 case_id uuid NOT NULL DEFAULT gen_random_uuid(),
 command_id text NOT NULL,
 evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 requested_spend_vnd bigint NOT NULL CHECK(requested_spend_vnd>=0),
 reason text NOT NULL CHECK(length(reason) BETWEEN 8 AND 2000),
 status text NOT NULL DEFAULT 'WAITING_CEO' CHECK(status IN ('WAITING_CEO','APPROVED','REJECTED','CANCELLED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,case_id),
 FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id),
 CHECK(status='WAITING_CEO')
);

CREATE TABLE dd04_stage.v55_agent_handoff_events (
 event_id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 command_id text NOT NULL,
 task_id text NOT NULL,
 from_agent text NOT NULL CHECK(from_agent ~ '^A(0[0-9]|1[0-7])$'),
 to_agent text NOT NULL CHECK(to_agent ~ '^A(0[0-9]|1[0-7])$'),
 revision integer NOT NULL CHECK(revision>=1),
 input_sha256 text NOT NULL CHECK(input_sha256 ~ '^[0-9a-f]{64}$'),
 report_sha256 text NOT NULL CHECK(report_sha256 ~ '^[0-9a-f]{64}$'),
 verdict text NOT NULL DEFAULT 'PENDING' CHECK(verdict IN ('PENDING','PASS','REWORK','HOLD')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id),
 FOREIGN KEY(tenant_id,command_id,task_id) REFERENCES dd04_stage.tasks(tenant_id,command_id,task_id),
 CHECK(from_agent<>to_agent),
 CHECK(verdict='PENDING') -- write of PASS requires separate validated worker transaction
);

CREATE TABLE dd04_stage.v55_publish_jobs (
 tenant_id uuid NOT NULL,
 job_id uuid NOT NULL DEFAULT gen_random_uuid(),
 command_id text NOT NULL,
 content_id text NOT NULL CHECK(length(content_id) BETWEEN 4 AND 150),
 channel_id text NOT NULL CHECK(length(channel_id) BETWEEN 4 AND 100),
 revision integer NOT NULL CHECK(revision>=1),
 final_packet_sha256 text NOT NULL CHECK(final_packet_sha256 ~ '^[0-9a-f]{64}$'),
 scheduled_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'BLOCKED' CHECK(status IN ('BLOCKED','READY','PUBLISHING','PUBLISHED','FAILED','CANCELLED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,job_id),
 UNIQUE(tenant_id,content_id,channel_id,revision),
 FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id),
 CHECK(status='BLOCKED') -- posting is disabled until separately audited enablement
);

CREATE TRIGGER dd04_v55_media_no_edit BEFORE UPDATE OR DELETE ON dd04_stage.v55_command_media
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();
CREATE TRIGGER dd04_v55_finance_policy_no_edit BEFORE UPDATE OR DELETE ON dd04_stage.v55_finance_policies
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();
CREATE TRIGGER dd04_v55_finance_cases_no_edit BEFORE UPDATE OR DELETE ON dd04_stage.v55_finance_cases
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();
CREATE TRIGGER dd04_v55_handoff_no_edit BEFORE UPDATE OR DELETE ON dd04_stage.v55_agent_handoff_events
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();
CREATE TRIGGER dd04_v55_publish_no_edit BEFORE UPDATE OR DELETE ON dd04_stage.v55_publish_jobs
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();

ALTER TABLE dd04_stage.v55_command_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.v55_finance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.v55_finance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.v55_agent_handoff_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.v55_publish_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dd04_stage.v55_command_media FROM PUBLIC,anon,authenticated;
REVOKE ALL ON dd04_stage.v55_finance_policies FROM PUBLIC,anon,authenticated;
REVOKE ALL ON dd04_stage.v55_finance_cases FROM PUBLIC,anon,authenticated;
REVOKE ALL ON dd04_stage.v55_agent_handoff_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON dd04_stage.v55_publish_jobs FROM PUBLIC,anon,authenticated;
COMMIT;
