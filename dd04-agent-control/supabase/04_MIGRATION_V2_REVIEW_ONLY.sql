-- DD04-A00-007 | MIGRATION V2 | REVIEW ONLY | DO NOT EXECUTE
-- TARGET (ONLY after new explicit CEO approval): wbvkqfnrlasmtizjszab
-- NEVER EXECUTE IN EXISTING PROJECT: ykhrtrvstymfjnzdgzna
-- Not installed in supabase/migrations; isolated review artifact.
-- This draft designs exactly SEVEN tables. No API grants or permissive policies.
-- Postgres 17 / private schema / trusted backend data access only.
--
-- Execution gate (not satisfied):
--  (1) CEO specifically authorizes migration V2 and exact target ref,
--  (2) schema/identity/fail-closed test and rollback plan reviewed,
--  (3) baseline verification and backup/restore plan accepted.
--
-- Caveat: tenant_id is an externally verified STAGING tenant ID.
-- The project deliberately does NOT clone dd_companies/auth.users from the existing DB.
-- Enrollment of tenant + CEO is a separate operation, NOT implemented here.
-- No claims of functional CEO approval until Auth + backend gates are tested.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- A deliberately private schema: do not add to Supabase exposed schemas.
create schema dd04_stage;
revoke all on schema dd04_stage from PUBLIC, anon, authenticated;
alter default privileges in schema dd04_stage
  revoke all on tables from PUBLIC, anon, authenticated;
alter default privileges in schema dd04_stage
  revoke all on sequences from PUBLIC, anon, authenticated;
alter default privileges in schema dd04_stage
  revoke execute on functions from PUBLIC, anon, authenticated;

-- 1/7 COMMANDS: root for all tenant-scoped objects.
create table dd04_stage.commands (
 tenant_id uuid not null,
 command_id text not null check (command_id ~ '^cmd_[0-9a-f]{20}$'),
 source text not null check (length(source) between 1 and 70),
 external_id text not null check (length(external_id) between 4 and 100),
 input_sha256 text not null check (input_sha256 ~ '^[0-9a-f]{64}$'),
 schema_version text not null default '5.3',
 message_text text not null check (length(message_text) between 8 and 2000),
 status text not null default 'WAITING_CEO_PLAN'
  check (status in ('WAITING_CEO_PLAN','READY','IN_PROGRESS','HOLD','DONE','CANCELLED')),
 received_at timestamptz not null,
 created_at timestamptz not null default now(),
 created_by uuid references auth.users(id),
 constraint dd04_commands_pk primary key (tenant_id, command_id),
 constraint dd04_commands_idempotent unique (tenant_id, source, external_id)
);
create index dd04_commands_received_idx on dd04_stage.commands(tenant_id,received_at desc);

-- Until verified CEO G1 orchestration exists, commands stay WAITING_CEO_PLAN.
create function dd04_stage.guard_command_state()
returns trigger language plpgsql security invoker
set search_path=pg_catalog, dd04_stage as $$
begin
 if tg_op='INSERT' then
  if new.status <> 'WAITING_CEO_PLAN' then raise exception 'DD04_COMMAND_G1_REQUIRED'; end if;
 else
  if new.status is distinct from old.status then raise exception 'DD04_COMMAND_TRANSITIONS_NOT_ENABLED'; end if;
  if new.tenant_id is distinct from old.tenant_id
     or new.command_id is distinct from old.command_id
     or new.source is distinct from old.source
     or new.external_id is distinct from old.external_id
     or new.input_sha256 is distinct from old.input_sha256
     or new.message_text is distinct from old.message_text then
     raise exception 'DD04_COMMAND_INPUT_IMMUTABLE';
  end if;
 end if;
 return new;
end;
$$;
create trigger dd04_commands_guard before insert or update on dd04_stage.commands
for each row execute function dd04_stage.guard_command_state();

