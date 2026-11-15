// DD04-A00-018 | CEO command intake | authenticated staging only.
// Atomic insert of COMMAND+TASK DRAFT+legacy G1 PENDING+audit. No approvals, no AI run.
import {Pool} from 'pg';
import {isStagingPreviewUrl} from '../../dd04-agent-control/runtime-core.mjs';
import {verifyAuthUser} from '../../dd04-agent-control/ceo-approval-contract.mjs';
import {sessionAssuranceFromVerifiedJwt} from '../../dd04-agent-control/ceo-readiness-core.mjs';
import {createVerifiedPgTlsConfig} from '../../dd04-agent-control/pg-tls.mjs';
import {makeCeoCommandDraft,validateCeoSessionRecord} from '../../dd04-agent-control/v55-ceo-command-core.mjs';
const resp=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const fail=(error,status=403)=>resp({ok:false,error,autonomous_execution:false,publishing_enabled:false},status);
let pool;
export default async request=>{
 if(!isStagingPreviewUrl(request.url))return fail('PREVIEW_ONLY');
 if(request.method!=='POST'||new URL(request.url).pathname!=='/api/dd04-ceo-command')return fail('NOT_FOUND',404);
 if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))
  return fail('JSON_REQUIRED',415);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(token.length<40||token.length>12000)return fail('AUTH_REQUIRED',401);
 const tenantId=process.env.DD04_STAGING_TENANT_ID;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId||''))
  return fail('TENANT_CONFIG_INVALID',503);
 const auth=await verifyAuthUser({token,supabaseUrl:'https://wbvkqfnrlasmtizjszab.supabase.co',
  publishableKey:'sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU'});
 if(!auth.ok)return fail(auth.reason,401);
 const claims=sessionAssuranceFromVerifiedJwt(token,auth.userId);
 if(!claims.ok)return fail(claims.reason,401);
 if(claims.aal!=='aal2')return fail('MFA_AAL2_REQUIRED',403);
 let input;
 try{const raw=await request.text();if(raw.length>4000)return fail('PAYLOAD_TOO_LARGE',413);input=JSON.parse(raw)}
 catch{return fail('INVALID_JSON',400)}
 const draft=makeCeoCommandDraft(input);
 if(!draft.ok)return fail(draft.error,400);
 let client;
 try{
  if(!pool){
   const cfg=createVerifiedPgTlsConfig(process.env.DD04_STAGING_DATABASE_URL,tenantId,
    process.env.DD04_STAGING_DB_CA_PEM);
   pool=new Pool({...cfg,max:2,connectionTimeoutMillis:7000,idleTimeoutMillis:9000,
    statement_timeout:12000,query_timeout:14000});
  }
  client=await pool.connect();
  await client.query('BEGIN');
  const sec=await client.query(`
   SELECT EXISTS(SELECT 1 FROM auth.sessions s
      JOIN auth.mfa_factors f ON f.id=s.factor_id AND f.user_id=s.user_id
      WHERE s.id=$1::uuid AND s.user_id=$2::uuid AND s.aal='aal2'
        AND f.factor_type='totp' AND f.status='verified'
        AND (s.not_after IS NULL OR s.not_after>now())) AS session_valid,
   EXISTS(SELECT 1 FROM dd04_stage.ceo_enrollments
      WHERE tenant_id=$3::uuid AND user_id=$2::uuid AND role='CEO'
       AND status='ACTIVE' AND verified_by_admin=true) AS ceo_valid
   `,[claims.session_id,auth.userId,tenantId]);
  const security=validateCeoSessionRecord({userId:auth.userId,tenantId,claims,verified:sec.rows[0]});
  if(!security.ok){await client.query('ROLLBACK');return fail(security.error)}
  const added=await client.query(`
   INSERT INTO dd04_stage.commands
     (tenant_id,command_id,source,external_id,input_sha256,message_text,status,received_at,schema_version,created_by)
   VALUES($1::uuid,$2,$3,$4,$5,$6,'WAITING_CEO_PLAN',now(),'5.3',$7::uuid)
   ON CONFLICT(tenant_id,source,external_id) DO NOTHING RETURNING command_id
   `,[tenantId,draft.command_id,draft.source,draft.external_id,draft.input_sha256,draft.message_text,auth.userId]);
  if(added.rowCount===0){
   const prev=await client.query(`
    SELECT command_id,input_sha256,status FROM dd04_stage.commands
    WHERE tenant_id=$1::uuid AND source=$2 AND external_id=$3 FOR UPDATE
    `,[tenantId,draft.source,draft.external_id]);
   if(prev.rowCount!==1){await client.query('ROLLBACK');return fail('IDEMPOTENCY_LOOKUP_UNAVAILABLE',409)}
   if(prev.rows[0].command_id!==draft.command_id||prev.rows[0].input_sha256!==draft.input_sha256){
    await client.query('ROLLBACK');return fail('IDEMPOTENCY_CONFLICT',409);
   }
   await client.query('COMMIT');
   return resp({ok:true,duplicate:true,command_id:draft.command_id,status:prev.rows[0].status,
    autonomous_execution:false,publishing_enabled:false});
  }
  for(const t of draft.taskGraph){
   await client.query(`
    INSERT INTO dd04_stage.tasks(tenant_id,command_id,task_id,owner_agent,
      dependency_task_id,status,revision,output_refs)
    VALUES($1::uuid,$2,$3,$4,$5,'PLANNED_WAIT_G1',1,'[]'::jsonb)
    `,[tenantId,draft.command_id,t.task_id,t.owner_agent,t.dependency_task_id]);
  }
  await client.query(`
   INSERT INTO dd04_stage.approvals(tenant_id,command_id,gate,revision,proposal_sha256)
   VALUES($1::uuid,$2,'G1',1,$3)`,[tenantId,draft.command_id,draft.input_sha256]);
  await client.query(`
   INSERT INTO dd04_stage.task_events(tenant_id,command_id,event_name,actor_kind,
     actor_ref,evidence_sha256,details)
   VALUES($1::uuid,$2,'CEO_COMMAND_RECEIVED','CEO',$3,$4,$5::jsonb)
   `,[tenantId,draft.command_id,auth.userId,draft.input_sha256,
     JSON.stringify({policy_version:draft.policy_version,source:draft.source,
      stage:'DRAFT_ONLY',agent_execution_enabled:false,uploaded_files:0})]);
  await client.query('COMMIT');
  return resp({ok:true,duplicate:false,command_id:draft.command_id,
   status:'WAITING_CEO_PLAN',task_count:draft.taskGraph.length,
   assigned_agents:draft.taskGraph.map(x=>x.owner_agent),
   attachment_storage_enabled:false,autonomous_execution:false,publishing_enabled:false},201);
 }catch(e){
  if(client){try{await client.query('ROLLBACK')}catch{}}
  // Never emit raw PG error or credentials.
  return fail(['23505','23503','23514'].includes(String(e?.code))?
   'STAGING_CONSTRAINT_BLOCKED':'STAGING_COMMAND_INTAKE_UNAVAILABLE',503);
 }finally{if(client)client.release()}
};
export const config={path:'/api/dd04-ceo-command'};
