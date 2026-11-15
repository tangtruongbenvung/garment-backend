// DD04 A00-020 — attach a verified, registered output artifact to a task.
// Private server-only; no upload endpoint, no LLM authority, no provider spending.
import {createHash} from 'node:crypto';
import {requireAgentCapability} from './a00-020-db-actor-resolver.mjs';
const CMD=/^cmd_[a-f0-9]{20}$/;
const HEX=/^[0-9a-f]{64}$/;
const KEY=/^[A-Za-z0-9:_-]{8,120}$/;
const AGENT=/^A(0[0-9]|1[0-7])$/;
const deny=code=>{throw new Error(code)};
const need=(condition,code)=>{if(!condition)deny(code)};
const rows=r=>Array.isArray(r?.rows)?r.rows:deny('DB_RESULT_INVALID');
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

export function createA0020ArtifactAttacher(pool,resolveVerifiedActor){
 need(pool&&typeof pool.connect==='function'&&typeof resolveVerifiedActor==='function','PRIVATE_RUNTIME_REQUIRED');
 return Object.freeze({async attach(request,credential){
  need(request&&typeof request==='object'&&!Array.isArray(request),'REQUEST_REQUIRED');
  for(const name of ['tenant_id','agent_id','actor_id','role','approved','publish_allowed'])
   need(!Object.hasOwn(request,name),'CLIENT_AUTHORITY_FIELD_FORBIDDEN');
  const {command_id,task_id,artifact_sha256,expected_revision,idempotency_key}=request;
  need(CMD.test(command_id)&&typeof task_id==='string'&&
   task_id.startsWith(command_id+'_')&&AGENT.test(task_id.slice(command_id.length+1)),
   'TASK_ID_INVALID');
  need(HEX.test(artifact_sha256)&&Number.isInteger(expected_revision)&&expected_revision>=1&&
   KEY.test(idempotency_key),'ARTIFACT_REQUEST_INVALID');
  const requestHash=hash({command_id,task_id,artifact_sha256,expected_revision,idempotency_key});
  const client=await pool.connect();let begun=false;
  try{
   await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');begun=true;
   await client.query('SET LOCAL ROLE dd04_a00_runtime');
   await client.query("SET LOCAL statement_timeout='8000ms'");
   await client.query("SELECT pg_catalog.set_config('dd04.worker_credential',$1,true)",[credential]);
   const actor=await resolveVerifiedActor(client,credential);
   need(actor?.verified_by_db===true&&actor.active===true&&actor.runtime_environment==='STAGING'
    &&AGENT.test(actor.agent_id||'')&&typeof actor.tenant_id==='string','DB_ACTOR_REQUIRED');
   requireAgentCapability(actor,'ATTACH');
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',
     [actor.tenant_id+':'+idempotency_key]);
   const duplicate=rows(await client.query(`SELECT event_id,request_sha256
    FROM dd04_stage.a00_transition_events
    WHERE tenant_id=$1::uuid AND idempotency_key=$2`,
    [actor.tenant_id,idempotency_key]))[0];
   if(duplicate){
    need(duplicate.request_sha256===requestHash,'IDEMPOTENCY_CONFLICT');
    await client.query('COMMIT');begun=false;
    return {ok:true,duplicate:true,event_id:duplicate.event_id,publish_allowed:false};
   }
   const task=rows(await client.query(`SELECT t.owner_agent,t.status AS canonical_status,
     c.state,c.revision
     FROM dd04_stage.tasks t JOIN dd04_stage.a00_task_contexts c
     ON c.tenant_id=t.tenant_id AND c.command_id=t.command_id AND c.task_id=t.task_id
     WHERE t.tenant_id=$1::uuid AND t.command_id=$2 AND t.task_id=$3
     FOR UPDATE OF c`,[actor.tenant_id,command_id,task_id]))[0];
   need(task&&task.owner_agent===actor.agent_id,'TASK_OWNER_REQUIRED');
   need(task.state==='IN_PROGRESS'&&['PLANNED_WAIT_G1','READY','IN_PROGRESS'].includes(task.canonical_status)&&
    task.revision===expected_revision,'TASK_NOT_READY_OR_STALE');
   const gate=rows(await client.query(`SELECT dd04_stage.a00_022_effective_g1(
    $1::uuid,$2::text) AS passed`,[actor.tenant_id,command_id]))[0];
   need(gate?.passed===true,'G1_STILL_LOCKED');
   const artifact=rows(await client.query(`SELECT artifact_id,storage_ref,sha256
    FROM dd04_stage.artifacts WHERE tenant_id=$1::uuid AND command_id=$2
    AND task_id=$3 AND sha256=$4 ORDER BY version DESC LIMIT 1`,
    [actor.tenant_id,command_id,task_id,artifact_sha256]))[0];
   need(artifact&&artifact.sha256===artifact_sha256&&artifact.storage_ref,'ARTIFACT_NOT_REGISTERED');
   const event=rows(await client.query(`INSERT INTO dd04_stage.a00_transition_events
    (tenant_id,command_id,task_id,actor_user_id,agent_id,action,
     from_state,to_state,evidence_sha256,request_sha256,expected_revision,idempotency_key)
    VALUES ($1::uuid,$2,$3,$4::uuid,$5,'ATTACH','IN_PROGRESS','IN_PROGRESS',
      $6,$7,$8,$9) RETURNING event_id`,
    [actor.tenant_id,command_id,task_id,actor.subject_id,actor.agent_id,
     artifact_sha256,requestHash,expected_revision,idempotency_key]))[0];
   const updated=rows(await client.query(`UPDATE dd04_stage.a00_task_contexts
    SET output_sha256=$4,
      output_refs=jsonb_build_array(jsonb_build_object('artifact_id',$5::text,'storage_ref',$6::text)),
      revision=revision+1,updated_at=now()
    WHERE tenant_id=$1::uuid AND command_id=$2 AND task_id=$3
      AND state='IN_PROGRESS' AND revision=$7 RETURNING revision`,
    [actor.tenant_id,command_id,task_id,artifact_sha256,String(artifact.artifact_id),
     artifact.storage_ref,expected_revision]))[0];
   need(updated,'ARTIFACT_CAS_CONFLICT');
   await client.query('COMMIT');begun=false;
   return {ok:true,duplicate:false,event_id:event.event_id,revision:updated.revision,
    artifact_sha256,persistent:true,publish_allowed:false};
  }catch(e){if(begun)await client.query('ROLLBACK').catch(()=>{});throw e;}
  finally{client.release();}
 }});
}
