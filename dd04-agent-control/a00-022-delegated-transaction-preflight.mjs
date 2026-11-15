// DD04-A00-022 — Internal delegation / A11 finance / stage handoff preflight.
// STAGING ONLY. Pure decisions, NO DB writes, NO publication, NO provider calls.
// This is deliberately NOT proof of execution; an audited DB transaction must
// verify the evidence and enforce the same predicates after a reviewed migration.
import {createHash} from 'node:crypto';
const HEX=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CMD=/^cmd_[a-f0-9]{20}$/;
const AGENT=/^A(0[0-9]|1[0-7])$/;
const ORDER=['A00','A03','A04','A05','A08','A09'];
const STAGES=new Set(ORDER);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const blocked=(reason,extra={})=>Object.freeze({ok:false,reason,executable:false,publish_allowed:false,
 spend_allowed:false,...extra});
const verified=(e,tenant,command,packet)=>e&&e.source==='DB_AUTHENTICATED_IMMUTABLE_EVENT'
 &&e.tenant_id===tenant&&e.command_id===command&&e.packet_sha256===packet
 &&HEX.test(e.evidence_sha256||'')&&UUID.test(e.actor_subject_id||'')
 &&AGENT.test(e.agent_id||'')&&e.verdict==='PASS'&&e.expires_at>0;
const requiredAgents=Object.freeze(['A00','A02','A09','A11']);
/**
 * @param {object} source Server-created bundle loaded inside the same
 * SERIALIZABLE transaction, not derived from caller JSON.
 * No active finance policy means NO eligible delegated G1 even if cost=0.
 * Approved policy limits are never inferred from estimates or stale versions.
 */
export function evaluateA0022InternalG1(source){
 if(!source||source.provenance!=='DB_SERIALIZABLE_READ'||
    source.environment!=='STAGING')return blocked('TRUSTED_DB_SNAPSHOT_REQUIRED');
 const {tenant_id,command_id,packet_sha256,finance_policy,finance_ledger,checks,epoch_ms}=source;
 if(!UUID.test(tenant_id||'')||!CMD.test(command_id||'')||!HEX.test(packet_sha256||'')||
    !Number.isSafeInteger(epoch_ms)||epoch_ms<=0)return blocked('SNAPSHOT_ID_INVALID');
 if(source.legacy_g1_decision!=='PENDING')return blocked('CANONICAL_G1_STATE_UNEXPECTED');
 if(source.ceo_final_g2_decision==='APPROVED')return blocked('PUBLICATION_DECISION_OUT_OF_SCOPE');
 if(!finance_policy||finance_policy.source!=='DB_ACTIVE_CEO_FINANCE_POLICY'||
   finance_policy.tenant_id!==tenant_id||finance_policy.status!=='ACTIVE'||
   !HEX.test(finance_policy.policy_sha256||'')||!Number.isInteger(finance_policy.version)||
   finance_policy.version<1||!Number.isSafeInteger(finance_policy.max_single_spend_vnd)||
   !Number.isSafeInteger(finance_policy.max_campaign_spend_vnd)||
   finance_policy.max_single_spend_vnd<0||finance_policy.max_campaign_spend_vnd<0)
   return blocked('A11_ACTIVE_FINANCE_POLICY_REQUIRED',{requires_ceo_finance:true});
 if(!finance_ledger||finance_ledger.source!=='DB_LOCKED_FINANCE_LEDGER'||
   finance_ledger.tenant_id!==tenant_id||finance_ledger.command_id!==command_id||
   finance_ledger.policy_sha256!==finance_policy.policy_sha256||
   finance_ledger.packet_sha256!==packet_sha256||
   ![finance_ledger.requested_vnd,finance_ledger.campaign_committed_vnd].every(x=>Number.isSafeInteger(x)&&x>=0))
   return blocked('A11_SERIALIZABLE_FINANCE_RESERVATION_REQUIRED');
 if(finance_ledger.requested_vnd>finance_policy.max_single_spend_vnd||
    finance_ledger.campaign_committed_vnd+finance_ledger.requested_vnd>finance_policy.max_campaign_spend_vnd)
    return blocked('CEO_FINANCE_EXCEPTION_REQUIRED',{requires_ceo_finance:true});
 if(!Array.isArray(checks)||checks.length!==requiredAgents.length)
   return blocked('INDEPENDENT_REVIEW_SET_REQUIRED');
 const actors=new Set();
 for(const agent of requiredAgents){
  const matches=checks.filter(c=>c.agent_id===agent);
  if(matches.length!==1||!verified(matches[0],tenant_id,command_id,packet_sha256)||
      matches[0].expires_at<=epoch_ms)return blocked('INDEPENDENT_'+agent+'_REVIEW_REQUIRED');
  if(actors.has(matches[0].actor_subject_id))return blocked('DISTINCT_REVIEWER_SUBJECTS_REQUIRED');
  actors.add(matches[0].actor_subject_id);
 }
 const snapshotHash=hash({tenant_id,command_id,packet_sha256,
   policy:finance_policy.policy_sha256,ledger:finance_ledger,
   checks:requiredAgents.map(id=>checks.find(c=>c.agent_id===id).evidence_sha256)});
 return Object.freeze({ok:true,reason:'ELIGIBLE_FOR_DB_TRANSACTION_ONLY',
  tenant_id,command_id,packet_sha256,snapshot_sha256:snapshotHash,
  internal_g1_candidate:true,executable:false,publish_allowed:false,spend_allowed:false,
  requires_ceo_finance:false});
}
/**
 * Handoff only reports eligibility. DB must independently verify canonical G1,
 * revision CAS, object-storage byte hash, immutable event, two distinct QC
 * actors on the same output and independent transaction commit.
 */
