-- DD04-A00-006: DESIGN PROPOSAL ONLY / NO EXECUTION AUTHORIZED
-- This file must NOT be applied until CEO separately approves:
--  1) an independent Supabase staging project/ref,
--  2) reviewed existing schema, role model and RLS audit,
--  3) scoped migration plan and rollback.
-- The draft uses schema dd04_stage to avoid collisions with existing public tables.
-- service_role is NEVER exposed in client-side JavaScript or GitHub.
begin;
create schema if not exists dd04_stage;
-- Restrict all browser roles by default.
revoke all on schema dd04_stage from public, anon, authenticated;
create table dd04_stage.commands (
  command_id text primary key check (command_id ~ '^cmd_[a-f0-9]{20}$'),
  external_id text not null,
  origin text not null,
  input_sha256 text not null check (input_sha256 ~ '^[a-f0-9]{64}$'),
  message_text text not null,
  status text not null check(status in ('WAITING_CEO_PLAN','READY','IN_PROGRESS','HOLD','DONE','CANCELLED')),
  schema_version text not null default '5.3',
  received_at timestamptz not null default now(),
  created_by uuid, -- maps to verified auth.users subject when identity integration exists
  created_at timestamptz not null default now(),
  unique(origin,external_id)
);
create table dd04_stage.tasks (
  task_id text primary key,
  command_id text not null references dd04_stage.commands(command_id),
  owner_agent text not null check(owner_agent ~ '^A(0[0-9]|1[0-7])$'),
  dependency_task_id text references dd04_stage.tasks(task_id),
  status text not null check(status in ('PLANNED_WAIT_G1','READY','IN_PROGRESS','REVIEW','REWORK','HOLD','DONE','BLOCKED','CANCELLED')),
  revision integer not null default 1 check(revision >= 1),
  quality_score numeric(5,2) check(quality_score between 0 and 100),
  started_at timestamptz,
  completed_at timestamptz,
  output_sha256 text,
  output_refs jsonb not null default '[]'::jsonb check(jsonb_typeof(output_refs)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dd04_tasks_command_idx on dd04_stage.tasks(command_id);
create index dd04_tasks_agent_status_idx on dd04_stage.tasks(owner_agent,status);
create table dd04_stage.task_events (
  event_id bigint generated always as identity primary key,
  command_id text not null references dd04_stage.commands(command_id),
  task_id text references dd04_stage.tasks(task_id),
  event_name text not null,
  actor_kind text not null check(actor_kind in ('SYSTEM','AGENT','HUMAN','CEO')),
  actor_id text not null,
  from_status text,
  to_status text,
  evidence_sha256 text,
  detail jsonb not null default '{}'::jsonb,
  happened_at timestamptz not null default now()
);
create index dd04_events_command_time_idx on dd04_stage.task_events(command_id,happened_at desc);
create table dd04_stage.approvals (
  approval_id uuid primary key default gen_random_uuid(),
  command_id text not null references dd04_stage.commands(command_id),
  gate text not null check(gate in ('G1','G2')),
  asset_sha256 text,
  target_channels jsonb not null default '[]'::jsonb,
  schedule jsonb not null default '{}'::jsonb,
  decision text not null default 'PENDING' check(decision in ('PENDING','APPROVED','REJECTED','REVOKED')),
  approved_by uuid,
  decided_at timestamptz,
  approval_version integer not null default 1 check(approval_version>=1),
  created_at timestamptz not null default now(),
  unique(command_id,gate,approval_version),
  check((decision='PENDING' and decided_at is null and approved_by is null) or
        (decision<>'PENDING' and decided_at is not null and approved_by is not null))
);
create table dd04_stage.artifacts (
  artifact_id uuid primary key default gen_random_uuid(),
  command_id text not null references dd04_stage.commands(command_id),
  task_id text references dd04_stage.tasks(task_id),
  artifact_kind text not null,
  storage_ref text not null,
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  version integer not null default 1 check(version >= 1),
  created_at timestamptz not null default now(),
  unique(task_id,artifact_kind,version)
);
create table dd04_stage.agent_memories (
  memory_id uuid primary key default gen_random_uuid(),
  agent_id text not null check(agent_id ~ '^A(0[0-9]|1[0-7])$'),
  source_task_id text references dd04_stage.tasks(task_id),
  memory_kind text not null,
  body text not null,
  evidence_refs jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) check(confidence between 0 and 1),
  review_status text not null default 'PENDING' check(review_status in ('PENDING','VERIFIED','REJECTED','RETIRED')),
  memory_version integer not null default 1 check(memory_version>=1),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index dd04_memories_agent_status_idx on dd04_stage.agent_memories(agent_id,review_status);
create table dd04_stage.capability_versions (
  capability_id uuid primary key default gen_random_uuid(),
  agent_id text not null check(agent_id ~ '^A(0[0-9]|1[0-7])$'),
  skill_name text not null,
  version integer not null check(version>=1),
  baseline_score numeric(5,2) check(baseline_score between 0 and 100),
  benchmark_score numeric(5,2) check(benchmark_score between 0 and 100),
  evidence_refs jsonb not null default '[]'::jsonb,
  approval_status text not null default 'PROPOSED' check(approval_status in ('PROPOSED','TESTED','APPROVED','REJECTED','ROLLED_BACK')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(agent_id,skill_name,version)
);
-- Deny browser roles. Exact grants/policies/service authorization must be
-- separately reviewed; RLS alone is not proof of secure server-side authorization.
alter table dd04_stage.commands enable row level security;
alter table dd04_stage.tasks enable row level security;
alter table dd04_stage.task_events enable row level security;
alter table dd04_stage.approvals enable row level security;
alter table dd04_stage.artifacts enable row level security;
alter table dd04_stage.agent_memories enable row level security;
alter table dd04_stage.capability_versions enable row level security;
revoke all on all tables in schema dd04_stage from public,anon,authenticated;
revoke all on all sequences in schema dd04_stage from public,anon,authenticated;
-- No public/authenticated policies are created, so browser direct access is denied.
-- Backend MUST additionally validate verified CEO auth, membership, G1/G2 hashes,
-- trusted job identities, token rotation, scopes and idempotency on every mutation.
-- Only after review may a migration be run by an authorized staging administrator.
commit;
