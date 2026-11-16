// DD04 A00-026 — real-byte frame ingestion and A05 handoff gating.
// Provider neutral. This is NOT a visual similarity model or final QC.
import {prepareReferenceImage,storeAndVerifyReference} from './a00-026-reference-image-core.mjs';
const HEX=/^[a-f0-9]{64}$/;
export async function acceptSceneImage({tenant_id,identity,packet,scene_id,bytes,mime,reference_pair,reference_review,storage}){
 if(!identity||!packet||packet.channel_id!==identity.channel_id||
  packet.channel_identity_sha256!==identity.identity_bundle_sha256||
  packet.A04?.channel_character_bible_sha256!==identity.character_bible_sha256||
  packet.A04?.channel_visual_style_sha256!==identity.visual_style_sha256)
  throw Error('SCENE_IDENTITY_MISMATCH');
 if(!reference_pair||reference_pair.channel_id!==identity.channel_id||
   reference_pair.channel_identity_sha256!==identity.identity_bundle_sha256||
   reference_review?.ok!==true||reference_review?.ready_for_A05_scene_generation!==true||
   reference_review?.publish_allowed!==false)
  throw Error('REFERENCE_VISUAL_QC_NOT_PASSED');
 if(!Array.isArray(packet.A04.image_shots)||!packet.A04.image_shots.some(x=>x.scene_id===scene_id)||
   !packet.A05?.video_shots?.some(x=>x.scene_id===scene_id))
  throw Error('SCENE_NOT_IN_APPROVED_STORYBOARD');
 if(typeof scene_id!=='string'||!/^[-A-Za-z0-9_]{2,200}$/.test(scene_id))
  throw Error('SCENE_ID_INVALID');
 // Temporary isolated storyboard frame storage uses same byte verification path,
 // but distinct role/key namespace and never mutates the Character Bible.
 const shot=packet.A04.image_shots.find(x=>x.scene_id===scene_id);
 if(shot.channel_identity_sha256!==identity.identity_bundle_sha256||
  shot.channel_character_bible_sha256!==identity.character_bible_sha256)
  throw Error('SCENE_STALE_IDENTITY');
 const asset=prepareReferenceImage({tenant_id,identity,role:'MOTHER',bytes,mime});
 const imageKey=asset.storage_key.replace('/reference/mother/','/storyboards/'+packet.script_id+'/'+scene_id+'/');
 if(!imageKey.includes('/storyboards/'))throw Error('STORYBOARD_PATH_INVALID');
 const sceneAsset={...asset,storage_key:imageKey,role:'STORYBOARD_FRAME',scene_id,
  script_id:packet.script_id,reference_pair_sha256:reference_pair.manifest_sha256,
  reference_a08_a09_reviewed:true,frame_a08_review:'PENDING',
  frame_a09_review:'PENDING',publish_allowed:false};
 return storeAndVerifyReference({asset:sceneAsset,bytes,storage});
}
export function evaluateA05Input({packet,reference_pair,reference_review,scene_images,frame_reviews}={}){
 if(!packet||!reference_pair||reference_review?.ok!==true||
   packet.channel_id!==reference_pair.channel_id||
   packet.channel_identity_sha256!==reference_pair.channel_identity_sha256||
   !Array.isArray(scene_images)||!Array.isArray(packet.A05?.video_shots)||
   scene_images.length!==packet.A05.video_shots.length||
   !Array.isArray(frame_reviews)||frame_reviews.length!==scene_images.length)
  return Object.freeze({ok:false,reason:'A05_REFERENCES_OR_FRAMES_MISSING',render_allowed:false,publish_allowed:false});
 const seen=new Set();
 for(const img of scene_images){
  if(!img.storage_verified||!HEX.test(img.bytes_sha256||'')||
     img.reference_pair_sha256!==reference_pair.manifest_sha256||
     img.channel_id!==packet.channel_id||
     img.channel_identity_sha256!==packet.channel_identity_sha256||
     !packet.A05.video_shots.some(x=>x.scene_id===img.scene_id)||seen.has(img.scene_id))
   return Object.freeze({ok:false,reason:'A05_FRAME_HASH_OR_SCOPE_MISMATCH',render_allowed:false,publish_allowed:false});
  seen.add(img.scene_id);
  const review=frame_reviews.find(r=>r.scene_id===img.scene_id);
  if(!review||review.a08!=='PASS'||review.a09!=='PASS'||
     review.frame_bytes_sha256!==img.bytes_sha256||
     review.reference_pair_sha256!==reference_pair.manifest_sha256)
    return Object.freeze({ok:false,reason:'A08_A09_FRAME_REVIEW_REQUIRED',render_allowed:false,publish_allowed:false});
 }
 return Object.freeze({ok:true,reason:'A05_INPUT_REFERENCE_AND_FRAME_GATE_PASSED',
  render_allowed:false,requires_provider_authorization:true,
  video_file_exists:false,publish_allowed:false});
}
