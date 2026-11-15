// DD04-A00-020 — Persist a CEO command's task plan atomically into EXISTING DD04 tables.
// No HTTP endpoint; requires a separately reviewed, authenticated A00 service identity.
// Only creates PLANNED_WAIT_G1 tasks; never grants G1/G2 or starts agent execution.
import {createHash} from 'node:crypto';
import {requireAgentCapability} from './a00-020-db-actor-resolver.mjs';
const CMD=/^cmd_[a-f0-9]{20}$/, AGENT=/^A(0[0-9]|1[0-7])$/, KEY=/^[A-Za-z0-9:_-]{8,120}$/;
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const err=code=>{throw new Error(code)};
const check=(ok,code)=>{if(!ok)err(code)};
const resultRows=r=>Array.isArray(r?.rows)?r.rows:err('DB_RESULT_INVALID');
function validatePlan({command_id,tasks,idempotency_key}={}){
 check(CMD.test(command_id)&&KEY.test(idempotency_key),'PLAN_REQUEST_INVALID');
 check(Array.isArray(tasks)&&tasks.length>=1&&tasks.length<=18,'PLAN_TASK_COUNT_INVALID');
 const seen=new Set();
 const normalized=tasks.map(t=>{
  check(t&&AGENT.test(t.owner_agent)&&t.task_id===command_id+'_'+t.owner_agent,'TASK_ID_OWNER_INVALID');
  check(!seen.has(t.task_id),'DUPLICATE_TASK');seen.add(t.task_id);
  const dep=t.dependency_task_id??null;
  check(dep===null||CMD.test(dep.slice(0,24))&&dep.startsWith(command_id+'_')&&AGENT.test(dep.slice(25)),
    'DEPENDENCY_FORMAT_INVALID');
  check(dep!==t.task_id,'SELF_DEPENDENCY');
  return {task_id:t.task_id,owner_agent:t.owner_agent,dependency_task_id:dep};
 });
 for(const t of normalized)check(t.dependency_task_id===null||seen.has(t.dependency_task_id),'DEPENDENCY_OUTSIDE_PLAN');
 const map=new Map(normalized.map(t=>[t.task_id,t]));
 const visited=new Set(),visiting=new Set(),ordered=[];
 function visit(id){
  if(visited.has(id))return;
  check(!visiting.has(id),'CYCLIC_DEPENDENCIES');
  visiting.add(id);const task=map.get(id);
  if(task.dependency_task_id)visit(task.dependency_task_id);
  visiting.delete(id);visited.add(id);ordered.push(task);
 }
 for(const t of normalized)visit(t.task_id);
 return {command_id,idempotency_key,tasks:ordered,plan_sha256:sha(ordered)};
}
export function createA0020TaskPlanWriter(pool,resolveVerifiedA00){
 check(pool&&typeof pool.connect==='function'&&typeof resolveVerifiedA00==='function','PRIVATE_SERVER_ONLY');
 return Object.freeze({async savePlan(request,credential){
  // Reject all client-reported tenant/actor/approval flags.
  check(request&&typeof request==='object'&&!['tenant_id','agent_id','actor_id','approved','g1_passed'].some(k=>Object.hasOwn(request,k)),'FORGED_AUTHORITY_FIELD');
  const plan=validatePlan(request),client=await pool.connect();
  let begun=false;
  try{
   await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');begun=true;
   // Role membership is provisioned separately; refuses privileged/owner-only runtime.
   await client.query('SET LOCAL ROLE dd04_a00_runtime');
   await client.query("SET LOCAL statement_timeout='8000ms'");
   // RLS authorization binds each statement to the verified opaque worker secret.
   // Never place this secret into a browser payload, audit log or response.
   await client.query("SELECT pg_catalog.set_config('dd04.worker_credential',$1,true)",[credential]);
   const actor=await resolveVerifiedA00(client,credential);
   check(actor?.verified_by_db===true&&actor.active===true&&actor.agent_id==='A00'&&
     actor.runtime_environment==='STAGING'&&/^[0-9a-f-]{36}$/i.test(actor.tenant_id||'')&&
     /^[0-9a-f-]{36}$/i.test(actor.subject_id||''),'A00_DB_AUTH_REQUIRED');
   requireAgentCapability(actor,'SAVE_PLAN');
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',
    [actor.tenant_id+':'+plan.command_id]);
   const command=resultRows(await client.query(`SELECT status,input_sha256 FROM dd04_stage.commands
    WHERE tenant_id=$1::uuid AND command_id=$2 FOR SHARE`,[actor.tenant_id,plan.command_id]))[0];
   check(command&&command.status==='WAITING_CEO_PLAN','COMMAND_NOT_READY_FOR_PLAN');
   const prior=resultRows(await client.query(`SELECT evidence_sha256,details
    FROM dd04_stage.task_events WHERE tenant_id=$1::uuid AND command_id=$2 AND
    event_name='TASK_PLAN_SAVED' AND details->>'idempotency_key'=$3 LIMIT 1`,
    [actor.tenant_id,plan.command_id,plan.idempotency_key]))[0];
   if(prior){
    check(prior.evidence_sha256===plan.plan_sha256,'PLAN_IDEMPOTENCY_CONFLICT');
    await client.query('COMMIT');begun=false;
    return {ok:true,duplicate:true,plan_sha256:plan.plan_sha256,persistent:true,execute_agents:false};
   }
   const n=resultRows(await client.query(`SELECT count(*)::int AS n FROM dd04_stage.tasks
    WHERE tenant_id=$1::uuid AND command_id=$2`,[actor.tenant_id,plan.command_id]))[0]?.n;
   check(n===0,'PLAN_ALREADY_EXISTS_REQUIRE_RECONCILIATION');
   for(const task of plan.tasks){
    await client.query(`INSERT INTO dd04_stage.tasks
      (tenant_id,command_id,task_id,owner_agent,dependency_task_id,status,revision)
      VALUES ($1::uuid,$2,$3,$4,$5,'PLANNED_WAIT_G1',1)`,
      [actor.tenant_id,plan.command_id,task.task_id,task.owner_agent,task.dependency_task_id]);
   }
   await client.query(`INSERT INTO dd04_stage.task_events
   (tenant_id,command_id,task_id,event_name,actor_kind,actor_ref,
    from_status,to_status,evidence_sha256,details)
    VALUES ($1::uuid,$2,NULL,'TASK_PLAN_SAVED','AGENT',$3,NULL,'PLANNED_WAIT_G1',
      $4,$5::jsonb)`,[actor.tenant_id,plan.command_id,actor.agent_id,
       plan.plan_sha256,JSON.stringify({idempotency_key:plan.idempotency_key,
       task_count:plan.tasks.length,command_input_sha256:command.input_sha256})]);
   await client.query('COMMIT');begun=false;
   return {ok:true,duplicate:false,plan_sha256:plan.plan_sha256,task_count:plan.tasks.length,
    persistent:true,execute_agents:false,publish_allowed:false,plan_state:'PLANNED_WAIT_G1'};
  }catch(error){
   if(begun)await client.query('ROLLBACK').catch(()=>{});
   throw error;
  }finally{client.release()}
 }});
}
