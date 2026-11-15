// DD04-A00-025 | Staging design contracts, no provider call or media verification.
// Channel identity stays stable across every video; a separate script cannot
// silently change character or visual identity. Do not claim generated pixels match.
import {createHash} from 'node:crypto';
const H=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const ID=/^[A-Za-z0-9_-]{2,64}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const normalize=s=>String(s).normalize('NFC').trim();
const palettes=[
 {name:'Nắng sớm',primary:'#E9B998',secondary:'#93BCC0',accent:'#F2D26B'},
 {name:'Mùa xuân',primary:'#D39CA9',secondary:'#AED0AC',accent:'#E9D19B'},
 {name:'Ngày vui',primary:'#A7BBD8',secondary:'#E3B4A1',accent:'#F0CF80'},
 {name:'Ấm áp',primary:'#D4A6C3',secondary:'#9CC9BA',accent:'#F3DAA2'}
];
function requireText(x,code,max=900){if(typeof x!=='string'||!x.trim()||x.length>max)throw Error(code);return normalize(x);}
function forbidUnsafeText(t){
 // Text classification is only an early deterministic screen: A09 still reviews.
 if(/\b(?:photorealistic\s+(?:child|baby)|real\s+infant\s+identity)\b/i.test(t))
  throw Error('REAL_CHILD_IMPERSONATION_DENIED');
}
export function makeChannelIdentity(channel,{channel_version=1,reference_assets=null}={}){
 if(!channel||!ID.test(channel.channel_id||'')||!['FANPAGE','TIKTOK'].includes(channel.platform)||
    !Number.isSafeInteger(channel_version)||channel_version<1)
  throw Error('CHANNEL_IDENTITY_SCOPE_INVALID');
 const name=requireText(channel.name,'CHANNEL_NAME_REQUIRED',100);
 const seed=H({channel_id:channel.channel_id,platform:channel.platform,kind:'VIETNAMESE_FICTIONAL_FAMILY_V1'});
 const palette=palettes[parseInt(seed.slice(0,2),16)%palettes.length];
 const setting=['Nhà phố Việt Nam sáng sủa','Căn hộ gia đình Việt ấm cúng',
   'Nhà có khoảng sân nhỏ, đồ chơi an toàn','Góc phòng khách gia đình Việt'][parseInt(seed.slice(2,4),16)%4];
 const hair=['tóc đen ngang vai','tóc đen buộc thấp','tóc đen dài ngang lưng','tóc đen búi gọn'][parseInt(seed.slice(4,6),16)%4];
 const mother={
  character_id:channel.channel_id+'_MOM',
  role:'Mẹ Việt Nam hoạt hình hư cấu, người trưởng thành',
  invariant:{face_shape:'mặt bầu nhẹ, đường nét hoạt hình cách điệu',
    hair,eye_color:'nâu đậm',skin_tone:'màu da tự nhiên đa dạng, tông ấm',
    silhouette:'người trưởng thành, tỷ lệ hoạt hình',outfit:'áo trơn màu '+palette.primary+' và quần đơn sắc',
    voice:'giọng tiếng Việt tự nhiên, ấm áp, không giả giọng người thật'},
  expression_variants:['vui vẻ','ngạc nhiên','dịu dàng','hài hước']
 };
 const baby={
  character_id:channel.channel_id+'_BABY',
  role:'Em bé Việt Nam hoạt hình hư cấu 0–36 tháng',
  invariant:{face_shape:'khuôn mặt tròn hoạt hình, má bầu',
    hair:'tóc đen tơ ngắn',eye_color:'nâu đậm',
    skin_tone:'màu da tự nhiên tông ấm',silhouette:'tỷ lệ đáng yêu phù hợp độ tuổi thể hiện',
    outfit:'bộ cotton hoạt hình trơn màu '+palette.secondary,
    voice:'tiếng bé hoặc lời thoại hư cấu phù hợp độ tuổi, không gán khả năng phát triển phi thực tế thành sự thật'},
  expression_variants:['tò mò','vui','bất ngờ','buồn ngủ']
 };
 const channelProfile=channel.profile;
 if(channelProfile!==undefined){
  if(!channelProfile||channelProfile.channel_id!==channel.channel_id||
     channelProfile.platform!==channel.platform||channelProfile.name!==name)
   throw Error('CHANNEL_PROFILE_ID_MISMATCH');
 }
 const bible={
  schema_version:'DD04_CHARACTER_BIBLE_V1',
  channel_id:channel.channel_id,channel_name:name,platform:channel.platform,
  character_version:channel_version,canonical_seed:seed,
  fictional:true,locale:'vi-VN',reference_source:'GENERATED_CONTRACT_ONLY',
  mother,baby,side_characters:[],
  cultural_rules:['Bối cảnh gia đình Việt gần gũi, không rập khuôn vùng miền',
   'Lời nói tự nhiên, tôn trọng cha mẹ và trẻ nhỏ',
   'Trò đùa dựa trên tình huống, không hạ thấp hay bắt nạt trẻ',
   'Không dùng khuôn mặt hay giọng của trẻ em và người thật'],
  identity_edit_policy:'LOCKED_UNTIL_SEPARATE_CHANNEL_VERSION_APPROVED'
 };
 const visual={
  schema_version:'DD04_VISUAL_STYLE_V1',channel_id:channel.channel_id,
  channel_version,style:'Hoạt hình 3D cách điệu mềm mại, không giống ảnh người thật',
  color_palette:palette,setting,lighting:'ánh sáng dịu, ấm, rõ nhân vật',
  composition:'9:16, chủ thể rõ, an toàn vùng đặt phụ đề',
  motion:'chuyển động mượt vừa phải, không giật hình',
  typography:'Phụ đề tiếng Việt rõ nét, dấu chuẩn',audio:'nhạc gốc hoặc có quyền sử dụng',
  identity_reference:'Bám Character Bible của kênh, không tự tạo người mẹ/bé mới mỗi video'
 };
 const rules={
  schema_version:'DD04_CONTINUITY_V1',channel_id:channel.channel_id,
  lock_fields:['character_id','face_shape','hair','eye_color','skin_tone','silhouette','outfit','voice','color_palette','style','setting'],
  may_change:['expression','gesture','camera_angle','story_prop_if_safe'],
  video_frame_rule:'A04 phải mang cùng channel_character_bible_sha256 và channel_visual_style_sha256 tới mọi cảnh',
  cross_video_rule:'Một kênh dùng cùng một bản bible + style được khóa, không tự thay trang phục/mặt/giọng qua video',
  profile_change_rule:'Tăng version và kiểm duyệt lại trước khi cập nhật tài sản nhận diện kênh',
  visual_check:'Chỉ đánh giá tính nhất quán hình ảnh sau khi có ảnh tham chiếu và frame thật; prompt không chứng minh chất lượng thực tế',
  safety:['Không giả danh người thật','Không nội dung trẻ em nguy hiểm',
   'Không hình ảnh phản cảm, tục tĩu, xuyên tạc hoặc công kích nhóm người',
   'Không sao chép nhận dạng nhân vật của tác phẩm được bảo hộ'],
  mandatory_reviews:['A08_VISUAL_CONTINUITY','A09_VIETNAMESE_CULTURAL_SAFETY']
 };
 if(reference_assets!==null){
  if(!Array.isArray(reference_assets)||reference_assets.length<2||
    reference_assets.some(r=>!r||!['MOTHER','BABY'].includes(r.character_role)||
      !DIGEST.test(r.bytes_sha256||'')||!requireText(r.storage_ref,'REFERENCE_LOCATION_REQUIRED',500))||
    new Set(reference_assets.map(r=>r.character_role)).size!==2)
    throw Error('CHANNEL_REFERENCE_ASSET_INVALID');
  bible.reference_assets=reference_assets.map(r=>({character_role:r.character_role,
    bytes_sha256:r.bytes_sha256,storage_ref:r.storage_ref}));
  bible.reference_source='UNVERIFIED_METADATA_NEEDS_STORAGE_BYTE_CHECK';
 }
 const character_bible_sha256=H(bible);
 const visual_style_sha256=H(visual);
 const continuity_rules_sha256=H(rules);
 return Object.freeze({
  schema_version:'DD04_CHANNEL_IDENTITY_LOCK_V1',channel_id:channel.channel_id,
  channel_version,character_bible:bible,visual_style:visual,continuity_rules:rules,
  character_bible_sha256,visual_style_sha256,continuity_rules_sha256,
  identity_bundle_sha256:H({channel_id:channel.channel_id,channel_version,
   character_bible_sha256,visual_style_sha256,continuity_rules_sha256}),
  reference_assets_verified:false,status:'DESIGN_LOCKED_NO_REAL_MEDIA_PROOF'
 });
}
export function assessContinuityPacket(packet,identity){
 if(!packet||!identity||packet.channel_id!==identity.channel_id)
  return {ok:false,reason:'CHANNEL_SCOPE_MISMATCH',publish_allowed:false};
 const expected=identity.identity_bundle_sha256;
 if(packet.channel_identity_sha256!==expected||
   packet.A04?.channel_character_bible_sha256!==identity.character_bible_sha256||
   packet.A04?.channel_visual_style_sha256!==identity.visual_style_sha256||
   !Array.isArray(packet.A04?.image_shots)||packet.A04.image_shots.length<1)
  return {ok:false,reason:'CHANNEL_IDENTITY_MISMATCH',publish_allowed:false};
 for(const frame of packet.A04.image_shots){
  if(frame.channel_identity_sha256!==expected||
     frame.channel_character_bible_sha256!==identity.character_bible_sha256||
     frame.channel_visual_style_sha256!==identity.visual_style_sha256)
   return {ok:false,reason:'SCENE_CHARACTER_CONTINUITY_MISMATCH',publish_allowed:false};
 }
 if(packet.A05?.video_shots?.length!==packet.A04.image_shots.length)
  return {ok:false,reason:'A04_A05_SCENE_COUNT_MISMATCH',publish_allowed:false};
 return {ok:true,reason:'IDENTITY_HASH_CONSISTENT_PROMPTS_ONLY',
  physical_media_review_passed:false,requires:['A08','A09','CEO_G2'],publish_allowed:false};
}
