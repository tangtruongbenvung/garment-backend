// DD04-A00-006: pure migration/validation contract. No DB or network operations.
const taskStates=new Set(['PLANNED_WAIT_G1','READY','IN_PROGRESS','REVIEW','REWORK','HOLD','DONE','BLOCKED','CANCELLED']);
const expectedAgents=new Set(Array.from({length:18},(_,i)=>'A'+String(i).padStart(2,'0')));
export function normalizeLegacyA00(record){
 if(!record || typeof record!=='object'||!/^cmd_[a-f0-9]{20}$/.test(record.command_id||''))throw new Error('INVALID_COMMAND');
 if(!Array.isArray(record.task_graph)||record.task_graph.length>18)throw new Error('INVALID_TASK_GRAPH');
 if(record.status!=='WAITING_CEO_PLAN')throw new Error('REVIEW_REQUIRED_FOR_NON_PENDING_COMMAND');
 const ids=new Set();
 const tasks=record.task_graph.map(t=>{
  if(!t||typeof t.task_id!=='string'||ids.has(t.task_id)||!expectedAgents.has(t.owner_agent)||!taskStates.has(t.status))throw new Error('INVALID_TASK');
  ids.add(t.task_id);
  if(t.status!=='PLANNED_WAIT_G1')throw new Error('UNVERIFIED_TASK_STATE');
  return {task_id:t.task_id,command_id:record.command_id,owner_agent:t.owner_agent,dependency_task_id:t.dependency||null,status:t.status,revision:t.revision||1,output_refs:[]};
 });
 for(const t of tasks)if(t.dependency_task_id&&!ids.has(t.dependency_task_id))throw new Error('UNKNOWN_DEPENDENCY');
 const approval=(record.approvals||[]).find(x=>x.stage==='PLAN');
 if(!approval||approval.decision!=='PENDING')throw new Error('UNVERIFIED_G1');
 return Object.freeze({
  command:{command_id:record.command_id,external_id:record.external_id,origin:record.origin,input_sha256:record.input_sha256,message_text:record.message_text,status:record.status,received_at:record.received_at,schema_version:'5.3'},
  tasks,
  approvals:[{command_id:record.command_id,gate:'G1',decision:'PENDING',approved_by:null,decided_at:null,approval_version:1}],
  events:(record.audit||[]).map(e=>({command_id:record.command_id,event_name:e.event,actor_kind:'SYSTEM',actor_id:e.actor||'UNKNOWN',happened_at:e.at,evidence_sha256:e.input_hash||null})),
  migration_status:'REVIEW_ONLY_NOT_EXECUTED'
 });
}
export function checkEventTransition(prev,next,evidence){
 const valid={
  PLANNED_WAIT_G1:['READY','HOLD','CANCELLED'],
  READY:['IN_PROGRESS','HOLD','BLOCKED'],
  IN_PROGRESS:['REVIEW','BLOCKED','HOLD'],
  REVIEW:['DONE','REWORK','HOLD'],
  REWORK:['READY','HOLD','CANCELLED'],
  HOLD:['READY','CANCELLED'],
  BLOCKED:['READY','CANCELLED'],
  DONE:[],
  CANCELLED:[]
 };
 if(!taskStates.has(prev)||!taskStates.has(next))return {ok:false,reason:'INVALID_STATUS'};
 if(!valid[prev].includes(next))return {ok:false,reason:'TRANSITION_NOT_ALLOWED'};
 if(['REVIEW','DONE','REWORK','BLOCKED'].includes(next) && (!evidence||typeof evidence.sha256!=='string'||!/^[a-f0-9]{64}$/.test(evidence.sha256)))return {ok:false,reason:'EVIDENCE_REQUIRED'};
 if(prev==='PLANNED_WAIT_G1'&&next==='READY'&&evidence?.verified_ceo_g1!==true)return {ok:false,reason:'VERIFIED_G1_REQUIRED'};
 return {ok:true,reason:'ALLOW_PROPOSAL_ONLY'};
}
