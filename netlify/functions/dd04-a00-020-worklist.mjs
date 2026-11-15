// DD04-A00-020: CEO Master Task Ledger, LIVE STAGING DB, READ ONLY.
// No G1/G2 decisions, no task transitions, no spending, no publication.
import {Pool} from 'pg';
import {verifyAuthUser} from '../../dd04-agent-control/ceo-approval-contract.mjs';
import {sessionAssuranceFromVerifiedJwt} from '../../dd04-agent-control/ceo-readiness-core.mjs';
import {isStagingPreviewUrl} from '../../dd04-agent-control/runtime-core.mjs';
import {createVerifiedPgTlsConfig} from '../../dd04-agent-control/pg-tls.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const deny=(code,status=403)=>json({ok:false,error:code,publish_allowed:false,write_enabled:false},status);
let pool;
export default async request=>{
 if(!isStagingPreviewUrl(request.url))return deny('STAGING_PREVIEW_ONLY');
 if(request.method!=='POST'||new URL(request.url).pathname!=='/api/dd04-a00-020-worklist')return deny('NOT_FOUND',404);
 const bearer=request.headers.get('authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(bearer))return deny('AUTH_REQUIRED',401);
 const token=bearer.replace(/^Bearer\s+/i,'');
 if(token.length<40||token.length>12000)return deny('AUTH_REQUIRED',401);
 const tenantId=process.env.DD04_STAGING_TENANT_ID;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(tenantId||''))return deny('STAGING_TENANT_CONFIG_INVALID',503);
 const auth=await verifyAuthUser({token,supabaseUrl:'https://wbvkqfnrlasmtizjszab.supabase.co',
 publishableKey:'sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU'});
 if(!auth.ok)return deny(auth.reason,401);
 const claims=sessionAssuranceFromVerifiedJwt(token,auth.userId);
 if(!claims.ok)return deny(claims.reason,401);
 if(claims.aal!=='aal2')return deny('MFA_AAL2_REQUIRED');
 let client,begin=false;
 try{
  if(!pool){
   const tls=createVerifiedPgTlsConfig(process.env.DD04_STAGING_DATABASE_URL,tenantId,process.env.DD04_STAGING_DB_CA_PEM);
   pool=new Pool({...tls,max:2,connectionTimeoutMillis:7000,idleTimeoutMillis:9000,statement_timeout:9000,query_timeout:10000});
  }
  client=await pool.connect();
  await client.query('BEGIN READ ONLY');begin=true;
  const s=await client.query(`SELECT
  EXISTS(SELECT 1 FROM auth.sessions x JOIN auth.mfa_factors f
   ON f.id=x.factor_id AND f.user_id=x.user_id
   WHERE x.id=$1::uuid AND x.user_id=$2::uuid AND x.aal='aal2'
    AND f.status='verified' AND f.factor_type='totp'
    AND (x.not_after IS NULL OR x.not_after>now())) AS valid_session,
  EXISTS(SELECT 1 FROM dd04_stage.ceo_enrollments e
   WHERE e.tenant_id=$3::uuid AND e.user_id=$2::uuid AND
   e.role='CEO' AND e.status='ACTIVE' AND e.verified_by_admin=true) AS valid_ceo`,
   [claims.session_id,auth.userId,tenantId]);
  if(s.rows[0]?.valid_session!==true||s.rows[0]?.valid_ceo!==true){
   await client.query('COMMIT');begin=false;return deny('CEO_AAL2_ENROLLMENT_REQUIRED');
  }
  const result=await client.query(`SELECT t.command_id,t.task_id,t.owner_agent,
   t.dependency_task_id,t.status,t.revision,t.updated_at,
   c.source AS command_source
   FROM dd04_stage.tasks t JOIN dd04_stage.commands c
   ON c.tenant_id=t.tenant_id AND c.command_id=t.command_id
   WHERE t.tenant_id=$1::uuid ORDER BY t.updated_at DESC,t.task_id LIMIT 100`,[tenantId]);
  const counts=await client.query(`SELECT
   (SELECT count(*)::int FROM dd04_stage.commands WHERE tenant_id=$1::uuid) AS commands,
   (SELECT count(*)::int FROM dd04_stage.tasks WHERE tenant_id=$1::uuid) AS tasks,
   (SELECT count(*)::int FROM dd04_stage.v55_agent_handoff_events WHERE tenant_id=$1::uuid) AS handoffs,
   (SELECT count(*)::int FROM dd04_stage.v55_finance_cases WHERE tenant_id=$1::uuid) AS finance_cases,
   (SELECT count(*)::int FROM dd04_stage.v55_publish_jobs WHERE tenant_id=$1::uuid) AS publish_jobs`,[tenantId]);
  await client.query('COMMIT');begin=false;
  return json({ok:true,source:'DD04_STAGING_SUPABASE',read_only:true,persistent:true,
   rows:result.rows,counts:counts.rows[0],write_enabled:false,publish_allowed:false,
   status:'LEGACY_TASKS_G1_LOCKED_A00_020_PENDING_MIGRATION',
   note:'Danh sách đọc từ DB staging; giao dịch A00-020 chưa kích hoạt khi thiếu migration và server actor authorization.'});
 }catch{
  if(begin)await client.query('ROLLBACK').catch(()=>{});
  return deny('STAGING_WORKLIST_READ_UNAVAILABLE',503);
 }finally{if(client)client.release()}
};
export const config={path:'/api/dd04-a00-020-worklist'};
