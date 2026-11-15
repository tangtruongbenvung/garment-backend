import test from 'node:test';
import assert from 'node:assert/strict';
import {createA0020LedgerRepository} from '../dd04-agent-control/a00-020-atomic-ledger-repository.mjs';
const tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const subject='be8c9e62-fe68-448a-8822-bffbbb96f937';
const command='cmd_1234567890abcdef1234';
const input=({action='START',revision=1}={})=>({command_id:command,task_id:command+'_A03',
 action,expected_revision:revision,idempotency_key:'test-operation-001',
 evidence_sha256:'a'.repeat(64),report_sha256:'b'.repeat(64)});
function fixture({g1=true,prior=false,dbError=false,state='READY',owner='A03',agent='A03'}={}){
 const calls=[];let released=0;
 const client={
 async query(sql,args){
  calls.push({sql:String(sql),args});
  const q=String(sql).toLowerCase();
  if(dbError&&q.includes('select t.owner_agent'))throw Error('DB_FAILURE');
  if(q.includes('from dd04_stage.a00_transition_events where'))return {rows:prior?[{event_id:9,request_sha256:'unexpected',to_state:'READY'}]:[]};
  if(q.includes('select t.owner_agent'))return {rows:[{owner_agent:owner,legacy_status:'READY',state,revision:1,
    dependency_task_ids:[],output_refs:[{uri:'private://test'}],output_sha256:'a'.repeat(64),profile_sha256:null,channel_id:null,last_reviewer_agent:null}]};
  if(q.includes("action='qc_pass'"))return {rows:[{agent_id:'A08'},{agent_id:'A09'}]};
  if(q.includes('from dd04_stage.artifacts'))return {rows:[{exists:true}]};
  if(q.includes('from dd04_stage.approvals'))return {rows:[{passed:g1}]};
  if(q.includes('from dd04_stage.a00_task_contexts')&&q.includes('for share'))return {rows:[]};
  if(q.includes('insert into dd04_stage.a00_transition_events'))return {rows:[{event_id:5}]};
  if(q.includes('update dd04_stage.a00_task_contexts')&&q.includes('returning revision'))return {rows:[{revision:2}]};
  if(q.includes('update dd04_stage.a00_task_contexts target'))return {rows:[]};
  return {rows:[]};
 },release(){released++;}
 };
 return {calls,released:()=>released,pool:{async connect(){return client;}},actor:{
  verified_by_db:true,active:true,runtime_environment:'STAGING',tenant_id:tenant,subject_id:subject,agent_id:agent,allowed_actions:['START','SUBMIT','QC_PASS','REVIEW_PASS','REVIEW_FAIL','REWORK']
 }};
}
test('rejects client-supplied authority fields before connecting',async()=>{
 const f=fixture();const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 await assert.rejects(r.transact({...input(),tenant_id:tenant},{}),/CLIENT_AUTHORITY_FIELD_FORBIDDEN/);
 assert.equal(f.calls.length,0);
});
test('fails closed when trusted database identity is missing',async()=>{
 const f=fixture();const r=createA0020LedgerRepository(f.pool,async()=>({...f.actor,verified_by_db:false}));
 await assert.rejects(r.transact(input(),{}),/DB_VERIFIED_ACTOR_REQUIRED/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');assert.equal(f.released(),1);
});
test('pending G1 denies transition; no audit INSERT and rollback',async()=>{
 const f=fixture({g1:false});const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 await assert.rejects(r.transact(input(),{}),/G1_STILL_LOCKED/);
 assert.ok(!f.calls.some(c=>c.sql.includes('INSERT INTO')));
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
});
test('atomic START persists event and context; legacy tasks remain untouched',async()=>{
 const f=fixture();const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 const res=await r.transact(input(),{});
 assert.equal(res.state,'IN_PROGRESS');assert.equal(res.persistent,true);
 assert.equal(res.publish_allowed,false);assert.equal(f.calls.at(-1).sql,'COMMIT');
 assert.ok(f.calls.some(c=>c.sql.includes('INSERT INTO dd04_stage.a00_transition_events')));
 assert.ok(!f.calls.some(c=>/UPDATE\s+dd04_stage\.tasks/i.test(c.sql)));
 assert.equal(f.released(),1);
});
test('review must come from different agent and match the output hash',async()=>{
 const f=fixture({state:'INTERNAL_REVIEW',agent:'A03'});
 const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 await assert.rejects(r.transact(input({action:'REVIEW_PASS'}),{}),/INDEPENDENT_REVIEW_REQUIRED/);
});
test('independent A08 review can PASS internal only, never publishes',async()=>{
 const f=fixture({state:'INTERNAL_REVIEW',agent:'A08'});
 const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 const res=await r.transact(input({action:'REVIEW_PASS'}),{});
 assert.equal(res.state,'APPROVED_INTERNAL');assert.equal(res.publish_allowed,false);
 assert.ok(f.calls.some(c=>c.sql.includes('UPDATE dd04_stage.a00_task_contexts target')));
});
test('stale revision rejected and rollback complete',async()=>{
 const f=fixture();const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 await assert.rejects(r.transact(input({revision:2}),{}),/STALE_REVISION/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
});
test('idempotency conflict is detected and cannot alter state',async()=>{
 const f=fixture({prior:true});const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 await assert.rejects(r.transact(input(),{}),/IDEMPOTENCY_CONFLICT/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
});
test('database exception releases connection after rollback',async()=>{
 const f=fixture({dbError:true});const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 await assert.rejects(r.transact(input(),{}),/DB_FAILURE/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');assert.equal(f.released(),1);
});
test('no production execution',()=>{
 const f=fixture();assert.throws(()=>createA0020LedgerRepository(f.pool,async()=>f.actor,{environment:'PRODUCTION'}),/STAGING_ONLY/);
});

test('dual QC verification is required before automatic handoff',async()=>{
 const f=fixture({state:'INTERNAL_REVIEW',agent:'A08'});
 const old=f.pool.connect;
 f.pool.connect=async()=>{
  const client=await old();const q=client.query;
  client.query=async(sql,args)=>{
   if(String(sql).toLowerCase().includes("action='qc_pass'"))return {rows:[{agent_id:'A08'}]};
   return q(sql,args);
  };return client;
 };
 const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 await assert.rejects(r.transact(input({action:'REVIEW_PASS'}),{}),/A08_A09_QC_EVIDENCE_REQUIRED/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
});
test('QC evidence can only be recorded by an independent A08/A09 reviewer',async()=>{
 const f=fixture({state:'INTERNAL_REVIEW',agent:'A08'});
 const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 const res=await r.transact(input({action:'QC_PASS'}),{});
 assert.equal(res.state,'INTERNAL_REVIEW');assert.equal(res.publish_allowed,false);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
});

test('unregistered QC report cannot be used for approval',async()=>{
 const f=fixture({state:'INTERNAL_REVIEW',agent:'A09'}); const prior=f.pool.connect;
 f.pool.connect=async()=>{const c=await prior();const q=c.query;
  c.query=async(sql,args)=>String(sql).includes('FROM dd04_stage.artifacts')?{rows:[{exists:false}]}:q(sql,args);
  return c;};
 const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 await assert.rejects(r.transact(input({action:'QC_PASS'}),{}),/QC_REPORT_ARTIFACT_NOT_REGISTERED/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
});
test('unregistered production output cannot advance to QC',async()=>{
 const f=fixture({state:'IN_PROGRESS'});const prior=f.pool.connect;
 f.pool.connect=async()=>{const c=await prior();const q=c.query;
  c.query=async(sql,args)=>String(sql).includes('FROM dd04_stage.artifacts')?{rows:[{exists:false}]}:q(sql,args);
  return c;};
 const r=createA0020LedgerRepository(f.pool,async()=>f.actor);
 await assert.rejects(r.transact(input({action:'SUBMIT'}),{}),/OUTPUT_ARTIFACT_NOT_REGISTERED/);
});
