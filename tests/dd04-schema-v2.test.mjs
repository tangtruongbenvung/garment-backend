import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ddl=readFileSync(new URL('../dd04-agent-control/supabase/04_MIGRATION_V2_REVIEW_ONLY.sql',import.meta.url),'utf8');
const expected=['commands','tasks','task_events','approvals','artifacts','agent_memories','capability_versions'];

test('Migration V2 remains outside executable migration directory and targets isolated project only',()=>{
 assert.match(ddl,/MIGRATION V2 \| REVIEW ONLY \| DO NOT EXECUTE/);
 assert.match(ddl,/wbvkqfnrlasmtizjszab/);
 assert.match(ddl,/NEVER EXECUTE IN EXISTING PROJECT: ykhrtrvstymfjnzdgzna/);
 assert.match(ddl,/^begin;/m);
 assert.match(ddl,/^commit;/m);
});

test('Exactly seven DD04 private-schema tables, each with RLS and deny privileges',()=>{
 const actual=[...ddl.matchAll(/create table dd04_stage\.([a-z_]+)\s*\(/g)].map(x=>x[1]);
 assert.deepEqual(actual,expected);
 assert.match(ddl,/create schema dd04_stage;/);
 assert.match(ddl,/revoke all on schema dd04_stage from PUBLIC, anon, authenticated;/);
 for(const table of expected) assert.match(ddl,new RegExp('alter table dd04_stage\\.'+table+' enable row level security;'));
 assert.match(ddl,/revoke all on all tables in schema dd04_stage from PUBLIC,anon,authenticated;/);
 assert.doesNotMatch(ddl,/create policy\b/i);
 assert.doesNotMatch(ddl,/grant\s+(all|select|insert|update|delete|usage)\b/i);
});

test('Tenant scoping, unique idempotency and cross-tenant FKs present',()=>{
 assert.match(ddl,/dd04_commands_idempotent unique \(tenant_id, source, external_id\)/);
 assert.match(ddl,/primary key \(tenant_id, command_id\)/);
 assert.match(ddl,/foreign key \(tenant_id,command_id,dependency_task_id\)/);
 assert.match(ddl,/foreign key\(tenant_id,command_id,task_id\)/);
 assert.match(ddl,/unique\(tenant_id,command_id,task_id,kind,version\)/);
 assert.match(ddl,/foreign key\(tenant_id,command_id\)/);
});

test('No auto approval or task execution before identity service',()=>{
 assert.match(ddl,/create trigger dd04_tasks_guard before insert or update/);
 assert.match(ddl,/DD04_G1_PENDING_TASK_ONLY/);
 assert.match(ddl,/DD04_COMMAND_G1_REQUIRED/);
 assert.match(ddl,/DD04_COMMAND_TRANSITIONS_NOT_ENABLED/);
 assert.match(ddl,/DD04_MEMORY_REVIEW_NOT_CONFIGURED/);
 assert.match(ddl,/DD04_CAPABILITY_APPROVAL_NOT_CONFIGURED/);
 assert.match(ddl,/DD04_TASK_TRANSITIONS_NOT_ENABLED/);
 assert.match(ddl,/create trigger dd04_approval_guard before update/);
 assert.match(ddl,/create trigger dd04_approval_insert_guard before insert/);
 assert.match(ddl,/create trigger dd04_approval_no_delete before delete/);
 assert.match(ddl,/DD04_CEO_AUTH_APPROVAL_NOT_CONFIGURED/);
 assert.match(ddl,/where decision='APPROVED'/);
});

test('Audit and artifacts are append only under normal database DML',()=>{
 assert.match(ddl,/create trigger dd04_task_events_immutable before update or delete/);
 assert.match(ddl,/create trigger dd04_artifacts_immutable before update or delete/);
 assert.match(ddl,/DD04_AUDIT_APPEND_ONLY/);
 assert.match(ddl,/DD04_ARTIFACT_VERSION_IMMUTABLE/);
 assert.doesNotMatch(ddl,/language\s+plpgsql\s+security\s+definer/i);
});

test('G2 artifacts and review metadata require evidence',()=>{
 assert.match(ddl,/dd04_approvals_g2_payload check/);
 assert.match(ddl,/jsonb_array_length\(target_channels\)>0/);
 assert.match(ddl,/dd04_tasks_done_evidence check/);
 assert.match(ddl,/dd04_events_qc_evidence check/);
 assert.match(ddl,/review_status in \('PENDING','VERIFIED','REJECTED','RETIRED'\)/);
});
