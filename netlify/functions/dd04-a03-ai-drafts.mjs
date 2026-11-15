// DD04-A03 optional billed provider: staging preview, CEO Auth/MFA and finance policy required.
// Nothing is generated, persisted, billed or published when policy is unconfigured.
import {Pool} from 'pg';
import {verifyAuthUser} from '../../dd04-agent-control/ceo-approval-contract.mjs';
import {sessionAssuranceFromVerifiedJwt} from '../../dd04-agent-control/ceo-readiness-core.mjs';
import {createVerifiedPgTlsConfig} from '../../dd04-agent-control/pg-tls.mjs';
import {isStagingPreviewUrl} from '../../dd04-agent-control/runtime-core.mjs';
import {generateA03WithOpenAI} from '../../dd04-agent-control/a03-openai-provider.mjs';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer',
 'x-content-type-options':'nosniff'}});
const deny=(error,status=403)=>response({ok:false,error,real_llm_execution:false,publishing_allowed:false},status);
let pool;
export default async request=>{
 if(!isStagingPreviewUrl(request.url))return deny('STAGING_PREVIEW_ONLY');
 if(request.method!=='POST'||new URL(request.url).pathname!=='/api/dd04-a03-ai-drafts')return deny('NOT_FOUND',404);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(token.length<40||token.length>12000)return deny('AUTH_REQUIRED',401);
 if(!(request.headers.get('content-type')||'').includes('application/json'))return deny('JSON_REQUIRED',415);
 let plan;try{const raw=await request.text();if(raw.length>14000)return deny('TOO_LARGE',413);
  plan=JSON.parse(raw)}catch{return deny('INVALID_JSON',400)}
 const tenantId=process.env.DD04_STAGING_TENANT_ID;
 if(!/^[a-f0-9-]{36}$/i.test(tenantId||''))return deny('STAGING_TENANT_NOT_CONFIGURED',503);
 const auth=await verifyAuthUser({token,supabaseUrl:'https://wbvkqfnrlasmtizjszab.supabase.co',
  publishableKey:'sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU'});
 if(!auth.ok)return deny(auth.reason,401);
 const claims=sessionAssuranceFromVerifiedJwt(token,auth.userId);
 if(!claims.ok)return deny(claims.reason,401);
 if(claims.aal!=='aal2')return deny('MFA_AAL2_REQUIRED');
 let client;
 try{
  if(!pool){
   const cfg=createVerifiedPgTlsConfig(process.env.DD04_STAGING_DATABASE_URL,tenantId,
    process.env.DD04_STAGING_DB_CA_PEM);
   pool=new Pool({...cfg,max:2,connectionTimeoutMillis:7000,idleTimeoutMillis:9000,
    statement_timeout:9000,query_timeout:10000});
  }
  client=await pool.connect();
  await client.query('BEGIN READ ONLY');
  const sec=await client.query(`
   SELECT EXISTS (SELECT 1 FROM auth.sessions s
    JOIN auth.mfa_factors f ON f.id=s.factor_id AND f.user_id=s.user_id
    WHERE s.id=$1::uuid AND s.user_id=$2::uuid AND s.aal='aal2'
     AND f.factor_type='totp' AND f.status='verified'
     AND (s.not_after IS NULL OR s.not_after>now())) AS session_ok,
    EXISTS(SELECT 1 FROM dd04_stage.ceo_enrollments
      WHERE tenant_id=$3::uuid AND user_id=$2::uuid
       AND status='ACTIVE' AND role='CEO' AND verified_by_admin=true) AS ceo_ok
  `,[claims.session_id,auth.userId,tenantId]);
  if(!sec.rows[0]?.session_ok||!sec.rows[0]?.ceo_ok){
   await client.query('COMMIT');return deny('ACTIVE_CEO_MFA_SESSION_REQUIRED');
  }
  // The reviewed V5.5 migration currently locks all finance policies in PROPOSED.
  // Therefore the adapter is intentionally non-billable until a separately
  // approved activation procedure is reviewed and applied.
  const financial=await client.query(`
   SELECT policy_id,max_single_spend_vnd,max_campaign_spend_vnd,policy_sha256
   FROM dd04_stage.v55_finance_policies WHERE tenant_id=$1::uuid
     AND owner_ceo_id=$2::uuid AND status='ACTIVE'
   ORDER BY version DESC LIMIT 1`,[tenantId,auth.userId]);
  await client.query('COMMIT');
  if(financial.rowCount!==1)return deny('CEO_FINANCE_POLICY_NOT_ACTIVE',423);
  const apiKey=process.env.DD04_STAGING_OPENAI_API_KEY;
  const model=process.env.DD04_STAGING_OPENAI_MODEL;
  const enabled=process.env.DD04_STAGING_AI_DRAFTS_ENABLED==='true';
  if(!enabled||!apiKey||!model)return deny('STAGING_AI_PROVIDER_NOT_CONFIGURED',503);
  // No guessed token-to-VND conversion: a separate signed budget/reservation ledger
  // must be present before enabling chargeable work.
  return deny('PER_REQUEST_COST_RESERVATION_NOT_IMPLEMENTED',423);
 }catch{return deny('STAGING_A03_PREREQUISITE_UNAVAILABLE',503)}
 finally{if(client)client.release()}
};
export const config={path:'/api/dd04-a03-ai-drafts'};
