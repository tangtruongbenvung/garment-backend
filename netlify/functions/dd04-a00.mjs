import { timingSafeEqual } from 'node:crypto';
import { getDeployStore } from '@netlify/blobs';
import { dispatch, isStagingPreviewUrl } from '../../dd04-agent-control/runtime-core.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
});
const equal=(a,b)=>{
 if(!a||!b)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
};
export default async (request) => {
 const pathname=new URL(request.url).pathname;
 // CONTEXT is build-time metadata and may not exist in Netlify Functions runtime.
 // Protect production and other deployment hosts with strict preview hostname validation.
 if(!isStagingPreviewUrl(request.url))return reply({ok:false,error:'PREVIEW_ONLY'},403);
 if(request.method==='GET' && pathname.endsWith('/health')){
  return reply({ok:true,component:'DD04-A00',runtime:'NODE_FUNCTION',mode:process.env.DD04_A00_PREVIEW_TOKEN?'AUTH_LOCKED':'NOT_CONFIGURED',
    persistent_store:'DEPLOY_SCOPED_BLOBS',real_llm_execution:false,telegram_connected:false,ceo_approval:false,production_connected:false});
 }
 const secret=process.env.DD04_A00_PREVIEW_TOKEN;
 if(!secret || secret.length<32)return reply({error:'PREVIEW_TOKEN_NOT_CONFIGURED'},503);
 const bearer=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!equal(bearer,secret))return reply({error:'UNAUTHORIZED'},401);
 const store=getDeployStore('dd04-a00-runtime-poc');
 if(request.method==='GET' && pathname.endsWith('/commands')){
  try{
   const {blobs}=await store.list({prefix:'commands/'});
   // Staging cap prevents unbounded reads. No DB aggregation or production status inference.
   const selected=blobs.slice(0,30);
   const records=(await Promise.all(selected.map(async item=>{
    const r=await store.get(item.key,{type:'json'});
    return r&&r.schema_version==='5.3'&&Array.isArray(r.task_graph)?r:null;
   }))).filter(Boolean).sort((a,b)=>String(b.received_at).localeCompare(String(a.received_at)));
   return reply({source:'DEPLOY_SCOPED_BLOBS_API',records,total_keys:blobs.length,truncated:blobs.length>30,live_execution_verified:false});
  }catch(e){
   console.error('DD04 list error type:',e.name);
   return reply({error:'STORE_LIST_UNAVAILABLE'},503);
  }
 }
 if(request.method==='POST' && pathname.endsWith('/commands')){
  if(!(request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({error:'JSON_REQUIRED'},415);
  const raw=await request.text();
  if(raw.length>4096)return reply({error:'PAYLOAD_TOO_LARGE'},413);
  try{
   const data=JSON.parse(raw),out=await dispatch(store,data);
   return reply(out.body,out.code);
  }catch(e){
   if(e instanceof SyntaxError)return reply({error:'INVALID_JSON'},400);
   if(/^INVALID_|^MEDIA_NOT_ENABLED/.test(e.message))return reply({error:e.message},400);
   console.error('DD04 runtime error type:',e.name);
   return reply({error:'STORE_OR_RUNTIME_UNAVAILABLE'},503);
  }
 }
 if(request.method==='GET' && pathname.includes('/commands/')){
  const id=pathname.split('/').pop();
  if(!/^cmd_[a-f0-9]{20}$/.test(id||''))return reply({error:'INVALID_COMMAND_ID'},400);
  try{const record=await store.get('commands/'+id,{type:'json'});return record?reply(record):reply({error:'NOT_FOUND'},404);}
  catch(e){console.error('DD04 read error type:',e.name);return reply({error:'STORE_UNAVAILABLE'},503);}
 }
 return reply({error:'NOT_FOUND'},404);
};
export const config={path:['/api/dd04-a00/health','/api/dd04-a00/commands','/api/dd04-a00/commands/:id']};
