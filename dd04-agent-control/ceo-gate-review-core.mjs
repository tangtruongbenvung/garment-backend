// DD04-A00-013: G1/G2 approval review ONLY. No mutation, no approval decision.
// Inputs come from Supabase-authenticated CEO session and read-only DB queries.
import {verifyAuthUser} from './ceo-approval-contract.mjs';
import {sessionAssuranceFromVerifiedJwt} from './ceo-readiness-core.mjs';
const project='https://wbvkqfnrlasmtizjszab.supabase.co';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const deny=(reason,status=403)=>({httpStatus:status,body:{ok:false,error:reason,decision_enabled:false,publishing_allowed:false}});
export async function reviewCeoGate({token,tenantId,publishableKey,approvalId,dbLookup,fetchImpl=fetch}){
 if(!uuid.test(tenantId||'')||!uuid.test(approvalId||'')||typeof dbLookup!=='function')return deny('REQUEST_OR_SERVER_CONFIG_INVALID',400);
 const auth=await verifyAuthUser({token,supabaseUrl:project,publishableKey,fetchImpl});
 if(!auth.ok)return deny(auth.reason,401);
 const claims=sessionAssuranceFromVerifiedJwt(token,auth.userId);
 if(!claims.ok)return deny(claims.reason,401);
 if(claims.aal!=='aal2')return deny('MFA_AAL2_REQUIRED');
 let data;
 try{data=await dbLookup({tenantId,userId:auth.userId,sessionId:claims.session_id,approvalId})}
 catch{return deny('STAGING_DB_REVIEW_UNAVAILABLE',503)}
 if(data?.session_verified!==true)return deny('MFA_SESSION_NOT_VERIFIED',401);
 if(data?.enrollment_valid!==true)return deny('CEO_ENROLLMENT_INACTIVE');
 if(!data?.approval||data.approval.tenant_id!==tenantId)return deny('APPROVAL_NOT_FOUND',404);
 const a=data.approval;
 if(!['G1','G2'].includes(a.gate))return deny('INVALID_GATE');
 const current=a.decision==='PENDING'&&a.approved_by==null&&a.decided_at==null;
 const snapshotMatches=!!data.command&&
  data.command.tenant_id===tenantId&&data.command.command_id===a.command_id;
 const missing=[];
 if(!current)missing.push('DECISION_NOT_PENDING');
 if(!snapshotMatches)missing.push('COMMAND_SNAPSHOT_MISSING');
 if(a.gate==='G1'){
  if(!snapshotMatches||data.command.status!=='WAITING_CEO_PLAN'||data.command.input_sha256!==a.proposal_sha256)missing.push('G1_SOURCE_HASH_OR_STATUS_CHANGED');
  // The original 7-table schema has no approved canonical plan/cost payload.
  // Reject plan decisions until separately versioned G1 scope/budget evidence is stored.
  if(data.plan_evidence_verified!==true)missing.push('G1_PLAN_SCOPE_BUDGET_EVIDENCE_REQUIRED');
 }else{
  if(data.g1_approved!==true)missing.push('G2_G1_APPROVAL_REQUIRED');
  if(!snapshotMatches||!['IN_PROGRESS','HOLD'].includes(data.command.status))missing.push('G2_COMMAND_STATE_REQUIRED');
  if(!data.final_asset_verified)missing.push('G2_FINAL_ASSET_HASH_CHANNEL_SCHEDULE_REQUIRED');
  if(!data.qc_a08_verified||!data.qc_a09_verified)missing.push('G2_A08_A09_QC_EVIDENCE_REQUIRED');
 }
 missing.push('G1_G2_TRANSACTION_NOT_MIGRATED');
 return {httpStatus:200,body:{
  ok:true,identity_verified:true,mfa_aal2:true,ceo_enrollment_verified:true,
  approval:{approval_id:a.approval_id,command_id:a.command_id,gate:a.gate,
    revision:a.revision,decision:a.decision,proposal_sha256:a.proposal_sha256,
    asset_sha256:a.asset_sha256??null,target_channels:a.target_channels??[],
    publish_schedule:a.publish_schedule??{},created_at:a.created_at},
  evidence:{plan_evidence_verified:data.plan_evidence_verified===true,
    g1_approved:data.g1_approved===true,final_asset_verified:data.final_asset_verified===true,
    qc_a08_verified:data.qc_a08_verified===true,qc_a09_verified:data.qc_a09_verified===true},
  missing,decision_enabled:false,publishing_allowed:false,
  message:'REVIEW_ONLY_NO_DB_DECISION'}};
}
