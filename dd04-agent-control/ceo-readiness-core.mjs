// DD04 CEO readiness — read-only status, never grants enrollment or approves G1/G2.
import {verifyAuthUser} from './ceo-approval-contract.mjs';
const PROJECT='wbvkqfnrlasmtizjszab';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DENIED=(reason,status=403)=>({httpStatus:status,body:{ok:false,error:reason,ceo_approval_enabled:false,G1_enabled:false,G2_enabled:false}});
export function sessionAssuranceFromVerifiedJwt(token,userId){
 // Call ONLY AFTER Auth /user verified this SAME token against exact staging project.
 if(typeof token!=='string'||!UUID.test(userId||''))return {ok:false,reason:'SESSION_UNVERIFIED'};
 const parts=token.split('.');
 if(parts.length!==3||parts[1].length>8192)return {ok:false,reason:'SESSION_INVALID_FORMAT'};
 try{
  const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  const expectedIssuer='https://'+PROJECT+'.supabase.co/auth/v1';
  if(payload?.iss!==expectedIssuer||payload?.sub!==userId||payload?.role!=='authenticated'||
     !Number.isSafeInteger(payload?.exp)||payload.exp<=Math.floor(Date.now()/1000))return {ok:false,reason:'SESSION_CLAIMS_MISMATCH'};
  if(!UUID.test(payload?.session_id||''))return {ok:false,reason:'SESSION_ID_REQUIRED'};
  return {ok:true,aal:payload.aal==='aal2'?'aal2':'aal1',session_id:payload.session_id};
 }catch{return {ok:false,reason:'SESSION_CLAIMS_INVALID'}}
}
export async function inspectCeoReadiness({token,publishableKey,tenantId,lookup,fetchImpl=fetch}){
 const identity=await verifyAuthUser({token,supabaseUrl:'https://'+PROJECT+'.supabase.co',publishableKey,fetchImpl});
 if(!identity.ok)return DENIED(identity.reason,401);
 const assurance=sessionAssuranceFromVerifiedJwt(token,identity.userId);
 if(!assurance.ok)return DENIED(assurance.reason,401);
 if(!UUID.test(tenantId||'')||typeof lookup!=='function')return DENIED('SERVER_CONFIG_NOT_READY',503);
 let backend;
 try{backend=await lookup({tenantId,userId:identity.userId,sessionId:assurance.session_id})}
 catch{return DENIED('STAGING_READ_UNAVAILABLE',503)}
 if(!backend||backend.session_valid!==true)return DENIED('SESSION_REVOKED_OR_UNKNOWN',401);
 const enrolled=backend.enrollment_present===true&&backend.role==='CEO'&&
   backend.enrollment_status==='ACTIVE'&&backend.enrollment_user_id===identity.userId&&
   backend.enrollment_tenant_id===tenantId&&backend.verified_by_admin===true;
 const missing=[];
 if(assurance.aal!=='aal2')missing.push('MFA_AAL2_REQUIRED');
 if(!enrolled)missing.push(backend.enrollment_table_present?'CEO_ENROLLMENT_NOT_VERIFIED':'CEO_ENROLLMENT_TABLE_NOT_MIGRATED');
 missing.push('G1_G2_DATABASE_GUARD_LOCKED');
 return {httpStatus:200,body:{
  ok:true,identity_verified:true,session_valid:true,mfa_aal2:assurance.aal==='aal2',
  enrollment_verified:enrolled,ceo_approval_enabled:false,G1_enabled:false,G2_enabled:false,
  ready_for_gates:false,missing,source:'STAGING_AUTH_AND_DATABASE_READ_ONLY'
 }};
}
