// DD04 A00-026 | STAGING ONLY | Reference image bytes and scoped immutable manifest.
// No paid provider calls, no public buckets, no publishing, no visual-QC claim.
// A04 may propose assets; A08/A09 must independently inspect REAL images.
import {createHash} from 'node:crypto';
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9_-]{2,64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowed=new Set(['MOTHER','BABY']);
const mimeOf=(bytes)=>{
 if(bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return 'image/png';
 if(bytes.length>=12&&bytes.subarray(0,3).equals(Buffer.from('ffd8ff','hex')))return 'image/jpeg';
 if(bytes.length>=16&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'image/webp';
 return null;
};
function pngHeader(b){if(b.length<45||b.toString('ascii',12,16)!=='IHDR'||b.readUInt32BE(8)!==13||
 b.readUInt8(24)!==8||!([2,6].includes(b.readUInt8(25)))||
 b.readUInt8(26)!==0||b.readUInt8(27)!==0||b.readUInt8(28)!==0||
 b.toString('ascii',b.length-8,b.length-4)!=='IEND')throw Error('PNG_ENCODING_INVALID');
 return [b.readUInt32BE(16),b.readUInt32BE(20)];
}
function jpegHeader(b){
 let p=2;
 while(p<b.length-4){
  if(b[p]!==255){p++;continue;}
  while(b[p]===255)p++;
  const m=b[p++];
  if(m===0xd9||m===0xda)break;
  if(m===0x01||m>=0xd0&&m<=0xd7)continue;
  if(p+2>b.length)break;const len=b.readUInt16BE(p);
  if(len<2||p+len>b.length)break;
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb].includes(m)){
   if(len<7)break;return [b.readUInt16BE(p+5),b.readUInt16BE(p+3)];
  }
  p+=len;
 }
 throw Error('JPEG_DIMENSIONS_INVALID');
}
function webpHeader(b){
 const subtype=b.toString('ascii',12,16);
 if(subtype==='VP8X'&&b.length>=30)return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)];
 if(subtype==='VP8L'&&b.length>=25){
  const w=1+(((b[22]&0x3f)<<8)|b[21]);
  const h=1+(((b[24]&0x0f)<<10)|(b[23]<<2)|((b[22]>>6)&3));
  return [w,h];
 }
 throw Error('WEBP_DIMENSIONS_UNSUPPORTED');
}
function validateBytes(binary,declaredMime){
 const bytes=Buffer.isBuffer(binary)?binary:binary instanceof Uint8Array?Buffer.from(binary):null;
 if(!bytes||bytes.byteLength<45||bytes.byteLength>12*1024*1024)throw Error('REFERENCE_BYTES_REQUIRED_OR_TOO_LARGE');
 const mime=mimeOf(bytes);
 if(!mime||mime!==declaredMime)throw Error('REFERENCE_MIME_SIGNATURE_MISMATCH');
 const [width,height]=mime==='image/png'?pngHeader(bytes):mime==='image/jpeg'?jpegHeader(bytes):webpHeader(bytes);
 if(width<256||height<256||width>8192||height>8192||
  width/height<0.45||width/height>2.2)throw Error('REFERENCE_DIMENSIONS_OUT_OF_RANGE');
 return {bytes,mime,width,height,bytes_sha256:sha(bytes),byte_length:bytes.length};
}
function assetPath(tenant,identity,role,hex){
 if(!ID.test(identity.channel_id)||!Number.isSafeInteger(identity.channel_version)||
  identity.channel_version<1||!HEX.test(identity.identity_bundle_sha256||''))
  throw Error('CHANNEL_REFERENCE_IDENTITY_INVALID');
 return `dd04-staging/${tenant}/channels/${identity.channel_id}/identity-v${identity.channel_version}/reference/${role.toLowerCase()}/${hex}`;
}
export function prepareReferenceImage({tenant_id,identity,role,bytes,mime,provider='LOCAL_AUTHORIZED_UPLOAD'}){
 if(!UUID.test(tenant_id||'')||!identity||!allowed.has(role))throw Error('REFERENCE_SCOPE_INVALID');
 if(provider!=='LOCAL_AUTHORIZED_UPLOAD')throw Error('PROVIDER_EXECUTION_NOT_AUTHORIZED');
 const image=validateBytes(bytes,mime);
 const storage_key=assetPath(tenant_id,identity,role,image.bytes_sha256);
 return Object.freeze({schema_version:'DD04_A00_026_REFERENCE_V1',
  tenant_id,channel_id:identity.channel_id,channel_version:identity.channel_version,
  channel_identity_sha256:identity.identity_bundle_sha256,
  character_bible_sha256:identity.character_bible_sha256,
  character_id:identity.character_bible[role==='MOTHER'?'mother':'baby'].character_id,
  role,storage_key,mime:image.mime,width:image.width,height:image.height,
  bytes_sha256:image.bytes_sha256,byte_length:image.byte_length,
  source:provider,storage_verified:false,a08_visual_review:'PENDING',
  a09_cultural_review:'PENDING',publish_allowed:false});
}
// Storage adapter must be PRIVATE, non-overwriting, tenant-scoped and server-side.
// Its put/get implementations must not trust user-provided paths.
export async function storeAndVerifyReference({asset,bytes,storage}){
 if(!asset||!storage||typeof storage.putIfAbsent!=='function'||typeof storage.get!=='function')
  throw Error('PRIVATE_STORAGE_ADAPTER_REQUIRED');
 const check=validateBytes(bytes,asset.mime);
 if(check.bytes_sha256!==asset.bytes_sha256||check.byte_length!==asset.byte_length||
   check.width!==asset.width||check.height!==asset.height)
  throw Error('REFERENCE_BYTE_HASH_MISMATCH');
 await storage.putIfAbsent(asset.storage_key,check.bytes,asset.mime);
 const stored=await storage.get(asset.storage_key);
 const actual=validateBytes(stored,asset.mime);
 if(actual.bytes_sha256!==asset.bytes_sha256)
  throw Error('STORED_REFERENCE_BYTES_MISMATCH');
 return Object.freeze({...asset,storage_verified:true,
  a08_visual_review:'PENDING',a09_cultural_review:'PENDING',publish_allowed:false});
}
export function collectReferencePair(identity,storedAssets){
 if(!identity||!Array.isArray(storedAssets)||storedAssets.length!==2||
    new Set(storedAssets.map(a=>a.role)).size!==2||
    storedAssets.some(a=>!a.storage_verified||a.channel_id!==identity.channel_id||
      a.channel_identity_sha256!==identity.identity_bundle_sha256||
      a.channel_version!==identity.channel_version||!allowed.has(a.role)||
      !HEX.test(a.bytes_sha256||'')))throw Error('REFERENCE_PAIR_NOT_VERIFIED');
 const assets=['MOTHER','BABY'].map(role=>storedAssets.find(a=>a.role===role));
 const manifest={schema_version:'DD04_A00_026_REFERENCE_PAIR_V1',
  channel_id:identity.channel_id,channel_version:identity.channel_version,
  channel_identity_sha256:identity.identity_bundle_sha256,
  assets:assets.map(a=>({role:a.role,character_id:a.character_id,
   storage_key:a.storage_key,bytes_sha256:a.bytes_sha256,mime:a.mime,
   width:a.width,height:a.height})),
  review_status:'A08_A09_PENDING',visual_consistency_verified:false,
  ceo_G2:'NOT_APPROVED',publish_allowed:false};
 return Object.freeze({...manifest,manifest_sha256:sha(Buffer.from(JSON.stringify(manifest)))});
}
function checkAudit(a,actorRole,manifest){
 return a&&a.role===actorRole&&a.verdict==='PASS'&&UUID.test(a.actor_subject_id||'')&&
  a.manifest_sha256===manifest.manifest_sha256&&
  a.provenance==='INDEPENDENT_HUMAN_OR_AUTHENTICATED_AGENT_REVIEW'&&
  Array.isArray(a.checked_image_sha256)&&
  a.checked_image_sha256.length===2&&
  manifest.assets.every(x=>a.checked_image_sha256.includes(x.bytes_sha256));
}
export function evaluateReferenceReview(manifest,{a08,a09}={}){
 if(!manifest||manifest.review_status!=='A08_A09_PENDING'||!Array.isArray(manifest.assets)||
  manifest.assets.length!==2||!HEX.test(manifest.manifest_sha256||''))
  return Object.freeze({ok:false,reason:'REFERENCE_MANIFEST_UNVERIFIED',publish_allowed:false});
 if(!checkAudit(a08,'A08',manifest)||!checkAudit(a09,'A09',manifest))
  return Object.freeze({ok:false,reason:'INDEPENDENT_IMAGE_QC_REQUIRED',publish_allowed:false});
 if(a08.actor_subject_id===a09.actor_subject_id)
  return Object.freeze({ok:false,reason:'SAME_REVIEWER_FORBIDDEN',publish_allowed:false});
 return Object.freeze({ok:true,reason:'REVIEW_EVIDENCE_CONTRACT_PASSED',
  images_reviewed:true,ready_for_A05_scene_generation:true,
  ceo_G2:'NOT_APPROVED',publish_allowed:false});
}
