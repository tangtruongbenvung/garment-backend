import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildContentFactoryDraft} from '../dd04-agent-control/a00-024-content-factory-draft.mjs';
const plan=n=>({campaign_id:'DD04-CONTENT-TEST',channels:Array.from({length:n},(_,i)=>({
 channel_id:'pilot-'+String(i+1).padStart(2,'0'),
 platform:i<10?'FANPAGE':'TIKTOK',name:'Kênh thử '+(i+1)}))});
test('A00-024 creates 20 distinct zero-cost A03/A04/A05 packs for 10+10 channels',()=>{
 const x=buildContentFactoryDraft(plan(20));
 assert.equal(x.channel_count,20);
 assert.equal(x.counts.a03_scripts,20);
 assert.equal(x.counts.a04_image_shot_prompts,80);
 assert.equal(x.counts.a05_video_shot_plans,80);
 assert.equal(x.counts.videos_rendered,0);
 assert.equal(x.counts.paid_api_calls,0);
 assert.equal(x.counts.published,0);
 assert.deepEqual(x.packets.map(p=>p.platform).reduce((a,p)=>(a[p]=(a[p]||0)+1,a),{}),
  {FANPAGE:10,TIKTOK:10});
 assert.equal(new Set(x.packets.map(p=>p.package_sha256)).size,20);
 assert.match(x.manifest_sha256,/^[a-f0-9]{64}$/);
});
test('each pack has Vietnamese fictional mother/baby continuity, stage prompts, voice and reply library',()=>{
 const x=buildContentFactoryDraft(plan(2));
 for(const p of x.packets){
  assert.equal(p.direction,'Video giải trí hài mẹ/bé hoạt hình hư cấu Việt Nam 0–36 tháng');
  assert.ok(p.duration_seconds>=20&&p.duration_seconds<=60);
  assert.equal(p.format,'1080x1920');
  assert.equal(p.A04.character_bible.fictional,true);
  assert.equal(p.A04.image_shots.length,p.A05.video_shots.length);
  assert.ok(p.A04.image_shots.every(s=>s.image_status==='PROMPT_ONLY_NO_IMAGE_GENERATED'));
  assert.ok(p.A05.video_shots.every(s=>s.status==='VIDEO_SHOT_PLAN_NO_RENDER'));
  assert.ok(p.A03.reply_library_json.positive.length>0);
  assert.equal(p.quality.A08.status,'PENDING');
  assert.equal(p.quality.A09.status,'PENDING');
  assert.equal(p.approval.ceo_G2,'NOT_APPROVED');
  assert.equal(p.runtime.channel_finance_approval_required,false);
  assert.equal(p.runtime.external_spend_authorized,false);
  assert.equal(p.runtime.publish_allowed,false);
  assert.equal(p.runtime.agent_execution,false);
  assert.equal(p.A05.render_complete,false);
 }
});
test('staging zero-cost content packs are deterministic and cannot bypass publication controls',()=>{
 assert.deepEqual(buildContentFactoryDraft(plan(3)),buildContentFactoryDraft(plan(3)));
 const result=buildContentFactoryDraft(plan(3));
 assert.equal(result.controls.finance_approvals_for_channel_building,false);
 assert.equal(result.controls.permission_to_publish,false);
 assert.equal(result.controls.permission_to_render_paid,false);
 assert.equal(result.controls.canonical_g1_not_bypassed,true);
 assert.equal(result.handoff.at(-1).to,'CEO_G2');
 assert.throws(()=>buildContentFactoryDraft(plan(21)),/CHANNEL_COUNT_1_TO_20/);
});
test('Netlify A00 endpoint has authenticated stage preview route without paid provider',()=>{
 const source=readFileSync(new URL('../netlify/functions/dd04-a00.mjs',import.meta.url),'utf8');
 assert.ok(source.includes("pathname.endsWith('/content-factory-preview')"));
 assert.ok(source.includes("buildContentFactoryDraft(JSON.parse(raw))"));
 assert.ok(source.includes("'/api/dd04-a00/content-factory-preview'"));
 const authCheck=source.indexOf("if(!equal(bearer,secret))return reply({error:'UNAUTHORIZED'},401)");
 const preview=source.indexOf("pathname.endsWith('/content-factory-preview')");
 assert.ok(authCheck>0&&preview>authCheck);
});
test('Preview UI has export and never calls an A11 approval endpoint',()=>{
 const js=readFileSync(new URL('../dd04-agent-control/a03-preview.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../dd04-agent-control/a03-preview.html',import.meta.url),'utf8');
 assert.ok(js.includes('/api/dd04-a00/content-factory-preview'));
 assert.ok(js.includes('downloadVideoPack'));
 assert.ok(html.includes('id="downloadVideoPlan"'));
 assert.ok(html.includes('id="videoResults"'));
 assert.ok(!js.includes('a11'));
 assert.ok(!html.includes('activateA11V1Btn'));
});
