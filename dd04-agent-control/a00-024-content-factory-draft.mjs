// DD04-A00-024 — staging-only content pipeline: A03 → A04 → A05 → A08/A09.
// Creates immutable, deterministic production plans; DOES NOT call any model,
// render a video, change production, require finance approval, or publish.
import {createHash} from 'node:crypto';
import {planScripts} from './a03-channel-script-planner.mjs';
import {makeChannelIdentity,assessContinuityPacket} from './a00-025-channel-identity-lock.mjs';
const SHA=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const TEXT=x=>typeof x==='string'&&x.trim().length>0;
const STAGING='STAGING_CONTENT_DRAFT_NO_PROVIDER';
function assertDraft(script){
 if(!script||script.status!=='DRAFT_STAGING_NOT_EXECUTED'
 ||script.duration_seconds<20||script.duration_seconds>60
 ||!Array.isArray(script.scenes)||script.scenes.length<3
 ||script.review?.G2!=='NOT_APPROVED'||script.publishing_allowed!==false
 ||!TEXT(script.channel_id)||!TEXT(script.script_id))
  throw Error('A03_UNVERIFIED_STAGING_DRAFT');
 let last=0;
 for(const sc of script.scenes){
  if(!Number.isFinite(sc.from)||!Number.isFinite(sc.to)||
     sc.from!==last||sc.to<=sc.from||sc.to>script.duration_seconds||!TEXT(sc.visual))
   throw Error('SCENE_TIMELINE_INVALID');
  last=sc.to;
 }
 if(last!==script.duration_seconds)throw Error('SCENE_TIMELINE_INCOMPLETE');
}
function framePrompt(script,scene,index,identity){
 const profile=script.channel_context;
 const visuals=profile?.visual_style?JSON.stringify(profile.visual_style):
   'Hoạt hình 3D mềm mại, màu sắc ấm áp, bối cảnh gia đình Việt Nam';
 const forbidden=Array.isArray(profile?.forbidden)?profile.forbidden:[];
 const base=['Dựng một khung hình dọc 9:16 cho video hoạt hình hư cấu Việt Nam.',
   'Giữ nhân vật nhất quán xuyên suốt.','MẸ (đặc điểm bất biến): '+JSON.stringify(identity.character_bible.mother.invariant),
   'BÉ (đặc điểm bất biến): '+JSON.stringify(identity.character_bible.baby.invariant),
   'Mã khóa hồ sơ nhân vật '+identity.character_bible_sha256+'.',
   'Mã khóa style '+identity.visual_style_sha256+'.',
   'Phong cách kênh: '+JSON.stringify(identity.visual_style),visuals,
   'Tình huống: '+script.creative.story,
   'Cảnh '+(index+1)+': '+scene.visual,
   'Không dùng mặt, giọng hoặc danh tính người thật; không đặt bé vào tình huống nguy hiểm.',
   'Không logo, không chữ quảng cáo tùy tiện.'];
 if(forbidden.length)base.push('Tránh: '+forbidden.join('; '));
 return base.join(' ');
}
function makePack(script){
 assertDraft(script);
 const identity=makeChannelIdentity({channel_id:script.channel_id,
  platform:script.platform,name:script.channel_name},
  {channel_version:script.profile_version||1});
 const bible=identity.character_bible;
 const images=script.scenes.map((scene,i)=>({
  scene_id:`${script.script_id}_scene_${String(i+1).padStart(2,'0')}`,
  start_second:scene.from,end_second:scene.to,aspect_ratio:'9:16',
  frame_prompt_vi:framePrompt(script,scene,i,identity),
  channel_identity_sha256:identity.identity_bundle_sha256,
  channel_character_bible_sha256:identity.character_bible_sha256,
  channel_visual_style_sha256:identity.visual_style_sha256,
  negative_prompt_vi:'Không photorealistic trẻ em thật, không mặt người nổi tiếng, không nguy hiểm, không nội dung phản cảm, không watermark.',
  reference_character_ids:[bible.mother.character_id,bible.baby.character_id],
  image_status:'PROMPT_ONLY_NO_IMAGE_GENERATED'
 }));
 const video=script.scenes.map((scene,i)=>({
  scene_id:images[i].scene_id,from:scene.from,to:scene.to,
  channel_identity_sha256:identity.identity_bundle_sha256,
  duration_seconds:scene.to-scene.from,source_image_sha256:null,
  animation_prompt_vi:'Chuyển động hoạt hình nhẹ, biểu cảm tự nhiên, camera ổn định. '+scene.visual+
     ' Không dùng chuyển động giật mạnh, vật sắc nhọn hay hành vi nguy hiểm với trẻ.',
  voiceover_vi:TEXT(scene.speech)?scene.speech:null,
  subtitles_vi:TEXT(scene.speech)?scene.speech:null,
  audio_plan_vi:'Nhạc nền vui nhẹ chỉ dùng bản gốc hoặc có quyền sử dụng; không sao chép nhạc có bản quyền.',
  transition:'cắt cảnh mềm',
  status:'VIDEO_SHOT_PLAN_NO_RENDER'
 }));
 const qc={A08:{status:'PENDING',checks:[
  'Thời lượng video 20–60 giây, tỷ lệ dọc 9:16',
  'Nhân vật nhất quán giữa các cảnh và phù hợp hoạt hình hư cấu',
  'Nhịp hài tự nhiên; ngôn ngữ tiếng Việt không máy móc',
  'Đồ vật và hành động an toàn với trẻ 0–36 tháng',
  'Không dùng hình ảnh/giọng nói/âm nhạc không có quyền',
  'Đối chiếu SHA-256 của video và caption sau khi render'
 ]},A09:{status:'PENDING',checks:[
  'Không mạo danh người thật hoặc đánh lừa người xem video là cảnh quay thật',
  'Không công bố thông tin trẻ em thật',
  'Không xúc phạm, tục tĩu, nội dung gây hại hoặc giật gân nguy hiểm',
  'Không quảng cáo sai lệch hay đánh giá giả',
  'Trả lời bình luận theo thư viện ngữ cảnh, không spam',
  'Chỉ trình CEO duyệt G2 sau khi A08 và A09 đều PASS'
 ]}};
 const deliver={schema_version:'DD04_A00_024_V1',campaign_id:script.campaign_id,
  channel_id:script.channel_id,channel_name:script.channel_name,platform:script.platform,
  script_id:script.script_id,title:script.creative.title,
  direction:'Video giải trí hài mẹ/bé hoạt hình hư cấu Việt Nam 0–36 tháng',
  duration_seconds:script.duration_seconds,format:'1080x1920',locale:'vi-VN',
  A03:{status:'DRAFT_REVIEW_REQUIRED',script:script.creative,scenes:script.scenes,
    caption:script.caption,reply_library_json:script.reply_library},
  channel_identity_sha256:identity.identity_bundle_sha256,
  channel_identity_version:identity.channel_version,
  A04:{status:'PROMPTS_READY_NO_PROVIDER',character_bible:bible,
    visual_style:identity.visual_style,continuity_rules:identity.continuity_rules,
    channel_character_bible_sha256:identity.character_bible_sha256,
    channel_visual_style_sha256:identity.visual_style_sha256,
    channel_continuity_rules_sha256:identity.continuity_rules_sha256,
    reference_images_verified:false,image_shots:images},
  A05:{status:'SHOT_PLAN_READY_NO_RENDER',video_shots:video,
    output_video_sha256:null,render_complete:false},
  quality:qc,
  approval:{internal_review:'PENDING',ceo_G2:'NOT_APPROVED',
    approved_asset_sha256:null,target_channel:script.channel_id,
    publishing_schedule:null},
  runtime:{environment:STAGING,paid_api_calls:0,actual_video_file:false,
    channel_finance_approval_required:false,external_spend_authorized:false,
    agent_execution:false,publish_allowed:false}};
 const identityPreflight=assessContinuityPacket(deliver,identity);
 if(!identityPreflight.ok)throw Error('CHANNEL_CONTINUITY_PRECHECK_FAILED');
 deliver.quality.A08.identity_preflight=identityPreflight;
 deliver.quality.A08.visual_media_passed=false;
 return Object.freeze({...deliver,package_sha256:SHA(deliver)});
}
export function buildContentFactoryDraft(campaignPlan){
 const scripts=planScripts(campaignPlan);
 const packets=scripts.scripts.map(makePack);
 if(new Set(packets.map(p=>p.package_sha256)).size!==packets.length)
  throw Error('CONTENT_PACKAGE_DUPLICATE');
 return Object.freeze({schema_version:'DD04_A00_024_V1',
  status:'STAGING_STORYBOARD_READY_NOT_RENDERED',
  campaign_id:scripts.campaign_id,channel_count:scripts.channel_count,
  packets,counts:{a03_scripts:packets.length,a04_image_shot_prompts:packets.reduce((n,p)=>n+p.A04.image_shots.length,0),
   a05_video_shot_plans:packets.reduce((n,p)=>n+p.A05.video_shots.length,0),
   videos_rendered:0,published:0,paid_api_calls:0},
  handoff:[{from:'A00',to:'A03',state:'PREVIEW_PLAN_ONLY'},
   {from:'A03',to:'A04',state:'PROMPT_PACKET_ONLY'},
   {from:'A04',to:'A05',state:'IMAGE_CREATION_REQUIRED'},
   {from:'A05',to:'A08',state:'VIDEO_RENDER_REQUIRED'},
   {from:'A08',to:'A09',state:'QC_REQUIRED'},
   {from:'A09',to:'CEO_G2',state:'FINAL_APPROVAL_REQUIRED'}],
  controls:{finance_approvals_for_channel_building:false,
   permission_to_spend:false,permission_to_render_paid:false,
   permission_to_publish:false,canonical_g1_not_bypassed:true},
  manifest_sha256:SHA(packets.map(p=>p.package_sha256))});
}
