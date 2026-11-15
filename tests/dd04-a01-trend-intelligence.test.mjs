import test from 'node:test';
import assert from 'node:assert/strict';
import {buildA01ResearchPack,validateA01Handoff} from '../dd04-agent-control/a01-trend-intelligence.mjs';
import {createDemoChannelProfiles} from '../dd04-agent-control/channel-context-core.mjs';
const base=()=>({
 campaign_id:'CAMP_A01_01', research_id:'R_A01_01',
 research_question:'Ý tưởng hài mẹ bé hư cấu nào cần nghiên cứu?',research_window:'2026-11-01/2026-11-15',
 evidence:[{evidence_id:'EV01',source_platform:'PUBLIC_WEB',source_type:'PUBLIC_ARTICLE',
 source_url:'https://example.org/reference',observed_at:'2026-11-15T00:00:00Z',
 topic:'Sinh hoạt gia đình',summary:'Ví dụ kiểm thử, không phải số liệu thị trường.',verification:'UNVERIFIED'}],
 concepts:[{concept_id:'CO01',title:'Bé làm tổng đài',creative_angle:'Đảo vai với mẹ',
 mother_baby_situation:'Nhân vật hoạt hình bé nhận điện thoại đồ chơi.',duration_seconds:30,
 evidence_ids:['EV01'],risks:'Không sử dụng người thật.',review_notes:'A08/A09 cần thẩm định.'}],
 channel_matches:[]
});
test('A01 generates immutable review-only handoff',()=>{
 const pack=buildA01ResearchPack(base());
 assert.equal(pack.publishing_allowed,false);
 assert.equal(pack.real_time_collection,false);
 assert.equal(pack.approval.G1,'NOT_APPROVED');
 assert.equal(pack.evidence_quality.all_verified,false);
 assert.deepEqual(pack.handoff.to,['A00','A02','A03']);
 assert.equal(validateA01Handoff(pack,pack.content_sha256).valid,true);
});
test('A01 tampering invalidates hash',()=>{
 const pack=buildA01ResearchPack(base());
 pack.concepts[0].title='Nội dung bị thay đổi';
 assert.throws(()=>validateA01Handoff(pack,pack.content_sha256),/A01_HANDOFF_TAMPERED/);
});
test('A01 rejects fabricated negative metrics, missing sources and invalid duration',()=>{
 const x=base();x.evidence[0].metrics={views:-1};
 assert.throws(()=>buildA01ResearchPack(x),/METRICS_INVALID/);
 const y=base();y.evidence[0].source_url='unknown';
 assert.throws(()=>buildA01ResearchPack(y),/SOURCE_URL_REQUIRED/);
 const z=base();z.concepts[0].duration_seconds=70;
 assert.throws(()=>buildA01ResearchPack(z),/DURATION_20_TO_60/);
});
test('A01 requires linked evidence and avoids duplicates',()=>{
 const x=base();x.concepts[0].evidence_ids=['OTHER'];
 assert.throws(()=>buildA01ResearchPack(x),/CONCEPT_EVIDENCE_LINK_INVALID/);
 const y=base();y.evidence.push({...y.evidence[0]});
 assert.throws(()=>buildA01ResearchPack(y),/EVIDENCE_DUPLICATE/);
});
test('A01 will not trust editorial observations as measured metrics',()=>{
 const x=base();x.evidence[0].source_type='EDITORIAL_OBSERVATION';x.evidence[0].metrics={views:100};
 assert.throws(()=>buildA01ResearchPack(x),/EDITORIAL_METRICS_NOT_VERIFIED/);
});
