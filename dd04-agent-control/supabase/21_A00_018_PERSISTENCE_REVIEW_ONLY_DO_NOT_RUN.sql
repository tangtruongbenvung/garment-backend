-- DD04-A00-018 | REVIEW-ONLY DDL | DO NOT EXECUTE.
-- Intended project wbvkqfnrlasmtizjszab, schema dd04_stage; NEVER production.
-- All permissions fail closed; NO operational writes or approvals are enabled by this draft.
-- Requires independent SQL review, authorization-role design, and explicit CEO staging migration approval.
BEGIN;

-- Physical ledger version and per-channel task context; existing tasks remain authoritative.
CREATE TABLE dd04_stage.a00_workflow_instances (
  tenant_id uuid NOT NULL,
  workflow_id text NOT NULL CHECK (workflow_id ~ '^[A-Za-z0-9_-]{2,100}$'),
  command_id text NOT NULL,
  campaign_id text NOT NULL,
  workflow_kind text NOT NULL CHECK (workflow_kind IN ('CONTENT','TREND','SALES','COMMUNITY','FINANCE')),
  input_sha256 text NOT NULL CHECK (input_sha256 ~ '^[a-f0-9]{64}$'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  state text NOT NULL DEFAULT 'DRAFT_LOCKED' CHECK (state IN ('DRAFT_LOCKED','READY_INTERNAL','HOLD','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,workflow_id),
  FOREIGN KEY (tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id)
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
  required_review_agents text[] NOT NULL DEFAULT '{}',
  authority_policy_sha256 text,
  state text NOT NULL DEFAULT 'BLOCKED' CHECK (state IN ('BLOCKED','READY','IN_PROGRESS','INTERNAL_REVIEW','NEEDS_FIX','APPROVED_INTERNAL','HOLD')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,command_id,task_id),
  FOREIGN KEY (tenant_id,command_id,task_id) REFERENCES dd04_stage.tasks(tenant_id,command_id,task_id),
  FOREIGN KEY (tenant_id,workflow_id) REFERENCES dd04_stage.a00_workflow_instances(tenant_id,workflow_id),
  CHECK ((channel_id IS NULL AND profile_version IS NULL AND profile_sha256 IS NULL)
      OR (channel_id IS NOT NULL AND profile_version > 0 AND profile_sha256 ~ '^[a-f0-9]{64}$'))
);
CREATE INDEX a00_task_contexts_state_idx ON dd04_stage.a00_task_contexts(tenant_id,state,updated_at DESC);

-- Agent authority assignment is a proposal store only until server role enrollment is built.
CREATE TABLE dd04_stage.a00_authority_assignments (
  tenant_id uuid NOT NULL,
  assignment_id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL,
  agent_id text NOT NULL CHECK (agent_id ~ '^A(0[0-9]|1[0-7])$'),
  approved_policy_sha256 text NOT NULL CHECK (approved_policy_sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,assignment_id)
);
CREATE UNIQUE INDEX a00_active_authority_idx ON dd04_stage.a00_authority_assignments(tenant_id,subject_user_id,agent_id) WHERE status='ACTIVE';

-- Append-only evidence history. No text self-assertion can authorize a state transition.
CREATE TABLE dd04_stage.a00_transition_events (
  tenant_id uuid NOT NULL,
  event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  command_id text NOT NULL,
  task_id text NOT NULL,
  actor_user_id uuid NOT NULL,
  agent_id text NOT NULL CHECK (agent_id ~ '^A(0[0-9]|1[0-7])$'),
  action text NOT NULL CHECK (action IN ('ASSIGN','START','SUBMIT','REVIEW_PASS','REVIEW_FAIL','HOLD','CANCEL')),
  from_state text NOT NULL,
  to_state text NOT NULL,
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  expected_revision integer NOT NULL CHECK (expected_revision > 0),
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 8 AND 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id,command_id,task_id) REFERENCES dd04_stage.a00_task_contexts(tenant_id,command_id,task_id),
  UNIQUE (tenant_id,idempotency_key)
);

-- Finance data: immutable reservations and CEO exception queue, ALL operations locked.
CREATE TABLE dd04_stage.a00_delegation_policies (
  tenant_id uuid NOT NULL,
  policy_id uuid NOT NULL DEFAULT gen_random_uuid(),
  revision integer NOT NULL CHECK (revision > 0),
  scope text NOT NULL,
  budget_period text NOT NULL,
  budget_limit_vnd bigint NOT NULL CHECK (budget_limit_vnd >= 0),
  approval_evidence_sha256 text NOT NULL CHECK (approval_evidence_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','ACTIVE','REVOKED')),
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  CHECK (valid_from < valid_until),
  PRIMARY KEY (tenant_id,policy_id,revision)
);
CREATE INDEX a00_budget_policy_scope_idx ON dd04_stage.a00_delegation_policies(tenant_id,scope,budget_period,state);

CREATE TABLE dd04_stage.a00_finance_commitments (
  tenant_id uuid NOT NULL,
  request_id text NOT NULL,
  command_id text NOT NULL,
  policy_id uuid NOT NULL,
  policy_revision integer NOT NULL,
  budget_scope text NOT NULL,
  budget_period text NOT NULL,
  amount_vnd bigint NOT NULL CHECK (amount_vnd >= 0),
  request_sha256 text NOT NULL CHECK (request_sha256 ~ '^[a-f0-9]{64}$'),
  state text NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (state IN ('PENDING_REVIEW','RESERVED','CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,request_id),
  FOREIGN KEY (tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id),
  FOREIGN KEY (tenant_id,policy_id,policy_revision) REFERENCES dd04_stage.a00_delegation_policies(tenant_id,policy_id,revision)
);
CREATE INDEX a00_commitments_budget_idx ON dd04_stage.a00_finance_commitments(tenant_id,budget_scope,budget_period,state);

CREATE TABLE dd04_stage.a00_finance_exceptions (
  tenant_id uuid NOT NULL,
  exception_id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id text NOT NULL,
  command_id text NOT NULL,
  requested_vnd bigint NOT NULL CHECK (requested_vnd >= 0),
  limit_vnd bigint NOT NULL CHECK (limit_vnd >= 0),
  used_vnd bigint NOT NULL CHECK (used_vnd >= 0),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  status text NOT NULL DEFAULT 'WAITING_CEO' CHECK (status IN ('WAITING_CEO','RESOLVED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,exception_id),
  UNIQUE (tenant_id,request_id),
  FOREIGN KEY (tenant_id,command_id) REFERENCES dd04_stage.commands(tenant_id,command_id)
);

-- RLS must be enabled, but absence of policies means deny by default for non-owner roles.
-- Do not grant any anon/authenticated/service_role permissions in this review draft.
ALTER TABLE dd04_stage.a00_workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_task_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_authority_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_transition_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_delegation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_finance_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_finance_exceptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON dd04_stage.a00_workflow_instances,dd04_stage.a00_task_contexts,
 dd04_stage.a00_authority_assignments,dd04_stage.a00_transition_events,
 dd04_stage.a00_delegation_policies,dd04_stage.a00_finance_commitments,
 dd04_stage.a00_finance_exceptions FROM PUBLIC,anon,authenticated;
-- Default-deny means database owner/server-superuser may still bypass RLS.
-- Do not use owner/service-role credentials as the end-user authorization mechanism.
-- BEFORE EXECUTION: review and add append-only trigger, dedicated least-privilege DB
-- role & verified server actor mapping, atomic transition CAS/row lock and budget
-- reservation transaction with advisory/row lock covering (tenant,scope,period),
-- revoke/access controls, independent reviewer + G1/G2 packet model, rollback plan.
-- This file intentionally stops short of deploying active workflow permissions.
COMMIT;
