// DD04 V5.5 — CEO commands/inputs/financial exceptions ONLY.
// This pure module evaluates *candidates* for autonomous Agent handoffs.
// No DB mutation, no approval row, no publishing or external side effects.
import {createHash} from 'node:crypto';
export const V55_POLICY='DD04_V5_5_CEO_COMMAND_FINANCE_ONLY';
export const AGENT_ROLES=Object.freeze({
 A00:'ĐIỀU_PHỐI',A01:'TREND',A02:'CHIẾN_LƯỢC_KÊNH',
 A03:'KỊCH_BẢN',A04:'HÌNH_ẢNH',A05:'VIDEO',A06:'QUẢN_LÝ_KÊNH',
 A07:'XUẤT_BẢN',A08:'KIỂM_DUYỆT',A09:'TUÂN_THỦ',A10:'PHÂN_TÍCH_KÊNH',
 A11:'CHI_PHÍ',A12:'ĐỐI_THỦ',A13:'VIRAL',A14:'KINH_DOANH',
 A15:'CSKH',A16:'LẮNG_NGHE',A17:'TƯƠNG_TÁC'
});
const HEX=/^[0-9a-f]{64}$/;
const deny=reason=>({ok:false,status:'BLOCKED',reason,side_effects:false,publication_allowed:false});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const numeric=n=>Number.isSafeInteger(n)&&n>=0;
export function checkFinanceEscalation({policy,request}={}){
 if(policy?.source!=='CEO_SIGNED_POLICY'||policy.active!==true||
    !numeric(policy.max_spend_vnd)||!numeric(policy.max_campaign_vnd))
   return {status:'CEO_FINANCE_POLICY_REQUIRED',requires_ceo:true,reason:'NO_APPROVED_FINANCE_LIMITS'};
 if(request?.source!=='SERVER_FINANCE_LEDGER'||!numeric(request.estimated_spend_vnd)||
    !numeric(request.campaign_total_vnd)||!HEX.test(request.budget_snapshot_sha256||''))
   return {status:'HOLD_DATA',requires_ceo:false,reason:'FINANCIAL_EVIDENCE_REQUIRED'};
 if(request.estimated_spend_vnd>policy.max_spend_vnd||
    request.campaign_total_vnd>policy.max_campaign_vnd||
    request.new_paid_service===true||request.change_budget_cap===true||
    request.contract_or_debt===true)
   return {status:'WAITING_CEO_FINANCE',requires_ceo:true,reason:'FINANCE_OUTSIDE_DELEGATION'};
 return {status:'AUTO_AGENT_ALLOWED',requires_ceo:false,reason:'WITHIN_APPROVED_FINANCIAL_POLICY'};
}
export function agentHandoffDecision({task,evidence,finance}={}){
 if(!task||!Object.hasOwn(AGENT_ROLES,task.owner_agent)||!Object.hasOwn(AGENT_ROLES,task.next_agent))
   return deny('REGISTERED_AGENT_ROLE_REQUIRED');
 if(task.source!=='SERVER_TASK_REGISTRY'||!HEX.test(task.input_sha256||'')||
    !numeric(task.revision)||task.revision<1)
   return deny('SERVER_VERSIONED_TASK_REQUIRED');
 if(evidence?.source!=='SERVER_AGENT_AUDIT'||evidence.task_sha256!==task.input_sha256||
    evidence.revision!==task.revision||evidence.review_agent!==task.next_agent||
    evidence.result!=='PASS'||!HEX.test(evidence.report_sha256||''))
   return deny('NEXT_AGENT_VERIFIED_REVIEW_REQUIRED');
 if(finance?.status==='WAITING_CEO_FINANCE'||finance?.status==='CEO_FINANCE_POLICY_REQUIRED')
   return {ok:false,status:'WAITING_CEO_FINANCE',reason:finance.reason,requires_ceo:true,side_effects:false,publication_allowed:false};
 if(finance?.status!=='AUTO_AGENT_ALLOWED')return deny('FINANCE_CHECK_NOT_PASSED');
 if(evidence.policy_hold===true||evidence.safety_flags?.length>0)return deny('COMPLIANCE_HOLD');
 return {ok:true,status:'AUTO_HANDOFF_ELIGIBLE',authority:'AGENT_ROLE_CHECK',
  from_agent:task.owner_agent,to_agent:task.next_agent,
  task_sha256:task.input_sha256,revision:task.revision,
  review_evidence_sha256:evidence.report_sha256,
  audit_fingerprint:hash([V55_POLICY,task.owner_agent,task.next_agent,task.input_sha256,task.revision,evidence.report_sha256]),
  side_effects:false,publication_allowed:false};
}
export function autoPublicationPreflight({packet,checks,authorization,finance}={}){
 // CEO does not approve content. Policies and A08/A09/A07 must independently certify it.
 if(packet?.source!=='SERVER_FINAL_PACKET'||!HEX.test(packet.package_sha256||'')||
    !numeric(packet.revision)||packet.revision<1||
    !Array.isArray(packet.target_channel_ids)||packet.target_channel_ids.length!==1||
    typeof packet.scheduled_at!=='string'||!Number.isFinite(Date.parse(packet.scheduled_at)))
   return deny('VERSIONED_FINAL_SINGLE_CHANNEL_PACKET_REQUIRED');
 if(finance?.status!=='AUTO_AGENT_ALLOWED')return deny('FINANCE_CLEARANCE_REQUIRED');
 if(checks?.source!=='SERVER_AGENT_AUDIT'||checks.packet_sha256!==packet.package_sha256||
    checks.revision!==packet.revision||
    checks.A08!=='PASS'||checks.A09!=='PASS'||checks.A06!=='PASS'||
    checks.A07!=='PASS'||checks.content_originality_verified!==true||
    checks.channel_profile_verified!==true||checks.schedule_verified!==true||
    checks.licensing_verified!==true||checks.policy_hold===true)
   return deny('ALL_AGENT_QC_AND_PLATFORM_CHECKS_REQUIRED');
 if(authorization?.source!=='SERVER_PUBLISH_POLICY'||authorization.active!==true||
    authorization.staging_only!==true||
    authorization.platform_identity_verified!==true||
    authorization.channel_id!==packet.target_channel_ids[0]||
    authorization.policy_sha256!==checks.policy_sha256||
    !HEX.test(authorization.policy_sha256||''))
   return deny('VALIDATED_CHANNEL_AUTHORIZATION_REQUIRED');
 // This is STILL a preflight; permission to post requires separate,
 // reviewed server DB transaction & channel credentials. Never "publish" here.
 return {ok:true,status:'AUTO_PUBLICATION_CANDIDATE',authority:'A07_AFTER_A08_A09',
  policy:V55_POLICY,packet_sha256:packet.package_sha256,
  channel_id:packet.target_channel_ids[0],revision:packet.revision,
  evidence_fingerprint:hash([packet.package_sha256,checks.policy_sha256,packet.revision,packet.target_channel_ids[0]]),
  side_effects:false,publication_allowed:false,reason:'STAGING_TRANSACTION_NOT_ACTIVATED'};
}
export function buildAgentWorklist(tasks){
 if(!Array.isArray(tasks))return [];
 return tasks.filter(t=>t&&typeof t.task_id==='string'&&Object.hasOwn(AGENT_ROLES,t.owner_agent))
 .map(t=>({
  task_id:t.task_id,command_id:String(t.command_id||''),owner_agent:t.owner_agent,
  role:AGENT_ROLES[t.owner_agent],channel_id:t.channel_id||null,
  status:String(t.status||'UNKNOWN'),revision:Number.isInteger(t.revision)?t.revision:1,
  evidence_sha256:HEX.test(t.evidence_sha256||'')?t.evidence_sha256:null,
  approval_mode:'AUTO_AGENT_POLICY_NOT_ENABLED',
  requires_ceo_finance:t.status==='WAITING_CEO_FINANCE',
  tracked_at:t.updated_at||null,
 }));
}
