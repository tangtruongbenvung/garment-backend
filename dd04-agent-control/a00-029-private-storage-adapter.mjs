// DD04-A00-029 | Supabase PRIVATE Storage backend adapter, staging-only.
// No public URL, signed URL, anon upload, browser service-role key or production.
// This adapter is inert without explicit server-side env and authenticated
// short-lived worker authorizer. Run SQL30 / create private bucket separately
// only when permitted, and do not claim an image QC PASS from bytes alone.
import {createHash} from 'node:crypto';
const HEX=/^[0-9a-f]{64}$/;
const BUCKET='dd04-media-private-staging';
const PROJECT='wbvkqfnrlasmtizjszab';
const PROJECT_URL='https://'+PROJECT+'.supabase.co';
const MIME=new Set(['image/png','image/jpeg','image/webp']);
const hash=data=>createHash('sha256').update(data).digest('hex');
function safePath(key,{tenant_id,channel_id,version}){
 if(typeof key!=='string'||key.length>600||key.includes('//')||
  key.includes('..')||key.includes('%')||key.includes('?')||key.includes('#')||
  !/^[-a-zA-Z0-9_/]+$/.test(key)||
  !/^[-a-zA-Z0-9_]{2,64}$/.test(channel_id||'')||
  !Number.isSafeInteger(version)||version<1)
  throw Error('STORAGE_KEY_NOT_CANONICAL');
 const prefix=`dd04-staging/${tenant_id}/channels/${channel_id}/identity-v${version}/`;
 if(!key.startsWith(prefix))throw Error('STORAGE_CROSS_TENANT_OR_CHANNEL_PATH');
 const parts=key.slice(prefix.length).split('/');
 if(parts.length<3||!parts.every(Boolean))throw Error('STORAGE_PATH_DEPTH_INVALID');
 const digest=parts.at(-1);
 if(!HEX.test(digest))throw Error('STORAGE_OBJECT_NAME_NOT_SHA256');
 return key;
}
function authHeader(token){
 return {'apikey':token,'authorization':'Bearer '+token};
}
function config({url,token,bucket,tenant_id,channel_id,version,authorize,fetch_impl}){
 if(url!==PROJECT_URL||bucket!==BUCKET||!token||token.length<40||
   typeof authorize!=='function'||typeof fetch_impl!=='function'||
   !/^[a-f0-9-]{36}$/i.test(tenant_id||''))
  throw Error('STORAGE_PRIVATE_STAGING_CONFIGURATION_REQUIRED');
 return {url,token,bucket,tenant_id,channel_id,version,authorize,fetch_impl};
}
export function makeA0029PrivateStorageAdapter(options={}){
 const c=config({...options,fetch_impl:options.fetch_impl??fetch});
 const scope={tenant_id:c.tenant_id,channel_id:c.channel_id,version:c.version};
 async function allowed(action,key){
  safePath(key,scope);
  // authorize MUST check real staging backend worker identity and channel ACL,
  // not caller-supplied JSON or a client JWT alone.
  const decision=await c.authorize({action,storage_key:key,...scope});
  if(decision!==true)throw Error('STORAGE_WORKER_NOT_AUTHORIZED');
 }
 async function run({method,key,data,mime}){
  const route=method==='GET'?'/storage/v1/object/authenticated/':'/storage/v1/object/';
  const requestUrl=c.url+route+encodeURIComponent(c.bucket)+'/'+key.split('/').map(encodeURIComponent).join('/');
  const headers={...authHeader(c.token)};
  if(method==='POST'){headers['content-type']=mime;headers['x-upsert']='false';headers['cache-control']='private, no-store';}
  const resp=await c.fetch_impl(requestUrl,{method,headers,
   body:method==='POST'?data:undefined,redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(25000)});
  if(!resp.ok){
   // Do not expose internal request URLs, service keys or API error bodies.
   if(resp.status===404)throw Error('STORAGE_OBJECT_OR_BUCKET_NOT_FOUND');
   if(resp.status===409)throw Error('STORAGE_IMMUTABLE_CONFLICT');
   if([401,403].includes(resp.status))throw Error('STORAGE_CREDENTIAL_OR_RLS_DENIED');
   throw Error('STORAGE_REQUEST_DENIED_'+resp.status);
  }
  return resp;
 }
 return Object.freeze({
  bucket:c.bucket,tenant_id:c.tenant_id,channel_id:c.channel_id,
  async putIfAbsent(key,bytes,mime){
   await allowed('REFERENCE_WRITE',key);
   if(!Buffer.isBuffer(bytes)||bytes.length<45||bytes.length>12*1024*1024||
     !MIME.has(mime)||hash(bytes)!==key.split('/').at(-1))
    throw Error('STORAGE_BYTES_MIME_OR_HASH_INVALID');
   await run({method:'POST',key,data:bytes,mime});
   return {stored:true,public:false};
  },
  async get(key){
   await allowed('REFERENCE_READ',key);
   const response=await run({method:'GET',key});
   const b=Buffer.from(await response.arrayBuffer());
   if(b.length>12*1024*1024||hash(b)!==key.split('/').at(-1))
    throw Error('STORAGE_RETURNED_BYTES_HASH_MISMATCH');
   return b;
  }
 });
}
// Never use a PUBLIC bucket even if credentials are configured.
export function assertA0029PrivateBucket(row){
 if(!row||row.id!==BUCKET||row.public!==false||
  !row.allowed_mime_types||!['image/png','image/jpeg','image/webp']
   .every(x=>row.allowed_mime_types.includes(x))||
  !Number.isFinite(Number(row.file_size_limit))||
  Number(row.file_size_limit)>12*1024*1024)
  throw Error('STAGING_STORAGE_BUCKET_NOT_PRIVATE_OR_BOUNDED');
 return true;
}
