// DD04-A00-016 | Delegated orchestration domain; staging-only, pure functions.
// All "approvals" are simulation/preflight; no DB writes or publish permissions.
import {createHash} from 'node:crypto';
export const A00_DELEGATION_VERSION='DD04-A00-016-STAGING';
export const AGENTS=Object.freeze(Array.from({length:18},(_,i)=>'A'+String(i).padStart(2,'0')));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{2,100}$/.test(x);
const isMoney=x=>Number.isSafeInteger(x)&&x>=0;
const deny=reason=>({ok:false,reason,executable:false,publish_allowed:false});
const clone=x=>structuredClone(x);
const routes={
 CONTENT:[['A00',[]],['A02',['A00']],['A03',['A02']],['A04',['A03']],['A05',['A04']],['A08',['A05']],['A09',['A08']],['A06',['A09']],['A07',['A06']],['A10',['A07']],['A11',['A10']]],
 TREND:[['A00',[]],['A01',['A00']],['A12',['A01']],['A13',['A12']],['A02',['A13']],['A09',['A02']],['A03',['A09']]],
 SALES:[['A00',[]],['A14',['A00']],['A15',['A14']],['A09',['A15']]],
 COMMUNITY:[['A00',[]],['A16',['A00']],['A17',['A16']],['A09',['A17']]],
 FINANCE:[['A00',[]],['A11',['A00']]]
};
export const WORKFLOW_ROUTES=Object.freeze(routes);
export function prepareLedger({tenant_id,command_id,campaign_id,workflow,channels=[],input_sha256,actor_source,at='2026-11-15T00:00:00.000Z'}={}){
 if(!id(tenant_id)||!id(command_id)||!id(campaign_id)||!routes[workflow]||!hex(input_sha256))throw Error('COMMAND_CONTEXT_INVALID');
 if(actor_source!=='VERIFIED_GATEWAY'&&actor_source!=='STAGING_OPERATOR_REVIEW')throw Error('COMMAND_AUTH_REQUIRED');
 if(!Array.isArray(channels)||channels.length>20||new Set(channels).size!==channels.length||channels.some(x=>!id(x)))throw Error('CHANNELS_INVALID');
 if(!Number.isFinite(Date.parse(at)))throw Error('TIME_INVALID');
 const rows=routes[workflow].map(([owner,deps])=>({
 tenant_id,command_id,campaign_id,channel_id:null,task_id:command_id+'_'+owner,owner_agent:owner,
 dependency_ids:deps.map(a=>command_id+'_'+a),status:owner==='A00'?'PLANNED':'BLOCKED_DEPENDENCY',
 revision:1,input_sha256,output_sha256:null,output_refs:[],evidence_refs:[],profile_version:null,profile_sha256:null,
 qa_agent:null,compliance_agent:null,approval_policy_version:A00_DELEGATION_VERSION,
 budget_vnd:null,committed_budget_vnd:null,finance_decision:'UNASSESSED',next_action:'WAIT_FOR_DEPENDENCIES',updated_at:at
 }));
 const data={schema_version:'5.3',policy_version:A00_DELEGATION_VERSION,tenant_id,command_id,campaign_id,workflow,channels:[...channels],rows,
 events:[{event_id:sha([command_id,'CREATE']),actor:'A00',event:'LEDGER_CREATED',at,context_hash:input_sha256}],
 finance_exceptions:[],decisions:[],status:'PREVIEW_ONLY_NOT_PERSISTED',publish_allowed:false};
 return data;
}
export function reviewFinance({policy,request,commitments,now}={}){
 if(policy?.source!=='SERVER_VERIFIED_POLICY'||policy.active!==true||!id(policy.policy_id)||!id(policy.tenant_id)||
 !Number.isSafeInteger(policy.revision)||policy.revision<1||!isMoney(policy.limit_vnd)||policy.currency!=='VND'||
 !nonblank(policy.scope)||!nonblank(policy.period)||!nonblank(policy.authority_evidence_hash)||!hex(policy.authority_evidence_hash)||
 !Number.isFinite(Date.parse(policy.valid_from))||!Number.isFinite(Date.parse(policy.valid_until))||
 !Number.isFinite(Date.parse(now)))return deny('ACTIVE_VERIFIED_FINANCIAL_POLICY_REQUIRED');
 const t=Date.parse(now);if(t<Date.parse(policy.valid_from)||t>=Date.parse(policy.valid_until))return deny('FINANCIAL_POLICY_EXPIRED');
 if(!request||request.source!=='SERVER_VERSIONED_REQUEST'||!id(request.tenant_id)||!id(request.command_id)||
 !id(request.request_id)||!id(request.campaign_id)||!isMoney(request.amount_vnd)||
 !hex(request.request_sha256)||!Number.isSafeInteger(request.revision)||request.revision<1||
 !nonblank(request.scope)||!nonblank(request.period))return deny('FINANCIAL_REQUEST_INVALID');
 if(request.tenant_id!==policy.tenant_id)return deny('TENANT_MISMATCH');
 if(request.scope!==policy.scope||request.period!==policy.period)return deny('POLICY_SCOPE_MISMATCH');
 if(!Array.isArray(commitments)||commitments.some(c=>c?.source!=='SERVER_FINANCE_LEDGER'||c.tenant_id!==policy.tenant_id||
 c.scope!==policy.scope||c.period!==policy.period||!id(c.request_id)||!isMoney(c.amount_vnd)))return deny('FINANCIAL_LEDGER_UNVERIFIED');
 const seen=new Set();let used=0;
 for(const c of commitments){
  if(seen.has(c.request_id))return deny('DUPLICATE_FINANCE_REQUEST');
  seen.add(c.request_id);
  if(c.request_id===request.request_id)return deny('EXISTING_REQUEST_REQUIRES_IDEMPOTENT_LOOKUP');
  used+=c.amount_vnd;
  if(!Number.isSafeInteger(used))return deny('FINANCIAL_OVERFLOW');
 }
 const total=used+request.amount_vnd;if(!Number.isSafeInteger(total))return deny('FINANCIAL_OVERFLOW');
 if(total>policy.limit_vnd)return {ok:false,reason:'OVER_DELEGATED_LIMIT',state:'ESCALATED_TO_CEO',authority:'CEO_FINANCE_ONLY',policy_id:policy.policy_id,request_id:request.request_id,used_vnd:used,requested_vnd:request.amount_vnd,total_vnd:total,limit_vnd:policy.limit_vnd,executable:false,publish_allowed:false};
 return {ok:true,state:'ELIGIBLE_INTERNAL_A11',authority:'A11',policy_id:policy.policy_id,policy_revision:policy.revision,request_id:request.request_id,used_vnd:used,total_vnd:total,limit_vnd:policy.limit_vnd,request_sha256:request.request_sha256,executable:false,publish_allowed:false};
}
function nonblank(s){return typeof s==='string'&&s.trim().length>0}
export function applyTaskReview(ledger,{task_id,actor,action,evidence_sha256,reviewer,review_source,idempotency_key,at,profile_version,profile_sha256}={}){
 if(!ledger||ledger.publish_allowed!==false||!id(task_id)||!AGENTS.includes(actor)||!['START','SUBMIT','APPROVE','REWORK'].includes(action)||
 !id(idempotency_key)||!Number.isFinite(Date.parse(at)))return deny('TRANSITION_INPUT_INVALID');
 const next=clone(ledger),row=next.rows.find(x=>x.task_id===task_id);
 if(!row)return deny('TASK_NOT_FOUND');
 const duplicate=next.events.find(e=>e.idempotency_key===idempotency_key);
 if(duplicate)return duplicate.task_id===task_id&&duplicate.action===action&&duplicate.evidence_sha256===evidence_sha256?{ok:true,duplicate:true,ledger:next,executable:false,publish_allowed:false}:deny('IDEMPOTENCY_CONFLICT');
 const isOwner=actor===row.owner_agent;
 if(['START','SUBMIT','REWORK'].includes(action)&&!isOwner)return deny('OWNER_REQUIRED');
 if(action==='START'){
  if(row.status!=='PLANNED'&&row.status!=='BLOCKED_DEPENDENCY')return deny('STATUS_MISMATCH');
  if(row.dependency_ids.some(d=>next.rows.find(x=>x.task_id===d)?.status!=='APPROVED_INTERNAL'))return deny('DEPENDENCIES_NOT_APPROVED');
  row.status='IN_PROGRESS';
 }else if(action==='SUBMIT'){
  if(row.status!=='IN_PROGRESS'||!hex(evidence_sha256))return deny('OUTPUT_EVIDENCE_REQUIRED');
  if(row.channel_id!==null&&(!Number.isInteger(profile_version)||profile_version<1||!hex(profile_sha256)||row.profile_version!==profile_version||row.profile_sha256!==profile_sha256))return deny('CHANNEL_PROFILE_CHANGED');
  row.output_sha256=evidence_sha256;row.status='INTERNAL_REVIEW';
 }else if(action==='APPROVE'){
  if(row.status!=='INTERNAL_REVIEW'||!hex(evidence_sha256)||row.output_sha256!==evidence_sha256)return deny('REVIEW_HASH_MISMATCH');
  if(!AGENTS.includes(reviewer)||actor!==reviewer||actor===row.owner_agent||review_source!=='SERVER_INDEPENDENT_AGENT_AUDIT')return deny('INDEPENDENT_REVIEW_REQUIRED');
  // A07 cannot be cleared by a single agent; publishing stays locked regardless.
  if(row.owner_agent==='A07')return deny('A07_PUBLICATION_GATE_LOCKED');
  if(row.owner_agent==='A11'&&next.finance_exceptions.some(x=>x.state==='ESCALATED_TO_CEO'))return deny('FINANCE_ESCALATION_UNRESOLVED');
  row.status='APPROVED_INTERNAL';
 }else{
  if(row.status!=='INTERNAL_REVIEW'||!hex(evidence_sha256)||review_source!=='SERVER_INDEPENDENT_AGENT_AUDIT'||!AGENTS.includes(reviewer)||actor!==row.owner_agent)return deny('REWORK_PROOF_REQUIRED');
  row.status='IN_PROGRESS';row.output_sha256=null;row.revision++;
 }
 row.updated_at=at;
 const event={event_id:sha([task_id,action,idempotency_key]),task_id,actor,action,from_status:ledger.rows.find(x=>x.task_id===task_id).status,to_status:row.status,
 evidence_sha256:evidence_sha256||null,idempotency_key,at};
 next.events.push(event);
 return {ok:true,duplicate:false,ledger:next,event,executable:false,publish_allowed:false};
}
export function attachFinanceException(ledger,result,at){
 if(!ledger||result?.state!=='ESCALATED_TO_CEO'||result.authority!=='CEO_FINANCE_ONLY'||!id(result.request_id)||!Number.isFinite(Date.parse(at)))return deny('ESCALATION_INVALID');
 const next=clone(ledger);
 if(next.finance_exceptions.some(x=>x.request_id===result.request_id))return {ok:true,duplicate:true,ledger:next,executable:false,publish_allowed:false};
 const exception={request_id:result.request_id,command_id:next.command_id,campaign_id:next.campaign_id,tenant_id:next.tenant_id,
 state:'ESCALATED_TO_CEO',authority:'CEO_FINANCE_ONLY',used_vnd:result.used_vnd,requested_vnd:result.requested_vnd,limit_vnd:result.limit_vnd,
 evidence:'VERIFIED_FINANCE_PRECHECK_REQUIRED_FOR_ACTUAL_APPROVAL',created_at:at};
 next.finance_exceptions.push(exception);
 next.events.push({event_id:sha([result.request_id,'FINANCE_ESCALATED']),actor:'A11',event:'FINANCE_ESCALATED',at,context_hash:sha(exception)});
 return {ok:true,ledger:next,exception,executable:false,publish_allowed:false};
}
export function sharedWorklist(ledgers,tenant_id){
 if(!Array.isArray(ledgers)||!id(tenant_id)||ledgers.some(l=>l?.tenant_id!==tenant_id||!Array.isArray(l.rows)||!Array.isArray(l.finance_exceptions)))throw Error('TENANT_ISOLATION_REQUIRED');
 return {tenant_id,source:'STAGING_IN_MEMORY_SNAPSHOTS',tasks:ledgers.flatMap(l=>l.rows.map(r=>({...r}))),ceo_finance_queue:ledgers.flatMap(l=>l.finance_exceptions.filter(e=>e.state==='ESCALATED_TO_CEO').map(e=>({...e}))),
 publish_allowed:false,persistent:false};
}