export function evaluateA0022Handoff({source_task,destination_task,context}={}){
 if(!context||context.provenance!=='DB_SERIALIZABLE_READ'||context.environment!=='STAGING')
   return blocked('TRUSTED_DB_SNAPSHOT_REQUIRED');
 if(context.g1_authority!=='DB_VERIFIED_APPROVED_INTERNAL'||
    context.finance_clearance!=='DB_A11_RESERVED_OR_ZERO_COST')
   return blocked('INTERNAL_G1_A11_NOT_VERIFIED');
 if(!source_task||!destination_task||source_task.tenant_id!==context.tenant_id||
    destination_task.tenant_id!==context.tenant_id||
    source_task.command_id!==context.command_id||
    destination_task.command_id!==context.command_id)
   return blocked('TASK_SCOPE_MISMATCH');
 const from=ORDER.indexOf(source_task.owner_agent);
 const to=ORDER.indexOf(destination_task.owner_agent);
 if(from<0||to!==from+1||!STAGES.has(source_task.owner_agent)||
    destination_task.owner_agent==='A07')
    return blocked('HANDOFF_ORDER_DENIED');
 if(source_task.state!=='APPROVED_INTERNAL'||destination_task.state!=='BLOCKED'||
    !Number.isSafeInteger(source_task.revision)||source_task.revision<1||
    !Number.isSafeInteger(destination_task.revision)||destination_task.revision<1)
    return blocked('HANDOFF_STATE_OR_REVISION_INVALID');
 if(!HEX.test(source_task.output_sha256||'')||
    context.storage_verified_output_sha256!==source_task.output_sha256)
    return blocked('OUTPUT_BYTES_NOT_VERIFIED');
 if(context.a08_qc!==true||context.a09_qc!==true||
    !Array.isArray(context.qc_actor_subject_ids)||
    context.qc_actor_subject_ids.length!==2||
    !context.qc_actor_subject_ids.every(x=>UUID.test(x))||
    new Set(context.qc_actor_subject_ids).size!==2)
   return blocked('A08_A09_INDEPENDENT_QC_REQUIRED');
 return Object.freeze({ok:true,reason:'ELIGIBLE_FOR_ATOMIC_DB_HANDOFF_ONLY',
  from_agent:source_task.owner_agent,to_agent:destination_task.owner_agent,
  source_revision:source_task.revision,destination_revision:destination_task.revision,
  evidence_sha256:hash({from:source_task.task_id,to:destination_task.task_id,
   output_sha256:source_task.output_sha256,
   source_revision:source_task.revision,destination_revision:destination_task.revision}),
  executable:false,publish_allowed:false,spend_allowed:false});
}
