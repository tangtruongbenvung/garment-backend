-- DD04 Channel Registry V2 | REVIEW ONLY | DO NOT EXECUTE UNTIL CEO APPROVAL
-- Target exact Supabase project: wbvkqfnrlasmtizjszab
-- Existing schema: dd04_stage; existing 7 V2 tables preserved.
-- No changes to production. No GRANT to anon/authenticated. No bypass of RLS.
BEGIN;
CREATE TABLE dd04_stage.channels (
 tenant_id uuid NOT NULL,
 channel_id text NOT NULL CHECK (channel_id ~ '^[A-Za-z0-9_-]{2,64}$'),
 platform text NOT NULL CHECK (platform IN ('FANPAGE','TIKTOK')),
 display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 2 AND 100),
 platform_account_ref text,
 account_verified boolean NOT NULL DEFAULT false,
 lifecycle text NOT NULL DEFAULT 'DRAFT' CHECK (lifecycle IN ('DRAFT','READY','ACTIVE','PAUSED','RECOVERY_14D','RETIRED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dd04_channels_pk PRIMARY KEY (tenant_id,channel_id),
 CONSTRAINT dd04_channels_external_unique UNIQUE (tenant_id,platform,platform_account_ref)
);
CREATE TABLE dd04_stage.channel_profile_versions (
 tenant_id uuid NOT NULL,
 channel_id text NOT NULL,
 profile_version integer NOT NULL CHECK (profile_version>=1),
 profile_sha256 text NOT NULL CHECK (profile_sha256 ~ '^[0-9a-f]{64}$'),
 positioning text NOT NULL CHECK (length(btrim(positioning)) BETWEEN 5 AND 500),
 audience text NOT NULL CHECK (length(btrim(audience)) BETWEEN 3 AND 250),
 content_pillars text NOT NULL CHECK (length(btrim(content_pillars)) BETWEEN 3 AND 700),
 tone text NOT NULL CHECK (length(btrim(tone)) BETWEEN 3 AND 350),
 character_bible text NOT NULL CHECK (length(btrim(character_bible)) BETWEEN 3 AND 900),
 visual_style text NOT NULL CHECK (length(btrim(visual_style)) BETWEEN 3 AND 350),
 forbidden text NOT NULL CHECK (length(btrim(forbidden)) BETWEEN 3 AND 700),
 cta_policy text NOT NULL CHECK (length(btrim(cta_policy)) BETWEEN 3 AND 350),
 target_outcome text NOT NULL CHECK (length(btrim(target_outcome)) BETWEEN 3 AND 350),
 assigned_agents jsonb NOT NULL CHECK (jsonb_typeof(assigned_agents)='array'),
 proposed_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dd04_channel_profiles_pk PRIMARY KEY(tenant_id,channel_id,profile_version),
 CONSTRAINT dd04_channel_profiles_fk FOREIGN KEY (tenant_id,channel_id) REFERENCES dd04_stage.channels(tenant_id,channel_id),
 CONSTRAINT dd04_channel_profiles_hash_uq UNIQUE(tenant_id,channel_id,profile_version,profile_sha256)
);
CREATE TABLE dd04_stage.channel_agent_assignments (
 tenant_id uuid NOT NULL,
 channel_id text NOT NULL,
 agent_id text NOT NULL CHECK (agent_id ~ '^A(0[0-9]|1[0-7])$'),
 responsibility text NOT NULL CHECK (length(btrim(responsibility)) BETWEEN 3 AND 500),
 state text NOT NULL DEFAULT 'PROPOSED' CHECK (state IN ('PROPOSED','ENABLED','DISABLED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dd04_channel_agent_pk PRIMARY KEY (tenant_id,channel_id,agent_id),
 CONSTRAINT dd04_channel_agent_fk FOREIGN KEY(tenant_id,channel_id) REFERENCES dd04_stage.channels(tenant_id,channel_id)
);
CREATE TABLE dd04_stage.channel_content_history (
 history_id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 channel_id text NOT NULL,
 profile_version integer NOT NULL,
 profile_sha256 text NOT NULL CHECK(profile_sha256 ~ '^[0-9a-f]{64}$'),
 command_id text NOT NULL,
 task_id text NOT NULL,
 content_kind text NOT NULL CHECK (content_kind IN ('SCRIPT','IMAGE','VIDEO','CAPTION','REPLY_LIBRARY')),
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
 concept_key text NOT NULL CHECK(length(concept_key) BETWEEN 3 AND 250),
 storage_ref text NOT NULL CHECK(length(storage_ref) BETWEEN 3 AND 2048),
 review_state text NOT NULL DEFAULT 'PENDING' CHECK (review_state IN ('PENDING','QC_PASS','HOLD','REJECT','REWORK')),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dd04_channel_history_pk PRIMARY KEY(history_id),
 CONSTRAINT dd04_channel_history_profile_fk FOREIGN KEY(tenant_id,channel_id,profile_version,profile_sha256)
 REFERENCES dd04_stage.channel_profile_versions(tenant_id,channel_id,profile_version,profile_sha256),
 CONSTRAINT dd04_channel_history_task_fk FOREIGN KEY(tenant_id,command_id,task_id) REFERENCES dd04_stage.tasks(tenant_id,command_id,task_id),
 CONSTRAINT dd04_channel_history_content_unique UNIQUE(tenant_id,channel_id,content_kind,content_sha256)
);
CREATE TABLE dd04_stage.channel_task_context (
 tenant_id uuid NOT NULL,
 command_id text NOT NULL,
 task_id text NOT NULL,
 channel_id text NOT NULL,
 profile_version integer NOT NULL,
 profile_sha256 text NOT NULL CHECK (profile_sha256 ~ '^[0-9a-f]{64}$'),
 owner_agent text NOT NULL CHECK (owner_agent ~ '^A(0[0-9]|1[0-7])$'),
 context_state text NOT NULL DEFAULT 'PLANNED_WAIT_G1' CHECK (context_state IN ('PLANNED_WAIT_G1','REQUIRES_REVIEW','REWORK','CANCELLED')),
 context_snapshot jsonb NOT NULL CHECK (jsonb_typeof(context_snapshot)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dd04_channel_task_context_pk PRIMARY KEY(tenant_id,command_id,task_id),
 CONSTRAINT dd04_channel_task_context_task_fk FOREIGN KEY(tenant_id,command_id,task_id) REFERENCES dd04_stage.tasks(tenant_id,command_id,task_id),
 CONSTRAINT dd04_channel_task_context_profile_fk FOREIGN KEY(tenant_id,channel_id,profile_version,profile_sha256)
 REFERENCES dd04_stage.channel_profile_versions(tenant_id,channel_id,profile_version,profile_sha256)
);
CREATE TABLE dd04_stage.channel_change_requests (
 request_id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,
 channel_id text NOT NULL,
 current_version integer NOT NULL CHECK (current_version>=0),
 proposed_version integer NOT NULL CHECK(proposed_version>current_version),
 diff jsonb NOT NULL CHECK (jsonb_typeof(diff)='object'),
 status text NOT NULL DEFAULT 'WAITING_CEO_G1' CHECK(status IN ('WAITING_CEO_G1','APPROVED','REJECTED','CANCELLED')),
 requested_by uuid REFERENCES auth.users(id),
 decided_by uuid REFERENCES auth.users(id),
 decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dd04_channel_changes_pk PRIMARY KEY(request_id),
 CONSTRAINT dd04_channel_changes_fk FOREIGN KEY (tenant_id,channel_id) REFERENCES dd04_stage.channels(tenant_id,channel_id),
 CONSTRAINT dd04_channel_changes_decision_guard CHECK (
    (status='WAITING_CEO_G1' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status<>'WAITING_CEO_G1' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
 )
);
CREATE INDEX dd04_channel_history_tenant_recent_idx ON dd04_stage.channel_content_history (tenant_id,channel_id,created_at DESC);
CREATE INDEX dd04_channel_task_context_agent_idx ON dd04_stage.channel_task_context (tenant_id,owner_agent,context_state);
CREATE INDEX dd04_channels_lifecycle_idx ON dd04_stage.channels (tenant_id,lifecycle,platform);
CREATE INDEX dd04_channel_changes_pending_idx ON dd04_stage.channel_change_requests (tenant_id,status,created_at DESC);
-- Fail-closed: all six new tables have RLS enabled, no policies until separate reviewed CEO authorization migration.
ALTER TABLE dd04_stage.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.channel_profile_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.channel_agent_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.channel_content_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.channel_task_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.channel_change_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dd04_stage.channels,dd04_stage.channel_profile_versions,dd04_stage.channel_agent_assignments,
 dd04_stage.channel_content_history,dd04_stage.channel_task_context,dd04_stage.channel_change_requests FROM PUBLIC,anon,authenticated;
-- Profiles are immutable; approval decisions belong to change_requests, not editable profile rows.
-- Initial registration: current_version=0, proposed_version=1.
-- No status can be approved via anon/authenticated: no grants/RLS policies.
-- Add CEO-verified decision service/trigger only in a separately approved security rollout.
CREATE FUNCTION dd04_stage.reject_profile_version_mutation() RETURNS trigger LANGUAGE plpgsql
 SET search_path = pg_catalog,dd04_stage
 AS $$
 BEGIN
 RAISE EXCEPTION 'CHANNEL_PROFILE_IMMUTABLE' USING ERRCODE='P0001';
 END
 $$;
REVOKE ALL ON FUNCTION dd04_stage.reject_profile_version_mutation() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER dd04_channel_profile_immutable BEFORE UPDATE OR DELETE
 ON dd04_stage.channel_profile_versions FOR EACH ROW EXECUTE FUNCTION dd04_stage.reject_profile_version_mutation();
COMMIT;
