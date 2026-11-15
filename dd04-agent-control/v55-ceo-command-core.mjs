// DD04-A00-018 V5.5 CEO authenticated command intake, no agent execution/approval.
// The current legacy DB guards REQUIRE WAITING_CEO_PLAN; never bypass them.
import {createHash} from 'node:crypto';
import {agentsFor} from './runtime-core.mjs';
const hex=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const okUuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x||'');
export function makeCeoCommandDraft({message_text,request_id,media_refs}={}){
 if(typeof message_text!=='string'||message_text.trim().length<8||message_text.length>2000)
  return {ok:false,error:'MESSAGE_8_TO_2000_REQUIRED'};
 if(typeof request_id!=='string'||!/^ceo_[a-f0-9-]{16,64}$/i.test(request_id))
  return {ok:false,error:'CEO_REQUEST_ID_REQUIRED'};
 // Until verified storage is implemented, never pretend an attachment was uploaded or read.
 if(media_refs!==undefined&&(!Array.isArray(media_refs)||media_refs.length>0))
  return {ok:false,error:'ATTACHMENT_STORAGE_NOT_ENABLED'};
 const source='CEO_STAGING_WEB';
 const external_id=request_id;
 const command_id='cmd_'+hex({source,external_id}).slice(0,20);
 const input_sha256=hex({source,external_id,message_text});
 const agentIds=agentsFor(message_text);
 const taskGraph=agentIds.map((owner_agent,i)=>({
  task_id:command_id+'_'+owner_agent,owner_agent,
  dependency_task_id:i===0?null:command_id+'_A00',
  status:'PLANNED_WAIT_G1',revision:1
 }));
 return {ok:true,source,external_id,command_id,input_sha256,
  message_text,status:'WAITING_CEO_PLAN',schema_version:'5.3',
  taskGraph,policy_version:'DD04_V5_5_CEO_COMMAND_FINANCE_ONLY',
  agent_execution_enabled:false,auto_approval_enabled:false};
}
export function validateCeoSessionRecord({userId,tenantId,claims,verified}={}){
 if(!okUuid(userId)||!okUuid(tenantId)||!okUuid(claims?.session_id)||claims?.aal!=='aal2')
  return {ok:false,error:'CEO_MFA_AAL2_REQUIRED'};
 if(verified?.session_valid!==true||verified?.ceo_valid!==true)
  return {ok:false,error:'ACTIVE_CEO_AND_LIVE_MFA_SESSION_REQUIRED'};
 return {ok:true};
}
