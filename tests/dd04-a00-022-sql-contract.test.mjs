import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../dd04-agent-control/supabase/26_A00_022_DELEGATED_G1_FINANCE_REVIEW_ONLY_DO_NOT_RUN.sql',import.meta.url),'utf8');
const count=pattern=>(sql.match(pattern)||[]).length;
test('SQL A00-022 review is atomic candidate, five proposed tables, RLS enabled',()=>{
 assert.equal(count(/^BEGIN;$/gm),1);
 assert.equal(count(/^COMMIT;$/gm),1);
 for(const table of ['a00_022_delegation_policies','a00_022_review_events',
   'a00_022_finance_reservations','a00_022_internal_g1_events','a00_022_ceo_finance_queue']){
  assert.equal(count(new RegExp('^CREATE TABLE dd04_stage\\.'+table+' \\(','gm')),1,table);
  assert.ok(sql.includes('ALTER TABLE dd04_stage.'+table+' ENABLE ROW LEVEL SECURITY;'),table);
 }
});
test('SQL A00-022 does not bypass existing canonical G1/G2 or publishing',()=>{
 for(const forbidden of ['DISABLE TRIGGER','DROP TRIGGER','UPDATE dd04_stage.approvals',
 'INSERT INTO dd04_stage.v55_publish_jobs','GRANT INSERT ON dd04_stage.approvals',
 'CREATE POLICY a00_022_rt_approval','ALTER TABLE dd04_stage.tasks DISABLE'])
  assert.ok(!sql.includes(forbidden),forbidden);
});
test('SQL A00-022 has no runtime grants and denies direct activation',()=>{
 assert.match(sql,/FROM PUBLIC,anon,authenticated,service_role,dd04_a00_runtime/);
 assert.match(sql,/CEO_DELEGATION_POLICY_ACTIVATION_NOT_CONFIGURED/);
 assert.match(sql,/INTERNAL_G1_COMMIT_NOT_CONFIGURED/);
 assert.match(sql,/A11_FINANCE_RESERVATION_PROCEDURE_NOT_CONFIGURED/);
});
test('staging finance limit, queue and independent reports have immutable/audited model',()=>{
 for(const needed of ['max_single_spend_vnd','max_campaign_spend_vnd','period_key',
 'campaign_id','actor_subject_id','review_manifest_sha256','policy_sha256',
 'A00','A02','A09','A11','WAITING_CEO']){
  assert.ok(sql.includes(needed),needed);
 }
 assert.match(sql,/a00_022_review_events_immutable/);
 assert.match(sql,/a00_022_ceo_finance_immutable/);
});
