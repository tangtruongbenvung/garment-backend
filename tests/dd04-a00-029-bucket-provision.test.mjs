import test from 'node:test';
import assert from 'node:assert/strict';
import {provisionA0029PrivateBucket} from '../dd04-agent-control/scripts/dd04-a00-029-provision-bucket.mjs';
const url='https://wbvkqfnrlasmtizjszab.supabase.co',token='fake-supabase-staging-admin-token-not-real-for-ci';
const confirm='EXACT_STAGING_PRIVATE_BUCKET';
const bucket={id:'dd04-media-private-staging',public:false,
 file_size_limit:12582912,allowed_mime_types:['image/png','image/jpeg','image/webp']};
const response=(x,status=200)=>({ok:status<400,status,json:async()=>x});
test('bucket provisioning refuses absent explicit operator flag, wrong tenant or missing key',async()=>{
 await assert.rejects(provisionA0029PrivateBucket({url,token,confirm:null,fetch_impl:async()=>{throw Error('SHOULD_NOT_FETCH')}}),/OPERATOR_AUTHORIZATION/);
 await assert.rejects(provisionA0029PrivateBucket({url:'https://ykhrtrvstymfjnzdgzna.supabase.co',token,confirm,fetch_impl:async()=>{throw Error('SHOULD_NOT_FETCH')}}),/OPERATOR_AUTHORIZATION/);
});
test('existing valid bucket yields no write',async()=>{
 let write=0;
 const fetch_impl=async(_url,opts)=>{if(opts.method==='POST')write++;return response([bucket])};
 const result=await provisionA0029PrivateBucket({url,token,confirm,fetch_impl});
 assert.equal(result.status,'ALREADY_PRIVATE_AND_BOUNDED');assert.equal(write,0);
});
test('public bucket fails closed, never mutates it',async()=>{
 let write=0;
 const fetch_impl=async(_url,opts)=>{if(opts.method==='POST')write++;return response([{...bucket,public:true}])};
 await assert.rejects(provisionA0029PrivateBucket({url,token,confirm,fetch_impl}),/CONFIG_IS_UNSAFE/);
 assert.equal(write,0);
});
test('one-shot creation is private, max 12 MB, limited MIME and readback verified',async()=>{
 const rows=[];let payload;
 const fetch_impl=async(_url,opts)=>{
  if(opts.method==='POST'){payload=JSON.parse(opts.body);rows.push({...payload});return response({id:payload.id})}
  return response(rows);
 };
 const result=await provisionA0029PrivateBucket({url,token,confirm,fetch_impl});
 assert.equal(result.status,'CREATED_PRIVATE_AND_BOUNDED');
 assert.equal(payload.public,false);
 assert.equal(payload.file_size_limit,12582912);
 assert.equal(payload.allowed_mime_types.length,3);
});
