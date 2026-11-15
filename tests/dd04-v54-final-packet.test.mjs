import test from 'node:test';
import assert from 'node:assert/strict';
import {makeFinalPacket,inspectQcEvidence,previewCeoDecisionBatch} from '../dd04-agent-control/v54-final-packet-core.mjs';
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64),d='d'.repeat(64);
const raw={source:'SERVER_ASSET_REGISTRY',tenant_id:'6bc73b49-a396-4c7d-b390-ab6339d547cd',
 command_id:'cmd_91c7ce5ec8760df9fa0f',content_id:'BIN-CONTENT-001',
 channel_id:'FB001',platform:'FANPAGE',revision:1,
 channel_profile_version:'V1',profile_sha256:a,script_sha256:b,video_sha256:c,
 caption_sha256:d,video_ref:'storage://video_final.mp4',
 caption_ref:'storage://caption.txt',script_ref:'storage://script.md',
 image_refs:['storage://image.png'],duration_seconds:30,
 schedule_at:'2026-11-18T09:00:00+07:00'};
test('final packet binds channel, revision, media, caption and schedule to immutable digest',()=>{
 const p=makeFinalPacket(raw);
 assert.equal(p.ok,true);assert.equal(p.ready_for_publication,false);
 assert.equal(p.packet_sha256.length,64);
 for(const changed of [{...raw,caption_sha256:b},{...raw,channel_id:'TT001',platform:'TIKTOK'},
  {...raw,revision:2},{...raw,schedule_at:'2026-11-18T10:00:00+07:00'},
  {...raw,profile_sha256:d},{...raw,video_sha256:b}]){
  assert.notEqual(makeFinalPacket(changed).packet_sha256,p.packet_sha256);
 }
});
test('packet preflight fails on browser provided or incomplete/unsafe media and ambiguous schedule',()=>{
 assert.equal(makeFinalPacket({...raw,source:'BROWSER'}).ok,false);
 assert.equal(makeFinalPacket({...raw,image_refs:[]}).ok,false);
 assert.equal(makeFinalPacket({...raw,duration_seconds:19}).ok,false);
 assert.equal(makeFinalPacket({...raw,schedule_at:'2026-11-18T09:00:00'}).ok,false);
 assert.equal(makeFinalPacket({...raw,caption_sha256:'wrong'}).ok,false);
});
test('A08 + A09 must independently PASS for identical final packet hash',()=>{
 const p=makeFinalPacket(raw);
 const a08={source:'SERVER_AGENT_AUDIT',agent_id:'A08',packet_sha256:p.packet_sha256,
  report_sha256:a,result:'PASS'};
 const a09={...a08,agent_id:'A09',report_sha256:b};
 assert.equal(inspectQcEvidence(p,[a08,a09]).ok,true);
 assert.equal(inspectQcEvidence(p,[a08,{...a09,result:'HOLD'}]).ok,false);
 assert.equal(inspectQcEvidence(p,[a08,{...a09,packet_sha256:b}]).ok,false);
 assert.equal(inspectQcEvidence(p,[a08,a08]).ok,false);
});
test('CEO batch preflight rejects duplicate content-channel-revisions, never publishes',()=>{
 const p=makeFinalPacket(raw);
 const p2=makeFinalPacket({...raw,channel_id:'TT001',platform:'TIKTOK'});
 const r=previewCeoDecisionBatch([p,p2]);
 assert.equal(r.ok,true);assert.equal(r.items.length,2);
 assert.equal(r.ready_for_publication,false);
 assert.equal(previewCeoDecisionBatch([p,p]).reason,'DUPLICATE_PACKET_IN_BATCH');
 assert.equal(previewCeoDecisionBatch([]).ok,false);
});
