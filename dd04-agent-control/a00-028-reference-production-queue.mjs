// DD04 A00-028 — reference production queue, staging-only, zero cost.
// This is a plan/contract, NOT image generation, object upload, DB worker handoff or publish.
import {createHash} from 'node:crypto';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const SHA=/^[a-f0-9]{64}$/;
const slots=['mother_front','mother_three_quarter','mother_expressions',
 'baby_front','baby_three_quarter','baby_expressions','family_joint'];
const phrase={
 mother_front:'Mẹ chính diện, ánh sáng tự nhiên, gương mặt Việt hư cấu nhất quán',
 mother_three_quarter:'Mẹ góc ba phần tư, CÙNG một khuôn mặt và trang phục',
 mother_expressions:'Mẹ nhiều biểu cảm tự nhiên, gương mặt không biến đổi',
 baby_front:'Bé chính diện, tỷ lệ đúng tháng tuổi, cùng nhân vật',
 baby_three_quarter:'Bé góc ba phần tư, CÙNG đặc điểm với ảnh bé chính diện',
 baby_expressions:'Bé nhiều nét mặt phù hợp độ tuổi; giữ nguyên mắt, má và tóc',
 family_joint:'Mẹ và bé cùng khung hình, dùng chính xác hai khuôn mặt đã khóa'
};
export const REFERENCE_SLOTS=Object.freeze([...slots]);
export function makeA0028ReferenceQueue(registry){
 if(!registry||registry.schema_version!=='DD04_CHANNEL_IDENTITY_REGISTRY_V1'||
  registry.image_usage!=='COMMON_STYLE_ONLY_NOT_SHARED_FACES'||
  !SHA.test(registry.approved_common_style_sha256||'')||
  !Array.isArray(registry.channels)||registry.channels.length!==20)
  throw Error('A0028_APPROVED_REGISTRY_REQUIRED');
 const ids=new Set(),names=new Set(),characterPairs=new Set();
 const channels=registry.channels.map(c=>{
  if(!/^((FB|TT)\d{3})$/.test(c.channel_id||'')||
   (c.platform==='FANPAGE'?!c.channel_id.startsWith('FB'):c.platform==='TIKTOK'?!c.channel_id.startsWith('TT'):true)||
   !Number.isInteger(c.baby_age_months)||c.baby_age_months<0||c.baby_age_months>36||
   c.identity_version!==1||c.reference_assets_status!=='PENDING_SEPARATE_IMAGES_A08_A09_QC'||
   !c.name||!c.mother_name||!c.baby_name||ids.has(c.channel_id)||names.has(c.name))
   throw Error('A0028_CHANNEL_IDENTITY_UNVERIFIED');
  ids.add(c.channel_id);names.add(c.name);
  const pair=c.mother_name+'|'+c.baby_name;
  if(characterPairs.has(pair))throw Error('A0028_DUPLICATE_CHARACTER_PAIR');
  characterPairs.add(pair);
  const brief={
   channel_id:c.channel_id,identity_version:1,platform:c.platform,
   channel_name:c.name,mother_name:c.mother_name,baby_name:c.baby_name,
   baby_age_months:c.baby_age_months,content_pillar:c.content_pillar,
   common_style_sha256:registry.approved_common_style_sha256,
   use_style_reference_for_face_identity:false,
   phase_lock:['MOI','CHUYEN_TIEP','BAN_HANG'],
   character_lock_status:'DESIGN_APPROVED_REFERENCE_PENDING',
   reference_review:{A08:'PENDING',A09:'PENDING'},
   a05_video_production:'BLOCKED_PENDING_REFERENCE_BYTES_AND_QC',
   ceo_g2:'NOT_APPROVED',publish_allowed:false
  };
  const identity_packet_sha256=digest(brief);
  const tasks=slots.map((slot,i)=>({
   task_id:'A04-028-'+c.channel_id+'-'+String(i+1).padStart(2,'0'),
   slot,view_direction_vi:phrase[slot],channel_id:c.channel_id,
   identity_packet_sha256,
   source_character_bible_version:1,
   generated_image_bytes_sha256:null,private_storage_key:null,
   status:'QUEUED_NOT_GENERATED',A08:'PENDING',A09:'PENDING',
   provider_execution_authorized:false,paid_api_calls:0
  }));
  return {channel_id:c.channel_id,platform:c.platform,identity_packet_sha256,
    brief,tasks};
 });
 if(channels.filter(c=>c.platform==='FANPAGE').length!==10||
   channels.filter(c=>c.platform==='TIKTOK').length!==10)
  throw Error('A0028_10_PLUS_10_REQUIRED');
 return Object.freeze({schema_version:'DD04_A00_028_REFERENCE_QUEUE_V1',
  status:'STAGING_PRODUCTION_HANDOFF_ONLY',
  channels,counts:{channels:20,reference_tasks:140,rendered_images:0,
   uploaded_images:0,qc_passed:0,rendered_videos:0,provider_calls:0,published:0},
  constraints:{same_face_all_views_and_videos:true,distinct_channel_faces:true,
   no_mock_qc_pass:true,no_finance_approval_for_free_planning:true,
   paid_provider_execution:false,storage_writes:false,ceo_g2_required:true,
   a07_publish:false},
  queue_sha256:digest(channels.map(c=>({id:c.channel_id,hash:c.identity_packet_sha256})))});
}
export function checkA0028ReferenceGate({queue,channel_id,reference_records,independent_audits}={}){
 const denied=reason=>Object.freeze({ok:false,reason,may_render_video:false,publish_allowed:false});
 const channel=queue?.channels?.find(c=>c.channel_id===channel_id);
 if(!channel)return denied('CHANNEL_NOT_IN_APPROVED_REGISTRY');
 if(!Array.isArray(reference_records)||reference_records.length!==7||
  new Set(reference_records.map(x=>x.slot)).size!==7 ||
  reference_records.some(x=>!slots.includes(x.slot)||x.channel_id!==channel_id||
   x.identity_packet_sha256!==channel.identity_packet_sha256||
   !SHA.test(x.bytes_sha256||'')||x.storage_verified!==true))
  return denied('SEVEN_IMMUTABLE_REFERENCE_IMAGES_REQUIRED');
 // Cannot establish trusted visual reviews from caller-provided audit JSON.
 // This only identifies a packet ready for backend DB audit verification.
 if(!independent_audits||independent_audits.source!=='AUTHENTICATED_STAGING_DB'||
   independent_audits.a08?.status!=='PASS'||independent_audits.a09?.status!=='PASS'||
   independent_audits.a08?.actor_subject_id===independent_audits.a09?.actor_subject_id||
   independent_audits.channel_id!==channel_id||
   independent_audits.identity_packet_sha256!==channel.identity_packet_sha256)
  return denied('INDEPENDENT_STAGING_QC_EVIDENCE_REQUIRED');
 return Object.freeze({ok:true,reason:'STATIC_CONTRACT_PASSED_NEEDS_TRUSTED_BACKEND',
  may_render_video:false,publish_allowed:false,requires:'TRUSTED_BACKEND_RECHECK_BEFORE_A05'});
}
