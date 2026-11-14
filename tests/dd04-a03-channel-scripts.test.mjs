import test from 'node:test';
import assert from 'node:assert/strict';
import {planScripts} from '../dd04-agent-control/a03-channel-script-planner.mjs';
const channels=n=>Array.from({length:n},(_,i)=>({channel_id:'dd04-demo-'+String(i+1).padStart(2,'0'),platform:i%2?'TIKTOK':'FANPAGE',name:'Kênh demo '+(i+1)}));
const plan=n=>({campaign_id:'DD04-TEST-20261114',channels:channels(n)});
test('1 channel creates precisely 1 fully scoped A03 script',()=>{
 const x=planScripts(plan(1));
 assert.equal(x.channel_count,1);assert.equal(x.script_count,1);
 assert.equal(x.scripts[0].channel_id,'dd04-demo-01');
 assert.equal(x.scripts[0].duration_seconds,30);
 assert.equal(x.scripts[0].status,'DRAFT_STAGING_NOT_EXECUTED');
 assert.equal(x.real_llm_execution,false);
 assert.equal(x.scripts[0].publishing_allowed,false);
});
test('5 channels yield exactly 5 different full scripts for distinct formats',()=>{
 const x=planScripts(plan(5));
 assert.equal(x.script_count,5);
 for(const field of [y=>y.script_id,y=>y.creative.title,y=>y.creative.approach,y=>y.fingerprint]){
  assert.equal(new Set(x.scripts.map(field)).size,5);
 }
 for(const s of x.scripts){
  assert.equal(s.scenes.length,4);assert.equal(s.scenes.at(-1).to,30);
  assert.ok(s.creative.hook&&s.creative.punchline&&s.creative.beats.length===3);
  assert.ok(s.reply_library.positive.length);
  assert.equal(s.review.G1,'NOT_APPROVED');assert.equal(s.review.G2,'NOT_APPROVED');
 }
 assert.equal(x.handoff.A07,'DENIED_G2_NOT_APPROVED');
});
test('20 pilot channels yield 20 distinct concepts not 20 copies',()=>{
 const x=planScripts(plan(20));
 assert.equal(x.script_count,20);
 assert.equal(new Set(x.scripts.map(s=>s.creative.title)).size,20);
 assert.equal(new Set(x.scripts.map(s=>s.creative.approach)).size,20);
 assert.equal(new Set(x.scripts.map(s=>s.creative.hook)).size,20);
 assert.equal(new Set(x.scripts.map(s=>s.creative.punchline)).size,20);
 assert.equal(x.audit.channel_count,20);assert.match(x.audit.content_sha256,/^[a-f0-9]{64}$/);
});
test('same plan deterministic, no accidental duplicates or extra scripts',()=>{
 assert.deepEqual(planScripts(plan(5)),planScripts(plan(5)));
 assert.throws(()=>planScripts(plan(21)),/CHANNEL_COUNT_1_TO_20/);
 assert.throws(()=>planScripts(plan(0)),/CHANNEL_COUNT_1_TO_20/);
 const dup=plan(5);dup.channels[1].channel_id=dup.channels[0].channel_id;
 assert.throws(()=>planScripts(dup),/CHANNEL_DUPLICATE/);
 const dupName=plan(2);dupName.channels[1].name='Kênh demo 1';
 assert.throws(()=>planScripts(dupName),/CHANNEL_DISPLAY_NAME_DUPLICATE/);
 const bad=plan(1);bad.channels[0].platform='YOUTUBE';
 assert.throws(()=>planScripts(bad),/PLATFORM_INVALID/);
});
test('no script is approved, posted or marked as actually executed',()=>{
 const x=planScripts(plan(5));
 assert.equal(x.status,'PRE_G1_DRAFT_NO_AGENT_EXECUTION');
 assert.equal(x.generator,'A03_STAGING_TEMPLATE_PREVIEW');
 assert.ok(x.scripts.every(s=>s.review.A08==='PENDING'&&s.review.A09==='PENDING'&&s.publishing_allowed===false));
});
