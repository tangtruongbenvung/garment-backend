import { createHash } from 'node:crypto';

export const SCHEMA_VERSION = '5.3';
// Netlify exposes CONTEXT to build steps but not necessarily to Functions runtime.
// Fail closed for all hosts except this exact Netlify Deploy Preview hostname.
export function isStagingPreviewUrl(url) {
 try {
  const u=new URL(url);
  return u.protocol==='https:' && /^deploy-preview-[1-9][0-9]*--ducduy-ai-os-test[.]netlify[.]app$/.test(u.hostname);
 } catch {return false;}
}
export const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function agentsFor(message) {
  const s=message.toLocaleLowerCase('vi-VN');
  if (/video|clip|kịch bản|hoạt hình|hình ảnh|nội dung/.test(s)) return ['A00','A03','A04','A05','A08','A09','A06'];
  if (/xu hướng|đối thủ|viral|nghiên cứu/.test(s)) return ['A00','A01','A02','A12','A13','A09'];
  if (/khách hàng|tư vấn|đơn hàng|chăm sóc/.test(s)) return ['A00','A14','A15','A09'];
  return ['A00','A02','A09'];
}
export function makeCommand(input, at=new Date().toISOString()) {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error('INVALID_INPUT');
  const externalId=input.external_id, message=input.message_text;
  if(typeof externalId!=='string' || !/^[a-zA-Z0-9_-]{4,100}$/.test(externalId)) throw new Error('INVALID_EXTERNAL_ID');
  if(typeof message!=='string'||message.trim().length<8||message.length>2000) throw new Error('INVALID_MESSAGE');
  if(input.media_refs!==undefined && (!Array.isArray(input.media_refs)||input.media_refs.length)) throw new Error('MEDIA_NOT_ENABLED');
  const commandId='cmd_'+sha({externalId,source:'STAGING_OPERATOR'}).slice(0,20);
  const agents=agentsFor(message);
  const inputHash=sha({externalId,message});
  const taskGraph=agents.map((agent,i)=>({task_id:commandId+'_'+agent,owner_agent:agent,status:'PLANNED_WAIT_G1',dependency:i===0?null:commandId+'_A00',output_refs:[],revision:1}));
  return {
    schema_version:SCHEMA_VERSION, command_id:commandId, external_id:externalId, origin:'STAGING_OPERATOR',
    input_sha256:inputHash, received_at:at, message_text:message,
    status:'WAITING_CEO_PLAN', auth_level:'STAGING_OPERATOR_TOKEN_NOT_CEO_AUTH',
    meeting:{status:'DRAFT_ROUTING_ONLY', invited_agents:agents, proposals:[], policy_review:'NOT_RUN',
      notes:['Phân tuyến theo quy tắc; chưa gọi LLM/Agent chuyên môn','G1 chưa được CEO duyệt xác thực']},
    task_graph:taskGraph,
    approvals:[{stage:'PLAN',decision:'PENDING',reviewer:null,decided_at:null}],
    audit:[{at,event:'COMMAND_ACCEPTED',actor:'STAGING_OPERATOR',input_hash:inputHash}]
  };
}
export async function dispatch(store,input) {
  const record=makeCommand(input);
  const key='commands/'+record.command_id;
  const previous=await store.get(key,{type:'json'});
  if(previous){
    if(previous.input_sha256!==record.input_sha256) return {code:409,body:{error:'IDEMPOTENCY_CONFLICT',command_id:record.command_id}};
    return {code:200,body:{command_id:record.command_id,duplicate:true,status:previous.status,task_count:previous.task_graph.length}};
  }
  // Netlify Blobs is not transactional; same-key concurrency needs stronger DB before production.
  await store.setJSON(key,record);
  return {code:201,body:{command_id:record.command_id,duplicate:false,status:record.status,task_count:record.task_graph.length,invited_agents:record.meeting.invited_agents}};
}