-- 2/7 TASKS: dependency must belong to same command AND same tenant.
create table dd04_stage.tasks (
 tenant_id uuid not null,
 command_id text not null,
 task_id text not null check (length(task_id) between 4 and 150),
 owner_agent text not null check (owner_agent ~ '^A(0[0-9]|1[0-7])$'),
 dependency_task_id text,
 status text not null default 'PLANNED_WAIT_G1'
  check (status in ('PLANNED_WAIT_G1','READY','IN_PROGRESS','REVIEW',
                    'REWORK','HOLD','DONE','BLOCKED','CANCELLED')),
 revision integer not null default 1 check (revision >= 1),
 quality_score numeric(5,2) check (quality_score >= 0 and quality_score <= 100),
 output_refs jsonb not null default '[]'::jsonb
  check (jsonb_typeof(output_refs)='array'),
 output_sha256 text check (output_sha256 ~ '^[0-9a-f]{64}$'),
 started_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint dd04_tasks_pk primary key (tenant_id, command_id, task_id),
 constraint dd04_tasks_command_fk foreign key (tenant_id,command_id)
  references dd04_stage.commands(tenant_id,command_id),
 constraint dd04_tasks_dependency_fk foreign key (tenant_id,command_id,dependency_task_id)
  references dd04_stage.tasks(tenant_id,command_id,task_id) deferrable initially deferred,
 constraint dd04_tasks_no_self_dep check (dependency_task_id is null or dependency_task_id <> task_id),
 constraint dd04_tasks_done_evidence check (
  status <> 'DONE' or (completed_at is not null and output_sha256 is not null and quality_score is not null)
 )
);
create index dd04_tasks_agent_state_idx on dd04_stage.tasks(tenant_id,owner_agent,status);
create index dd04_tasks_command_idx on dd04_stage.tasks(tenant_id,command_id);

-- Fail closed: G1 identity service is not deployed yet.
-- Therefore task rows can only begin PLANNED_WAIT_G1 and cannot advance.
-- A future migration must introduce atomic, verified transition functions.
create function dd04_stage.guard_task_state()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, dd04_stage as $$
begin
 if tg_op = 'INSERT' then
   if new.status <> 'PLANNED_WAIT_G1' then
     raise exception 'DD04_G1_PENDING_TASK_ONLY';
   end if;
 else
   if new.status is distinct from old.status then
     raise exception 'DD04_TASK_TRANSITIONS_NOT_ENABLED';
   end if;
   if new.tenant_id is distinct from old.tenant_id
      or new.command_id is distinct from old.command_id
      or new.task_id is distinct from old.task_id
      or new.owner_agent is distinct from old.owner_agent then
     raise exception 'DD04_TASK_IDENTITY_IMMUTABLE';
   end if;
 end if;
 return new;
end;
$$;
create trigger dd04_tasks_guard before insert or update on dd04_stage.tasks
for each row execute function dd04_stage.guard_task_state();

