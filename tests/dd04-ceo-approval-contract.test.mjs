import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAuthUser,verifyCeoEnrollment,prepareGateDecision} from '../dd04-agent-control/ceo-approval-contract.mjs';
const user='123e4567-e89b-42d3-a456-426614174111';
const tenant='123e4567-e89b-42d3-a456-426614174000';
const other='123e4567-e89b-42d3-a456-426614174222';
const cmd={command_id:'cmd_91c7ce5ec8760df9fa0f',tenant_id:tenant,status:'WAITING_CEO_PLAN'};
const enrollment={user_id:user,tenant_id:tenant,role:'CEO',status:'ACTIVE',verified_by_admin:true,identity_source:'SERVER_DB_VERIFIED',current_aal:'aal2'};
const actor={ok:true,role:'CEO',userId:user,tenantId:tenant};
const assurance={source:'SERVER_VERIFIED_SESSION',userId:user,aal:'aal2'};
const sha='a'.repeat(64);

test('Supabase auth URL is locked to staging and does not accept operator tokens as CEO',async()=>{
 assert.deepEqual(await verifyAuthUser({token:'x'.repeat(50),supabaseUrl:'https://ykhrtrvstymfjnzdgzna.supabase.co',publishableKey:'public',fetchImpl:()=>{throw Error('must not fetch')}}),{ok:false,reason:'AUTH_NOT_CONFIGURED_OR_TOKEN_MISSING'});
 const fake=async(url)=>{assert.equal(url,'https://wbvkqfnrlasmtizjszab.supabase.co/auth/v1/user');return {ok:true,json:async()=>({id:user,email_confirmed_at:'2026-11-14T10:00:00Z',user_metadata:{role:'CEO'}})}};
 assert.deepEqual(await verifyAuthUser({token:'x'.repeat(50),supabaseUrl:'https://wbvkqfnrlasmtizjszab.supabase.co',publishableKey:'public',fetchImpl:fake}),{ok:true,userId:user});
});
test('reject forged role, no enrollment and missing MFA',()=>{
 assert.equal(verifyCeoEnrollment({identity:{ok:true,userId:user},tenantId:tenant}).reason,'CEO_ENROLLMENT_REQUIRED');
 assert.equal(verifyCeoEnrollment({identity:{ok:true,userId:user},tenantId:tenant,enrollment:{...enrollment,role:'STAFF'}}).reason,'CEO_ENROLLMENT_REQUIRED');
 assert.equal(verifyCeoEnrollment({identity:{ok:true,userId:user},tenantId:tenant,enrollment:{...enrollment,identity_source:'BROWSER'}}).reason,'UNTRUSTED_ENROLLMENT_SOURCE');
 assert.equal(verifyCeoEnrollment({identity:{ok:true,userId:user},tenantId:tenant,enrollment,assurance:{...assurance,aal:'aal1'}}).reason,'MFA_AAL2_REQUIRED');
 assert.equal(verifyCeoEnrollment({identity:{ok:true,userId:user},tenantId:other,enrollment}).reason,'CEO_ENROLLMENT_REQUIRED');
 assert.deepEqual(verifyCeoEnrollment({identity:{ok:true,userId:user},tenantId:tenant,enrollment,assurance}),{ok:true,userId:user,tenantId:tenant,role:'CEO'});
});
test('G1 requires verified CEO, proposal version and approved scope/budget evidence',()=>{
 assert.equal(prepareGateDecision({actor:{role:'CEO'},command:cmd,gate:'G1',decision:'APPROVED',evidence:{}}).reason,'VERIFIED_CEO_REQUIRED');
 assert.equal(prepareGateDecision({actor,command:{...cmd,tenant_id:other},gate:'G1',decision:'APPROVED',evidence:{}}).reason,'COMMAND_NOT_IN_CEO_TENANT');
 const evidence={revision:1,proposal_sha256:sha,budget_vnd:200000,scope_text:'Video thử nghiệm 30 giây'};
 const p=prepareGateDecision({actor,command:cmd,gate:'G1',decision:'APPROVED',evidence});
 assert.equal(p.ok,true);assert.equal(p.executable,false);assert.equal(p.proposal.status,'NOT_SUBMITTED_DB_GUARD_ACTIVE');
 assert.equal(p.fingerprint.length,64);
 assert.equal(prepareGateDecision({actor,command:cmd,gate:'G1',decision:'APPROVED',evidence:{...evidence,revision:0}}).reason,'VERSIONED_PROPOSAL_REQUIRED');
});
test('G2 requires final asset hash, channel list, schedule and QC evidence',()=>{
 const c={...cmd,status:'HOLD'};
 const ev={revision:1,proposal_sha256:sha,asset_sha256:'b'.repeat(64),target_channels:['fanpage-test'],publish_schedule:{planned_at:'2026-12-01T12:00:00Z'},qc_pass:true,compliance_pass:true};
 assert.equal(prepareGateDecision({actor,command:c,gate:'G2',decision:'APPROVED',evidence:{...ev,qc_pass:false}}).reason,'G2_QC_AND_COMPLIANCE_REQUIRED');
 assert.equal(prepareGateDecision({actor,command:c,gate:'G2',decision:'APPROVED',evidence:{...ev,target_channels:[]}}).reason,'G2_ASSET_CHANNEL_SCHEDULE_REQUIRED');
 assert.equal(prepareGateDecision({actor,command:cmd,gate:'G2',decision:'APPROVED',evidence:ev}).reason,'G2_COMMAND_STATE_MISMATCH');
 const result=prepareGateDecision({actor,command:c,gate:'G2',decision:'APPROVED',evidence:ev});
 assert.equal(result.ok,true);assert.equal(result.executable,false);
});
