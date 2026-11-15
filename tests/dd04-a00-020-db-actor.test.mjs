import test from 'node:test';
import assert from 'node:assert/strict';
import {createA0020DbActorResolver,requireAgentCapability}
 from '../dd04-agent-control/a00-020-db-actor-resolver.mjs';
const tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const credential='dd04w_'+('A'.repeat(64));
function db({tenantAllowed=true,agent_id='A03',subject_id='be8c9e62-fe68-448a-8822-bffbbb96f937',
 actions=['READ','START','SUBMIT'],noRows=false}={}){
 const calls=[];return {calls,client:{async query(sql,args){
  calls.push({sql,args});return {rows:noRows?[]:[{
   tenant_read_allowed:tenantAllowed,agent_id,subject_id,allowed_actions:actions}]};
 }}};
}
test('requires private opaque worker secret before any DB query',async()=>{
 const d=db(),resolver=createA0020DbActorResolver({expectedTenantId:tenant});
 await assert.rejects(resolver(d.client,'A03'),/PRIVATE_WORKER_CREDENTIAL_REQUIRED/);
 assert.equal(d.calls.length,0);
});
test('identity and capabilities come exclusively from RLS-scoped DB functions',async()=>{
 const d=db(),resolver=createA0020DbActorResolver({expectedTenantId:tenant});
 const actor=await resolver(d.client,credential);
 assert.equal(actor.agent_id,'A03');
 assert.equal(actor.tenant_id,tenant);
 assert.equal(d.calls[0].args[0],tenant);
 assert.ok(d.calls[0].sql.includes('a00_current_agent()'));
 assert.ok(d.calls[0].sql.includes('a00_current_subject()'));
 assert.ok(!d.calls[0].sql.includes('FROM dd04_stage.a00_worker_identities'));
 assert.equal(requireAgentCapability(actor,'START'),true);
 assert.throws(()=>requireAgentCapability(actor,'REVIEW_PASS'),/AGENT_CAPABILITY_DENIED/);
});
test('missing/revoked/expired or tenant-mismatched worker fails closed',async()=>{
 const resolver=createA0020DbActorResolver({expectedTenantId:tenant});
 for(const options of [{noRows:true},{tenantAllowed:false},{agent_id:null},{subject_id:null}]){
  await assert.rejects(resolver(db(options).client,credential),/WORKER_IDENTITY_INVALID|WORKER_IDENTITY_UNVERIFIED/);
 }
});
test('rejects non-staging usage and forged claims',async()=>{
 assert.throws(()=>createA0020DbActorResolver({expectedTenantId:tenant,environment:'PRODUCTION'}),/STAGING_TENANT_REQUIRED/);
 const resolver=createA0020DbActorResolver({expectedTenantId:tenant});
 await assert.rejects(resolver(db({agent_id:'A99'}).client,credential),/WORKER_IDENTITY_INVALID/);
});
