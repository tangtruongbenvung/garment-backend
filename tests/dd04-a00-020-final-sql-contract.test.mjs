import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const filename=new URL('../dd04-agent-control/supabase/24_A00_020_FINAL_CANDIDATE_STAGING_ONLY_DO_NOT_RUN.sql',import.meta.url);
const s=readFileSync(filename,'utf8');
const sha=createHash('sha256').update(s).digest('hex');
console.log('DD04_A00_020_FINAL_SQL_SHA256='+sha);
const count=(pattern)=>(s.match(pattern)||[]).length;
test('one complete atomic transaction, four unique new tables, no corrupted duplicated statements',()=>{
 assert.match(s,/\bBEGIN;[\s\S]*COMMIT;\s*$/);
 assert.equal(count(/^BEGIN;/gm),1);assert.equal(count(/^COMMIT;/gm),1);
 for(const t of ['a00_worker_identities','a00_workflow_instances','a00_task_contexts','a00_transition_events'])
  assert.equal(count(new RegExp('^CREATE TABLE dd04_stage\\.'+t+' \\(','gm')),1,t);
});
test('runtime DB role has no login and no RLS bypass',()=>{
 assert.match(s,/CREATE ROLE dd04_a00_runtime NOLOGIN NOBYPASSRLS/);
 assert.match(s,/AND \(rolcanlogin OR rolbypassrls OR rolsuper\)/);
 assert.match(s,/GRANT USAGE ON SCHEMA dd04_stage TO dd04_a00_runtime/);
 assert.doesNotMatch(s,/GRANT ALL\s+ON\s+ALL TABLES/i);
});
test('all four new tables enable RLS, and public, anon and authenticated have no direct grants',()=>{
 for(const t of ['a00_worker_identities','a00_workflow_instances','a00_task_contexts','a00_transition_events'])
  assert.match(s,new RegExp('ALTER TABLE dd04_stage\\.'+t+' ENABLE ROW LEVEL SECURITY;'));
 assert.match(s,/FROM PUBLIC,anon,authenticated,service_role/);
});
test('no unscoped public policies and no release to A07 or production',()=>{
 assert.doesNotMatch(s,/TO\s+PUBLIC\s+USING\s*\(true\)/i);
 assert.doesNotMatch(s,/GRANT\s+.+\s+TO\s+anon\b/i);
 assert.doesNotMatch(s,/UPDATE\s+dd04_stage\.approvals\s+SET/i);
 assert.doesNotMatch(s,/ALTER\s+TABLE\s+dd04_stage\.tasks\s+DISABLE\s+TRIGGER/i);
 assert.doesNotMatch(s,/dd04_stage\.v55_publish_jobs\s+FOR INSERT/i);
});
test('credential verification, tenant restriction and append-only audit in SQL',()=>{
 assert.match(s,/pg_catalog\.sha256\(pg_catalog\.convert_to/);
 assert.match(s,/p_action=ANY\(w\.allowed_actions\)/);
 assert.match(s,/w\.tenant_id=p_tenant/);
 assert.match(s,/a00_transition_events_immutable/);
 assert.match(s,/dd04_stage\.deny_audit_mutation\(\)/);
 assert.match(s,/UNIQUE\(tenant_id,idempotency_key\)/);
});
test('candidate does not create worker secret, enable workers or change G1/G2',()=>{
 assert.doesNotMatch(s,/INSERT INTO dd04_stage\.a00_worker_identities/i);
 assert.doesNotMatch(s,/UPDATE dd04_stage\.approvals/i);
 assert.doesNotMatch(s,/INSERT INTO dd04_stage\.v55_publish_jobs/i);
});

test('database guards block un-audited direct state changes and forged handoff',()=>{
 for(const rule of ['A00_ATOMIC_AUDIT_REQUIRED','A00_CANONICAL_G1_LOCKED',
   'A00_SELF_APPROVAL_DENIED','A00_DUAL_QC_MISSING',
   'A00_QC_REPORT_NOT_VERIFIED','A00_REVIEW_REPORT_NOT_REGISTERED',
   'A00_HANDOFF_UNVERIFIED','A00_SUBJECT_SPOOF','A00_OUTPUT_ATTACH_NOT_REGISTERED'])
    assert.ok(s.includes(rule),rule);
 assert.match(s,/CREATE TRIGGER a00_context_transition_guard/);
 assert.match(s,/CREATE TRIGGER a00_transition_event_guard/);
 assert.match(s,/CREATE TRIGGER a00_v55_handoff_insert_guard/);
});
test('workflow modifications stay least privilege and publishing is blocked',()=>{
 assert.match(s,/GRANT SELECT,INSERT ON dd04_stage\.a00_workflow_instances TO dd04_a00_runtime;/);
 assert.doesNotMatch(s,/GRANT SELECT,INSERT,UPDATE ON dd04_stage\.a00_workflow_instances/i);
 assert.doesNotMatch(s,/GRANT .* ON dd04_stage\.v55_publish_jobs/i);
});

test('runtime transaction code changes to least-privilege role and binds worker secret locally',()=>{
 for(const path of ['a00-020-save-task-plan.mjs','a00-020-atomic-ledger-repository.mjs',
  'a00-020-attach-artifact.mjs']){
  const code=readFileSync(new URL('../dd04-agent-control/'+path,import.meta.url),'utf8');
  assert.match(code,/SET LOCAL ROLE dd04_a00_runtime/);
  assert.match(code,/set_config\('dd04.worker_credential',\$1,true\)/);
 }
});
test('root-task grant is constrained to current tenant and existing G1 evidence',()=>{
 assert.match(s,/t\.tenant_id=a00_task_contexts\.tenant_id/);
 assert.match(s,/a\.tenant_id=a00_task_contexts\.tenant_id/);
 assert.match(s,/a\.decision='APPROVED'/);
 assert.match(s,/state='READY' AND cardinality\(dependency_task_ids\)=0/);
});
