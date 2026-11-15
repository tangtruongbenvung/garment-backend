import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {makeChannelIdentity} from '../dd04-agent-control/a00-025-channel-identity-lock.mjs';
import {prepareReferenceImage,storeAndVerifyReference,collectReferencePair,evaluateReferenceReview,checkTrustedReferenceReview} from '../dd04-agent-control/a00-026-reference-image-core.mjs';
const tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const identity=makeChannelIdentity({channel_id:'FB001',platform:'FANPAGE',name:'Mẹ bé FB001'});
// Unit fixture: only PNG container and 256x256 header, NOT proof of visual validity.
function crc(b){let c=0xffffffff;for(const v of b){c^=v;for(let j=0;j<8;j++)c=(c>>>1)^(c&1?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(type,data){const tag=Buffer.from(type);const sz=Buffer.alloc(4);sz.writeUInt32BE(data.length);const crcBuf=Buffer.alloc(4);crcBuf.writeUInt32BE(crc(Buffer.concat([tag,data])));return Buffer.concat([sz,tag,data,crcBuf]);}
function png(width=256,height=256){
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 const raw=Buffer.alloc(height*(1+width*3));
 const pixels=deflateSync(raw);
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),
  chunk('IDAT',pixels),chunk('IEND',Buffer.alloc(0))]);
}
const mother=png(),baby=png(257,256);
const make=(role,buffer)=>prepareReferenceImage({tenant_id:tenant,identity,role,bytes:buffer,mime:'image/png'});
function store(){
 const rows=new Map();return {
  putIfAbsent:async(key,bytes,mime)=>{
   if(rows.has(key))throw Error('IMMUTABLE_OVERWRITE_DENIED');
   rows.set(key,Buffer.from(bytes));
  },
  get:async(key)=>rows.get(key),
  overwriteForTamper:(key,value)=>rows.set(key,Buffer.from(value)),
  keys:()=>[...rows.keys()]
 };
}
test('A04 creates per-role immutable storage paths with verified byte hashes',async()=>{
 const storeAdapter=store(),m=make('MOTHER',mother),b=make('BABY',baby);
 assert.ok(m.storage_key.includes('/FB001/identity-v1/reference/mother/'));
 const saved=await storeAndVerifyReference({asset:m,bytes:mother,storage:storeAdapter});
 assert.equal(saved.storage_verified,true);
 assert.equal(saved.a08_visual_review,'PENDING');
 assert.equal(saved.publish_allowed,false);
 await assert.rejects(storeAndVerifyReference({asset:m,bytes:mother,storage:storeAdapter}),/IMMUTABLE_OVERWRITE_DENIED/);
 const second=await storeAndVerifyReference({asset:b,bytes:baby,storage:storeAdapter});
 const pair=collectReferencePair(identity,[second,saved]);
 assert.equal(pair.assets[0].role,'MOTHER');
 assert.equal(pair.assets[1].role,'BABY');
 assert.equal(pair.review_status,'A08_A09_PENDING');
 assert.equal(pair.visual_consistency_verified,false);
 assert.match(pair.manifest_sha256,/^[a-f0-9]{64}$/);
});
test('reject cross-channel data, forged byte hash, missing role and mimetype spoofing',async()=>{
 assert.throws(()=>prepareReferenceImage({tenant_id:tenant,identity,role:'MOTHER',bytes:mother,mime:'image/jpeg'}),/MIME_SIGNATURE/);
 assert.throws(()=>prepareReferenceImage({tenant_id:tenant,identity,role:'DOG',bytes:mother,mime:'image/png'}),/REFERENCE_SCOPE_INVALID/);
 const m=make('MOTHER',mother);
 await assert.rejects(storeAndVerifyReference({asset:m,bytes:baby,storage:store()}),/REFERENCE_BYTE_HASH_MISMATCH/);
 const other=makeChannelIdentity({channel_id:'FB002',platform:'FANPAGE',name:'Khác'});
 assert.throws(()=>collectReferencePair(other,[{...m,storage_verified:true},{...make('BABY',baby),storage_verified:true}]),/REFERENCE_PAIR_NOT_VERIFIED/);
 assert.throws(()=>collectReferencePair(identity,[{...m,storage_verified:true},{...m,storage_verified:true}]),/REFERENCE_PAIR_NOT_VERIFIED/);
});
test('A08 and A09 cannot PASS from file metadata alone or shared actor',async()=>{
 const db=store();
 const m=await storeAndVerifyReference({asset:make('MOTHER',mother),bytes:mother,storage:db});
 const b=await storeAndVerifyReference({asset:make('BABY',baby),bytes:baby,storage:db});
 const pair=collectReferencePair(identity,[m,b]);
 const first={role:'A08',verdict:'PASS',manifest_sha256:pair.manifest_sha256,
  actor_subject_id:'11111111-1111-4111-8111-111111111111',
  provenance:'INDEPENDENT_HUMAN_OR_AUTHENTICATED_AGENT_REVIEW',
  checked_image_sha256:pair.assets.map(a=>a.bytes_sha256)};
 const second={...first,role:'A09',actor_subject_id:'22222222-2222-4222-8222-222222222222'};
 assert.equal(evaluateReferenceReview(pair,{}).ok,false);
 assert.equal(evaluateReferenceReview(pair,{a08:first,a09:{...second,actor_subject_id:first.actor_subject_id}}).reason,'SAME_REVIEWER_FORBIDDEN');
 assert.equal(evaluateReferenceReview(pair,{a08:first,a09:{...second,manifest_sha256:'0'.repeat(64)}}).reason,'INDEPENDENT_IMAGE_QC_REQUIRED');
 const pass=evaluateReferenceReview(pair,{a08:first,a09:second});
 assert.equal(pass.ok,true);
 assert.equal(pass.ready_for_A05_scene_generation,false);
 assert.equal(pass.authenticated_review_verified,false);
 assert.equal(pass.publish_allowed,false);
 assert.equal(pass.ceo_G2,'NOT_APPROVED');
});
test('invalid dimensions, unsigned media and unsafe roles fail closed',()=>{
 assert.throws(()=>make('MOTHER',png(30,30)),/DIMENSIONS_OUT_OF_RANGE/);
 assert.throws(()=>make('MOTHER',Buffer.alloc(55)),/MIME_SIGNATURE/);
 const incorrect=prepareReferenceImage({tenant_id:tenant,identity,role:'BABY',
   bytes:baby,mime:'image/png',provider:'LOCAL_AUTHORIZED_UPLOAD'});
 assert.equal(incorrect.source,'LOCAL_AUTHORIZED_UPLOAD');
 assert.throws(()=>prepareReferenceImage({tenant_id:tenant,identity,role:'BABY',
   bytes:baby,mime:'image/png',provider:'PAID_API_PROVIDER'}),/PROVIDER_EXECUTION_NOT_AUTHORIZED/);
});

