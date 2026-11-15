// DD04-A00-014: CEO review queue, read only and only after MFA aal2.
// The queue does not approve, prepare or change any decision.
import {Pool} from 'pg';
import {verifyAuthUser} from '../../dd04-agent-control/ceo-approval-contract.mjs';
import {sessionAssuranceFromVerifiedJwt} from '../../dd04-agent-control/ceo-readiness-core.mjs';
import {isStagingPreviewUrl} from '../../dd04-agent-control/runtime-core.mjs';
import {createVerifiedPgTlsConfig} from '../../dd04-agent-control/pg-tls.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const deny=(error,status=403)=>reply({ok:false,error,decision_enabled:false},status);
let pool;
export default async request=>{
 if(!isStagingPreviewUrl(request.url))return deny('PREVIEW_ONLY');
 if(request.method!=='POST'||new URL(request.url).pathname!=='/api/dd04-ceo-gate-list')return deny('NOT_FOUND',404);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(token.length<40||token.length>12000)return deny('AUTH_REQUIRED',401);
 const tenantId=process.env.DD04_STAGING_TENANT_ID;
 if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(tenantId||''))return deny('TENANT_CONFIG_INVALID',503);
 const auth=await verifyAuthUser({token,supabaseUrl:'https://wbvkqfnrlasmtizjszab.supabase.co',
  publishableKey:'sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU'});
 if(!auth.ok)return deny(auth.reason,401);
 const claims=sessionAssuranceFromVerifiedJwt(token,auth.userId);
 if(!claims.ok)return deny(claims.reason,401);
 if(claims.aal!=='aal2')return deny('MFA_AAL2_REQUIRED');
 let client;
 try{
  if(!pool){
   const tls=createVerifiedPgTlsConfig(process.env.DD04_STAGING_DATABASE_URL,tenantId,
    process.env.DD04_STAGING_DB_CA_PEM);
   pool=new Pool({...tls,max:2,connectionTimeoutMillis:7000,
    idleTimeoutMillis:9000,statement_timeout:9000,query_timeout:10000});
  }
  client=await pool.connect();
  await client.query('BEGIN READ ONLY');
  const security=await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM auth.sessions s
      JOIN auth.mfa_factors f ON f.id=s.factor_id AND f.user_id=s.user_id
      WHERE s.id=$1::uuid AND s.user_id=$2::uuid AND s.aal='aal2'
       AND f.status='verified' AND f.factor_type='totp'
       AND (s.not_after IS NULL OR s.not_after>now())
    ) AS valid_session,
    EXISTS (
      SELECT 1 FROM dd04_stage.ceo_enrollments
      WHERE tenant_id=$3::uuid AND user_id=$2::uuid
       AND role='CEO' AND status='ACTIVE' AND verified_by_admin=true
    ) AS valid_ceo`,[claims.session_id,auth.userId,tenantId]);
  if(security.rows[0]?.valid_session!==true||security.rows[0]?.valid_ceo!==true){
   await client.query('COMMIT');return deny('CEO_MFA_SESSION_REQUIRED',403);
  }
  const pending=await client.query(`
   SELECT a.approval_id,a.command_id,a.gate,a.revision,a.created_at,
     c.status AS command_status
   FROM dd04_stage.approvals a
   JOIN dd04_stage.commands c
    ON c.tenant_id=a.tenant_id AND c.command_id=a.command_id
   WHERE a.tenant_id=$1::uuid AND a.decision='PENDING'
     AND a.approved_by IS NULL AND a.decided_at IS NULL
   ORDER BY a.created_at DESC LIMIT 30`,[tenantId]);
  await client.query('COMMIT');
  return reply({ok:true,items:pending.rows,decision_enabled:false,read_only:true});
 }catch{
  if(client){try{await client.query('ROLLBACK')}catch{}}
  return deny('STAGING_REVIEW_QUEUE_UNAVAILABLE',503);
 }finally{if(client)client.release()}
};
export const config={path:'/api/dd04-ceo-gate-list'};
