// DD04 V5.5 — pure simulation of Agent handoff and QC rework.
// This is NOT a live worker: it never mutates DB, spends money or publishes.
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const reject=(reason,s)=>({ok:false,reason,workflow:s??null,live_worker:false,published:false});
export function createAgentWorkflow({command_id,channel_id,content_id,revision=1,source_sha256}={}){
 if(!/^cmd_[0-9a-f]{20}$/.test(command_id||'')||
    !/^[A-Za-z0-9_-]{2,100}$/.test(channel_id||'')||
    !/^[A-Za-z0-9_-]{4,150}$/.test(content_id||'')||
    !Number.isInteger(revision)||revision<1||
    !/^[a-f0-9]{64}$/.test(source_sha256||''))return reject('INVALID_VERSIONED_INPUT');
 return {ok:true,live_worker:false,published:false,
  workflow:{command_id,channel_id,content_id,revision,source_sha256,
   current_agent:'A03',stage:'DRAFTING',review:{A08:'PENDING',A09:'PENDING'},
   events:[]}};
}
export function simulateAgentStep(workflow,{agent_id,action,output_sha256,review_sha256}={}){
 if(!workflow||!/^A(0[0-9]|1[0-7])$/.test(agent_id||''))return reject('INVALID_AGENT',workflow);
 if(!/^[a-f0-9]{64}$/.test(output_sha256||''))return reject('VERSIONED_OUTPUT_HASH_REQUIRED',workflow);
 const w=structuredClone(workflow);
 const add=(event)=>w.events.push({sequence:w.events.length+1,actor_kind:'AGENT',actor_ref:agent_id,
  event,revision:w.revision,output_sha256,
  evidence_sha256:sha({command:w.command_id,channel:w.channel_id,
   content:w.content_id,revision:w.revision,agent_id,action,output_sha256})});
 if(w.stage==='DRAFTING'&&agent_id==='A03'&&action==='SUBMIT_DRAFT'){
  w.current_agent='A08';w.stage='QC';w.output_sha256=output_sha256;
  w.review={A08:'PENDING',A09:'PENDING'};add('DRAFT_SUBMITTED');return {ok:true,workflow:w,live_worker:false,published:false};
 }
 if(w.stage==='QC'&&['A08','A09'].includes(agent_id)&&action==='PASS'&&
    /^[a-f0-9]{64}$/.test(review_sha256||'')&&output_sha256===w.output_sha256){
  if(w.review[agent_id]!=='PENDING')return reject('DUPLICATE_REVIEW',workflow);
  w.review[agent_id]='PASS';add('QC_'+agent_id+'_PASS');
  if(w.review.A08==='PASS'&&w.review.A09==='PASS'){w.stage='READY_FOR_PLATFORM_PERMISSION_REVIEW';w.current_agent='A07';}
  else w.current_agent=agent_id==='A08'?'A09':'A08';
  return {ok:true,workflow:w,live_worker:false,published:false};
 }
 if(w.stage==='QC'&&['A08','A09'].includes(agent_id)&&action==='REWORK'&&output_sha256===w.output_sha256){
  w.stage='REWORK';w.current_agent='A03';w.review={A08:'PENDING',A09:'PENDING'};
  add('QC_'+agent_id+'_REWORK');return {ok:true,workflow:w,live_worker:false,published:false};
 }
 if(w.stage==='REWORK'&&agent_id==='A03'&&action==='REVISE'&&output_sha256!==w.output_sha256){
  w.revision++;w.output_sha256=output_sha256;w.stage='QC';w.current_agent='A08';
  w.review={A08:'PENDING',A09:'PENDING'};add('DRAFT_REVISED_AND_QC_RESET');return {ok:true,workflow:w,live_worker:false,published:false};
 }
 return reject('UNAUTHORIZED_STAGE_OR_HASH_CHANGE',workflow);
}
