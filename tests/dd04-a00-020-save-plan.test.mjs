import test from 'node:test';
import assert from 'node:assert/strict';
import {createA0020TaskPlanWriter} from '../dd04-agent-control/a00-020-save-task-plan.mjs';
const tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const command='cmd_1234567890abcdef1234';
const tasks=[{task_id:command+'_A00',owner_agent:'A00'},{task_id:command+'_A03',owner_agent:'A03',dependency_task_id:command+'_A00'}];
const req=()=>({command_id:command,idempotency_key:'plan-unique-001',tasks});
function fixture({prior=false,count=0,dbError=false,active=true,agent='A00'}={}){
 const calls=[];let released=0;
 const client={async query(sql,args){
  const q=String(sql).toLowerCase();calls.push({sql:String(sql),args});
  if(dbError&&q.includes('insert into dd04_stage.tasks'))throw Error('DB_FAILURE');
  if(q.includes('from dd04_stage.commands'))return {rows:[{status:'WAITING_CEO_PLAN',input_sha256:'a'.repeat(64)}]};
  if(q.includes("event_name='task_plan_saved'"))return {rows:prior?[{evidence_sha256:'bad',details:{}}]:[]};
  if(q.includes('count(*)'))return {rows:[{n:count}]};
  return {rows:[]};
 },release(){released++;}};
 return {pool:{async connect(){return client}},calls,released:()=>released,
  actor:{verified_by_db:true,active,agent_id:agent,runtime_environment:'STAGING',tenant_id:tenant,subject_id:'be8c9e62-fe68-448a-8822-bffbbb96f937'}};
}
test('creates DAG task plan in one transaction and keeps G1 locked',async()=>{
 const f=fixture();const w=createA0020TaskPlanWriter(f.pool,async()=>f.actor);
 const r=await w.savePlan(req(),{});
 assert.equal(r.task_count,2);assert.equal(r.execute_agents,false);assert.equal(r.publish_allowed,false);
 assert.equal(f.calls.filter(x=>x.sql.includes('INSERT INTO dd04_stage.tasks')).length,2);
 assert.ok(f.calls.some(x=>x.sql.includes('INSERT INTO dd04_stage.task_events')));
 assert.equal(f.calls.at(-1).sql,'COMMIT');assert.equal(f.released(),1);
});
test('rejects forged tenant and runtime authority fields before any DB connection',async()=>{
 const f=fixture();const w=createA0020TaskPlanWriter(f.pool,async()=>f.actor);
 await assert.rejects(w.savePlan({...req(),tenant_id:tenant},{}),/FORGED_AUTHORITY_FIELD/);
 assert.equal(f.calls.length,0);
});
test('rejects unauthorized reviewer pretending to be A00',async()=>{
 const f=fixture({agent:'A03'});const w=createA0020TaskPlanWriter(f.pool,async()=>f.actor);
 await assert.rejects(w.savePlan(req(),{}),/A00_DB_AUTH_REQUIRED/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
});
test('does not overwrite existing tasks',async()=>{
 const f=fixture({count:14});const w=createA0020TaskPlanWriter(f.pool,async()=>f.actor);
 await assert.rejects(w.savePlan(req(),{}),/PLAN_ALREADY_EXISTS_REQUIRE_RECONCILIATION/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
});
test('detects idempotency conflict',async()=>{
 const f=fixture({prior:true});const w=createA0020TaskPlanWriter(f.pool,async()=>f.actor);
 await assert.rejects(w.savePlan(req(),{}),/PLAN_IDEMPOTENCY_CONFLICT/);
});
test('rejects missing dependencies or cycles',async()=>{
 const f=fixture(),w=createA0020TaskPlanWriter(f.pool,async()=>f.actor);
 await assert.rejects(w.savePlan({...req(),tasks:[{...tasks[1]}]},{}),/DEPENDENCY_OUTSIDE_PLAN/);
 await assert.rejects(w.savePlan({...req(),tasks:[
  {...tasks[0],dependency_task_id:command+'_A03'},{...tasks[1]}]},{}),/CYCLIC_DEPENDENCIES/);
});
test('database insert failure rolls back all planned tasks and releases client',async()=>{
 const f=fixture({dbError:true});const w=createA0020TaskPlanWriter(f.pool,async()=>f.actor);
 await assert.rejects(w.savePlan(req(),{}),/DB_FAILURE/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');assert.equal(f.released(),1);
});
