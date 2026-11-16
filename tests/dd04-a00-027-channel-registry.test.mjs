import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const r=JSON.parse(readFileSync(new URL('../dd04-agent-control/registries/dd04-20-channel-identity-registry-v1.json',import.meta.url),'utf8'));
test('pilot registry has exactly 10 Fanpages and 10 TikTok identities, each with distinct fictional mother/baby',()=>{
 assert.equal(r.channels.length,20);
 assert.equal(r.channels.filter(x=>x.platform==='FANPAGE').length,10);
 assert.equal(r.channels.filter(x=>x.platform==='TIKTOK').length,10);
 for(const k of ['channel_id','name','mother_name','baby_name']){
  assert.equal(new Set(r.channels.map(x=>x[k])).size,20,k);
 }
 assert.ok(r.channels.every(x=>x.baby_age_months>=0&&x.baby_age_months<=36));
 assert.ok(r.channels.every(x=>x.identity_version===1&&x.reference_assets_status==='PENDING_SEPARATE_IMAGES_A08_A09_QC'));
});
test('the single approved image is STYLE ONLY not character reference and seeding/sales lock is explicit',()=>{
 assert.match(r.approved_common_style_sha256,/^[a-f0-9]{64}$/);
 assert.equal(r.image_usage,'COMMON_STYLE_ONLY_NOT_SHARED_FACES');
 assert.deepEqual(r.phases,['MOI','CHUYEN_TIEP','BAN_HANG']);
 assert.equal(r.governance.character_identity_locked_across_phases,true);
 assert.equal(r.governance.channel_specific_reference_required,true);
 assert.equal(r.governance.all_generated_assets_require_a08_a09,true);
 assert.equal(r.governance.ceo_g2_mandatory_for_publish,true);
 assert.equal(r.governance.no_paid_api_authorized,true);
});
