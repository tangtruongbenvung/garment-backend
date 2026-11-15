CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- DD04 A00-020: EPHEMERAL POSTGRES 17 CI FIXTURE; NEVER RUN AGAINST STAGING.
-- Minimal stand-in for pre-existing protected dd04_stage tables.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA dd04_stage;

CREATE TABLE dd04_stage.commands (
 tenant_id uuid NOT NULL, command_id text NOT NULL, status text NOT NULL,
 PRIMARY KEY(tenant_id,command_id)
);
CREATE TABLE dd04_stage.tasks (
 tenant_id uuid NOT NULL, command_id text NOT NULL, task_id text NOT NULL,
 owner_agent text NOT NULL,status text NOT NULL,revision integer NOT NULL DEFAULT 1,
 PRIMARY KEY(tenant_id,command_id,task_id),
 FOREIGN KEY(tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id)
);
CREATE TABLE dd04_stage.task_events (
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,command_id text NOT NULL,task_id text,
 event_name text NOT NULL,actor_kind text NOT NULL,actor_ref text NOT NULL,
 from_status text,to_status text,evidence_sha256 text,details jsonb
);
CREATE TABLE dd04_stage.approvals (
 tenant_id uuid NOT NULL,command_id text NOT NULL,gate text NOT NULL,
 revision integer NOT NULL DEFAULT 1,decision text NOT NULL,
 PRIMARY KEY(tenant_id,command_id,gate,revision)
);
CREATE TABLE dd04_stage.artifacts (
 tenant_id uuid NOT NULL,command_id text NOT NULL,task_id text NOT NULL,
 artifact_id uuid NOT NULL DEFAULT gen_random_uuid(),
 kind text NOT NULL,sha256 text NOT NULL,
 storage_ref text NOT NULL,version integer NOT NULL DEFAULT 1
);
CREATE TABLE dd04_stage.v55_agent_handoff_events (
 event_id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
 tenant_id uuid NOT NULL,command_id text NOT NULL,task_id text NOT NULL,
 from_agent text NOT NULL,to_agent text NOT NULL,revision integer NOT NULL,
 input_sha256 text NOT NULL,report_sha256 text NOT NULL,verdict text NOT NULL
);
CREATE FUNCTION dd04_stage.deny_audit_mutation() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,dd04_stage AS $f$
BEGIN RAISE EXCEPTION 'DD04_AUDIT_APPEND_ONLY'; END;
$f$;

ALTER TABLE dd04_stage.commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.v55_agent_handoff_events ENABLE ROW LEVEL SECURITY;

INSERT INTO dd04_stage.commands VALUES
 ('6bc73b49-a396-4c7d-b390-ab6339d547cd','cmd_1234567890abcdef1234','WAITING_CEO_PLAN');
INSERT INTO dd04_stage.tasks(tenant_id,command_id,task_id,owner_agent,status) VALUES
 ('6bc73b49-a396-4c7d-b390-ab6339d547cd','cmd_1234567890abcdef1234',
 'cmd_1234567890abcdef1234_A03','A03','PLANNED_WAIT_G1');
INSERT INTO dd04_stage.approvals VALUES
 ('6bc73b49-a396-4c7d-b390-ab6339d547cd','cmd_1234567890abcdef1234','G1',1,'PENDING');
