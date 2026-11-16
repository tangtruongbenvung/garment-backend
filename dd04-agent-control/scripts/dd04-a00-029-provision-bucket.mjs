// DD04 A00-029 | One-shot STAGING ONLY private bucket provisioning.
// Not called by Netlify Functions, never auto-runs during import.
// Supabase Storage Admin API, NOT direct SQL writes to storage.buckets/objects.
// Requires explicit operator command: DD04_A00_029_PROVISION=EXACT_STAGING_PRIVATE_BUCKET.
// No public bucket, no anonymous policies, no broad changes to other buckets.
const URL='https://wbvkqfnrlasmtizjszab.supabase.co';
const BUCKET='dd04-media-private-staging';
const CAP=12*1024*1024;
const MIMES=['image/png','image/jpeg','image/webp'];
function matches(b){
 return b?.id===BUCKET&&b.public===false&&Number(b.file_size_limit)===CAP&&
  Array.isArray(b.allowed_mime_types)&&
  MIMES.every(x=>b.allowed_mime_types.includes(x))&&b.allowed_mime_types.length===MIMES.length;
}
export async function provisionA0029PrivateBucket({url,token,confirm,fetch_impl=fetch}){
 if(url!==URL||confirm!=='EXACT_STAGING_PRIVATE_BUCKET'||!token||token.length<40)
  throw Error('STAGING_BUCKET_OPERATOR_AUTHORIZATION_REQUIRED');
 const headers={'apikey':token,'authorization':'Bearer '+token,'content-type':'application/json'};
 const endpoint=url+'/storage/v1/bucket';
 const response=await fetch_impl(endpoint,{method:'GET',headers,cache:'no-store',redirect:'error'});
 if(!response.ok)throw Error('STAGING_BUCKET_LIST_FAILED_'+response.status);
 const list=await response.json();
 if(!Array.isArray(list))throw Error('STAGING_BUCKET_API_UNEXPECTED_RESPONSE');
 const found=list.find(x=>x.id===BUCKET);
 if(found){
  if(!matches(found))throw Error('STAGING_BUCKET_EXISTS_BUT_CONFIG_IS_UNSAFE');
  return {status:'ALREADY_PRIVATE_AND_BOUNDED',bucket:BUCKET};
 }
 const res=await fetch_impl(endpoint,{method:'POST',headers,
  body:JSON.stringify({id:BUCKET,name:BUCKET,public:false,
   file_size_limit:CAP,allowed_mime_types:MIMES}),
  cache:'no-store',redirect:'error'});
 if(!res.ok)throw Error('STAGING_BUCKET_CREATE_FAILED_'+res.status);
 const checked=await fetch_impl(endpoint,{method:'GET',headers,cache:'no-store',redirect:'error'});
 if(!checked.ok)throw Error('STAGING_BUCKET_POSTCREATE_READBACK_FAILED');
 const current=(await checked.json()).find(x=>x.id===BUCKET);
 if(!matches(current))throw Error('STAGING_BUCKET_POSTCREATE_SECURITY_MISMATCH');
 return {status:'CREATED_PRIVATE_AND_BOUNDED',bucket:BUCKET};
}
if(process.argv[1]?.endsWith('dd04-a00-029-provision-bucket.mjs')){
 const key=process.env.DD04_STAGING_STORAGE_ADMIN_KEY;
 const flag=process.env.DD04_A00_029_PROVISION;
 provisionA0029PrivateBucket({url:URL,token:key,confirm:flag})
 .then(result=>process.stdout.write(JSON.stringify(result)+'\n'))
 .catch(e=>{process.stderr.write('BLOCKED: '+e.message+'\n');process.exitCode=1;});
}
