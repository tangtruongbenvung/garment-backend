import test from 'node:test';
import assert from 'node:assert/strict';
import {AGENTS,prepareLedger,applyTaskReview,reviewFinance,attachFinanceException,sharedWorklist} from '../dd04-agent-control/a00-delegated-orchestrator.mjs';
const hash='a'.repeat(64),other='b'.repeat(64),time='2026-11-15T01:00:00Z';
const initial=()=>prepareLedger({tenant_id:'tenant_staging',command_id:'cmd_test001',campaign_id:'campaign01',workflow:'CONTENT',channels:['FB001'],input_sha256:hash,actor_source:'STAGING_OPERATOR_REVIEW',at:time});
const policy=()=>({source:'SERVER_VERIFIED_POLICY',active:true,policy_id:'policy01',tenant_id:'tenant_staging',revision:1,limit_vnd:1000000,currency:'VND',scope:'campaign01',period:'2026-11',authority_evidence_hash:hash,valid_from:'2026-11-01T00:00:00Z',valid_until:'2026-12-01T00:00:00Z'});
const request=()=>({source:'SERVER_VERSIONED_REQUEST',tenant_id:'tenant_staging',command_id:'cmd_test001',request_id:'req001',campaign_id:'campaign01',amount_vnd:500000,request_sha256:other,revision:1,scope:'campaign01',period:'2026-11'});
const commitment=(request_id,amount_vnd)=>({source:'SERVER_FINANCE_LEDGER',tenant_id:'tenant_staging',scope:'campaign01',period:'2026-11',request_id,amount_vnd});
test('A00 includes all 18 roles and builds a blocked dependency graph',()=>{
 assert.equal(AGENTS.length,18);
 const a=initial();
 assert.ok(a.rows.some(x=>x.owner_agent==='A00'&&x.status==='PLANNED'));
 assert.ok(a.rows.some(x=>x.owner_agent==='A07'&&x.status==='BLOCKED_DEPENDENCY'));
 assert.equal(a.publish_allowed,false);
});
test('unverified gateway and malformed channels rejected',()=>{
 assert.throws(()=>prepareLedger({...initialOptions(),actor_source:'UNTRUSTED'}),/COMMAND_AUTH_REQUIRED/);
 assert.throws(()=>prepareLedger({...initialOptions(),channels:['FB001','FB001']}),/CHANNELS_INVALID/);
});
function initialOptions(){return {tenant_id:'tenant_staging',command_id:'cmd_test001',campaign_id:'campaign01',workflow:'CONTENT',channels:['FB001'],input_sha256:hash,actor_source:'STAGING_OPERATOR_REVIEW',at:time}}
test('dependencies, owner, independent review, idempotency and hash protected',()=>{
 let l=initial(), a00='cmd_test001_A00', a02='cmd_test001_A02';
 assert.equal(applyTaskReview(l,{task_id:a02,actor:'A02',action:'START',idempotency_key:'dep01',at:time}).reason,'DEPENDENCIES_NOT_APPROVED');
 const start=applyTaskReview(l,{task_id:a00,actor:'A00',action:'START',idempotency_key:'start01',at:time});assert.equal(start.ok,true);l=start.ledger;
 assert.equal(applyTaskReview(l,{task_id:a00,actor:'A02',action:'SUBMIT',evidence_sha256:hash,idempotency_key:'sub_wrong',at:time}).reason,'OWNER_REQUIRED');
 l=applyTaskReview(l,{task_id:a00,actor:'A00',action:'SUBMIT',evidence_sha256:hash,idempotency_key:'submit01',at:time}).ledger;
 assert.equal(applyTaskReview(l,{task_id:a00,actor:'A00',reviewer:'A00',action:'APPROVE',review_source:'SERVER_INDEPENDENT_AGENT_AUDIT',evidence_sha256:hash,idempotency_key:'approve_wrong',at:time}).reason,'INDEPENDENT_REVIEW_REQUIRED');
 assert.equal(applyTaskReview(l,{task_id:a00,actor:'A02',reviewer:'A02',action:'APPROVE',review_source:'SERVER_INDEPENDENT_AGENT_AUDIT',evidence_sha256:other,idempotency_key:'approve_wrong2',at:time}).reason,'REVIEW_HASH_MISMATCH');
 const approved=applyTaskReview(l,{task_id:a00,actor:'A02',reviewer:'A02',action:'APPROVE',review_source:'SERVER_INDEPENDENT_AGENT_AUDIT',evidence_sha256:hash,idempotency_key:'approve01',at:time});
 assert.equal(approved.ok,true);l=approved.ledger;
 assert.equal(applyTaskReview(l,{task_id:a02,actor:'A02',action:'START',idempotency_key:'start02',at:time}).ok,true);
 assert.equal(applyTaskReview(l,{task_id:a00,actor:'A02',reviewer:'A02',action:'APPROVE',review_source:'SERVER_INDEPENDENT_AGENT_AUDIT',evidence_sha256:hash,idempotency_key:'approve01',at:time}).duplicate,true);
 assert.equal(applyTaskReview(l,{task_id:a00,actor:'A02',reviewer:'A02',action:'APPROVE',review_source:'SERVER_INDEPENDENT_AGENT_AUDIT',evidence_sha256:other,idempotency_key:'approve01',at:time}).reason,'IDEMPOTENCY_CONFLICT');
 assert.equal(l.publish_allowed,false);
});
test('A11 aggregates spent/committed money and escalates only outside verified limit',()=>{
 const good=reviewFinance({policy:policy(),request:request(),commitments:[commitment('req000',400000)],now:time});
 assert.equal(good.ok,true);assert.equal(good.total_vnd,900000);assert.equal(good.executable,false);
 const fail=reviewFinance({policy:policy(),request:request(),commitments:[commitment('req000',600000)],now:time});
 assert.equal(fail.state,'ESCALATED_TO_CEO');assert.equal(fail.authority,'CEO_FINANCE_ONLY');
 const entry=attachFinanceException(initial(),fail,time);assert.equal(entry.ok,true);
 const view=sharedWorklist([entry.ledger],'tenant_staging');assert.equal(view.ceo_finance_queue.length,1);
 assert.equal(view.persistent,false);assert.equal(view.publish_allowed,false);
 assert.equal(attachFinanceException(entry.ledger,fail,time).duplicate,true);
});
test('missing policy, expired policy, cross-tenant, wrong period, duplicate commitments blocked',()=>{
 assert.equal(reviewFinance({request:request(),commitments:[],now:time}).reason,'ACTIVE_VERIFIED_FINANCIAL_POLICY_REQUIRED');
 assert.equal(reviewFinance({policy:{...policy(),valid_until:'2026-11-01T00:00:00Z'},request:request(),commitments:[],now:time}).reason,'FINANCIAL_POLICY_EXPIRED');
 assert.equal(reviewFinance({policy:policy(),request:{...request(),tenant_id:'tenant_other'},commitments:[],now:time}).reason,'TENANT_MISMATCH');
 assert.equal(reviewFinance({policy:policy(),request:{...request(),period:'2026-12'},commitments:[],now:time}).reason,'POLICY_SCOPE_MISMATCH');
 assert.equal(reviewFinance({policy:policy(),request:request(),commitments:[commitment('req001',1)],now:time}).reason,'EXISTING_REQUEST_REQUIRES_IDEMPOTENT_LOOKUP');
 assert.equal(reviewFinance({policy:policy(),request:request(),commitments:[commitment('req002',1),commitment('req002',2)],now:time}).reason,'DUPLICATE_FINANCE_REQUEST');
 assert.throws(()=>sharedWorklist([initial()],'another_tenant'),/TENANT_ISOLATION_REQUIRED/);
});
test('A07 stays fail closed and no DB/publishing permission is generated',()=>{
 let l=initial();
 const row=l.rows.find(x=>x.owner_agent==='A07');row.status='INTERNAL_REVIEW';row.output_sha256=hash;
 const attempt=applyTaskReview(l,{task_id:row.task_id,actor:'A08',reviewer:'A08',action:'APPROVE',review_source:'SERVER_INDEPENDENT_AGENT_AUDIT',evidence_sha256:hash,idempotency_key:'a07check',at:time});
 assert.equal(attempt.reason,'A07_PUBLICATION_GATE_LOCKED');
});