-- 3/7 TASK EVENTS: evidence, actor, before/after state.
create table dd04_stage.task_events (
 event_id bigint generated always as identity primary key,
 tenant_id uuid not null,
 command_id text not null,
 task_id text,
 event_name text not null check (length(event_name) between 3 and 80),
 actor_kind text not null check (actor_kind in ('SYSTEM','AGENT','HUMAN','CEO')),
 actor_ref text not null check (length(actor_ref) between 2 and 150),
 from_status text,
 to_status text,
 evidence_sha256 text check(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 details jsonb not null default '{}'::jsonb check(jsonb_typeof(details)='object'),
 occurred_at timestamptz not null default now(),
 constraint dd04_events_command_fk foreign key (tenant_id,command_id)
  references dd04_stage.commands(tenant_id,command_id),
 constraint dd04_events_task_fk foreign key (tenant_id,command_id,task_id)
  references dd04_stage.tasks(tenant_id,command_id,task_id),
 constraint dd04_events_qc_evidence check(
  (to_status is null or to_status not in ('REVIEW','DONE','REWORK','BLOCKED'))
  or evidence_sha256 is not null
 )
);
create index dd04_events_command_time_idx on dd04_stage.task_events(tenant_id,command_id,occurred_at desc,event_id desc);
create index dd04_events_agent_time_idx on dd04_stage.task_events(tenant_id,actor_kind,occurred_at desc);

-- 4/7 APPROVALS: G1/G2 versioned, no approval without verified identity.
-- Do not use operator A00 preview bearer token as CEO identity.
create table dd04_stage.approvals (
 approval_id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 command_id text not null,
 gate text not null check(gate in ('G1','G2')),
 revision integer not null default 1 check(revision >= 1),
 decision text not null default 'PENDING'
  check(decision in ('PENDING','APPROVED','REJECTED','REVOKED')),
 proposal_sha256 text not null check(proposal_sha256 ~ '^[0-9a-f]{64}$'),
 asset_sha256 text check(asset_sha256 ~ '^[0-9a-f]{64}$'),
 target_channels jsonb not null default '[]'::jsonb check(jsonb_typeof(target_channels)='array'),
 publish_schedule jsonb not null default '{}'::jsonb check(jsonb_typeof(publish_schedule)='object'),
 approved_by uuid references auth.users(id),
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 constraint dd04_approvals_command_fk foreign key(tenant_id,command_id)
  references dd04_stage.commands(tenant_id,command_id),
 constraint dd04_approvals_version unique(tenant_id,command_id,gate,revision),
 constraint dd04_approvals_decision_identity check (
   (decision='PENDING' and approved_by is null and decided_at is null)
   or (decision<>'PENDING' and approved_by is not null and decided_at is not null)
 ),
 constraint dd04_approvals_g2_payload check(
   gate <> 'G2' or (asset_sha256 is not null and jsonb_array_length(target_channels)>0
                      and publish_schedule <> '{}'::jsonb)
 )
);
create unique index dd04_approvals_one_active_approved_idx
 on dd04_stage.approvals(tenant_id,command_id,gate)
 where decision='APPROVED';
create index dd04_approvals_pending_idx on dd04_stage.approvals(tenant_id,decision,created_at desc);

-- 5/7 ARTIFACTS: hashes lock content. No actual binary data in table.
create table dd04_stage.artifacts (
 artifact_id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 command_id text not null,
 task_id text not null,
 kind text not null check(length(kind) between 2 and 70),
 version integer not null default 1 check(version >= 1),
 storage_ref text not null check(length(storage_ref) between 3 and 2048),
 sha256 text not null check(sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 constraint dd04_artifacts_task_fk foreign key(tenant_id,command_id,task_id)
  references dd04_stage.tasks(tenant_id,command_id,task_id),
 constraint dd04_artifacts_version unique(tenant_id,command_id,task_id,kind,version)
);
create index dd04_artifacts_command_idx on dd04_stage.artifacts(tenant_id,command_id);

-- 6/7 AGENT MEMORIES: source-backed, explicitly reviewed. Never auto-train.
create table dd04_stage.agent_memories (
 memory_id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 agent_id text not null check (agent_id ~ '^A(0[0-9]|1[0-7])$'),
 command_id text,
 source_task_id text,
 memory_kind text not null check(length(memory_kind) between 3 and 60),
 body text not null check(length(body) between 5 and 12000),
 source_refs jsonb not null default '[]'::jsonb check(jsonb_typeof(source_refs)='array'),
 confidence numeric(4,3) check(confidence between 0 and 1),
 review_status text not null default 'PENDING'
  check(review_status in ('PENDING','VERIFIED','REJECTED','RETIRED')),
 version integer not null default 1 check(version >= 1),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 created_at timestamptz not null default now(),
 constraint dd04_memories_command_fk foreign key(tenant_id,command_id)
  references dd04_stage.commands(tenant_id,command_id),
 constraint dd04_memories_task_fk foreign key(tenant_id,command_id,source_task_id)
  references dd04_stage.tasks(tenant_id,command_id,task_id),
 constraint dd04_memories_source_pair check (source_task_id is null or command_id is not null),
 constraint dd04_memories_review_identity check (
  (review_status='PENDING' and reviewed_by is null and reviewed_at is null)
  or (review_status<>'PENDING' and reviewed_by is not null and reviewed_at is not null)
 )
);
create index dd04_memories_agent_review_idx on dd04_stage.agent_memories(tenant_id,agent_id,review_status,created_at desc);

-- 7/7 CAPABILITY VERSIONS: compare benchmark before CEO-authorized promotion.
create table dd04_stage.capability_versions (
 capability_id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 agent_id text not null check(agent_id ~ '^A(0[0-9]|1[0-7])$'),
 skill_name text not null check(length(skill_name) between 3 and 100),
 version integer not null check(version >= 1),
 baseline_score numeric(5,2) check(baseline_score between 0 and 100),
 benchmark_score numeric(5,2) check(benchmark_score between 0 and 100),
 evidence_refs jsonb not null default '[]'::jsonb check(jsonb_typeof(evidence_refs)='array'),
 status text not null default 'PROPOSED'
  check(status in ('PROPOSED','TESTED','APPROVED','REJECTED','ROLLED_BACK')),
 approved_by uuid references auth.users(id),
 approved_at timestamptz,
 created_at timestamptz not null default now(),
 constraint dd04_capability_versions_unique unique(tenant_id,agent_id,skill_name,version),
 constraint dd04_capability_approval_identity check(
  (status not in ('APPROVED','ROLLED_BACK') and approved_by is null and approved_at is null)
  or (status in ('APPROVED','ROLLED_BACK') and approved_by is not null and approved_at is not null)
 )
);
create index dd04_capability_agent_status_idx on dd04_stage.capability_versions(tenant_id,agent_id,status);

-- Memory and capability promotion are blocked until independent reviewer
-- identity, benchmark and evidence workflows receive separate approval.
create function dd04_stage.guard_memory_review()
returns trigger language plpgsql security invoker
set search_path=pg_catalog, dd04_stage as $$
begin
 if tg_op='INSERT' then
  if new.review_status <> 'PENDING' then
   raise exception 'DD04_MEMORY_REVIEW_NOT_CONFIGURED';
  end if;
 else
  if new.review_status is distinct from old.review_status
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
   raise exception 'DD04_MEMORY_REVIEW_NOT_CONFIGURED';
  end if;
  if new.tenant_id is distinct from old.tenant_id or new.agent_id is distinct from old.agent_id
     or new.body is distinct from old.body or new.source_refs is distinct from old.source_refs then
   raise exception 'DD04_MEMORY_SOURCE_IMMUTABLE';
  end if;
 end if;
 return new;
end;
$$;
create trigger dd04_memories_guard before insert or update on dd04_stage.agent_memories
for each row execute function dd04_stage.guard_memory_review();

create function dd04_stage.guard_capability_review()
returns trigger language plpgsql security invoker
set search_path=pg_catalog, dd04_stage as $$
begin
 if tg_op='INSERT' then
  if new.status <> 'PROPOSED' then raise exception 'DD04_CAPABILITY_APPROVAL_NOT_CONFIGURED'; end if;
 else
  if new.status is distinct from old.status or new.approved_by is distinct from old.approved_by
    or new.approved_at is distinct from old.approved_at then
    raise exception 'DD04_CAPABILITY_APPROVAL_NOT_CONFIGURED';
  end if;
  if new.tenant_id is distinct from old.tenant_id
    or new.agent_id is distinct from old.agent_id or new.skill_name is distinct from old.skill_name
    or new.version is distinct from old.version then
    raise exception 'DD04_CAPABILITY_IDENTITY_IMMUTABLE';
  end if;
 end if;
 return new;
end;
$$;
create trigger dd04_capabilities_guard before insert or update on dd04_stage.capability_versions
for each row execute function dd04_stage.guard_capability_review();

-- Additional database controls: prevent alterations to historical evidence.
-- Trigger functions are SECURITY INVOKER, live only in private schema.
create function dd04_stage.deny_audit_mutation()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, dd04_stage as $$
begin
  raise exception 'DD04_AUDIT_APPEND_ONLY';
end;
$$;
create trigger dd04_task_events_immutable before update or delete on dd04_stage.task_events
for each row execute function dd04_stage.deny_audit_mutation();

create function dd04_stage.prevent_artifact_overwrite()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, dd04_stage as $$
begin
  raise exception 'DD04_ARTIFACT_VERSION_IMMUTABLE';
end;
$$;
create trigger dd04_artifacts_immutable before update or delete on dd04_stage.artifacts
for each row execute function dd04_stage.prevent_artifact_overwrite();

-- Approvals must stay pending until external CEO identity service exists.
-- At this stage, even a trusted backend cannot flip PENDING -> APPROVED directly.
-- A future, separately reviewed migration may implement an authenticated
-- approval RPC validating a Supabase Auth identity + tenant role + G1/G2 hashes.
create function dd04_stage.deny_approval_decision()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, dd04_stage as $$
begin
 if new.decision is distinct from old.decision
    or new.approved_by is distinct from old.approved_by
    or new.decided_at is distinct from old.decided_at then
    raise exception 'DD04_CEO_AUTH_APPROVAL_NOT_CONFIGURED';
 end if;
 -- Freeze snapshot integrity (even if still pending).
 if new.tenant_id is distinct from old.tenant_id
    or new.command_id is distinct from old.command_id
    or new.gate is distinct from old.gate
    or new.revision is distinct from old.revision
    or new.proposal_sha256 is distinct from old.proposal_sha256
    or new.asset_sha256 is distinct from old.asset_sha256
    or new.target_channels is distinct from old.target_channels
    or new.publish_schedule is distinct from old.publish_schedule then
    raise exception 'DD04_APPROVAL_SNAPSHOT_IMMUTABLE';
 end if;
 return new;
end;
$$;
create trigger dd04_approval_guard before update on dd04_stage.approvals
for each row execute function dd04_stage.deny_approval_decision();

-- Pending approval snapshots may not be deleted.
create trigger dd04_approval_no_delete before delete on dd04_stage.approvals
for each row execute function dd04_stage.deny_audit_mutation();

-- Block any attempt to insert decisions pre-approved without identity.
create function dd04_stage.only_pending_approval_insert()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, dd04_stage as $$
begin
 if new.decision <> 'PENDING' or new.approved_by is not null or new.decided_at is not null then
   raise exception 'DD04_APPROVAL_MUST_BEGIN_PENDING';
 end if;
 return new;
end;
$$;
create trigger dd04_approval_insert_guard before insert on dd04_stage.approvals
for each row execute function dd04_stage.only_pending_approval_insert();

-- Strict private-schema permissions and defense in depth.
alter table dd04_stage.commands enable row level security;
alter table dd04_stage.tasks enable row level security;
alter table dd04_stage.task_events enable row level security;
alter table dd04_stage.approvals enable row level security;
alter table dd04_stage.artifacts enable row level security;
alter table dd04_stage.agent_memories enable row level security;
alter table dd04_stage.capability_versions enable row level security;
revoke all on all tables in schema dd04_stage from PUBLIC,anon,authenticated;
revoke all on all sequences in schema dd04_stage from PUBLIC,anon,authenticated;
revoke execute on all functions in schema dd04_stage from PUBLIC,anon,authenticated;

-- Explicitly no data copied, no automatic tenant bootstrap, no API grants.
-- No SECURITY DEFINER functions, no permissive policies.
-- Backend adapter and formal CEO approval RPC require another review.
commit;
