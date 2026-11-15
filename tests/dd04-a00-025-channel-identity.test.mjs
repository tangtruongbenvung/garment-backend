import test from 'node:test';
import assert from 'node:assert/strict';
import {makeChannelIdentity,assessContinuityPacket} from '../dd04-agent-control/a00-025-channel-identity-lock.mjs';
import {buildContentFactoryDraft} from '../dd04-agent-control/a00-024-content-factory-draft.mjs';
const plan=(campaign,channel='FB001')=>({campaign_id:campaign,channels:[
 {channel_id:channel,platform:'FANPAGE',name:'Mẹ bé Việt '+channel}
]});
test('same channel keeps exact character and visual hash across videos/campaigns',()=>{
 const a=buildContentFactoryDraft(plan('DEMO-ONE')).packets[0];
 const b=buildContentFactoryDraft(plan('DEMO-TWO')).packets[0];
 assert.notEqual(a.script_id,b.script_id);
 assert.equal(a.channel_identity_sha256,b.channel_identity_sha256);
 assert.equal(a.A04.channel_character_bible_sha256,b.A04.channel_character_bible_sha256);
 assert.equal(a.A04.channel_visual_style_sha256,b.A04.channel_visual_style_sha256);
 assert.deepEqual(a.A04.character_bible,b.A04.character_bible);
 assert.deepEqual(a.A04.visual_style,b.A04.visual_style);
 assert.equal(a.quality.A08.identity_preflight.ok,true);
 assert.equal(a.quality.A08.identity_preflight.physical_media_review_passed,false);
});
test('different channel identities and character IDs never accidentally collide',()=>{
 const a=buildContentFactoryDraft(plan('DEMO-ONE','FB001')).packets[0];
 const b=buildContentFactoryDraft(plan('DEMO-ONE','FB002')).packets[0];
 assert.notEqual(a.channel_identity_sha256,b.channel_identity_sha256);
 assert.notEqual(a.A04.character_bible.mother.character_id,b.A04.character_bible.mother.character_id);
 assert.notEqual(a.A04.character_bible.baby.character_id,b.A04.character_bible.baby.character_id);
 assert.ok(a.A04.image_shots.every(x=>x.reference_character_ids.includes('FB001_MOM')));
});
test('every frame has exact channel character/style hash; tampering denied',()=>{
 const p=buildContentFactoryDraft(plan('DEMO-ONE')).packets[0];
 const identity=makeChannelIdentity({channel_id:'FB001',platform:'FANPAGE',name:'Mẹ bé Việt FB001'});
 assert.equal(assessContinuityPacket(p,identity).ok,true);
 const altered=structuredClone(p);
 altered.A04.image_shots[2].channel_character_bible_sha256='0'.repeat(64);
 assert.equal(assessContinuityPacket(altered,identity).reason,'SCENE_CHARACTER_CONTINUITY_MISMATCH');
 const crossed=makeChannelIdentity({channel_id:'FB002',platform:'FANPAGE',name:'Mẹ bé Việt FB002'});
 assert.equal(assessContinuityPacket(p,crossed).reason,'CHANNEL_SCOPE_MISMATCH');
});
test('change in profile version needs new hash and visual review, not silent overwrite',()=>{
 const c={channel_id:'FB001',platform:'FANPAGE',name:'Mẹ bé Việt FB001'};
 const v1=makeChannelIdentity(c,{channel_version:1});
 const v2=makeChannelIdentity(c,{channel_version:2});
 assert.notEqual(v1.identity_bundle_sha256,v2.identity_bundle_sha256);
 assert.equal(v1.character_bible.identity_edit_policy,'LOCKED_UNTIL_SEPARATE_CHANNEL_VERSION_APPROVED');
 assert.equal(v1.reference_assets_verified,false);
 assert.equal(v2.reference_assets_verified,false);
 assert.throws(()=>makeChannelIdentity(c,{reference_assets:[{character_role:'MOTHER',bytes_sha256:'x',storage_ref:'file'}]}),/CHANNEL_REFERENCE_ASSET_INVALID/);
});
test('20 channels maintain separate identity locks and still contain no real media',()=>{
 const channels=Array.from({length:20},(_,i)=>({channel_id:'CH'+String(i+1).padStart(2,'0'),
 platform:i<10?'FANPAGE':'TIKTOK',name:'Hoạt hình Việt số '+i}));
 const x=buildContentFactoryDraft({campaign_id:'TEST-TWENTY',channels});
 assert.equal(new Set(x.packets.map(p=>p.channel_identity_sha256)).size,20);
 assert.equal(x.counts.videos_rendered,0);
 for(const p of x.packets){
  assert.equal(p.A04.reference_images_verified,false);
  assert.equal(p.quality.A08.visual_media_passed,false);
  assert.equal(p.quality.A09.status,'PENDING');
  assert.equal(p.approval.ceo_G2,'NOT_APPROVED');
  assert.equal(p.runtime.paid_api_calls,0);
  assert.equal(p.runtime.publish_allowed,false);
  assert.ok(p.A04.image_shots.every(s=>s.channel_identity_sha256===p.channel_identity_sha256));
 }
});

test('channel strategy profile update is hash-addressed; stale identity cannot silently pass',()=>{
 const c={channel_id:'FB001',platform:'FANPAGE',name:'Mẹ bé Việt FB001'};
 const a=makeChannelIdentity(c,{profile_sha256:'a'.repeat(64)});
 const b=makeChannelIdentity(c,{profile_sha256:'b'.repeat(64)});
 assert.notEqual(a.character_bible_sha256,b.character_bible_sha256);
 assert.notEqual(a.identity_bundle_sha256,b.identity_bundle_sha256);
 const draft=buildContentFactoryDraft(plan('DEMO-ONE')).packets[0];
 assert.equal(assessContinuityPacket(draft,a).reason,'CHANNEL_IDENTITY_MISMATCH');
 assert.throws(()=>makeChannelIdentity(c,{profile_sha256:'bad'}),/CHANNEL_PROFILE_HASH_INVALID/);
});
