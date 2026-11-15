// DD04-A00-017 — CEO read-only role-based Agent worklist on staging.
// No mutations, no automatic approval, no false Agent execution statuses.
import {Pool} from 'pg';
import {verifyAuthUser} from '../../dd04-agent-control/ceo-approval-contract.mjs';
import {sessionAssuranceFromVerifiedJwt} from '../../dd04-agent-control/ceo-readiness-core.mjs';
import {isStagingPreviewUrl} from '../../dd04-agent-control/runtime-core.mjs';
import {createVerifiedPgTlsConfig} from '../../dd04-agent-control/pg-tls.mjs';
import {buildAgentWorklist} from '../../dd04-agent-control/v55-automatic-delegation.mjs';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,
 headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const deny=(code,status=403)=>reply({ok:false,error:code,read_only:true},status);
let pool;
export default async request=>{
 if(!isStagingPreviewUrl(request.url))return deny('PREVIEW_ONLY');
 const url=new URL(request.url);
 if(request.method!=='POST'||url.pathname!=='/api/dd04-ceo-agent-worklist')return deny('NOT_FOUND',404);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(token.length<40||token.length>12000)return deny('AUTH_REQUIRED',401);
 const tenantId=process.env.DD04_STAGING_TENANT_ID;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(tenantId||''))return deny('TENANT_CONFIG_INVALID',503);
 const auth=await verifyAuthUser({token,supabaseUrl:'https://wbvkqfnrlasmtizjszab.supabase.co',
  publishableKey:'sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU'});
 if(!auth.ok)return deny(auth.reason,401);
 const claims=sessionAssuranceFromVerifiedJwt(token,auth.userId);
 if(!claims.ok)return deny(claims.reason,401);
 let client;
 try{
  if(!pool){
   const tls=createVerifiedPgTlsConfig(process.env.DD04_STAGING_DATABASE_URL,tenantId,
    process.env.DD04_STAGING_DB_CA_PEM);
   pool=new Pool({...tls,max:2,connectionTimeoutMillis:7000,idleTimeoutMillis:9000,
    statement_timeout:9000,query_timeout:10000});
  }
  client=await pool.connect();
  await client.query('BEGIN READ ONLY');
  const sec=await client.query(`
   SELECT EXISTS(
    SELECT 1 FROM auth.sessions s WHERE s.id=$1::uuid AND s.user_id=$2::uuid
      AND (s.not_after IS NULL OR s.not_after>now())
   ) AS session_valid,
   EXISTS(
    SELECT 1 FROM dd04_stage.ceo_enrollments
    WHERE tenant_id=$3::uuid AND user_id=$2::uuid AND role='CEO'
      AND status='ACTIVE' AND verified_by_admin=true
   ) AS ceo_valid`,[claims.session_id,auth.userId,tenantId]);
  if(!sec.rows[0]?.session_valid||!sec.rows[0]?.ceo_valid){
   await client.query('COMMIT');return deny('CEO_ACTIVE_SESSION_REQUIRED',403);
  }
  const tasks=await client.query(`
   SELECT t.command_id,t.task_id,t.owner_agent,t.status,t.revision,
      t.output_sha256 AS evidence_sha256,t.updated_at,t.created_at,
      c.status AS command_status,c.received_at,
      (SELECT count(*)::int FROM dd04_stage.task_events e
        WHERE e.tenant_id=t.tenant_id AND e.command_id=t.command_id
        AND e.task_id=t.task_id) AS event_count
   FROM dd04_stage.tasks t JOIN dd04_stage.commands c
    ON c.tenant_id=t.tenant_id AND c.command_id=t.command_id
   WHERE t.tenant_id=$1::uuid ORDER BY t.updated_at DESC,t.task_id LIMIT 200`,[tenantId]);
  const g=await client.query(`
   SELECT gate,decision,count(*)::int AS qty FROM dd04_stage.approvals
   WHERE tenant_id=$1::uuid GROUP BY gate,decision`,[tenantId]);
  await client.query('COMMIT');
  const rows=buildAgentWorklist(tasks.rows).map((r,i)=>({
    ...r,command_status:tasks.rows[i]?.command_status,
    event_count:tasks.rows[i]?.event_count??0
  }));
  return reply({ok:true,policy:'DD04_V5_5_CEO_COMMAND_FINANCE_ONLY',
   source:'STAGING_DB_READ_ONLY',agent_runtime_confirmed:false,
   autonomous_approval_enabled:false,publishing_enabled:false,
   legacy_gate_summary:g.rows,rows,truncated:tasks.rowCount>=200,read_only:true});
 }catch{
  if(client){try{await client.query('ROLLBACK')}catch{}}
  return deny('STAGING_WORKLIST_UNAVAILABLE',503);
 }finally{if(client)client.release()}
};
export const config={path:'/api/dd04-ceo-agent-worklist'};
