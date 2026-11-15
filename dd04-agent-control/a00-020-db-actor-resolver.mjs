// DD04-A00-020 — private worker authentication (NO HTTP ENDPOINT).
// Credential is a random server-side opaque bearer, NOT from a browser, chat or LLM.
// The database stores only SHA-256; rotation/revocation takes effect on next transaction.
// Service must be supplied via server secret manager; provisioned workers require independent review.
import {createHash,timingSafeEqual} from 'node:crypto';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGENT=/^A(0[0-9]|1[0-7])$/;
const HASH=/^[0-9a-f]{64}$/;
const fail=c=>{throw new Error(c)};
export function createA0020DbActorResolver({expectedTenantId,environment='STAGING'}={}){
 if(environment!=='STAGING'||!UUID.test(expectedTenantId||''))fail('STAGING_TENANT_REQUIRED');
 return async function resolveActor(client,serverCredential){
  if(!client||typeof client.query!=='function')fail('DB_CLIENT_REQUIRED');
  if(typeof serverCredential!=='string'||!/^dd04w_[A-Za-z0-9_-]{48,192}$/.test(serverCredential))fail('PRIVATE_WORKER_CREDENTIAL_REQUIRED');
  const digest=createHash('sha256').update(serverCredential).digest('hex');
  const r=await client.query(`SELECT tenant_id,subject_id,agent_id,status,expires_at,allowed_actions,
  current_timestamp < expires_at AS not_expired
  FROM dd04_stage.a00_worker_identities
  WHERE tenant_id=$1::uuid AND credential_sha256=$2 AND status='ACTIVE'
  FOR SHARE`,[expectedTenantId,digest]);
  if(!Array.isArray(r?.rows)||r.rows.length!==1)fail('WORKER_IDENTITY_UNVERIFIED');
  const p=r.rows[0];
  if(!UUID.test(p.tenant_id||'')||p.tenant_id.toLowerCase()!==expectedTenantId.toLowerCase()||
  !UUID.test(p.subject_id||'')||!AGENT.test(p.agent_id||'')||
  p.not_expired!==true||p.status!=='ACTIVE'||!Array.isArray(p.allowed_actions))fail('WORKER_IDENTITY_INVALID');
  // No caller-provided identity/tenant/role or test boolean is consulted.
  return Object.freeze({verified_by_db:true,active:true,runtime_environment:'STAGING',
   tenant_id:p.tenant_id,subject_id:p.subject_id,agent_id:p.agent_id,
   allowed_actions:Object.freeze(p.allowed_actions.filter(a=>typeof a==='string'))});
 };
}
export function requireAgentCapability(actor,action){
 if(!actor?.verified_by_db||actor.active!==true||!Array.isArray(actor.allowed_actions)||
 !actor.allowed_actions.includes(action))fail('AGENT_CAPABILITY_DENIED');
 return true;
}
