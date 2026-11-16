import test from 'node:test';
import assert from 'node:assert/strict';
import {planAutoReview,finalPublishReview,reviewBatchForCeo,APPROVAL_AUTHORITY} from '../dd04-agent-control/agent-auto-approval-policy.mjs';
const sha='a'.repeat(64),asset='b'.repeat(64),tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const plan={source:'SERVER_VERSIONED_PLAN',sha256:sha,revision:1,scope_text:'Hoạt hình hài mẹ bé hư cấu',channel_ids:['FB001','TT001'],budget_vnd:100000};
const policy={source:'CEO_CONFIGURED_POLICY',active:true,budget_limit_vnd:200000};
const agent_status={A00:'PASS',A02:'PASS',A08:'PASS',A09:'PASS',A11:'PASS'};
const checks={source:'SERVER_AGENT_AUDIT',plan_sha256:sha,revision:1,agent_status,channel_profiles_verified:true,n_channels_n_unique_scripts:true};
const packet={source:'SERVER_FINAL_PACKET',tenant_id:tenant,package_sha256:sha,revision:1,
 channel_ids:['FB001'],asset_sha256s:[asset],schedule:{FB001:'2026-11-17T09:00:00+07:00'}};
const finalChecks={source:'SERVER_AGENT_AUDIT',package_sha256:sha,revision:1,
 g1_auto_verified:true,agent_status:{A08:'PASS',A09:'PASS'},
 channel_schedule_immutable:true,asset_manifest_immutable:true};
const ceo={server_verified:true,role:'CEO',aal:'aal2',enrollment_status:'ACTIVE',tenant_id:tenant};
test('G1 is auto agent checkpoint, never human approval or publish permission',()=>{
 assert.equal(APPROVAL_AUTHORITY.G1,'AUTO_AGENT_CHECKPOINT');
 assert.equal(APPROVAL_AUTHORITY.G2,'CEO_FINAL_PUBLISH_AUTHORIZATION');
 const r=planAutoReview({plan,checks,policy});
 assert.equal(r.ok,true);assert.equal(r.executable,false);assert.equal(r.publish_allowed,false);
 assert.equal(r.stage,'G1');
});
test('G1 fails closed for missing limits, over-budget, unverified source, audit mismatches and failing reviewer',()=>{
 assert.equal(planAutoReview({plan,checks}).reason,'APPROVED_INTERNAL_POLICY_REQUIRED');
 assert.equal(planAutoReview({plan,checks,policy:{...policy,budget_limit_vnd:1}}).reason,'BUDGET_OUTSIDE_DELEGATED_LIMIT');
 assert.equal(planAutoReview({plan:{...plan,source:'BROWSER'},checks,policy}).ok,false);
 assert.equal(planAutoReview({plan,checks:{...checks,plan_sha256:asset},policy}).ok,false);
 assert.equal(planAutoReview({plan,checks:{...checks,agent_status:{...agent_status,A09:'FAIL'}},policy}).reason,'AGENT_A09_CHECK_REQUIRED');
 assert.equal(planAutoReview({plan,checks:{...checks,n_channels_n_unique_scripts:false},policy}).ok,false);
});
test('G2 requires CEO aal2 and server evidence even after all AI passes',()=>{
 assert.equal(finalPublishReview({packet,checks:finalChecks,ceo:{...ceo,aal:'aal1'}}).reason,'CEO_AAL2_FINAL_APPROVAL_REQUIRED');
 assert.equal(finalPublishReview({packet,checks:finalChecks,ceo:{...ceo,role:'A00'}}).ok,false);
 assert.equal(finalPublishReview({packet,checks:finalChecks,ceo:{...ceo,tenant_id:'other'}}).ok,false);
 assert.equal(finalPublishReview({packet,checks:{...finalChecks,g1_auto_verified:false},ceo}).reason,'G1_AUTO_CHECKPOINT_REQUIRED');
 assert.equal(finalPublishReview({packet,checks:{...finalChecks,agent_status:{A08:'PASS',A09:'HOLD'}},ceo}).reason,'AGENT_A09_FINAL_QC_REQUIRED');
 assert.equal(finalPublishReview({packet,checks:{...finalChecks,package_sha256:asset},ceo}).ok,false);
 const result=finalPublishReview({packet,checks:finalChecks,ceo});
 assert.equal(result.ok,true);assert.equal(result.executable,false);assert.equal(result.publish_allowed,false);
});
test('Batch CEO review gives one preview for many channels but NEVER posting approval',()=>{
 const item={content_id:'BIN-001',channel_id:'FB001',package_sha256:sha,revision:1,
  scheduled_at:'2026-11-17T09:00:00+07:00'};
 const ok=reviewBatchForCeo([item,{...item,channel_id:'TT001'}]);
 assert.equal(ok.ok,true);assert.equal(ok.batch_count,2);
 assert.equal(ok.publish_allowed,false);assert.equal(ok.executable,false);
 assert.equal(reviewBatchForCeo([item,item]).ok,false);
 assert.equal(reviewBatchForCeo([{...item,package_sha256:'bad'}]).ok,false);
 assert.equal(reviewBatchForCeo([]).ok,false);
});
