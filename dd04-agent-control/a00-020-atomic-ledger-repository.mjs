// DD04-A00-020 — Atomic task + independent review + handoff; PRIVATE SERVER LIBRARY.
// NO HTTP entrypoint. NO bypass of G1/G2, finance controls, task guards or publish lock.
// Requires reviewed staging schema 22_A00_020 and a separately trusted, DB-backed actor resolver.
import {createHash} from 'node:crypto';
const HEX=/^[a-f0-9]{64}$/;
const AGENT=/^A(0[0-9]|1[0-7])$/;
const COMMAND=/^cmd_[a-f0-9]{20}$/;
const KEY=/^[A-Za-z0-9:_-]{8,120}$/;
const STATES=new Set(['BLOCKED','READY','IN_PROGRESS','INTERNAL_REVIEW','NEEDS_FIX','APPROVED_INTERNAL','HOLD']);
const fail=(code)=>{throw Object.assign(new Error(code),{code})};
const rows=(result)=>Array.isArray(result?.rows)?result.rows:fail('DB_RESULT_INVALID');
const hash=(value)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ensure=(ok,code)=>{if(!ok)fail(code)};
const allowAction=(actor,task,action)=>{
  ensure(AGENT.test(task.owner_agent),'TASK_OWNER_INVALID');
  if(action==='START'||action==='SUBMIT'||action==='REWORK'){
    ensure(actor.agent_id===task.owner_agent,'TASK_OWNER_REQUIRED');
  }else{
    ensure(actor.agent_id!==task.owner_agent,'INDEPENDENT_REVIEW_REQUIRED');
    // A08/A09 can check production; reviews of either QC agent are handled by A00.
    ensure(actor.agent_id==='A08'||actor.agent_id==='A09'||actor.agent_id==='A00','REVIEWER_CAPABILITY_REQUIRED');
  }
};
function validateRequest(input){
 ensure(input&&typeof input==='object'&&!Array.isArray(input),'REQUEST_INVALID');
 const {command_id,task_id,action,expected_revision,idempotency_key,evidence_sha256,report_sha256}=input;
 ensure(COMMAND.test(command_id)&&typeof task_id==='string'&&task_id.startsWith(command_id+'_')&&task_id.length<=150,'TASK_ID_INVALID');
 ensure(['START','SUBMIT','REVIEW_PASS','REVIEW_FAIL','REWORK'].includes(action),'ACTION_INVALID');
 ensure(Number.isSafeInteger(expected_revision)&&expected_revision>=1,'REVISION_INVALID');
 ensure(KEY.test(idempotency_key),'IDEMPOTENCY_KEY_INVALID');
 ensure(HEX.test(evidence_sha256),'EVIDENCE_HASH_REQUIRED');
 ensure(action!=='REVIEW_PASS'&&action!=='REVIEW_FAIL'||HEX.test(report_sha256),'REVIEW_REPORT_REQUIRED');
 // Do not accept user/client-supplied tenant, actor, reviewer, role, gate or spend flags.
 for(const field of ['tenant_id','actor_id','actor_kind','agent_id','reviewer','approved','publish_allowed','finance_approved']){
   ensure(!Object.hasOwn(input,field),'CLIENT_AUTHORITY_FIELD_FORBIDDEN');
 }
 return {command_id,task_id,action,expected_revision,idempotency_key,evidence_sha256,report_sha256:report_sha256||null};
}
function validateActor(actor){
 ensure(actor&&actor.verified_by_db===true&&actor.active===true&&
 /^[0-9a-f-]{36}$/i.test(actor.tenant_id||'')&&
 /^[0-9a-f-]{36}$/i.test(actor.subject_id||'')&&
 AGENT.test(actor.agent_id||'')&&actor.runtime_environment==='STAGING','DB_VERIFIED_ACTOR_REQUIRED');
 return Object.freeze({...actor});
}
const MAP={
 START:{from:['READY'],to:'IN_PROGRESS'},
 SUBMIT:{from:['IN_PROGRESS'],to:'INTERNAL_REVIEW'},
 REVIEW_PASS:{from:['INTERNAL_REVIEW'],to:'APPROVED_INTERNAL'},
 REVIEW_FAIL:{from:['INTERNAL_REVIEW'],to:'NEEDS_FIX'},
 REWORK:{from:['NEEDS_FIX'],to:'IN_PROGRESS'}
};
export function createA0020LedgerRepository(pool,resolveVerifiedActor,{environment='STAGING'}={}){
 ensure(environment==='STAGING','STAGING_ONLY');
 ensure(pool&&typeof pool.connect==='function'&&typeof resolveVerifiedActor==='function','PRIVATE_DEPENDENCIES_REQUIRED');
 // A DB-backed resolver MUST use a validated session or internal worker identity,
 // check tenant membership and agent capability; never use an HTTP role/agent claim.
 async function transact(input,serverCredential){
  const request=validateRequest(input);
  const request_hash=hash(request);
  const client=await pool.connect();let begun=false;
  try{
   await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');begun=true;
   await client.query("SET LOCAL statement_timeout='8000ms'");
   const actor=validateActor(await resolveVerifiedActor(client,serverCredential));
   // per-tenant idempotency serialization; keys across tenants are independent.
   await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',[actor.tenant_id+':'+request.idempotency_key]);
   const prior=rows(await client.query(`SELECT event_id,request_sha256,from_state,to_state
 FROM dd04_stage.a00_transition_events WHERE tenant_id=$1::uuid AND idempotency_key=$2`,
     [actor.tenant_id,request.idempotency_key]))[0];
   if(prior){
    ensure(prior.request_sha256===request_hash,'IDEMPOTENCY_CONFLICT');
    await client.query('COMMIT');begun=false;
    return {ok:true,duplicate:true,event_id:prior.event_id,state:prior.to_state,persistent:true,publish_allowed:false};
   }
   const task=rows(await client.query(`SELECT t.owner_agent,t.status AS legacy_status,
 x.state,x.revision,x.dependency_task_ids,x.channel_id,x.profile_version,x.profile_sha256,
 x.output_sha256,x.output_refs,x.last_reviewer_agent
 FROM dd04_stage.tasks t JOIN dd04_stage.a00_task_contexts x
 ON x.tenant_id=t.tenant_id AND x.command_id=t.command_id AND x.task_id=t.task_id
 WHERE t.tenant_id=$1::uuid AND t.command_id=$2 AND t.task_id=$3
 FOR UPDATE OF x`,[actor.tenant_id,request.command_id,request.task_id]))[0];
   ensure(task,'TASK_NOT_FOUND_OR_NOT_MIGRATED');
   ensure(task.revision===request.expected_revision,'STALE_REVISION');
   ensure(STATES.has(task.state),'STATE_INVALID');
   ensure(task.owner_agent!=='A07','A07_PUBLISH_LOCKED');
   const spec=MAP[request.action];
   ensure(spec.from.includes(task.state),'TRANSITION_NOT_ALLOWED');
   allowAction(actor,task,request.action);
   // The original DB gate remains authoritative. A pending G1 never starts content.
   const gate=rows(await client.query(`SELECT EXISTS(
 SELECT 1 FROM dd04_stage.approvals
 WHERE tenant_id=$1::uuid AND command_id=$2 AND gate='G1' AND decision='APPROVED'
 ) AS passed`,[actor.tenant_id,request.command_id]))[0];
   ensure(gate?.passed===true,'G1_STILL_LOCKED');
   if(request.action==='START'){
    const deps=Array.isArray(task.dependency_task_ids)?task.dependency_task_ids:[];
    const validated=rows(await client.query(`SELECT task_id,state FROM dd04_stage.a00_task_contexts
 WHERE tenant_id=$1::uuid AND command_id=$2 AND task_id=ANY($3::text[]) FOR SHARE`,
      [actor.tenant_id,request.command_id,deps]));
    ensure(deps.length===validated.length&&validated.every(d=>d.state==='APPROVED_INTERNAL'),'DEPENDENCY_NOT_APPROVED');
   }
   if(request.action==='SUBMIT'){
     ensure(Array.isArray(task.output_refs)&&task.output_refs.length>0,'ARTIFACT_REFS_REQUIRED');
     ensure(HEX.test(task.profile_sha256||'')||task.channel_id===null,'CHANNEL_PROFILE_UNVERIFIED');
   }
   if(request.action==='REVIEW_PASS'||request.action==='REVIEW_FAIL'){
    ensure(HEX.test(task.output_sha256||'')&&task.output_sha256===request.evidence_sha256,'REVIEW_INPUT_HASH_MISMATCH');
    ensure(actor.agent_id!==task.last_reviewer_agent||request.action==='REVIEW_FAIL','REPEATED_REVIEWER_DENIED');
    ensure(request.report_sha256!==request.evidence_sha256,'REPORT_MUST_BE_INDEPENDENT');
   }
   const event=rows(await client.query(`INSERT INTO dd04_stage.a00_transition_events
 (tenant_id,command_id,task_id,actor_user_id,agent_id,action,from_state,to_state,
 evidence_sha256,report_sha256,request_sha256,expected_revision,idempotency_key)
 VALUES ($1::uuid,$2,$3,$4::uuid,$5,$6,$7,$8,$9,$10,$11,$12,$13)
 RETURNING event_id`,[actor.tenant_id,request.command_id,request.task_id,actor.subject_id,
 actor.agent_id,request.action,task.state,spec.to,request.evidence_sha256,
 request.report_sha256,request_hash,request.expected_revision,request.idempotency_key]))[0];
   const outputHash=request.action==='SUBMIT'?request.evidence_sha256:
     request.action==='REWORK'?null:task.output_sha256;
   const updated=rows(await client.query(`UPDATE dd04_stage.a00_task_contexts
 SET state=$4,revision=revision+1,output_sha256=$5,
 last_reviewer_agent=$6,updated_at=now()
 WHERE tenant_id=$1::uuid AND command_id=$2 AND task_id=$3 AND revision=$7
 RETURNING revision`,[actor.tenant_id,request.command_id,request.task_id,spec.to,outputHash,
 request.action.startsWith('REVIEW_')?actor.agent_id:task.last_reviewer_agent,request.expected_revision]))[0];
   ensure(updated,'REVISION_CONFLICT');
   if(request.action==='SUBMIT'){
    // Only PENDING is permitted in the legacy V5.5 handoff table.
    // Review outcome is persisted in private immutable transition events.
    await client.query(`INSERT INTO dd04_stage.v55_agent_handoff_events
 (tenant_id,command_id,task_id,from_agent,to_agent,revision,input_sha256,report_sha256,verdict)
 VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,'PENDING')`,
 [actor.tenant_id,request.command_id,request.task_id,task.owner_agent,
 task.owner_agent==='A08'?'A09':'A08',updated.revision,request.evidence_sha256,
 request.evidence_sha256]);
   }
   // Auto-unblock dependent task contexts after verified independent review.
   // This does not modify protected legacy tasks and does not authorize execution.
   let unblocked=[];
   if(request.action==='REVIEW_PASS'){
    const next=rows(await client.query(`UPDATE dd04_stage.a00_task_contexts target
 SET state='READY',revision=target.revision+1,updated_at=now()
 WHERE target.tenant_id=$1::uuid AND target.command_id=$2 AND target.state='BLOCKED'
 AND $3=ANY(target.dependency_task_ids)
 AND NOT EXISTS (
 SELECT 1 FROM unnest(target.dependency_task_ids) AS dep(id)
 LEFT JOIN dd04_stage.a00_task_contexts src
 ON src.tenant_id=target.tenant_id AND src.command_id=target.command_id AND src.task_id=dep.id
 WHERE src.state IS DISTINCT FROM 'APPROVED_INTERNAL'
 ) AND target.task_id<>$3
 RETURNING target.task_id,target.revision`,[actor.tenant_id,request.command_id,request.task_id]));
    // Preserve append-only evidence for every automatically unblocked dependent task.
    // All writes share the same SERIALIZABLE transaction and rollback together.
    for(const t of next){
      const autoKey='auto:'+hash([actor.tenant_id,request.command_id,t.task_id,event.event_id]).slice(0,48);
      const autoHash=hash({source_event_id:event.event_id,task_id:t.task_id,to:'READY'});
      await client.query(`INSERT INTO dd04_stage.a00_transition_events
       (tenant_id,command_id,task_id,actor_user_id,agent_id,action,from_state,to_state,
        evidence_sha256,report_sha256,request_sha256,expected_revision,idempotency_key)
       VALUES ($1::uuid,$2,$3,$4::uuid,$5,'AUTO_READY','BLOCKED','READY',$6,$7,$8,$9,$10)`,
       [actor.tenant_id,request.command_id,t.task_id,actor.subject_id,actor.agent_id,
        request.evidence_sha256,request.report_sha256,autoHash,t.revision-1,autoKey]);
    }
    unblocked=next.map(r=>r.task_id);
   }
   await client.query('COMMIT');begun=false;
   return {ok:true,duplicate:false,event_id:event.event_id,state:spec.to,
     revision:updated.revision,unblocked,persistent:true,publish_allowed:false,
     legacy_task_state_unchanged:true};
  }catch(err){
   if(begun)await client.query('ROLLBACK').catch(()=>{});
   throw err;
  }finally{client.release()}
 }
 return Object.freeze({transact});
}
