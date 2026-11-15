// DD04-A00-009 / fail-closed CEO identity + G1/G2 proposal contract.
// Never use this module to directly mutate Supabase; DB approval lock remains in force.
import { createHash } from 'node:crypto';

const PROJECT='wbvkqfnrlasmtizjszab';
const EXPECTED_URL='https://'+PROJECT+'.supabase.co';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/;
const COMMAND=/^cmd_[a-f0-9]{20}$/;

export const approvalHash=(obj)=>createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const deny=(reason)=>({ok:false,reason});

export async function verifyAuthUser({token,supabaseUrl,publishableKey,fetchImpl=fetch}){
 if(supabaseUrl!==EXPECTED_URL || typeof publishableKey!=='string' || !publishableKey || typeof token!=='string' || token.length<40){
  return deny('AUTH_NOT_CONFIGURED_OR_TOKEN_MISSING');
 }
 // Never trust user_metadata or browser-provided CEO role.
 let response;
 try {
  response=await fetchImpl(EXPECTED_URL+'/auth/v1/user',{
   headers:{apikey:publishableKey,authorization:'Bearer '+token,accept:'application/json'},
   cache:'no-store',
   signal:AbortSignal.timeout(6000)
  });
 }catch{return deny('AUTH_PROVIDER_UNAVAILABLE')}
 if(!response.ok)return deny('AUTH_SESSION_INVALID');
 let user;
 try{user=await response.json()}catch{return deny('AUTH_RESPONSE_INVALID')}
 if(!UUID.test(user?.id||'') || !user?.email_confirmed_at || user?.is_anonymous===true) return deny('AUTH_IDENTITY_NOT_VERIFIED');
 return {ok:true,userId:user.id}; // No role inferred here.
}

export function verifyCeoEnrollment({identity,enrollment,assurance,tenantId,requireMfa=true}){
 if(identity?.ok!==true || !UUID.test(identity.userId||'') || !UUID.test(tenantId||''))return deny('AUTH_IDENTITY_REQUIRED');
 if(!enrollment || enrollment.user_id!==identity.userId || enrollment.tenant_id!==tenantId ||
    enrollment.role!=='CEO' || enrollment.status!=='ACTIVE' || enrollment.verified_by_admin!==true){
  return deny('CEO_ENROLLMENT_REQUIRED');
 }
 // Enrollment evidence must originate from a trusted database lookup.
 if(enrollment.identity_source!=='SERVER_DB_VERIFIED')return deny('UNTRUSTED_ENROLLMENT_SOURCE');
 // MFA assurance MUST come from a separately verified Auth session/JWT,
 // never from mutable enrollment data or browser input.
 if(requireMfa && (assurance?.source!=='SERVER_VERIFIED_SESSION' || assurance?.userId!==identity.userId || assurance?.aal!=='aal2'))return deny('MFA_AAL2_REQUIRED');
 return {ok:true,userId:identity.userId,tenantId,role:'CEO'};
}

// Creates an immutable proposal ONLY; actual decision must be recorded by a
// separately reviewed database transaction that checks current CEO enrollment.
export function prepareGateDecision({actor,command,gate,decision,evidence}){
 if(actor?.ok!==true||actor.role!=='CEO'||!UUID.test(actor.userId||'')||!UUID.test(actor.tenantId||''))return deny('VERIFIED_CEO_REQUIRED');
 if(!COMMAND.test(command?.command_id||'')||command.tenant_id!==actor.tenantId)return deny('COMMAND_NOT_IN_CEO_TENANT');
 if(!['G1','G2'].includes(gate)||!['APPROVED','REJECTED'].includes(decision))return deny('INVALID_GATE_DECISION');
 if(!Number.isSafeInteger(evidence?.revision)||evidence.revision<1||!HASH.test(evidence?.proposal_sha256||''))return deny('VERSIONED_PROPOSAL_REQUIRED');
 if(command.status!=='WAITING_CEO_PLAN'&&gate==='G1')return deny('G1_COMMAND_STATE_MISMATCH');
 if(gate==='G2'){
  if(command.status!=='IN_PROGRESS' && command.status!=='HOLD')return deny('G2_COMMAND_STATE_MISMATCH');
  if(!HASH.test(evidence.asset_sha256||'')||!Array.isArray(evidence.target_channels)||!evidence.target_channels.length||
    evidence.target_channels.some(x=>typeof x!=='string'||!x.trim())||!evidence.publish_schedule||!Object.keys(evidence.publish_schedule).length)
    return deny('G2_ASSET_CHANNEL_SCHEDULE_REQUIRED');
  if(evidence.qc_pass!==true||evidence.compliance_pass!==true)return deny('G2_QC_AND_COMPLIANCE_REQUIRED');
 }
 if(gate==='G1' && (!Number.isFinite(evidence.budget_vnd)||evidence.budget_vnd<0||typeof evidence.scope_text!=='string'||!evidence.scope_text.trim()))return deny('G1_SCOPE_AND_BUDGET_REQUIRED');
 const payload={
  tenant_id:actor.tenantId,command_id:command.command_id,gate,decision,
  revision:evidence.revision,proposal_sha256:evidence.proposal_sha256,
  actor_user_id:actor.userId,asset_sha256:gate==='G2'?evidence.asset_sha256:null,
  target_channels:gate==='G2'?[...evidence.target_channels]:[],
  publish_schedule:gate==='G2'?structuredClone(evidence.publish_schedule):{},
  // Do not create a DB decision from this dry-run payload.
  status:'NOT_SUBMITTED_DB_GUARD_ACTIVE'
 };
 return {ok:true,proposal:Object.freeze(payload),fingerprint:approvalHash(payload),executable:false};
}
