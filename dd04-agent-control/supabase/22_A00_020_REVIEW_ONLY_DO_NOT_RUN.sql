-- DD04-A00-020 STAGING REVIEW ONLY — DO NOT EXECUTE.
-- Target project: wbvkqfnrlasmtizjszab, private schema dd04_stage.
-- NOT an approved migration. No production changes, no CEO gate unlock.
-- This is the MINIMUM physical contract for the a00-020 repository.
-- Deploy only after dedicated staging SQL approval, DBA security review,
-- trusted server identity resolver, and independent authorization tests.
BEGIN;
CREATE TABLE dd04_stage.a00_workflow_instances (
 tenant_id uuid NOT NULL,
 workflow_id text NOT NULL,
 command_id text NOT NULL,
 campaign_id text NOT NULL,
 workflow_kind text NOT NULL CHECK(workflow_kind IN ('CONTENT','TREND','SALES','COMMUNITY','FINANCE')),
 input_sha256 text NOT NULL CHECK(input_sha256 ~ '^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'DRAFT_LOCKED' CHECK(state IN ('DRAFT_LOCKED','READY_INTERNAL','HOLD','CLOSED')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,workflow_id),
 FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id)
);
CREATE TABLE dd04_stage.a00_task_contexts (
 tenant_id uuid NOT NULL,
 command_id text NOT NULL,
 task_id text NOT NULL,
 workflow_id text NOT NULL,
 campaign_id text NOT NULL,
 channel_id text,
 profile_version integer,
 profile_sha256 text,
 dependency_task_ids text[] NOT NULL DEFAULT '{}',
 state text NOT NULL DEFAULT 'BLOCKED' CHECK(state IN
 ('BLOCKED','READY','IN_PROGRESS','INTERNAL_REVIEW','NEEDS_FIX','APPROVED_INTERNAL','HOLD')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>=1),
 output_sha256 text CHECK(output_sha256 ~ '^[a-f0-9]{64}$'),
 output_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(output_refs)='array'),
 last_reviewer_agent text CHECK(last_reviewer_agent ~ '^A(0[0-9]|1[0-7])$'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id,command_id,task_id),
 FOREIGN KEY(tenant_id,command_id,task_id) REFERENCES dd04_stage.tasks(tenant_id,command_id,task_id),
 FOREIGN KEY(tenant_id,workflow_id) REFERENCES dd04_stage.a00_workflow_instances(tenant_id,workflow_id),
 CHECK((channel_id IS NULL AND profile_version IS NULL AND profile_sha256 IS NULL)
 OR(channel_id IS NOT NULL AND profile_version>=1 AND profile_sha256 ~ '^[a-f0-9]{64}$'))
);
CREATE INDEX a00_task_context_state_idx ON dd04_stage.a00_task_contexts(tenant_id,state,updated_at DESC);
CREATE TABLE dd04_stage.a00_transition_events(
 tenant_id uuid NOT NULL,
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 command_id text NOT NULL,
 task_id text NOT NULL,
 actor_user_id uuid NOT NULL,
 agent_id text NOT NULL CHECK(agent_id ~ '^A(0[0-9]|1[0-7])$'),
 action text NOT NULL CHECK(action IN ('START','SUBMIT','REVIEW_PASS','REVIEW_FAIL','REWORK','AUTO_READY')),
 from_state text NOT NULL,
 to_state text NOT NULL,
 evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 report_sha256 text CHECK(report_sha256 ~ '^[a-f0-9]{64}$'),
 request_sha256 text NOT NULL CHECK(request_sha256 ~ '^[a-f0-9]{64}$'),
 expected_revision integer NOT NULL CHECK(expected_revision>=1),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 120),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (tenant_id,command_id,task_id)
 REFERENCES dd04_stage.a00_task_contexts(tenant_id,command_id,task_id),
 UNIQUE(tenant_id,idempotency_key)
);
CREATE INDEX a00_transition_task_idx ON dd04_stage.a00_transition_events(tenant_id,command_id,task_id,created_at DESC);
CREATE TRIGGER a00_transition_events_immutable
 BEFORE UPDATE OR DELETE ON dd04_stage.a00_transition_events
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_audit_mutation();
ALTER TABLE dd04_stage.a00_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_task_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_transition_events ENABLE ROW LEVEL SECURITY;
-- No browser/Data API grants; dedicated service database role still needs
-- review + explicit least-privilege grants. Owner/service roles can bypass RLS.
REVOKE ALL ON dd04_stage.a00_workflow_instances,dd04_stage.a00_task_contexts,
 dd04_stage.a00_transition_events FROM PUBLIC,anon,authenticated;
-- No modifications to existing dd04_stage.tasks or approval/finance/publish guards.
-- DATA MIGRATION / BACKFILL is NOT included; old tasks remain G1-locked.
-- Additional requirements BEFORE activation:
-- 1. Independently verified DB actor identity and tenant scope.
-- 2. Approved server-only writer role; audit privileged role bypass.
-- 3. Backfill verified workflow/task contexts from approved authority.
-- 4. Verify serializable retries, audit for every AUTO_READY and rollback.
-- 5. Migrate only with explicit CEO permission for this exact SQL and project.
COMMIT;
