// DD04-A00-018 — Staging server-only READ-ONLY ledger repository.
// Existing dd04_stage.tasks / commands / task_events are source of truth.
// No agent assertions, role strings or tenant IDs are accepted from HTTP requests.
// This adapter DOES NOT approve, mutate, or unlock any gate.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGENT=/^A(0[0-9]|1[0-7])$/;
const deny=code=>{throw new Error(code)};
const fromRows=x=>Array.isArray(x?.rows)?x.rows:deny('QUERY_RESULT_INVALID');

export function createA0018ReadRepository(pool, serverContext){
 if(!pool||typeof pool.connect!=='function')deny('POOL_REQUIRED');
 // This must be established by a private server-side Auth + enrollment adapter;
 // never construct from a browser payload or LLM-provided "SERVER_VERIFIED" string.
 if(!serverContext||serverContext.provenance!=='PRIVATE_SERVER_AUTH_ADAPTER'||
 !UUID.test(serverContext.tenant_id||'')||!UUID.test(serverContext.subject_id||'')||
 !['CEO','A00','AGENT'].includes(serverContext.kind)||
 (serverContext.kind==='AGENT'&&!AGENT.test(serverContext.agent_id||''))||
 serverContext.active!==true)deny('TRUSTED_SERVER_CONTEXT_REQUIRED');
 const ctx=Object.freeze({...serverContext});
 async function withReadOnly(work){
  const client=await pool.connect();let begun=false;
  try{
   await client.query('BEGIN READ ONLY');begun=true;
   // Pool/repository credentials must be staging only and scoped to this tenant.
   const output=await work(client);
   await client.query('COMMIT');begun=false;return output;
  }catch(error){
   if(begun)await client.query('ROLLBACK').catch(()=>{});
   throw error;
  }finally{client.release()}
 }
 return Object.freeze({
  async worklist({limit=50,offset=0,agent_id}={}){
   if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0||offset>100000)deny('PAGINATION_INVALID');
   if(agent_id!==undefined&&!AGENT.test(agent_id))deny('AGENT_FILTER_INVALID');
   if(ctx.kind==='AGENT'&&agent_id!==undefined&&ctx.agent_id!==agent_id)deny('AGENT_SCOPE_DENIED');
   const filter=ctx.kind==='AGENT'?ctx.agent_id:agent_id||null;
   return withReadOnly(async c=>{
    const tasks=fromRows(await c.query(`select t.tenant_id,t.command_id,t.task_id,t.owner_agent,t.dependency_task_id,
 t.status,t.revision,t.output_sha256,t.created_at,t.updated_at,c.source as command_source,
 c.received_at,c.input_sha256
 from dd04_stage.tasks t inner join dd04_stage.commands c
 on c.tenant_id=t.tenant_id and c.command_id=t.command_id
 where t.tenant_id=$1 and ($2::text is null or t.owner_agent=$2)
 order by t.updated_at desc,t.task_id desc limit $3 offset $4`,[ctx.tenant_id,filter,limit,offset]));
    const count=fromRows(await c.query(`select count(*)::int as total
 from dd04_stage.tasks where tenant_id=$1 and ($2::text is null or owner_agent=$2)`,[ctx.tenant_id,filter]));
    return {source:'SUPABASE_STAGING_EXISTING_TASKS_READ_ONLY',tenant_id:ctx.tenant_id,
      rows:tasks,total:count[0]?.total||0,persistent:true,live_agent_execution_verified:false,
      delegated_approvals_enabled:false,publishing_allowed:false};
   });
  },
  async taskHistory(command_id,task_id){
   if(typeof command_id!=='string'||!/^cmd_[a-f0-9]{20}$/.test(command_id)||
      typeof task_id!=='string'||!/^cmd_[a-f0-9]{20}_A(0[0-9]|1[0-7])$/.test(task_id)||
      !task_id.startsWith(command_id+'_'))deny('TASK_CONTEXT_INVALID');
   if(ctx.kind==='AGENT'&&!task_id.endsWith('_'+ctx.agent_id))deny('AGENT_SCOPE_DENIED');
   return withReadOnly(async c=>{
    const events=fromRows(await c.query(`select event_id,task_id,event_name,actor_kind,actor_ref,
 from_status,to_status,evidence_sha256,details,occurred_at
 from dd04_stage.task_events
 where tenant_id=$1 and command_id=$2 and task_id=$3
 order by event_id desc limit 100`,[ctx.tenant_id,command_id,task_id]));
    return {tenant_id:ctx.tenant_id,task_id,events,read_only:true};
   });
  }
 });
}
