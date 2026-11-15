import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeA0029PrivateStorageAdapter,assertA0029PrivateBucket} from '../dd04-agent-control/a00-029-private-storage-adapter.mjs';
const url='https://wbvkqfnrlasmtizjszab.supabase.co',tenant='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const token='private-staging-only-long-fake-server-token-used-for-ci';
const bytes=Buffer.from('real-byte-hash-reference-img'.repeat(3));
const sha=createHash('sha256').update(bytes).digest('hex');
const path=`dd04-staging/${tenant}/channels/FB001/identity-v1/reference/mother/${sha}`;
function fakeStorage(){
 const blobs=new Map(),calls=[];
 async function fakeFetch(target,opts){
  calls.push({target,method:opts.method,headers:opts.headers,body:opts.body});
  const key=decodeURIComponent(new URL(target).pathname.split('/').slice(5).join('/'));
  if(opts.method==='POST'){
   if(blobs.has(key))return {ok:false,status:409};
   blobs.set(key,Buffer.from(opts.body));
   return {ok:true,status:200};
  }
  if(!blobs.has(key))return {ok:false,status:404};
  return {ok:true,status:200,arrayBuffer:async()=>Buffer.from(blobs.get(key))};
 }
 return {calls,blobs,fakeFetch};
}
const adapter=(fake,authorize=async()=>true,scope={})=>makeA0029PrivateStorageAdapter({
 url,token,bucket:'dd04-media-private-staging',tenant_id:tenant,
 channel_id:'FB001',version:1,authorize,fetch_impl:fake.fakeFetch,...scope
});
test('private storage adapter rejects public endpoint/cross project/missing worker authorizer',()=>{
 const fake=fakeStorage();
 assert.throws(()=>makeA0029PrivateStorageAdapter({url:'https://other.supabase.co',
 token,bucket:'dd04-media-private-staging',tenant_id:tenant,channel_id:'FB001',
 version:1,authorize:async()=>true,fetch_impl:fake.fakeFetch}),/STAGING_CONFIGURATION/);
 assert.throws(()=>makeA0029PrivateStorageAdapter({url,token,bucket:'dd04-public',
 tenant_id:tenant,channel_id:'FB001',version:1,authorize:async()=>true,
 fetch_impl:fake.fakeFetch}),/STAGING_CONFIGURATION/);
 assert.throws(()=>makeA0029PrivateStorageAdapter({url,token,
 bucket:'dd04-media-private-staging',tenant_id:tenant,channel_id:'FB001',
 version:1,fetch_impl:fake.fakeFetch}),/STAGING_CONFIGURATION/);
});
test('private Supabase storage supports 2 distinct writes+authenticated read-back without overwrite',async()=>{
 const fake=fakeStorage();const a=adapter(fake),second=Buffer.from('another-independent-reference-photo'.repeat(3));
 const h2=createHash('sha256').update(second).digest('hex');
 const key2=path.replace('/mother/'+sha,'/baby/'+h2);
 await a.putIfAbsent(path,bytes,'image/png');
 await a.putIfAbsent(key2,second,'image/png');
 const one=await a.get(path),two=await a.get(key2);
 assert.equal(Buffer.compare(one,bytes),0);
 assert.equal(Buffer.compare(two,second),0);
 assert.equal(fake.blobs.size,2);
 assert.equal(fake.calls.filter(x=>x.method==='POST').length,2);
 assert.ok(fake.calls.every(x=>x.target.startsWith(url+'/storage/v1/object/dd04-media-private-staging/')));
 assert.ok(fake.calls.filter(x=>x.method==='POST').every(x=>x.headers['x-upsert']==='false'));
 await assert.rejects(a.putIfAbsent(path,bytes,'image/png'),/STORAGE_IMMUTABLE_CONFLICT/);
});
test('staging worker denies wrong tenant, altered bytes, cross-channel path and expired worker',async()=>{
 const fake=fakeStorage();const denied=adapter(fake,async()=>false);
 await assert.rejects(denied.putIfAbsent(path,bytes,'image/png'),/STORAGE_WORKER_NOT_AUTHORIZED/);
 assert.equal(fake.calls.length,0);
 const a=adapter(fake);
 await assert.rejects(a.putIfAbsent(path,Buffer.concat([bytes,Buffer.from('change')]),'image/png'),/STORAGE_BYTES_MIME_OR_HASH_INVALID/);
 await assert.rejects(a.get(path.replace('/FB001/','/FB002/')),/STORAGE_CROSS_TENANT_OR_CHANNEL_PATH/);
 await assert.rejects(a.get(path.replace('/'+tenant+'/','/11111111-1111-4111-8111-111111111111/')),/STORAGE_CROSS_TENANT_OR_CHANNEL_PATH/);
 await assert.rejects(a.get(path.replace('/mother/','/mother/../')),/STORAGE_KEY_NOT_CANONICAL/);
});
test('stored bytes tampering is detected on readback',async()=>{
 const fake=fakeStorage(),a=adapter(fake);
 await a.putIfAbsent(path,bytes,'image/png');
 const key=decodeURIComponent(new URL(fake.calls[0].target).pathname.split('/').slice(5).join('/'));
 fake.blobs.set(key,Buffer.from('tampered bytes'));
 await assert.rejects(a.get(path),/STORAGE_RETURNED_BYTES_HASH_MISMATCH/);
});
test('predeployment private bucket must be private and bounded',()=>{
 const row={id:'dd04-media-private-staging',public:false,file_size_limit:12*1024*1024,
  allowed_mime_types:['image/png','image/jpeg','image/webp']};
 assert.equal(assertA0029PrivateBucket(row),true);
 assert.throws(()=>assertA0029PrivateBucket({...row,public:true}),/BUCKET_NOT_PRIVATE/);
 assert.throws(()=>assertA0029PrivateBucket({...row,file_size_limit:50*1024*1024}),/BUCKET_NOT_PRIVATE/);
});
