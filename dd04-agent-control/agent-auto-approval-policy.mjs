// DD04-A00-015 | V5.4 policy: automated INTERNAL G1, CEO-only FINAL PUBLISH G2.
// Pure preflight: it NEVER writes approval rows, never creates a publish job.
// Trusted evidence must originate in server-side records, not JSON sent from agents/browser.
import {createHash} from 'node:crypto';
const HEX=/^[0-9a-f]{64}$/;
const deny=(reason)=>Object.freeze({ok:false,reason,executable:false,publish_allowed:false});
const digest=(value)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const APPROVAL_POLICY_VERSION='DD04-A00-015-V5.4';
export const APPROVAL_AUTHORITY=Object.freeze({
 G1:'AUTO_AGENT_CHECKPOINT',
 G2:'CEO_FINAL_PUBLISH_AUTHORIZATION',
 internal:['A00','A02','A08','A09','A11'],
});

function nonEmptyArray(a){return Array.isArray(a)&&a.length>0&&a.every(x=>typeof x==='string'&&x.trim());}
export function planAutoReview({plan,checks,policy}={}){
 // No budget cap can be assumed, and no external spending can be implicitly authorized.
 if(policy?.source!=='CEO_CONFIGURED_POLICY'||policy?.active!==true||
    !Number.isSafeInteger(policy?.budget_limit_vnd)||policy.budget_limit_vnd<0)
    return deny('APPROVED_INTERNAL_POLICY_REQUIRED');
 if(plan?.source!=='SERVER_VERSIONED_PLAN'||!HEX.test(plan?.sha256||'')||
    !Number.isSafeInteger(plan?.revision)||plan.revision<1||
    typeof plan?.scope_text!=='string'||!plan.scope_text.trim()||
    !nonEmptyArray(plan.channel_ids)||!Number.isSafeInteger(plan.budget_vnd)||plan.budget_vnd<0)
    return deny('VERSIONED_PLAN_SCOPE_CHANNEL_BUDGET_REQUIRED');
 if(plan.budget_vnd>policy.budget_limit_vnd)return deny('BUDGET_OUTSIDE_DELEGATED_LIMIT');
 if(!checks||checks.source!=='SERVER_AGENT_AUDIT'||
    checks.plan_sha256!==plan.sha256||checks.revision!==plan.revision)
    return deny('SERVER_BOUND_AGENT_CHECKS_REQUIRED');
 // A00/A02 plan checks; A11 cost check; A08/A09 safety checks are distinct reviews.
 for(const id of APPROVAL_AUTHORITY.internal){
  if(checks.agent_status?.[id]!=='PASS')return deny('AGENT_'+id+'_CHECK_REQUIRED');
 }
 if(checks.has_policy_flags===true||checks.legal_hold===true)return deny('POLICY_OR_LEGAL_HOLD');
 if(checks.channel_profiles_verified!==true)return deny('CHANNEL_PROFILE_NOT_VERIFIED');
 if(checks.n_channels_n_unique_scripts!==true)return deny('CHANNEL_UNIQUE_SCRIPT_PLAN_REQUIRED');
 return Object.freeze({ok:true,authority:'AUTOMATED_INTERNAL_AGENT_CHECKPOINT',
  stage:'G1',policy_version:APPROVAL_POLICY_VERSION,
  plan_sha256:plan.sha256,revision:plan.revision,
  evidence_fingerprint:digest({plan_sha256:plan.sha256,revision:plan.revision,
   channel_ids:plan.channel_ids,budget_vnd:plan.budget_vnd,agent_status:checks.agent_status,
   policy_version:APPROVAL_POLICY_VERSION}),
  executable:false,publish_allowed:false,reason:'G1_AUTO_ELIGIBLE_PENDING_DB_GATE'});
}
export function finalPublishReview({packet,checks,ceo}={}){
 if(packet?.source!=='SERVER_FINAL_PACKET'||!HEX.test(packet?.package_sha256||'')||
   !Number.isSafeInteger(packet?.revision)||packet.revision<1||
   !nonEmptyArray(packet.channel_ids)||!nonEmptyArray(packet.asset_sha256s)||
   !packet.asset_sha256s.every(x=>HEX.test(x))||
   !packet.schedule||typeof packet.schedule!=='object'||Array.isArray(packet.schedule)||
   !Object.keys(packet.schedule).length)
    return deny('COMPLETE_VERSIONED_FINAL_PACKET_REQUIRED');
 if(checks?.source!=='SERVER_AGENT_AUDIT'||checks.package_sha256!==packet.package_sha256||
    checks.revision!==packet.revision)return deny('SERVER_QC_PACKET_MATCH_REQUIRED');
 if(checks.g1_auto_verified!==true)return deny('G1_AUTO_CHECKPOINT_REQUIRED');
 for(const id of ['A08','A09'])if(checks.agent_status?.[id]!=='PASS')
  return deny('AGENT_'+id+'_FINAL_QC_REQUIRED');
 if(checks.channel_schedule_immutable!==true||
    checks.asset_manifest_immutable!==true)return deny('FINAL_ASSET_CHANNEL_SCHEDULE_LOCK_REQUIRED');
 if(checks.has_policy_flags===true)return deny('POLICY_HOLD');
 // Even when ready, AI cannot grant posting authority or substitute for CEO.
 if(ceo?.server_verified!==true||ceo.role!=='CEO'||ceo.aal!=='aal2'||
    ceo.enrollment_status!=='ACTIVE')return deny('CEO_AAL2_FINAL_APPROVAL_REQUIRED');
 if(ceo.tenant_id!==packet.tenant_id)return deny('CEO_TENANT_MISMATCH');
 return Object.freeze({ok:true,stage:'G2',authority:'CEO_ONLY',
  package_sha256:packet.package_sha256,revision:packet.revision,
  evidence_fingerprint:digest({package_sha256:packet.package_sha256,
   asset_sha256s:packet.asset_sha256s,channel_ids:packet.channel_ids,
   schedule:packet.schedule,revision:packet.revision,
   policy_version:APPROVAL_POLICY_VERSION}),
  executable:false,publish_allowed:false,reason:'G2_CEO_REVIEW_ELIGIBLE_PENDING_DB_GATE'});
}
export function reviewBatchForCeo(items){
 if(!Array.isArray(items)||!items.length||items.length>50)
  return deny('INVALID_APPROVAL_BATCH_SIZE');
 const unique=new Set();
 const decisions=[];
 for(const x of items){
  const k=x?.content_id+'|'+x?.channel_id;
  if(typeof x?.content_id!=='string'||!x.content_id.trim()||
     typeof x?.channel_id!=='string'||!x.channel_id.trim()||unique.has(k)||
     !HEX.test(x?.package_sha256||'')||!Number.isSafeInteger(x?.revision)||x.revision<1||
     typeof x.scheduled_at!=='string'||Number.isNaN(Date.parse(x.scheduled_at)))
    return deny('BATCH_ITEM_INVALID_OR_DUPLICATE');
  unique.add(k);
  decisions.push({content_id:x.content_id,channel_id:x.channel_id,
   package_sha256:x.package_sha256,revision:x.revision,scheduled_at:x.scheduled_at});
 }
 return Object.freeze({ok:true,authority:'CEO_ONLY',stage:'G2',
  batch_count:decisions.length,batch_sha256:digest(decisions),
  decisions:Object.freeze(decisions),executable:false,publish_allowed:false,
  reason:'BATCH_PREVIEW_NOT_POSTING_AUTHORIZATION'});
}
