// Channel Registry V2 — pure staging preview domain, no database writes, no CEO approvals.
import {snapshotChannel,makeAgentHandoff,AGENT_IDS} from './channel-context-core.mjs';
const fail=x=>{throw new Error(x);};
function safeRecord(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('REGISTRY_INPUT_REQUIRED');
 if(!Array.isArray(input.channels)||input.channels.length<1||input.channels.length>300)fail('CHANNELS_1_TO_300');
 const byId=new Map();
 for(const channel of input.channels){
  const snap=snapshotChannel(channel);
  if(byId.has(snap.channel_id))fail('DUPLICATE_CHANNEL_ID');
  byId.set(snap.channel_id,{...snap,operational_state:'DRAFT_STAGING_UNVERIFIED',tasks:[],content_history:[]});
 }
 return byId;
}
export function previewRegistry(input){
 const byId=safeRecord(input);
 const channels=[...byId.values()];
 const countByPlatform={FANPAGE:channels.filter(x=>x.platform==='FANPAGE').length,TIKTOK:channels.filter(x=>x.platform==='TIKTOK').length};
 return {schema_version:'5.3',registry_version:2,source:'LOCAL_PREVIEW_NOT_SUPABASE',
  channel_count:channels.length,count_by_platform:countByPlatform,
  channels,approval:{G1:'PENDING',G2:'PENDING'},writing_enabled:false,publishing_allowed:false};
}
export function previewAssignment(input,channelId,agentId){
 const registry=safeRecord(input);
 const profile=registry.get(channelId);
 if(!profile)fail('CHANNEL_NOT_FOUND');
 if(!AGENT_IDS.includes(agentId)||!profile.assigned_agents.includes(agentId))fail('AGENT_NOT_ASSIGNED_TO_CHANNEL');
 return {channel_id:channelId,agent_id:agentId,profile_version:profile.version,profile_sha256:profile.profile_sha256,
  status:'ASSIGNMENT_PREVIEW_WAIT_G1',can_execute:false};
}
export function previewCampaignTasks(input,campaignId,agentId='A03'){
 const registry=safeRecord(input);
 if(typeof campaignId!=='string'||!/^[A-Za-z0-9_-]{2,64}$/.test(campaignId))fail('CAMPAIGN_ID_INVALID');
 if(!AGENT_IDS.includes(agentId))fail('AGENT_INVALID');
 const tasks=[];
 for(const [channelId,p] of registry){
  const t={campaign_id:campaignId,task_id:('V2-'+agentId+'-'+channelId).slice(0,64),
    channel_id:channelId,profile_version:p.version,profile_sha256:p.profile_sha256,
    agent_id:agentId,objective:'Tạo nội dung đúng định hướng riêng của '+p.name+'; không sao chép kênh khác.'};
  const original=input.channels.find(x=>x.channel_id===channelId);
  tasks.push(makeAgentHandoff(original,t));
 }
 if(tasks.length!==registry.size)fail('TASK_COUNT_MISMATCH');
 return {campaign_id:campaignId,channel_count:registry.size,task_count:tasks.length,
  tasks,source:'STAGING_NO_EXECUTION',approval:{G1:'PENDING',G2:'PENDING'}};
}
export function previewProfileChange(input,channelId,nextFields){
 const registry=safeRecord(input);
 const old=registry.get(channelId);
 if(!old)fail('CHANNEL_NOT_FOUND');
 if(!nextFields||typeof nextFields!=='object'||Array.isArray(nextFields))fail('PROFILE_CHANGE_INVALID');
 const allowed=['positioning','audience','content_pillars','tone','character_bible','visual_style','forbidden','cta_policy','target_outcome'];
 if(Object.keys(nextFields).some(k=>!allowed.includes(k)))fail('PROFILE_CHANGE_UNAUTHORIZED_FIELD');
 const current=input.channels.find(c=>c.channel_id===channelId);
 const newProfile={...current,...nextFields,version:current.version+1};
 const updated=snapshotChannel(newProfile);
 if(updated.profile_sha256===old.profile_sha256)fail('PROFILE_CHANGE_NOOP');
 return {channel_id:channelId,from_version:old.version,to_version:updated.version,
   from_sha256:old.profile_sha256,to_sha256:updated.profile_sha256,
   changed_keys:Object.keys(nextFields).filter(k=>nextFields[k]!==current[k]),
   status:'WAITING_CEO_G1',effective:false,publish_allowed:false,proposed_profile:updated};
}
