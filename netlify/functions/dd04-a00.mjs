import { timingSafeEqual } from 'node:crypto';
import { getDeployStore } from '@netlify/blobs';
import { dispatch, isStagingPreviewUrl } from '../../dd04-agent-control/runtime-core.mjs';
import { assertStagingDatabaseUrl, createPgRepository } from '../../dd04-agent-control/supabase-pg-repository.mjs';
import { createVerifiedPgTlsConfig } from '../../dd04-agent-control/pg-tls.mjs';

const reply=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
});
const equal=(a,b)=>{
 if(!a||!b)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&timingSafeEqual(x,y);
};
let pgPool;
async function pgStore(){
 const tenant=process.env.DD04_STAGING_TENANT_ID;
 const url=process.env.DD04_STAGING_DATABASE_URL;
 assertStagingDatabaseUrl(url,tenant);
 const tls=createVerifiedPgTlsConfig(url,tenant,process.env.DD04_STAGING_DB_CA_PEM);
 if(!pgPool){
  const {Pool}=await import('pg');
  pgPool=new Pool({
   ...tls,
   max:3,
   idleTimeoutMillis:10000,
   connectionTimeoutMillis:8000,
   statement_timeout:12000,
   query_timeout:14000
  });
 }
 return createPgRepository(pgPool,tenant);
}
const mode=()=>process.env.DD04_A00_STORE==='POSTGRES'?'POSTGRES':'BLOBS';
// Safe, non-sensitive classification. Never expose the SQL, DB host, credentials or raw error.
function dbErrorCategory(e) {
 const code=String(e?.code||'');
 const named=String(e?.name||'');
 if(code==='28P01'||code==='28000')return 'DB_AUTH_REJECTED';
 if(['DB_CA_CERTIFICATE_REQUIRED','DB_CA_CERTIFICATE_INVALID'].includes(String(e?.message||'')))return String(e.message);
 if(code==='3D000'||code==='42P01'||code==='3F000')return 'DB_SCHEMA_OR_OBJECT_MISSING';
 if(code==='42501')return 'DB_PERMISSION_DENIED';
 if(code==='23505'||code==='23503'||code==='23514')return 'DB_CONSTRAINT_FAILED';
 if(['ETIMEDOUT','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','EHOSTUNREACH','ENETUNREACH'].includes(code))return 'DB_NETWORK_UNAVAILABLE';
 if(['SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID'].includes(code))return 'DB_TLS_VERIFICATION_FAILED';
 if(named==='SyntaxError')return 'DB_RESPONSE_OR_SQL_INVALID';
 return 'DB_CONNECT_OR_QUERY_FAILED';
}


export default async (request) => {
 const pathname=new URL(request.url).pathname;
 // CONTEXT is build-time metadata and may not exist in Netlify Functions runtime.
 // Protect production and other deployment hosts with strict preview hostname validation.
 if(!isStagingPreviewUrl(request.url))return reply({ok:false,error:'PREVIEW_ONLY'},403);
 if(request.method==='GET' && pathname.endsWith('/health')){
  return reply({ok:true,component:'DD04-A00',runtime:'NODE_FUNCTION',mode:process.env.DD04_A00_PREVIEW_TOKEN?'AUTH_LOCKED':'NOT_CONFIGURED',
    persistent_store:mode()==='POSTGRES'?(process.env.DD04_STAGING_DATABASE_URL&&process.env.DD04_STAGING_TENANT_ID?(process.env.DD04_STAGING_DB_CA_PEM?'SUPABASE_STAGING_POSTGRES_CONFIGURED':'SUPABASE_STAGING_TLS_CA_REQUIRED'):'SUPABASE_STAGING_POSTGRES_NOT_CONFIGURED'):'DEPLOY_SCOPED_BLOBS',real_llm_execution:false,telegram_connected:false,ceo_approval:false,production_connected:false});
 }
 const secret=process.env.DD04_A00_PREVIEW_TOKEN;
 if(!secret || secret.length<32)return reply({error:'PREVIEW_TOKEN_NOT_CONFIGURED'},503);
 const bearer=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!equal(bearer,secret))return reply({error:'UNAUTHORIZED'},401);
 const isPg=mode()==='POSTGRES';
 let repository;
 if(isPg){try{repository=await pgStore()}catch(e){const error_code=dbErrorCategory(e);console.error('DD04 PG config category:',error_code);return reply({error:'STAGING_DATABASE_NOT_CONFIGURED',error_code},503)}}
 const store=isPg?null:getDeployStore('dd04-a00-runtime-poc');
 if(request.method==='GET' && pathname.endsWith('/diagnostics')){
  if(!isPg)return reply({ok:false,error:'POSTGRES_MODE_NOT_ENABLED'},409);
  try{
   const outcome=await repository.diagnose();
   return reply({component:'DD04-A00',source:'SUPABASE_STAGING_POSTGRES',...outcome},outcome.ok?200:503);
  }catch(e){
   const error_code=dbErrorCategory(e);
   console.error('DD04 diagnosis category:',error_code);
   return reply({ok:false,component:'DD04-A00',error:'STAGING_DATABASE_UNAVAILABLE',error_code},503);
  }
 }
 if(request.method==='GET' && pathname.endsWith('/commands')){
  try{
   if(isPg)return reply(await repository.list(30));
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
   const data=JSON.parse(raw),out=isPg?await repository.accept(data):await dispatch(store,data);
   return reply(out.body,out.code);
  }catch(e){
   if(e instanceof SyntaxError)return reply({error:'INVALID_JSON'},400);
   if(/^INVALID_|^MEDIA_NOT_ENABLED/.test(e.message))return reply({error:e.message},400);
   const error_code=isPg?dbErrorCategory(e):'BLOBS_STORE_UNAVAILABLE';
   console.error('DD04 runtime error category:',error_code);
   return reply({error:'STORE_OR_RUNTIME_UNAVAILABLE',error_code},503);
  }
 }
 if(request.method==='GET' && pathname.includes('/commands/')){
  const id=pathname.split('/').pop();
  if(!/^cmd_[a-f0-9]{20}$/.test(id||''))return reply({error:'INVALID_COMMAND_ID'},400);
  try{const record=isPg?await repository.get(id):await store.get('commands/'+id,{type:'json'});return record?reply(record):reply({error:'NOT_FOUND'},404);}
  catch(e){console.error('DD04 read error type:',e.name);return reply({error:'STORE_UNAVAILABLE'},503);}
 }
 return reply({error:'NOT_FOUND'},404);
};
export const config={path:['/api/dd04-a00/health','/api/dd04-a00/commands','/api/dd04-a00/commands/:id','/api/dd04-a00/diagnostics']};
