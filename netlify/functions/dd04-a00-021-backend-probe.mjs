// DD04 A00-021 — staging Deploy Preview DB connection probe (READ ONLY).
// Intentionally no worker credential, no task payload, no writes, no publish endpoint.
// Requires verified Supabase Auth and MFA AAL2; never prints connection strings.
import {verifyAuthUser} from '../../dd04-agent-control/ceo-approval-contract.mjs';
import {sessionAssuranceFromVerifiedJwt} from '../../dd04-agent-control/ceo-readiness-core.mjs';
import {isStagingPreviewUrl} from '../../dd04-agent-control/runtime-core.mjs';
import {createVerifiedPgTlsConfig} from '../../dd04-agent-control/pg-tls.mjs';
import {assertA0021BackendDbUrl} from '../../dd04-agent-control/a00-021-backend-runtime.mjs';

const PROJECT='wbvkqfnrlasmtizjszab';
const TENANT='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const json=(payload,status=200)=>new Response(JSON.stringify(payload),{
 status,headers:{'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'}
});
const reject=(reason,status=403)=>json({ok:false,status:reason,read_only:true,
 worker_active:false,can_publish:false,can_spend:false},status);

export default async request=>{
 if(!isStagingPreviewUrl(request.url))return reject('DEPLOY_PREVIEW_ONLY');
 if(request.method!=='POST'||new URL(request.url).pathname!=='/api/dd04-a00-021-backend-probe')
  return reject('METHOD_NOT_ALLOWED',405);
 const authorization=request.headers.get('authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(authorization))return reject('AUTH_REQUIRED',401);
 const token=authorization.replace(/^Bearer\s+/i,'');
 if(token.length<40||token.length>12000)return reject('AUTH_REQUIRED',401);
 const auth=await verifyAuthUser({token,
  supabaseUrl:'https://'+PROJECT+'.supabase.co',
  publishableKey:'sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU'});
 if(!auth.ok)return reject('AUTH_NOT_VERIFIED',401);
 const session=sessionAssuranceFromVerifiedJwt(token,auth.userId);
 if(!session.ok||session.aal!=='aal2')return reject('MFA_AAL2_REQUIRED');
 if(process.env.DD04_STAGING_TENANT_ID!==TENANT)
  return reject('STAGING_TENANT_CONFIG_INVALID',503);
 let pool,client,transaction=false;
 try{
  // Netlify Functions-only env vars, never sourced from browser/requests.
  const connectionString=process.env.DD04_A00_BACKEND_DATABASE_URL;
  const tls=createVerifiedPgTlsConfig(connectionString,TENANT,
    process.env.DD04_STAGING_DB_CA_PEM,assertA0021BackendDbUrl);
  const {Pool}=await import('pg');
  pool=new Pool({...tls,max:1,connectionTimeoutMillis:5000,
   idleTimeoutMillis:1000,statement_timeout:6000,query_timeout:7000});
  client=await pool.connect();
  await client.query('BEGIN READ ONLY');transaction=true;
  const before=await client.query('SELECT current_user AS identity');
  if(before.rows[0]?.identity!=='dd04_a00_backend')
    return reject('BACKEND_ROLE_MISMATCH',503);
  await client.query('SET LOCAL ROLE dd04_a00_runtime');
  const after=await client.query(`SELECT current_user AS runtime_role,
    dd04_stage.a00_authorized($1::uuid,'READ') AS unauthorized_worker`,[TENANT]);
  const ok=after.rows[0]?.runtime_role==='dd04_a00_runtime'
   &&after.rows[0]?.unauthorized_worker===false;
  await client.query('ROLLBACK');transaction=false;
  return ok?json({ok:true,status:'STAGING_BACKEND_RLS_PROBE_PASS',
   login_role:'dd04_a00_backend',runtime_role:'dd04_a00_runtime',
   worker_active:false,read_only:true,can_publish:false,can_spend:false}):
   reject('ROLE_OR_UNPROVISIONED_WORKER_CHECK_FAILED',503);
 }catch{
  return reject('STAGING_DATABASE_CONNECTION_UNAVAILABLE',503);
 }finally{
  if(transaction&&client)await client.query('ROLLBACK').catch(()=>{});
  if(client)client.release();
  if(pool)await pool.end().catch(()=>{});
 }
};
export const config={path:'/api/dd04-a00-021-backend-probe'};