test('actual A05 scene staging requires server-verified immutable A08/A09 evidence, not spoofable review JSON',async()=>{
 const db=store();
 const m=await storeAndVerifyReference({asset:make('MOTHER',mother),bytes:mother,storage:db});
 const b=await storeAndVerifyReference({asset:make('BABY',baby),bytes:baby,storage:db});
 const pair=collectReferencePair(identity,[m,b]);
 const events={source:'AUTHENTICATED_IMMUTABLE_STAGING_DB',
  manifest_sha256:pair.manifest_sha256,
  media_bytes_verified:true,visual_inspection_confirmed:true,
  a08:{role:'A08',verdict:'PASS',manifest_sha256:pair.manifest_sha256,
   actor_subject_id:'11111111-1111-4111-8111-111111111111',
   provenance:'INDEPENDENT_HUMAN_OR_AUTHENTICATED_AGENT_REVIEW',
   checked_image_sha256:pair.assets.map(a=>a.bytes_sha256)},
  a09:{role:'A09',verdict:'PASS',manifest_sha256:pair.manifest_sha256,
   actor_subject_id:'22222222-2222-4222-8222-222222222222',
   provenance:'INDEPENDENT_HUMAN_OR_AUTHENTICATED_AGENT_REVIEW',
   checked_image_sha256:pair.assets.map(a=>a.bytes_sha256)}
 };
 assert.equal((await checkTrustedReferenceReview(pair,null)).ok,false);
 assert.equal((await checkTrustedReferenceReview(pair,{readImmutableQcEvents:async()=>({...events,media_bytes_verified:false})})).ok,false);
 const accepted=await checkTrustedReferenceReview(pair,{readImmutableQcEvents:async()=>events});
 assert.equal(accepted.ok,true);
 assert.equal(accepted.ready_for_A05_scene_generation,true);
 assert.equal(accepted.render_allowed,false);
 assert.equal(accepted.publish_allowed,false);
});
