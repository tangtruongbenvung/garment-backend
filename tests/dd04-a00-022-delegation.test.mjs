import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateA0022InternalG1,evaluateA0022Handoff} from '../dd04-agent-control/a00-022-delegated-transaction-preflight.mjs';
const tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const command='cmd_1234567890abcdef1234';
const packet='a'.repeat(64),policy='b'.repeat(64);
const reviewers=['A00','A02','A09','A11'];
const actors=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
'33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
function g1(){
 return {provenance:'DB_SERIALIZABLE_READ',environment:'STAGING',tenant_id:tenant,
 command_id:command,packet_sha256:packet,legacy_g1_decision:'PENDING',
 epoch_ms:1781500000000,ceo_final_g2_decision:'PENDING',
 finance_policy:{source:'DB_ACTIVE_CEO_FINANCE_POLICY',tenant_id:tenant,status:'ACTIVE',
  version:1,policy_sha256:policy,max_single_spend_vnd:100000,max_campaign_spend_vnd:300000},
 finance_ledger:{source:'DB_LOCKED_FINANCE_LEDGER',tenant_id:tenant,
  command_id:command,policy_sha256:policy,packet_sha256:packet,
  requested_vnd:10000,campaign_committed_vnd:120000},
 checks:reviewers.map((a,i)=>({source:'DB_AUTHENTICATED_IMMUTABLE_EVENT',
  agent_id:a,actor_subject_id:actors[i],tenant_id:tenant,command_id:command,
  packet_sha256:packet,evidence_sha256:(i+1).toString(16).repeat(64),
  verdict:'PASS',expires_at:1781500060000}))};
}
test('G1 preflight eligible is never an authorization to execute, spend or publish',()=>{
 const res=evaluateA0022InternalG1(g1());
 assert.equal(res.ok,true);assert.equal(res.internal_g1_candidate,true);
 assert.equal(res.executable,false);assert.equal(res.spend_allowed,false);
 assert.equal(res.publish_allowed,false);
});
test('no policy, no locked A11 ledger or over budget fail closed',()=>{
 const noPolicy=g1();noPolicy.finance_policy=null;
 assert.equal(evaluateA0022InternalG1(noPolicy).reason,'A11_ACTIVE_FINANCE_POLICY_REQUIRED');
 const noLedger=g1();noLedger.finance_ledger=null;
 assert.equal(evaluateA0022InternalG1(noLedger).reason,'A11_SERIALIZABLE_FINANCE_RESERVATION_REQUIRED');
 const overspend=g1();overspend.finance_ledger.requested_vnd=100001;
 assert.equal(evaluateA0022InternalG1(overspend).reason,'CEO_FINANCE_EXCEPTION_REQUIRED');
 assert.equal(evaluateA0022InternalG1(overspend).requires_ceo_finance,true);
 const split=g1();split.finance_ledger.campaign_committed_vnd=299999;
 assert.equal(evaluateA0022InternalG1(split).reason,'CEO_FINANCE_EXCEPTION_REQUIRED');
});
test('no independent actor, expired evidence, forged source or unexpected G1 cannot pass',()=>{
 const duplicate=g1();duplicate.checks[3].actor_subject_id=duplicate.checks[0].actor_subject_id;
 assert.equal(evaluateA0022InternalG1(duplicate).reason,'DISTINCT_REVIEWER_SUBJECTS_REQUIRED');
 const expired=g1();expired.checks[0].expires_at=expired.epoch_ms;
 assert.equal(evaluateA0022InternalG1(expired).reason,'INDEPENDENT_A00_REVIEW_REQUIRED');
 const forged=g1();forged.checks[2].source='HTTP_JSON_CLIENT_CLAIM';
 assert.equal(evaluateA0022InternalG1(forged).reason,'INDEPENDENT_A09_REVIEW_REQUIRED');
 const changed=g1();changed.legacy_g1_decision='APPROVED';
 assert.equal(evaluateA0022InternalG1(changed).reason,'CANONICAL_G1_STATE_UNEXPECTED');
 assert.equal(evaluateA0022InternalG1({}).reason,'TRUSTED_DB_SNAPSHOT_REQUIRED');
});
const task=(agent,state)=>({tenant_id:tenant,command_id:command,owner_agent:agent,
 task_id:command+'_'+agent,revision:1,state,output_sha256:'e'.repeat(64)});
function handoff(){
 return {source_task:task('A03','APPROVED_INTERNAL'),destination_task:task('A04','BLOCKED'),
  context:{provenance:'DB_SERIALIZABLE_READ',environment:'STAGING',tenant_id:tenant,
   command_id:command,g1_authority:'DB_VERIFIED_APPROVED_INTERNAL',
   finance_clearance:'DB_A11_RESERVED_OR_ZERO_COST',
   storage_verified_output_sha256:'e'.repeat(64),a08_qc:true,a09_qc:true,
   qc_actor_subject_ids:[actors[0],actors[1]]}};
}
test('A03 to A04 can only become atomic DB handoff candidate',()=>{
 const result=evaluateA0022Handoff(handoff());
 assert.equal(result.ok,true);assert.equal(result.to_agent,'A04');
 assert.equal(result.executable,false);assert.equal(result.publish_allowed,false);
});
test('handoff blocks missing G1/A11, wrong order, unverified media and fake QC',()=>{
 const x=handoff();x.context.g1_authority='PENDING';
 assert.equal(evaluateA0022Handoff(x).reason,'INTERNAL_G1_A11_NOT_VERIFIED');
 const y=handoff();y.destination_task.owner_agent='A05';
 assert.equal(evaluateA0022Handoff(y).reason,'HANDOFF_ORDER_DENIED');
 const z=handoff();z.context.storage_verified_output_sha256='f'.repeat(64);
 assert.equal(evaluateA0022Handoff(z).reason,'OUTPUT_BYTES_NOT_VERIFIED');
 const qc=handoff();qc.context.qc_actor_subject_ids=[actors[0],actors[0]];
 assert.equal(evaluateA0022Handoff(qc).reason,'A08_A09_INDEPENDENT_QC_REQUIRED');
 const cross=handoff();cross.destination_task.tenant_id='11111111-1111-4111-8111-111111111111';
 assert.equal(evaluateA0022Handoff(cross).reason,'TASK_SCOPE_MISMATCH');
});
