import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewCeoGate} from '../dd04-agent-control/ceo-gate-review-core.mjs';
const tenantId='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const user='b11f7154-5f5d-4b55-a497-90e8adf2525e';
const approvalId='be8c9e62-fe68-448a-8822-bffbbb96f937';
const token=aal=>{
 const payload={iss:'https://wbvkqfnrlasmtizjszab.supabase.co/auth/v1',
  sub:user,role:'authenticated',aal,exp:Math.floor(Date.now()/1000)+5000,
  session_id:'c383719b-2a19-4147-9086-8d1fad42779b'};
 return Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+'s'.repeat(80);
};
const fetchImpl=async()=>({ok:true,json:async()=>({id:user,email_confirmed_at:'2026-11-14T13:56:09.920825Z',is_anonymous:false})});
const approval={approval_id:approvalId,tenant_id:tenantId,command_id:'cmd_91c7ce5ec8760df9fa0f',
 gate:'G1',revision:1,decision:'PENDING',proposal_sha256:'a'.repeat(64),
 approved_by:null,decided_at:null,target_channels:[],publish_schedule:{}};
const lookup=async()=>({session_verified:true,enrollment_valid:true,approval,
 command:{tenant_id:tenantId,command_id:approval.command_id,status:'WAITING_CEO_PLAN',input_sha256:'a'.repeat(64)}});
const common={tenantId,publishableKey:'sb_publishable_demo',approvalId,fetchImpl,dbLookup:lookup};
test('MFA aal1 cannot read pending approval even when CEO enrollment is active',async()=>{
 const r=await reviewCeoGate({...common,token:token('aal1')});
 assert.equal(r.httpStatus,403);assert.equal(r.body.error,'MFA_AAL2_REQUIRED');
});
test('Correct JWT MFA2, CEO enrollment, and matching G1 produces review-only missing-evidence blockers',async()=>{
 const r=await reviewCeoGate({...common,token:token('aal2')});
 assert.equal(r.httpStatus,200);assert.equal(r.body.approval.gate,'G1');
 assert.equal(r.body.approval.decision,'PENDING');assert.equal(r.body.decision_enabled,false);
 assert.ok(r.body.missing.includes('G1_PLAN_SCOPE_BUDGET_EVIDENCE_REQUIRED'));
 assert.ok(r.body.missing.includes('G1_G2_TRANSACTION_NOT_MIGRATED'));
});
test('MFA session mismatch and missing CEO enrollment fail closed',async()=>{
 const result=await reviewCeoGate({...common,token:token('aal2'),dbLookup:async()=>({session_verified:false,enrollment_valid:true})});
 assert.equal(result.httpStatus,401);
 const missing=await reviewCeoGate({...common,token:token('aal2'),dbLookup:async()=>({session_verified:true,enrollment_valid:false})});
 assert.equal(missing.body.error,'CEO_ENROLLMENT_INACTIVE');
});
test('G2 never reports ready without real G1/asset/QC evidence',async()=>{
 const g2={...approval,gate:'G2',asset_sha256:'b'.repeat(64)};
 const r=await reviewCeoGate({...common,token:token('aal2'),dbLookup:async()=>({
  session_verified:true,enrollment_valid:true,approval:g2,
  command:{tenant_id:tenantId,command_id:approval.command_id,status:'HOLD',input_sha256:'a'.repeat(64)}
 })});
 assert.ok(r.body.missing.includes('G2_G1_APPROVAL_REQUIRED'));
 assert.ok(r.body.missing.includes('G2_A08_A09_QC_EVIDENCE_REQUIRED'));
 assert.equal(r.body.publishing_allowed,false);
});
test('Netlify API is read-only and CEO login includes secure review button',()=>{
 const fn=readFileSync(new URL('../netlify/functions/dd04-ceo-gate-review.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../dd04-agent-control/ceo-login.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../dd04-agent-control/ceo-login.js',import.meta.url),'utf8');
 assert.match(fn,/BEGIN READ ONLY/);
 assert.match(fn,/isStagingPreviewUrl\(request.url\)/);
 assert.match(fn,/FROM auth\.sessions/);
 assert.match(fn,/dd04_stage\.ceo_enrollments/);
 assert.match(fn,/decision_enabled:false/);
 assert.doesNotMatch(fn,/INSERT INTO|UPDATE dd04_stage|DELETE FROM dd04_stage|CREATE POLICY/);
 assert.match(html,/id="gateReviewBtn"/);
 assert.match(js,/fetch\("\/api\/dd04-ceo-gate-review"/);
});
