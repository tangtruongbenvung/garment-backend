import { makeCommand, agentsFor } from './runtime-core.mjs';

// DD04-A00-008: backend-only Postgres adapter. No DDL, no CEO approval actions.
const PROJECT='wbvkqfnrlasmtizjszab';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMAND=/^cmd_[a-f0-9]{20}$/;

export function assertStagingDatabaseUrl(raw, tenantId){
 if(typeof raw!=='string'||!UUID.test(tenantId||''))throw new Error('STAGING_DATABASE_CONFIGURATION_REQUIRED');
 let u;try{u=new URL(raw)}catch{throw new Error('INVALID_STAGING_DATABASE_URL')}
 if(!['postgres:','postgresql:'].includes(u.protocol)||!u.password||!u.username||u.pathname!=='/postgres')throw new Error('INVALID_DATABASE_URL');
 const host=u.hostname.toLowerCase(),port=Number(u.port||5432);
 const direct=host==='db.'+PROJECT+'.supabase.co'&&port===5432;
 const pooler=host.endsWith('.pooler.supabase.com')&&port===6543&&decodeURIComponent(u.username)==='postgres.'+PROJECT;
 if(!direct&&!pooler)throw new Error('DATABASE_TARGET_NOT_DD04_STAGING');
 if(u.searchParams.get('sslmode')==='disable')throw new Error('DATABASE_SSL_REQUIRED');
 return {target:'DD04_STAGING_ONLY',mode:direct?'DIRECT':'TRANSACTION_POOLER'};
}

