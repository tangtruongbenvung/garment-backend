import test from 'node:test';
import assert from 'node:assert/strict';
import {createA0018ReadRepository} from '../dd04-agent-control/a00-018-existing-ledger-read-repository.mjs';
const tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const user='be8c9e62-fe68-448a-8822-bffbbb96f937';
function setup(fail=false){
 const statements=[];let releaseCount=0;
 const client={
 async query(sql,args){
  statements.push({sql,args});
  if(fail&&String(sql).includes('from dd04_stage.tasks t'))throw Error('DB_DOWN');
  if(String(sql).includes('count(*)'))return {rows:[{total:1}]};
  if(String(sql).startsWith('select'))return {rows:[{task_id:'cmd_1234567890abcdef1234_A01'}]};
  return {rows:[]};
 },release(){releaseCount++}};
 return {pool:{async connect(){return client}},statements,released:()=>releaseCount};
}
const ctx=(kind='CEO')=>({provenance:'PRIVATE_SERVER_AUTH_ADAPTER',tenant_id:tenant,subject_id:user,kind,active:true,agent_id:kind==='AGENT'?'A01':undefined});
test('rejects missing or invented trusted server context',()=>{
 const {pool}=setup();
 assert.throws(()=>createA0018ReadRepository(pool,{tenant_id:tenant,subject_id:user,kind:'CEO',active:true}),/TRUSTED_SERVER_CONTEXT_REQUIRED/);
 assert.throws(()=>createA0018ReadRepository(pool,{...ctx(),tenant_id:'another'}),/TRUSTED_SERVER_CONTEXT_REQUIRED/);
 assert.throws(()=>createA0018ReadRepository(pool,{...ctx('AGENT'),agent_id:'A99'}),/TRUSTED_SERVER_CONTEXT_REQUIRED/);
});
test('reads actual staging ledger tables with tenant binding inside READ ONLY transaction',async()=>{
 const x=setup(),repo=createA0018ReadRepository(x.pool,ctx());
 const response=await repo.worklist({limit:20,offset:0,agent_id:'A03'});
 assert.equal(response.persistent,true);
 assert.equal(response.publishing_allowed,false);
 assert.equal(response.live_agent_execution_verified,false);
 assert.equal(response.total,1);
 assert.equal(x.statements[0].sql,'BEGIN READ ONLY');
 assert.equal(x.statements.at(-1).sql,'COMMIT');
 assert.deepEqual(x.statements[1].args,[tenant,'A03',20,0]);
 assert.equal(x.released(),1);
});
test('agent cannot read other agent tasks or inject SQL filters',async()=>{
 const x=setup(),repo=createA0018ReadRepository(x.pool,ctx('AGENT'));
 assert.rejects(repo.worklist({agent_id:'A02'}),/AGENT_SCOPE_DENIED/);
 assert.rejects(repo.worklist({agent_id:"A01' OR 1=1"}),/AGENT_FILTER_INVALID/);
 const response=await repo.worklist();
 assert.equal(response.rows.length,1);
 assert.equal(x.statements[1].args[1],'A01');
});
test('read failure rolls back and releases connection',async()=>{
 const x=setup(true),repo=createA0018ReadRepository(x.pool,ctx());
 await assert.rejects(repo.worklist(),/DB_DOWN/);
 assert.equal(x.statements.at(-1).sql,'ROLLBACK');
 assert.equal(x.released(),1);
});
test('history query is task scoped and readonly',async()=>{
 const x=setup(),repo=createA0018ReadRepository(x.pool,ctx('AGENT'));
 const command='cmd_1234567890abcdef1234';
 await assert.rejects(repo.taskHistory(command,command+'_A02'),/AGENT_SCOPE_DENIED/);
 const result=await repo.taskHistory(command,command+'_A01');
 assert.equal(result.read_only,true);
 assert.deepEqual(x.statements[1].args,[tenant,command,command+'_A01']);
});
