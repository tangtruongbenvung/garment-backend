// DD04-A00-016 | V5.4 server-side canonical evidence packet builder.
// No DB operations, no G2 decision, no publishing; hashes bind full content+channel+schedule.
import {createHash} from 'node:crypto';
const SHA=/^[0-9a-f]{64}$/;
const TIME_ZONE_OFFSET=/([+-](?:0\d|1[0-4]):[0-5]\d|Z)$/;
const reject=(reason)=>({ok:false,reason,ready_for_publication:false});
function stable(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
}
const digest=value=>createHash('sha256').update(stable(value)).digest('hex');
const text=x=>typeof x==='string'&&x.trim().length>0;
const refs=ar=>Array.isArray(ar)&&ar.length>0&&ar.every(x=>text(x));
export function makeFinalPacket(input){
 if(input?.source!=='SERVER_ASSET_REGISTRY')return reject('SERVER_ASSET_REGISTRY_REQUIRED');
 if(!text(input.tenant_id)||!text(input.command_id)||!text(input.content_id)||
    !text(input.channel_id)||!['FANPAGE','TIKTOK'].includes(input.platform))
  return reject('IDENTITY_AND_PLATFORM_REQUIRED');
 if(!Number.isSafeInteger(input.revision)||input.revision<1)return reject('REVISION_REQUIRED');
 if(!SHA.test(input.profile_sha256||'')||!SHA.test(input.video_sha256||'')||
    !SHA.test(input.caption_sha256||'')||!SHA.test(input.script_sha256||''))
  return reject('ALL_CONTENT_HASHES_REQUIRED');
 if(!text(input.video_ref)||!text(input.caption_ref)||!text(input.script_ref)||
    !refs(input.image_refs))return reject('ALL_MEDIA_REFS_REQUIRED');
 if(!text(input.schedule_at)||!TIME_ZONE_OFFSET.test(input.schedule_at)||
    !Number.isFinite(Date.parse(input.schedule_at)))return reject('EXPLICIT_SCHEDULE_TIMEZONE_REQUIRED');
 if(!Number.isSafeInteger(input.duration_seconds)||input.duration_seconds<20||
    input.duration_seconds>60)return reject('DURATION_OUTSIDE_20_60_SECONDS');
 if(!text(input.channel_profile_version))return reject('CHANNEL_PROFILE_VERSION_REQUIRED');
 // No CEO signature included: this is only the content packet which CEO must review.
 const payload={
  protocol:'DD04_V5_4_FINAL_PACKET_V1',
  tenant_id:input.tenant_id,command_id:input.command_id,
  content_id:input.content_id,channel_id:input.channel_id,platform:input.platform,
  revision:input.revision,
  channel_profile_version:input.channel_profile_version,
  profile_sha256:input.profile_sha256,
  script_sha256:input.script_sha256,video_sha256:input.video_sha256,
  caption_sha256:input.caption_sha256,
  video_ref:input.video_ref,caption_ref:input.caption_ref,
  script_ref:input.script_ref,image_refs:[...input.image_refs],
  duration_seconds:input.duration_seconds,
  schedule_at:new Date(input.schedule_at).toISOString()
 };
 return {ok:true,packet:Object.freeze(payload),packet_sha256:digest(payload),
   ready_for_publication:false,reason:'WAIT_FOR_A08_A09_AND_CEO_G2'};
}
export function inspectQcEvidence(packetResult,agentChecks){
 if(packetResult?.ok!==true||!SHA.test(packetResult.packet_sha256||''))
  return reject('VERSIONED_FINAL_PACKET_REQUIRED');
 const checks=agentChecks;
 if(!Array.isArray(checks)||checks.length!==2)return reject('TWO_INDEPENDENT_QC_EVENTS_REQUIRED');
 const byAgent=new Map();
 for(const item of checks){
  if(!['A08','A09'].includes(item?.agent_id)||byAgent.has(item.agent_id)||
     item.source!=='SERVER_AGENT_AUDIT'||!SHA.test(item.report_sha256||'')||
     item.packet_sha256!==packetResult.packet_sha256||
     item.result!=='PASS')return reject('QC_EVENT_NOT_VERIFIED_OR_PACKET_HASH_MISMATCH');
  byAgent.set(item.agent_id,item);
 }
 if(!byAgent.has('A08')||!byAgent.has('A09'))return reject('A08_AND_A09_REQUIRED');
 return {ok:true,packet_sha256:packetResult.packet_sha256,
  qc_evidence_sha256:digest(checks.map(c=>({
   agent_id:c.agent_id,report_sha256:c.report_sha256,
   packet_sha256:c.packet_sha256,result:c.result
  })).sort((a,b)=>a.agent_id.localeCompare(b.agent_id))),
  ready_for_publication:false,reason:'WAIT_FOR_CEO_G2_TRANSACTION'};
}
export function previewCeoDecisionBatch(packets){
 if(!Array.isArray(packets)||!packets.length||packets.length>50)return reject('BATCH_SIZE_1_TO_50_REQUIRED');
 const ids=new Set(),items=[];
 for(const value of packets){
  if(value?.ok!==true||!SHA.test(value.packet_sha256||''))return reject('INVALID_PACKET');
  const p=value.packet;
  if(!p||!text(p.content_id)||!text(p.channel_id)||!Number.isSafeInteger(p.revision))
   return reject('PACKET_IDENTITY_REQUIRED');
  const key=[p.tenant_id,p.content_id,p.channel_id,p.revision].join('|');
  if(ids.has(key))return reject('DUPLICATE_PACKET_IN_BATCH');
  ids.add(key);
  items.push({content_id:p.content_id,channel_id:p.channel_id,
   revision:p.revision,packet_sha256:value.packet_sha256,
   schedule_at:p.schedule_at});
 }
 return {ok:true,batch_sha256:digest(items),items,ready_for_publication:false,
  reason:'CEO_MUST_REVIEW_EACH_PACKET_IN_G2'};
}
