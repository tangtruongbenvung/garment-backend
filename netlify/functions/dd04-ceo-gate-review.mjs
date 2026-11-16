// DD04-A00-013: strictly read-only G1/G2 review API, staging preview ONLY.
// No ability to send decisions, mutate Supabase, change command/task status or publish.
import {Pool} from 'pg';
import {isStagingPreviewUrl} from '../../dd04-agent-control/runtime-core.mjs';
import {createVerifiedPgTlsConfig} from '../../dd04-agent-control/pg-tls.mjs';
import {reviewCeoGate} from '../../dd04-agent-control/ceo-gate-review-core.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
});
let pool;
async function getPool(tenantId){
 const tls=createVerifiedPgTlsConfig(
  process.env.DD04_STAGING_DATABASE_URL,tenantId,process.env.DD04_STAGING_DB_CA_PEM);
 if(!pool)pool=new Pool({...tls,max:2,connectionTimeoutMillis:7000,
  idleTimeoutMillis:9000,statement_timeout:9000,query_timeout:10000});
 return pool;
}
async function getEvidence({tenantId,userId,sessionId,approvalId}){
 const client=await(await getPool(tenantId)).connect();
 try{
  await client.query('BEGIN READ ONLY');
  const verified=await client.query(`
   SELECT s.id FROM auth.sessions s
   JOIN auth.mfa_factors f ON f.id=s.factor_id AND f.user_id=s.user_id
   WHERE s.id=$1::uuid AND s.user_id=$2::uuid AND s.aal='aal2'
     AND f.status='verified' AND f.factor_type='totp'
     AND (s.not_after IS NULL OR s.not_after>now()) LIMIT 1`,[sessionId,userId]);
  const ceo=await client.query(`
   SELECT 1 FROM dd04_stage.ceo_enrollments
   WHERE tenant_id=$1::uuid AND user_id=$2::uuid
     AND role='CEO' AND status='ACTIVE' AND verified_by_admin=true LIMIT 1`,[tenantId,userId]);
  // Strictly tenant-scoped approval + command join. Never trust a browser-supplied plan/hash.
  const a=await client.query(`
   SELECT a.approval_id,a.tenant_id,a.command_id,a.gate,a.revision,
     a.decision,a.proposal_sha256,a.asset_sha256,a.target_channels,
     a.publish_schedule,a.approved_by,a.decided_at,a.created_at,
     c.status AS command_status,c.input_sha256 AS command_input_sha256
   FROM dd04_stage.approvals a
   JOIN dd04_stage.commands c
     ON c.tenant_id=a.tenant_id AND c.command_id=a.command_id
   WHERE a.tenant_id=$1::uuid AND a.approval_id=$2::uuid
   LIMIT 1`,[tenantId,approvalId]);
  const record=a.rows[0];
  let g1=false;
  if(record?.gate==='G2'){
   const prior=await client.query(`
    SELECT 1 FROM dd04_stage.approvals WHERE tenant_id=$1::uuid
    AND command_id=$2 AND gate='G1' AND decision='APPROVED' LIMIT 1`,
    [tenantId,record.command_id]);
   g1=prior.rowCount===1;
  }
  await client.query('COMMIT');
  return {session_verified:verified.rowCount===1,enrollment_valid:ceo.rowCount===1,
   approval:record??null,
   command:record?{tenant_id:record.tenant_id,command_id:record.command_id,
     status:record.command_status,input_sha256:record.command_input_sha256}:null,
   g1_approved:g1,
   plan_evidence_verified:false, // G1 cost/scope evidence missing from V2 schema
   final_asset_verified:false,    // no canonical immutable final package yet
   qc_a08_verified:false,         // never infer QC from browser request
   qc_a09_verified:false};
 }catch(e){try{await client.query('ROLLBACK')}catch{}throw e}
 finally{client.release()}
}
export default async request=>{
 if(!isStagingPreviewUrl(request.url))return reply({ok:false,error:'PREVIEW_ONLY'},403);
 const u=new URL(request.url);
 if(request.method!=='POST'||u.pathname!=='/api/dd04-ceo-gate-review')
  return reply({ok:false,error:'NOT_FOUND'},404);
 const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(token.length<40||token.length>12000)return reply({ok:false,error:'AUTH_REQUIRED'},401);
 if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))
  return reply({ok:false,error:'JSON_REQUIRED'},415);
 let body;
 try{const raw=await request.text();if(raw.length>2000)return reply({ok:false,error:'TOO_LARGE'},413);
  body=JSON.parse(raw)}
 catch{return reply({ok:false,error:'INVALID_JSON'},400)}
 const tenantId=process.env.DD04_STAGING_TENANT_ID;
 const publishableKey='sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU';
 try{
  const result=await reviewCeoGate({token,tenantId,publishableKey,
   approvalId:body?.approval_id,dbLookup:getEvidence});
  return reply(result.body,result.httpStatus);
 }catch{return reply({ok:false,error:'GATE_REVIEW_UNAVAILABLE',
  decision_enabled:false,publishing_allowed:false},503)}
};
export const config={path:'/api/dd04-ceo-gate-review'};
