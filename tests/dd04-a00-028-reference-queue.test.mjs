import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeA0028ReferenceQueue,checkA0028ReferenceGate} from '../dd04-agent-control/a00-028-reference-production-queue.mjs';
const source=JSON.parse(readFileSync(new URL('../dd04-agent-control/registries/dd04-20-channel-identity-registry-v1.json',import.meta.url),'utf8'));
test('A00-028 has 20 locked distinct pairs, 140 reference work orders with no false images',()=>{
 const q=makeA0028ReferenceQueue(source);
 assert.equal(q.channels.length,20);
 assert.equal(q.counts.reference_tasks,140);
 assert.equal(q.counts.rendered_images,0);
 assert.equal(q.counts.rendered_videos,0);
 assert.equal(q.counts.provider_calls,0);
 assert.equal(q.counts.published,0);
 assert.equal(new Set(q.channels.map(c=>c.identity_packet_sha256)).size,20);
 assert.equal(new Set(q.channels.flatMap(c=>c.tasks.map(x=>x.task_id))).size,140);
 assert.equal(q.channels.filter(x=>x.platform==='FANPAGE').length,10);
 assert.equal(q.channels.filter(x=>x.platform==='TIKTOK').length,10);
 assert.ok(q.channels.every(c=>c.tasks.length===7&&c.tasks.every(t=>
  t.status==='QUEUED_NOT_GENERATED'&&t.A08==='PENDING'&&t.A09==='PENDING'&&
  t.generated_image_bytes_sha256===null&&t.provider_execution_authorized===false)));
 assert.equal(q.constraints.ceo_g2_required,true);
 assert.equal(q.constraints.a07_publish,false);
});
test('Channel ID, character duplicates, missing references and fabricated QC fail closed',()=>{
 const q=makeA0028ReferenceQueue(source);
 assert.equal(checkA0028ReferenceGate({queue:q,channel_id:'FB001'}).reason,
  'SEVEN_IMMUTABLE_REFERENCE_IMAGES_REQUIRED');
 assert.equal(checkA0028ReferenceGate({queue:q,channel_id:'FB099'}).reason,
  'CHANNEL_NOT_IN_APPROVED_REGISTRY');
 const wrong=structuredClone(source);
 wrong.channels[1].mother_name=wrong.channels[0].mother_name;
 wrong.channels[1].baby_name=wrong.channels[0].baby_name;
 assert.throws(()=>makeA0028ReferenceQueue(wrong),/DUPLICATE_CHARACTER_PAIR/);
 const items=q.channels[0].tasks.map((x,i)=>({
  slot:x.slot,channel_id:'FB001',identity_packet_sha256:q.channels[0].identity_packet_sha256,
  bytes_sha256:String(i+1).repeat(64),storage_verified:true
 }));
 assert.equal(checkA0028ReferenceGate({queue:q,channel_id:'FB001',
  reference_records:items,independent_audits:{}}).reason,
  'INDEPENDENT_STAGING_QC_EVIDENCE_REQUIRED');
 const external={source:'AUTHENTICATED_STAGING_DB',channel_id:'FB001',
  identity_packet_sha256:q.channels[0].identity_packet_sha256,
  a08:{status:'PASS',actor_subject_id:'A'},a09:{status:'PASS',actor_subject_id:'B'}};
 const r=checkA0028ReferenceGate({queue:q,channel_id:'FB001',
  reference_records:items,independent_audits:external});
 assert.equal(r.ok,true);
 assert.equal(r.may_render_video,false);
 assert.equal(r.publish_allowed,false);
 const altered=structuredClone(items);
 altered[1].channel_id='TT001';
 assert.equal(checkA0028ReferenceGate({queue:q,channel_id:'FB001',
  reference_records:altered,independent_audits:external}).reason,
  'SEVEN_IMMUTABLE_REFERENCE_IMAGES_REQUIRED');
});
