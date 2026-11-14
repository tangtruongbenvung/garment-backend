// DD04-A00-010 — read-only CEO readiness. Auth bearer is NEVER the A00 operator token.
// Does not grant CEO roles, update tables, write approvals, or run migrations.
import {Pool} from 'pg';
import {isStagingPreviewUrl} from '../../dd04-agent-control/runtime-core.mjs';
import {assertStagingDatabaseUrl} from '../../dd04-agent-control/supabase-pg-repository.mjs';
import {createVerifiedPgTlsConfig} from '../../dd04-agent-control/pg-tls.mjs';
import {inspectCeoReadiness} from '../../dd04-agent-control/ceo-readiness-core.mjs';

const response=(data,status=200)=>new Response(JSON.stringify(data),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
});
let pool;
async function lookup({tenantId,userId,sessionId}){
 const url=process.env.DD04_STAGING_DATABASE_URL;
 assertStagingDatabaseUrl(url,tenantId);
 const tls=createVerifiedPgTlsConfig(url,tenantId,process.env.DD04_STAGING_DB_CA_PEM);
 if(!pool)pool=new Pool({...tls,max:2,connectionTimeoutMillis:7000,
  idleTimeoutMillis:10000,statement_timeout:9000,query_timeout:10000});
 const client=await pool.connect();
 try{
  await client.query('BEGIN READ ONLY');
  const s=await client.query(`SELECT s.id, s.user_id, s.aal::text AS aal, s.factor_id,
       (s.not_after IS NULL OR s.not_after>now()) AS not_expired,
       EXISTS (SELECT 1 FROM auth.mfa_factors f WHERE f.id=s.factor_id AND f.user_id=s.user_id
        AND f.status::text='verified' AND f.factor_type::text='totp') AS verified_factor
       FROM auth.sessions s WHERE s.id=$1::uuid AND s.user_id=$2::uuid LIMIT 1`,
    [sessionId,userId]);
  const active=s.rows[0];
  if(!active||active.not_expired!==true){
   await client.query('COMMIT');
   return {session_valid:false,enrollment_present:false,enrollment_table_present:false};
  }
  const meta=await client.query("SELECT to_regclass('dd04_stage.ceo_enrollments') IS NOT NULL AS exists");
  const exists=meta.rows[0]?.exists===true;
  let enrollment;
  if(exists){
   const e=await client.query(`SELECT tenant_id,user_id,role,status,verified_by_admin
       FROM dd04_stage.ceo_enrollments
       WHERE tenant_id=$1::uuid AND user_id=$2::uuid LIMIT 1`,[tenantId,userId]);
   enrollment=e.rows[0];
  }
  await client.query('COMMIT');
  return {session_valid:true,mfa_session_verified:active.aal==='aal2'&&active.verified_factor===true,
    enrollment_table_present:exists,enrollment_present:!!enrollment,
    enrollment_user_id:enrollment?.user_id,enrollment_tenant_id:enrollment?.tenant_id,
    role:enrollment?.role,enrollment_status:enrollment?.status,
    verified_by_admin:enrollment?.verified_by_admin===true};
 }catch(e){try{await client.query('ROLLBACK')}catch{}throw e}
 finally{client.release()}
}
export default async(request)=>{
 if(!isStagingPreviewUrl(request.url))return response({ok:false,error:'PREVIEW_ONLY'},403);
 const url=new URL(request.url);
 if(request.method!=='POST'||url.pathname!=='/api/dd04-ceo-readiness')return response({ok:false,error:'NOT_FOUND'},404);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(token.length<40||token.length>12000)return response({ok:false,error:'AUTH_REQUIRED',G1_enabled:false,G2_enabled:false},401);
 const tenantId=process.env.DD04_STAGING_TENANT_ID;
 const publishableKey='sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU';
 try{
  const result=await inspectCeoReadiness({token,tenantId,publishableKey,lookup});
  return response(result.body,result.httpStatus);
 }catch{
  return response({ok:false,error:'READINESS_UNAVAILABLE',ceo_approval_enabled:false,
    G1_enabled:false,G2_enabled:false},503);
 }
};
export const config={path:'/api/dd04-ceo-readiness'};
