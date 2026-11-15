import test from 'node:test';
import assert from 'node:assert/strict';
import {delegatedGatePreflight} from '../dd04-agent-control/a00-delegated-gates.mjs';
const h='a'.repeat(64),b='b'.repeat(64);
const policy={source:'SERVER_VERIFIED_DELEGATION',active:true,allow_internal_gates:true,policy_sha256:h,tenant_id:'tenant_staging'};
const packet=()=>({source:'SERVER_VERSIONED_PACKET',tenant_id:'tenant_staging',command_id:'cmd_one',sha256:h,revision:1,channel_ids:['FB001']});
const finance=()=>({source:'SERVER_A11_FINANCE_DECISION',tenant_id:'tenant_staging',command_id:'cmd_one',packet_sha256:h,revision:1,decision:'WITHIN_DELEGATED_LIMIT'});
const checks=(gate)=> (gate==='G1'?['A00','A02','A11','A09']:['A06','A08','A09','A07']).map((agent,i)=>({source:'SERVER_INDEPENDENT_AGENT_AUDIT',agent,actor_id:'agent_worker_'+String(i),tenant_id:'tenant_staging',command_id:'cmd_one',packet_sha256:h,revision:1,decision:'PASS'}));
test('G1 delegated eligibility never becomes executable approval',()=>{
 const r=delegatedGatePreflight({gate:'G1',packet:packet(),policy,checks:checks('G1'),finance:finance()});
 assert.equal(r.ok,true);assert.equal(r.publish_allowed,false);assert.equal(r.executable,false);
});
test('G1 rejects self/shared actors, stale hashes and forged finance',()=>{
 const cs=checks('G1');cs[1].actor_id=cs[0].actor_id;
 assert.equal(delegatedGatePreflight({gate:'G1',packet:packet(),policy,checks:cs,finance:finance()}).reason,'INDEPENDENT_ACTORS_REQUIRED');
 const c=checks('G1');c[0].packet_sha256=b;
 assert.equal(delegatedGatePreflight({gate:'G1',packet:packet(),policy,checks:c,finance:finance()}).reason,'INDEPENDENT_A00_CHECK_REQUIRED');
 assert.equal(delegatedGatePreflight({gate:'G1',packet:packet(),policy,checks:checks('G1'),finance:{...finance(),decision:'ESCALATED_TO_CEO'}}).reason,'A11_FINANCE_CLEARANCE_REQUIRED');
 assert.equal(delegatedGatePreflight({gate:'G1',packet:packet(),policy:{...policy,tenant_id:'foreign'},checks:checks('G1'),finance:finance()}).reason,'DELEGATION_POLICY_NOT_VERIFIED');
});
test('G2 requires matching G1, immutable final assets, channel permissions and QC',()=>{
 const p={...packet(),g1_decision:{source:'SERVER_G1_DECISION',decision:'APPROVED_INTERNAL',tenant_id:'tenant_staging',command_id:'cmd_one',sha256:b},
 asset_sha256s:[h],caption_sha256:b,schedule_sha256:h,channel_profile_hashes:{FB001:h},
 channel_schedule_immutable:true,asset_manifest_immutable:true,
 platform_entitlement:{source:'SERVER_PLATFORM_PERMISSION_CHECK',valid:true,channel_ids:['FB001']}};
 const cs=checks('G2');
 assert.equal(delegatedGatePreflight({gate:'G2',packet:p,policy,checks:cs,finance:finance()}).ok,true);
 assert.equal(delegatedGatePreflight({gate:'G2',packet:{...p,g1_decision:null},policy,checks:cs,finance:finance()}).reason,'INTERNAL_G1_NOT_VERIFIED');
 assert.equal(delegatedGatePreflight({gate:'G2',packet:{...p,schedule_sha256:'old'},policy,checks:cs,finance:finance()}).reason,'FINAL_ASSETS_CHANNEL_SCHEDULE_REQUIRED');
 assert.equal(delegatedGatePreflight({gate:'G2',packet:{...p,platform_entitlement:{...p.platform_entitlement,valid:false}},policy,checks:cs,finance:finance()}).reason,'PLATFORM_PERMISSION_REQUIRED');
 assert.equal(delegatedGatePreflight({gate:'G2',packet:p,policy,checks:cs.filter(x=>x.agent!=='A09'),finance:finance()}).reason,'INDEPENDENT_A09_CHECK_REQUIRED');
});
