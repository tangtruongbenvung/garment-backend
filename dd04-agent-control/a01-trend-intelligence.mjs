// DD04 A01 Trend Intelligence V0.1 — deterministic staging design, no live feeds or publishing.
import {createHash} from 'node:crypto';
import {snapshotChannel} from './channel-context-core.mjs';
export const A01_VERSION='0.1.0-STAGING-REVIEW_ONLY';
const ID=/^[A-Za-z0-9_-]{2,64}$/;
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=code=>{throw new Error(code);};
const nonempty=(s,max=500)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ordered=(a,b)=>a.localeCompare(b,'vi');
function checkEvidence(e){
 if(!e||typeof e!=='object'||Array.isArray(e))fail('EVIDENCE_INVALID');
 if(!ID.test(e.evidence_id||''))fail('EVIDENCE_ID_INVALID');
 if(!['TIKTOK','FANPAGE','PUBLIC_WEB','MANUAL_RESEARCH'].includes(e.source_platform))fail('SOURCE_PLATFORM_INVALID');
 if(!['FIRST_PARTY_ANALYTICS','PUBLIC_POST','PUBLIC_ARTICLE','EDITORIAL_OBSERVATION'].includes(e.source_type))fail('SOURCE_TYPE_INVALID');
 if(!nonempty(e.source_url,2048)||!/^https:\/\//i.test(e.source_url))fail('SOURCE_URL_REQUIRED');
 if(!nonempty(e.observed_at,40)||!Number.isFinite(Date.parse(e.observed_at)))fail('OBSERVED_AT_INVALID');
 if(!nonempty(e.summary,2000)||!nonempty(e.topic,200))fail('EVIDENCE_TEXT_REQUIRED');
 if(e.metrics!==undefined){
  if(!e.metrics||typeof e.metrics!=='object'||Array.isArray(e.metrics))fail('METRICS_INVALID');
  for(const [k,v] of Object.entries(e.metrics)){
   if(!['views','likes','comments','shares','saves'].includes(k)||!Number.isSafeInteger(v)||v<0)fail('METRICS_INVALID');
  }
 }
 if(e.source_type==='EDITORIAL_OBSERVATION'&&e.metrics!==undefined)fail('EDITORIAL_METRICS_NOT_VERIFIED');
 return {evidence_id:e.evidence_id,source_platform:e.source_platform,source_type:e.source_type,
 source_url:e.source_url,observed_at:new Date(e.observed_at).toISOString(),topic:e.topic.trim(),summary:e.summary.trim(),
 metrics:e.metrics?Object.fromEntries(Object.entries(e.metrics).sort(([a],[b])=>ordered(a,b))):null,
 verification:e.verification==='VERIFIED'?'VERIFIED':'UNVERIFIED'};
}
function checkConcept(c, evidence){
 if(!c||typeof c!=='object'||Array.isArray(c))fail('CONCEPT_INVALID');
 if(!ID.test(c.concept_id||''))fail('CONCEPT_ID_INVALID');
 if(!nonempty(c.title,140)||!nonempty(c.creative_angle,500)||!nonempty(c.mother_baby_situation,1000))fail('CONCEPT_TEXT_REQUIRED');
 if(!Array.isArray(c.evidence_ids)||c.evidence_ids.length<1||new Set(c.evidence_ids).size!==c.evidence_ids.length||c.evidence_ids.some(id=>!evidence.has(id)))fail('CONCEPT_EVIDENCE_LINK_INVALID');
 if(!Number.isInteger(c.duration_seconds)||c.duration_seconds<20||c.duration_seconds>60)fail('DURATION_20_TO_60');
 if(!nonempty(c.risks,1000)||!nonempty(c.review_notes,1000))fail('REVIEW_NOTES_REQUIRED');
 return {concept_id:c.concept_id,title:c.title.trim(),creative_angle:c.creative_angle.trim(),
 mother_baby_situation:c.mother_baby_situation.trim(),duration_seconds:c.duration_seconds,
 evidence_ids:[...c.evidence_ids].sort(ordered),risks:c.risks.trim(),review_notes:c.review_notes.trim(),
 status:'EDITORIAL_PROPOSAL_UNAPPROVED'};
}
function checkTarget(t,conceptIds){
 if(!t||typeof t!=='object'||Array.isArray(t))fail('CHANNEL_MATCH_INVALID');
 if(!t.profile||typeof t.profile!=='object')fail('CHANNEL_PROFILE_REQUIRED');
 const profile=snapshotChannel(t.profile);
 if(!Array.isArray(t.concept_ids)||t.concept_ids.length<1||new Set(t.concept_ids).size!==t.concept_ids.length||t.concept_ids.some(x=>!conceptIds.has(x)))fail('CHANNEL_CONCEPT_LINK_INVALID');
 if(!nonempty(t.fit_reason,1200)||!nonempty(t.differentiation,1200))fail('CHANNEL_FIT_NOT_ASSESSED');
 return {channel_id:profile.channel_id,platform:profile.platform,profile_version:profile.version,
  profile_sha256:profile.profile_sha256,concept_ids:[...t.concept_ids].sort(ordered),
  fit_reason:t.fit_reason.trim(),differentiation:t.differentiation.trim(),
  decision_owner:'A02',status:'PROPOSED_A02_REVIEW'};
}
export function buildA01ResearchPack(input){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('INPUT_REQUIRED');
 if(!ID.test(input.campaign_id||'')||!ID.test(input.research_id||''))fail('RESEARCH_ID_INVALID');
 if(!nonempty(input.research_question,1000)||!nonempty(input.research_window,100))fail('RESEARCH_SCOPE_REQUIRED');
 if(!Array.isArray(input.evidence)||!input.evidence.length||input.evidence.length>200)fail('EVIDENCE_1_TO_200');
 if(!Array.isArray(input.concepts)||!input.concepts.length||input.concepts.length>100)fail('CONCEPTS_1_TO_100');
 const evidence=input.evidence.map(checkEvidence).sort((a,b)=>ordered(a.evidence_id,b.evidence_id));
 const evidenceIds=new Set(evidence.map(x=>x.evidence_id));
 if(evidenceIds.size!==evidence.length)fail('EVIDENCE_DUPLICATE');
 const concepts=input.concepts.map(c=>checkConcept(c,evidenceIds)).sort((a,b)=>ordered(a.concept_id,b.concept_id));
 const conceptIds=new Set(concepts.map(x=>x.concept_id));
 if(conceptIds.size!==concepts.length)fail('CONCEPT_DUPLICATE');
 const targets=(input.channel_matches||[]).map(t=>checkTarget(t,conceptIds)).sort((a,b)=>ordered(a.channel_id,b.channel_id));
 if(new Set(targets.map(x=>x.channel_id)).size!==targets.length)fail('CHANNEL_MATCH_DUPLICATE');
 // Unverified/unsourced evidence must never be misrepresented as a measured trend.
 const allVerified=evidence.every(x=>x.verification==='VERIFIED');
 const measured=evidence.some(x=>x.metrics!==null&&x.verification==='VERIFIED');
 const data={schema_version:'5.3',agent:'A01',module_version:A01_VERSION,
  campaign_id:input.campaign_id,research_id:input.research_id,research_question:input.research_question.trim(),
  research_window:input.research_window.trim(),evidence,concepts,channel_matches:targets,
  evidence_quality:{all_verified:allVerified,has_verified_metrics:measured,
  unverified_count:evidence.filter(x=>x.verification!=='VERIFIED').length,
  disclaimer:'Nguồn do người lập hồ sơ cung cấp; A01 chưa tự truy xuất/xác minh mạng xã hội.'},
  approval:{G1:'NOT_APPROVED',G2:'NOT_APPROVED'},status:'DRAFT_STAGING_AWAIT_A00_A02',
  publishing_allowed:false,real_time_collection:false,real_llm_execution:false};
 const content_sha256=sha(data);
 return {...data,revision:1,content_sha256,
  handoff:{from:'A01',to:['A00','A02','A03'],type:'TREND_OPPORTUNITY_REVIEW',
  campaign_id:input.campaign_id,research_id:input.research_id,content_sha256,
  gates:'G1_REQUIRED_BEFORE_EXECUTION',instructions:'A02 xác minh độ phù hợp từng profile; A00 trình G1; A03 chỉ soạn nháp trước G1.'}};
}
export function validateA01Handoff(pack,expectedHash){
 if(!pack||!nonempty(expectedHash,64)||pack.content_sha256!==expectedHash)fail('A01_HASH_MISMATCH');
 const {revision,content_sha256,handoff,...data}=pack;
 if(revision!==1||sha(data)!==expectedHash||!same(handoff?.to,['A00','A02','A03']))fail('A01_HANDOFF_TAMPERED');
 if(data.publishing_allowed!==false||data.approval?.G1!=='NOT_APPROVED'||data.approval?.G2!=='NOT_APPROVED')fail('A01_GATE_VIOLATION');
 return {valid:true,content_sha256};
}
