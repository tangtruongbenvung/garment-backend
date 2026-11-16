import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../dd04-agent-control/supabase/27_A00_022_INTEGRATED_G1_A11_STAGING_REVIEW_ONLY_DO_NOT_RUN.sql',import.meta.url),'utf8');
const count=r=>(s.match(r)||[]).length;
test('one atomic staging-only SQL migration candidate, zero accidental duplication',()=>{
 assert.equal(count(/^BEGIN;$/gm),1);
 assert.equal(count(/^COMMIT;$/gm),1);
 assert.equal(count(/^CREATE TABLE dd04_stage\.a00_022_/gm),5);
 assert.equal(count(/^CREATE FUNCTION dd04_stage\.a00_022_reserve_finance\(/gm),1);
 assert.equal(count(/^CREATE FUNCTION dd04_stage\.a00_022_commit_g1\(/gm),1);
});
test('actual authenticated CEO AAL2 activation is required',()=>{
 for(const value of ["auth.uid()","auth.jwt()->>'aal'<>'aal2'","ceo_enrollments",
 'verified_by_admin=true','a00_022_one_active_policy_per_tenant','authorized_ceo_id=ceo']){
  assert.ok(s.includes(value),value);
 }
 assert.doesNotMatch(s,/GRANT EXECUTE ON FUNCTION dd04_stage\.a00_022_ceo_policy_decision\([^)]*\)\s+TO dd04_a00_runtime/i);
});
test('A11 budget cap uses locked campaign lifetime sum across policy versions',()=>{
 for(const value of ['A11_SERIALIZABLE_REQUIRED','pg_advisory_xact_lock',
  "p_tenant::text||':'||p_campaign","current_sum + p_amount>policy.max_campaign_spend_vnd",
  "campaign_id=p_campaign AND state='RESERVED'","A11_CEO_FINANCE_EXCEPTION_REQUIRED",
  'a00_022_queue_finance_exception']){
  assert.ok(s.includes(value),value);
 }
 assert.ok(!s.includes('WHERE tenant_id=p_tenant AND period_key=p_period'));
 assert.ok(s.includes("p_period<>to_char((now() AT TIME ZONE 'Asia/Bangkok'),'YYYY-MM')"));
});
test('legacy G1 remains immutable, private transition recognizes audited internal G1',()=>{
 assert.ok(s.includes("dd04_stage.a00_022_effective_g1(NEW.tenant_id,NEW.command_id)"));
 assert.ok(s.includes("IF legacy_status NOT IN ('PLANNED_WAIT_G1'"));
 assert.ok(s.includes('DROP POLICY a00_rt_context_update'));
 assert.ok(s.includes('DROP POLICY a00_rt_context_insert'));
 assert.ok(s.includes('a00_022_review_manifest'));
 assert.ok(s.includes('G1_MANIFEST_HASH_MISMATCH'));
 for(const forbidden of ['ALTER TABLE dd04_stage.approvals DISABLE',
  'DROP TRIGGER dd04_tasks_guard','DROP TRIGGER dd04_approval_guard',
  'UPDATE dd04_stage.approvals SET','GRANT INSERT ON dd04_stage.approvals',
  'GRANT INSERT ON dd04_stage.v55_publish_jobs']){
  assert.ok(!s.includes(forbidden),forbidden);
 }
});
test('stage handoff avoids dual-QC deadlock and publication remains gated',()=>{
 assert.ok(s.includes("WHEN 'A03' THEN 'A04'"));
 assert.ok(s.includes("WHEN 'A04' THEN 'A05'"));
 assert.ok(s.includes("WHEN 'A05' THEN 'A08'"));
 assert.ok(s.includes("WHEN 'A08' THEN 'A09'"));
 assert.ok(s.includes("owner='A05'"));
 assert.ok(s.includes("A00_STAGE_REVIEW_REQUIRED"));
 assert.ok(s.includes('FROM PUBLIC,anon,authenticated,service_role'));
});
