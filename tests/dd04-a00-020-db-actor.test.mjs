import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createA0020DbActorResolver,requireAgentCapability} from '../dd04-agent-control/a00-020-db-actor-resolver.mjs';
const tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const credential='dd04w_'+('A'.repeat(64));
const digest=createHash('sha256').update(credential).digest('hex');
function db({status='ACTIVE',not_expired=true,agent_id='A03'}={}){
 const calls=[];
 return {calls,client:{async query(sql,args){calls.push({sql,args});
  return {rows:status==='NONE'?[]:[{tenant_id:tenant,subject_id:'be8c9e62-fe68-448a-8822-bffbbb96f937',
   agent_id,status,not_expired,allowed_actions:['START','SUBMIT']}]};
 }}};
}
test('requires server-only opaque worker credential',async()=>{
 const d=db(),r=createA0020DbActorResolver({expectedTenantId:tenant});
 await assert.rejects(r(d.client,'A03'),/PRIVATE_WORKER_CREDENTIAL_REQUIRED/);
 assert.equal(d.calls.length,0);
});
test('resolves tenant and capabilities only from DB row',async()=>{
 const d=db(),r=createA0020DbActorResolver({expectedTenantId:tenant});
 const actor=await r(d.client,credential);
 assert.equal(actor.agent_id,'A03');assert.equal(actor.tenant_id,tenant);
 assert.deepEqual(d.calls[0].args,[tenant,digest]);
 assert.equal(requireAgentCapability(actor,'START'),true);
 assert.throws(()=>requireAgentCapability(actor,'REVIEW_PASS'),/AGENT_CAPABILITY_DENIED/);
});
test('missing, revoked, expired worker denies access',async()=>{
 const r=createA0020DbActorResolver({expectedTenantId:tenant});
 for(const setting of [{status:'NONE'},{status:'REVOKED'},{not_expired:false}]){
  await assert.rejects(r(db(setting).client,credential),/WORKER_IDENTITY_UNVERIFIED|WORKER_IDENTITY_INVALID/);
 }
});
test('production environment and tenant spoofing fail',async()=>{
 assert.throws(()=>createA0020DbActorResolver({expectedTenantId:tenant,environment:'PRODUCTION'}),/STAGING_TENANT_REQUIRED/);
 const d=db(),r=createA0020DbActorResolver({expectedTenantId:tenant});
 d.client.query=async()=>({rows:[{tenant_id:'11111111-1111-4111-8111-111111111111',
 subject_id:'be8c9e62-fe68-448a-8822-bffbbb96f937',agent_id:'A03',status:'ACTIVE',not_expired:true,allowed_actions:['START']}]});
 await assert.rejects(r(d.client,credential),/WORKER_IDENTITY_INVALID/);
});