export function createPgRepository(pool,tenantId){
 if(!UUID.test(tenantId||'')||typeof pool?.connect!=='function')throw new Error('INVALID_REPOSITORY_CONFIG');
 async function using(fn){const c=await pool.connect();try{return await fn(c)}finally{c.release()}}
 async function read(c,id){
  if(!COMMAND.test(id))return null;
  const cmd=await c.query('select command_id,external_id,source,input_sha256,message_text,status,received_at,schema_version from dd04_stage.commands where tenant_id=$1 and command_id=$2',[tenantId,id]);
  if(cmd.rows.length!==1)return null;
  const row=cmd.rows[0];
  const [ts,as,es]=await Promise.all([
   c.query('select task_id,owner_agent,dependency_task_id,status,revision,output_refs from dd04_stage.tasks where tenant_id=$1 and command_id=$2 order by created_at,task_id',[tenantId,id]),
   c.query('select gate,decision,approved_by,decided_at from dd04_stage.approvals where tenant_id=$1 and command_id=$2 order by gate,revision',[tenantId,id]),
   c.query('select event_name,actor_ref,occurred_at,evidence_sha256 from dd04_stage.task_events where tenant_id=$1 and command_id=$2 order by event_id',[tenantId,id])
  ]);
  return {schema_version:row.schema_version,command_id:row.command_id,external_id:row.external_id,
   origin:row.source,input_sha256:row.input_sha256,received_at:new Date(row.received_at).toISOString(),
   message_text:row.message_text,status:row.status,auth_level:'STAGING_OPERATOR_TOKEN_NOT_CEO_AUTH',
   meeting:{status:'DRAFT_ROUTING_ONLY',invited_agents:agentsFor(row.message_text),proposals:[],
    policy_review:'NOT_RUN',notes:['Phân tuyến theo quy tắc; chưa gọi LLM/Agent chuyên môn','G1 chưa được CEO duyệt xác thực']},
   task_graph:ts.rows.map(t=>({task_id:t.task_id,owner_agent:t.owner_agent,dependency:t.dependency_task_id,
    status:t.status,revision:t.revision,output_refs:t.output_refs||[]})),
   approvals:as.rows.map(a=>({stage:a.gate==='G1'?'PLAN':a.gate,decision:a.decision,reviewer:a.approved_by,decided_at:a.decided_at})),
   audit:es.rows.map(e=>({at:new Date(e.occurred_at).toISOString(),event:e.event_name,actor:e.actor_ref,input_hash:e.evidence_sha256}))
  };
 }
 async function accept(input){
  const r=makeCommand(input);
  return using(async c=>{
   await c.query('BEGIN');
   try{
    const added=await c.query('insert into dd04_stage.commands(tenant_id,command_id,source,external_id,input_sha256,message_text,status,received_at,schema_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (tenant_id,source,external_id) do nothing returning command_id',
     [tenantId,r.command_id,r.origin,r.external_id,r.input_sha256,r.message_text,r.status,r.received_at,r.schema_version]);
    if(added.rowCount===0){
     const prior=await c.query('select command_id,input_sha256,status from dd04_stage.commands where tenant_id=$1 and source=$2 and external_id=$3 for update',[tenantId,r.origin,r.external_id]);
     if(prior.rowCount!==1)throw new Error('IDEMPOTENCY_LOOKUP_FAILED');
     if(prior.rows[0].input_sha256!==r.input_sha256||prior.rows[0].command_id!==r.command_id){
      await c.query('ROLLBACK');return {code:409,body:{error:'IDEMPOTENCY_CONFLICT',command_id:prior.rows[0].command_id}};
     }
     const count=await c.query('select count(*)::int as n from dd04_stage.tasks where tenant_id=$1 and command_id=$2',[tenantId,r.command_id]);
     await c.query('COMMIT');
     return {code:200,body:{command_id:r.command_id,duplicate:true,status:prior.rows[0].status,task_count:count.rows[0].n}};
    }
    for(const t of r.task_graph)await c.query('insert into dd04_stage.tasks(tenant_id,command_id,task_id,owner_agent,dependency_task_id,status,revision,output_refs) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)',
     [tenantId,r.command_id,t.task_id,t.owner_agent,t.dependency,t.status,t.revision,JSON.stringify(t.output_refs)]);
    await c.query('insert into dd04_stage.approvals(tenant_id,command_id,gate,revision,proposal_sha256) values($1,$2,$3,$4,$5)',[tenantId,r.command_id,'G1',1,r.input_sha256]);
    await c.query('insert into dd04_stage.task_events(tenant_id,command_id,event_name,actor_kind,actor_ref,evidence_sha256) values($1,$2,$3,$4,$5,$6)',[tenantId,r.command_id,'COMMAND_ACCEPTED','SYSTEM','STAGING_OPERATOR',r.input_sha256]);
    await c.query('COMMIT');
    return {code:201,body:{command_id:r.command_id,duplicate:false,status:r.status,task_count:r.task_graph.length,invited_agents:r.meeting.invited_agents}};
   }catch(e){try{await c.query('ROLLBACK')}catch{}throw e}
  });
 }
 async function diagnose(){
  return using(async c=>{
   const db=await c.query('select current_database() as db_name, current_user as db_user');
   const schema=await c.query("select count(*)::int as table_count from information_schema.tables where table_schema='dd04_stage'");
   return {ok:db.rows[0]?.db_name==='postgres'&&schema.rows[0]?.table_count===7,
     stage:'DATABASE_READ_ONLY',tables:schema.rows[0]?.table_count??null};
  });
 }
 async function get(id){return using(c=>read(c,id))}
 async function list(max=30){
  const limit=Math.max(1,Math.min(30,max));
  return using(async c=>{
   const ids=await c.query('select command_id from dd04_stage.commands where tenant_id=$1 order by received_at desc,command_id desc limit $2',[tenantId,limit+1]);
   const records=[];for(const x of ids.rows.slice(0,limit))records.push(await read(c,x.command_id));
   return {source:'SUPABASE_STAGING_POSTGRES',records:records.filter(Boolean),total_keys:ids.rows.length,truncated:ids.rows.length>limit,live_execution_verified:false};
  });
 }
 return {accept,get,list,diagnose};
}
