import test from 'node:test';
import assert from 'node:assert/strict';
import {buildA0031VoiceMotionPack,checkA0031ProductionResult} from '../dd04-agent-control/a00-031-voice-motion-pack.mjs';
const x='a'.repeat(64),y='b'.repeat(64);
const make=()=>buildA0031VoiceMotionPack({channel_id:'FB002',identity_sha256:x,reference_pair_sha256:y});
test('A05 FB002 pilot uses same identity, controlled accents and age-appropriate Vietnamese dialogue',()=>{
 const pack=make();
 assert.equal(pack.shots.length,6);
 assert.equal(pack.duration_seconds,30);
 assert.equal(pack.voice_bible.mother.candidate_tts.voice,'banmai');
 assert.equal(pack.voice_bible.baby.kind,'FICTIONAL_TODDLER_19_MONTHS');
 assert.equal(pack.shots.reduce((sum,s)=>sum+s.to-s.from,0),30);
 assert.ok(pack.shots.every(s=>s.reference.identity_sha256===x&&s.reference.reference_pair_sha256===y));
 assert.ok(pack.shots.filter(s=>s.speaker==='BABY').every(s=>s.text_vi.split(/\s+/).length<=3));
 assert.ok(pack.shots.every(s=>s.lip_sync.active_character===s.speaker));
 assert.equal(pack.gate.G2,'NOT_APPROVED');
 assert.equal(pack.output.voice_rendered,false);
 assert.equal(pack.output.motion_rendered,false);
 assert.equal(pack.gate.paid_api_authorized,false);
 assert.equal(pack.gate.publish_allowed,false);
});
test('A00-031 refuses channel swaps or tampered reference hash',()=>{
 assert.throws(()=>buildA0031VoiceMotionPack({channel_id:'TT002',identity_sha256:x,reference_pair_sha256:y}),/LOCKED_CHANNEL_REFERENCE_REQUIRED/);
 assert.throws(()=>buildA0031VoiceMotionPack({channel_id:'FB002',identity_sha256:'bad',reference_pair_sha256:y}),/LOCKED_CHANNEL_REFERENCE_REQUIRED/);
 const pack=make();
 const fake={manifest_sha256:pack.manifest_sha256,channel_id:'FB002',
  reference_pair_sha256:y,shots:pack.shots.map(s=>({scene_id:s.scene_id,speaker:s.speaker,
   audio_sha256:x,video_sha256:y,lip_sync_checked:true,character_identity_checked:true}))};
 assert.equal(checkA0031ProductionResult(pack,fake).reason,'STRUCTURE_VALID_SERVER_QC_REQUIRED');
 assert.equal(checkA0031ProductionResult(pack,fake).publish_allowed,false);
 fake.shots[2].speaker='BABY';
 assert.equal(checkA0031ProductionResult(pack,fake).reason,'SHOT_AUDIO_VIDEO_OR_LIPSYNC_NOT_VERIFIED');
 fake.shots[2].speaker='MOTHER';fake.reference_pair_sha256='c'.repeat(64);
 assert.equal(checkA0031ProductionResult(pack,fake).reason,'CHARACTER_REFERENCE_OR_SHOTS_MISMATCH');
});
