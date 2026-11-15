import test from 'node:test';import assert from 'node:assert/strict';
import {checkFinanceEscalation,agentHandoffDecision,autoPublicationPreflight,buildAgentWorklist} from '../dd04-agent-control/v55-automatic-delegation.mjs';
const a='a'.repeat(64),b='b'.repeat(64);
const policy={source:'CEO_SIGNED_POLICY',active:true,max_spend_vnd:200000,max_campaign_vnd:1000000};
const expense={source:'SERVER_FINANCE_LEDGER',estimated_spend_vnd:100000,campaign_total_vnd:500000,budget_snapshot_sha256:a};
test('CEO involved only in financial exceptions under an authorized policy',()=>{
 assert.equal(checkFinanceEscalation({policy,request:expense}).requires_ceo,false);
 assert.equal(checkFinanceEscalation({policy,request:{...expense,estimated_spend_vnd:300000}}).status,'WAITING_CEO_FINANCE');
 assert.equal(checkFinanceEscalation({policy,request:{...expense,contract_or_debt:true}}).requires_ceo,true);
 assert.equal(checkFinanceEscalation({request:expense}).requires_ceo,true);
 assert.equal(checkFinanceEscalation({policy,request:{...expense,estimated_spend_vnd:null}}).status,'HOLD_DATA');
});
test('Agents automatically review each other without impersonating CEO or side effects',()=>{
 const task={source:'SERVER_TASK_REGISTRY',owner_agent:'A03',next_agent:'A08',input_sha256:a,revision:1};
 const evidence={source:'SERVER_AGENT_AUDIT',review_agent:'A08',task_sha256:a,revision:1,report_sha256:b,result:'PASS'};
 const finance=checkFinanceEscalation({policy,request:expense});
 const ok=agentHandoffDecision({task,evidence,finance});assert.equal(ok.ok,true);
 assert.equal(ok.publication_allowed,false);assert.equal(ok.side_effects,false);
 assert.equal(agentHandoffDecision({task,evidence:{...evidence,result:'HOLD'},finance}).ok,false);
 assert.equal(agentHandoffDecision({task,evidence:{...evidence,task_sha256:b},finance}).ok,false);
 assert.equal(agentHandoffDecision({task,evidence,finance:{status:'WAITING_CEO_FINANCE'}}).requires_ceo,true);
});
test('Autonomous publication candidate still fails closed without exact platform + QC permission',()=>{
 const packet={source:'SERVER_FINAL_PACKET',package_sha256:a,revision:1,target_channel_ids:['FB001'],scheduled_at:'2026-11-17T09:00:00+07:00'};
 const checks={source:'SERVER_AGENT_AUDIT',packet_sha256:a,revision:1,policy_sha256:b,A08:'PASS',A09:'PASS',A06:'PASS',A07:'PASS',content_originality_verified:true,channel_profile_verified:true,schedule_verified:true,licensing_verified:true};
 const auth={source:'SERVER_PUBLISH_POLICY',active:true,staging_only:true,platform_identity_verified:true,channel_id:'FB001',policy_sha256:b};
 const finance=checkFinanceEscalation({policy,request:expense});
 const ok=autoPublicationPreflight({packet,checks,authorization:auth,finance});assert.equal(ok.ok,true);
 assert.equal(ok.publication_allowed,false);assert.equal(ok.side_effects,false);
 assert.equal(autoPublicationPreflight({packet,checks:{...checks,A09:'HOLD'},authorization:auth,finance}).ok,false);
 assert.equal(autoPublicationPreflight({packet,checks,authorization:{...auth,channel_id:'TT001'},finance}).ok,false);
 assert.equal(autoPublicationPreflight({packet,checks,authorization:auth,finance:{status:'WAITING_CEO_FINANCE'}}).ok,false);
});
test('worklist tracks real tasks, does not claim AI auto approvals are already enabled',()=>{
 const r=buildAgentWorklist([{task_id:'t001',owner_agent:'A03',status:'PLANNED_WAIT_G1',revision:1,command_id:'cmd_test'}]);
 assert.equal(r.length,1);assert.equal(r[0].approval_mode,'AUTO_AGENT_POLICY_NOT_ENABLED');
 assert.equal(buildAgentWorklist([{task_id:'x',owner_agent:'A99'}]).length,0);
});
