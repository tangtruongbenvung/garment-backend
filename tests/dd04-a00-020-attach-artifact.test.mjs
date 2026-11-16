import test from 'node:test';
import assert from 'node:assert/strict';
import {createA0020ArtifactAttacher} from '../dd04-agent-control/a00-020-attach-artifact.mjs';
const tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const command='cmd_1234567890abcdef1234',task_id=command+'_A03';
const request=()=>({command_id:command,task_id,artifact_sha256:'a'.repeat(64),
 expected_revision:2,idempotency_key:'attach-test-0001'});
function mock({g1=true,registered=true,status='IN_PROGRESS',actor='A03',fail=false}={}){
 const queries=[];let released=0;
 const client={async query(sql,args){
  queries.push({sql:String(sql),args});
  const s=String(sql);
  if(fail&&s.startsWith('UPDATE dd04_stage.a00_task_contexts'))throw Error('DB_FAILURE');
  if(s.includes('FROM dd04_stage.a00_transition_events')&&s.includes('idempotency_key'))return {rows:[]};
  if(s.includes('SELECT t.owner_agent'))return {rows:[{owner_agent:'A03',canonical_status:status,
   state:'IN_PROGRESS',revision:2}]};
  if(s.includes('dd04_stage.a00_022_effective_g1'))return {rows:[{passed:g1}]};
  if(s.includes('FROM dd04_stage.artifacts'))return {rows:registered?[{
   artifact_id:'13d8d96d-8cf3-4342-b151-b5bd2fda1572',
   storage_ref:'private://output.mp4',sha256:'a'.repeat(64)}]:[]};
  if(s.includes('INSERT INTO dd04_stage.a00_transition_events'))return {rows:[{event_id:22}]};
  if(s.startsWith('UPDATE dd04_stage.a00_task_contexts'))return {rows:[{revision:3}]};
  return {rows:[]};
 },release(){released++;}};
 return {queries,released:()=>released,pool:{async connect(){return client}},
  actor:{verified_by_db:true,active:true,runtime_environment:'STAGING',tenant_id:tenant,
   subject_id:'be8c9e62-fe68-448a-8822-bffbbb96f937',agent_id:actor,
   allowed_actions:['READ','ATTACH']}};
}
test('staging artifact attachment commits state and evidence together',async()=>{
 const f=mock(),repo=createA0020ArtifactAttacher(f.pool,async()=>f.actor);
 const result=await repo.attach(request(),'private-worker-secret');
 assert.equal(result.ok,true);assert.equal(result.revision,3);assert.equal(result.publish_allowed,false);
 assert.ok(f.queries.some(x=>x.sql==='SET LOCAL ROLE dd04_a00_runtime'));
 assert.ok(f.queries.some(x=>x.sql.includes('INSERT INTO dd04_stage.a00_transition_events')));
 assert.equal(f.queries.at(-1).sql,'COMMIT');assert.equal(f.released(),1);
});
test('missing registered artifact fails without event insertion',async()=>{
 const f=mock({registered:false}),repo=createA0020ArtifactAttacher(f.pool,async()=>f.actor);
 await assert.rejects(repo.attach(request(),'secret'),/ARTIFACT_NOT_REGISTERED/);
 assert.equal(f.queries.at(-1).sql,'ROLLBACK');
});
test('pending G1 or owner mismatch blocks transaction',async()=>{
 for(const options of [{g1:false},{actor:'A04'}]){
  const f=mock(options),repo=createA0020ArtifactAttacher(f.pool,async()=>f.actor);
  await assert.rejects(repo.attach(request(),'secret'),/G1_STILL_LOCKED|TASK_OWNER_REQUIRED/);
  assert.equal(f.queries.at(-1).sql,'ROLLBACK');
 }
});
test('database write failure rolls back both event and output',async()=>{
 const f=mock({fail:true}),repo=createA0020ArtifactAttacher(f.pool,async()=>f.actor);
 await assert.rejects(repo.attach(request(),'secret'),/DB_FAILURE/);
 assert.equal(f.queries.at(-1).sql,'ROLLBACK');assert.equal(f.released(),1);
});
test('caller cannot choose tenant or authorized agent',async()=>{
 const f=mock(),repo=createA0020ArtifactAttacher(f.pool,async()=>f.actor);
 await assert.rejects(repo.attach({...request(),agent_id:'A09'},'secret'),/CLIENT_AUTHORITY_FIELD_FORBIDDEN/);
 assert.equal(f.queries.length,0);
});
