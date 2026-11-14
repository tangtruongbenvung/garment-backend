// DD04 G1/G2 — strict preflight only. Never writes DB; transition guards are still active.
import {prepareGateDecision} from './ceo-approval-contract.mjs';
const deny=reason=>({ok:false,reason,executable:false});
const HEX=/^[0-9a-f]{64}$/;
export function preflightGate({actor,command,approval,evidence,gate,decision,g1,review}){
 if(!actor||actor.ok!==true||actor.role!=='CEO')return deny('VERIFIED_CEO_REQUIRED');
 if(!command||command.tenant_id!==actor.tenantId)return deny('TENANT_MISMATCH');
 if(!approval||approval.tenant_id!==actor.tenantId||approval.command_id!==command.command_id||
 approval.gate!==gate||approval.decision!=='PENDING'||approval.approved_by!=null||approval.decided_at!=null)
 return deny('PENDING_GATE_RECORD_REQUIRED');
 if(!Number.isSafeInteger(evidence?.revision)||approval.revision!==evidence.revision||
   !HEX.test(approval.proposal_sha256||'')||approval.proposal_sha256!==evidence.proposal_sha256)
 return deny('STALE_PROPOSAL_OR_HASH');
 if(gate==='G1'){
  if(command.input_sha256!==approval.proposal_sha256)return deny('COMMAND_SNAPSHOT_CHANGED');
 }else if(gate==='G2'){
  if(!g1||g1.gate!=='G1'||g1.decision!=='APPROVED'||g1.tenant_id!==actor.tenantId||
     g1.command_id!==command.command_id)return deny('G1_APPROVAL_REQUIRED');
  if(approval.asset_sha256!==evidence.asset_sha256||
    JSON.stringify(approval.target_channels)!==JSON.stringify(evidence.target_channels)||
    JSON.stringify(approval.publish_schedule)!==JSON.stringify(evidence.publish_schedule))
   return deny('G2_FINAL_ASSET_CHANNEL_OR_SCHEDULE_CHANGED');
  if(!review||review.source!=='SERVER_DB_AUDIT'||review.command_id!==command.command_id||
     review.asset_sha256!==evidence.asset_sha256||review.A08!=='PASS'||review.A09!=='PASS')
   return deny('G2_SERVER_QC_EVIDENCE_REQUIRED');
 }else return deny('INVALID_GATE');
 const proposal=prepareGateDecision({actor,command,gate,decision,evidence});
 if(!proposal.ok)return {ok:false,reason:proposal.reason,executable:false};
 return {ok:true,reason:'PREPARED_NO_DB_APPROVAL',fingerprint:proposal.fingerprint,
  proposal:proposal.proposal,executable:false};
}
