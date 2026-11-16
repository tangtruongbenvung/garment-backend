// DD04-A00-031 | Vietnamese dialogue + character-motion production briefs.
// STAGING/DRAFT ONLY: does not call paid TTS, create a voice, animate pixels,
// clone persons, bypass A08/A09, authorize A11 spending or publish.
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const SCENES=[
 {id:'01',from:0,to:5,speaker:'MOTHER',
  line:'Ủa, bếp trưởng Bông hôm nay nấu món gì mà bí mật thế?',
  mood:'ngạc nhiên vui vẻ',motion:'Mẹ cúi nhẹ, nhìn bát rau củ đồ chơi; bé chỉ vào bát, hai nhân vật nhìn đúng hướng.'},
 {id:'02',from:5,to:10,speaker:'BABY',
  line:'Chuối ạ!',mood:'hồn nhiên, bật cười',motion:'Bé cầm muỗng gỗ đồ chơi, môi bé chuyển động vừa một câu ngắn, mắt sáng, cổ tay chuyển động nhẹ.'},
 {id:'03',from:10,to:15,speaker:'MOTHER',
  line:'À, thế còn cà chua này... cũng nấu với chuối luôn hả con?',
  mood:'trêu nhẹ, nhấn vào từ chuối',motion:'Mẹ nhướn mày, chỉ rau củ vải, ngừng một nhịp sau câu hỏi. Bé quay sang mẹ.'},
 {id:'04',from:15,to:20,speaker:'BABY',
  line:'Dạ... ngon!',mood:'tinh nghịch, có nhịp ngập ngừng',motion:'Bé cười, gật đầu một lần, hai tay đặt gần bát đồ chơi; không cầm vật nguy hiểm.'},
 {id:'05',from:20,to:25,speaker:'MOTHER',
  line:'Trời ơi, nhà mình có đầu bếp... sáng tạo nhất xóm rồi!',
  mood:'cười không chọc quê',motion:'Mẹ cười, đưa hai bàn tay ôm má; bé cười theo, khớp cử động mắt và biểu cảm.'},
 {id:'06',from:25,to:30,speaker:'MOTHER',
  line:'Thôi, mẹ đặt bàn. Bếp trưởng cho mẹ một phần nha!',
  mood:'ấm áp, kết thúc hài',motion:'Mẹ ôm bé thật nhẹ; cả hai cười, máy quay ở tầm mắt, nhân vật không biến dạng.'}
];
const DENY=(reason)=>Object.freeze({ok:false,reason,render_allowed:false,publish_allowed:false});
export function buildA0031VoiceMotionPack({channel_id,identity_sha256,reference_pair_sha256,video_id='FB002-BEP-BONG-PILOT-V1'}={}){
 if(channel_id!=='FB002'||!HEX.test(identity_sha256||'')||
   !HEX.test(reference_pair_sha256||'')||typeof video_id!=='string'||
   !/^[A-Za-z0-9_-]{5,80}$/.test(video_id))throw Error('LOCKED_CHANNEL_REFERENCE_REQUIRED');
 const voice_bible={
  mother:{speaker_id:'FB002_MOTHER',kind:'ADULT_FICTIONAL',
   description_vi:'Giọng nữ Việt ấm, tự nhiên, nhí nhảnh vừa phải; không bắt chước giọng người thật.',
   fixed_accent:'Vietnamese northern standard',target_speaking_rate:'natural',
   candidate_tts:{provider:'FPT_AI_TTS_V5',voice:'banmai',speed:0},
   speech_habits:['cười nhẹ khi bất ngờ','nhấn nhịp ở câu chốt','tránh kéo dài chữ giả tạo']},
  baby:{speaker_id:'FB002_BABY',kind:'FICTIONAL_TODDLER_19_MONTHS',
   description_vi:'Giọng bé hư cấu 19 tháng; câu một đến hai từ, phát âm đơn giản, không giả giọng trẻ có thật.',
   candidate_tts:{provider:'APPROVED_TODDLER_VOICE_REQUIRED',voice:null},
   speech_habits:['từ ngắn','bập bẹ vừa đủ','có tiếng cười nhẹ, không ép bé nói câu dài']}
 };
 const shots=SCENES.map(s=>({
  scene_id:video_id+'-S'+s.id,from:s.from,to:s.to,
  speaker:s.speaker,text_vi:s.line,delivery_vi:s.mood,
  motion_prompt_vi:s.motion+' Chuyển động thật vừa phải, một cú máy liên tục; khóa nhận diện mẹ và bé từ ảnh tham chiếu của FB002.',
  lip_sync:{active_character:s.speaker,other_character_mouth:'CLOSED_OR_NATURAL_LISTENING',
   alignment:'REQUIRED_FROM_REAL_AUDIO_TIMESTAMPS'},
  reference:{channel_id,identity_sha256,reference_pair_sha256},
  audio:{status:'NOT_SYNTHESIZED',bytes_sha256:null,duration_seconds:null,
   provider_job_id:null},
  video:{status:'NOT_ANIMATED',bytes_sha256:null,has_character_motion:false},
  A08:'PENDING',A09:'PENDING'
 }));
 const draft={schema_version:'DD04_A00_031_V1',status:'STAGING_VOICE_MOTION_DRAFT_NO_PROVIDER',
  channel_id,video_id,reference_pair_sha256,identity_sha256,
  duration_seconds:30,format:'9:16',voice_bible,shots,
  channel_voice_lock:'SAME_MOTHER_VOICE_ALL_VIDEOS; TODDLER_VOICE_NEEDS_PROVENANCE',
  output:{voice_rendered:false,motion_rendered:false,lip_sync_verified:false,
   video_ready_for_G2:false,published:false},
  gate:{require_real_reference_pair:true,require_separate_A08_A09:true,
   require_audio_sha256:true,require_video_sha256:true,
   paid_api_authorized:false,G2:'NOT_APPROVED',publish_allowed:false}};
 return Object.freeze({...draft,manifest_sha256:sha(draft)});
}
export function checkA0031ProductionResult(pack,production){
 if(!pack||!production||production.manifest_sha256!==pack.manifest_sha256)
  return DENY('SCRIPT_VERSION_MISMATCH');
 if(production.channel_id!==pack.channel_id||
  production.reference_pair_sha256!==pack.reference_pair_sha256||
  !Array.isArray(production.shots)||production.shots.length!==pack.shots.length)
  return DENY('CHARACTER_REFERENCE_OR_SHOTS_MISMATCH');
 for(let i=0;i<pack.shots.length;i++){
  const planned=pack.shots[i],actual=production.shots[i];
  if(actual.scene_id!==planned.scene_id||actual.speaker!==planned.speaker||
    !HEX.test(actual.audio_sha256||'')||!HEX.test(actual.video_sha256||'')||
    actual.lip_sync_checked!==true||actual.character_identity_checked!==true)
   return DENY('SHOT_AUDIO_VIDEO_OR_LIPSYNC_NOT_VERIFIED');
 }
 // A user-supplied result may claim PASS: this is structure-only. It NEVER
 // authorizes G2 or publication without server-authenticated QC event checks.
 return Object.freeze({ok:true,reason:'STRUCTURE_VALID_SERVER_QC_REQUIRED',
  render_allowed:false,requires:'IMMUTABLE_STAGING_A08_A09_AND_CEO_G2',
  publish_allowed:false});
}
