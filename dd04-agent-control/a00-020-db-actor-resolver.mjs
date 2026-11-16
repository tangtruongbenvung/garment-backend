// DD04 A00-021 — RLS-compatible private worker identity resolver.
// Call only inside the server transaction, after SET LOCAL ROLE dd04_a00_runtime
// and SET LOCAL dd04.worker_credential. Never fetch the secret identities table
// directly: RLS intentionally denies that table to the runtime role.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGENT=/^A(0[0-9]|1[0-7])$/;
const ACTIONS=Object.freeze(['READ','SAVE_PLAN','START','ATTACH','SUBMIT','QC_PASS',
 'REVIEW_PASS','REVIEW_FAIL','REWORK','AUTO_READY']);
const fail=code=>{throw new Error(code)};
export function createA0020DbActorResolver({expectedTenantId,environment='STAGING'}={}){
 if(environment!=='STAGING'||!UUID.test(expectedTenantId||''))fail('STAGING_TENANT_REQUIRED');
 return async function resolveActor(client,serverCredential){
  if(!client||typeof client.query!=='function')fail('DB_CLIENT_REQUIRED');
  if(typeof serverCredential!=='string'||!/^dd04w_[A-Za-z0-9_-]{48,192}$/.test(serverCredential))
   fail('PRIVATE_WORKER_CREDENTIAL_REQUIRED');
  // The opaque credential is already transaction-local, never returned here.
  // SECURITY DEFINER helpers verify ACTIVE, expiration, credential hash, and
  // supplied expected tenant without exposing any worker row to the client.
  const result=await client.query(`SELECT
    dd04_stage.a00_current_agent() AS agent_id,
    dd04_stage.a00_current_subject() AS subject_id,
    dd04_stage.a00_authorized($1::uuid,'READ') AS tenant_read_allowed,
    ARRAY(SELECT action FROM unnest($2::text[]) AS action
      WHERE dd04_stage.a00_authorized($1::uuid,action)) AS allowed_actions`,
    [expectedTenantId,ACTIONS]);
  if(!Array.isArray(result?.rows)||result.rows.length!==1)fail('WORKER_IDENTITY_UNVERIFIED');
  const actor=result.rows[0];
  if(actor.tenant_read_allowed!==true||!UUID.test(actor.subject_id||'')||
     !AGENT.test(actor.agent_id||'')||!Array.isArray(actor.allowed_actions))
   fail('WORKER_IDENTITY_INVALID');
  return Object.freeze({verified_by_db:true,active:true,runtime_environment:'STAGING',
   tenant_id:expectedTenantId,subject_id:actor.subject_id,agent_id:actor.agent_id,
   allowed_actions:Object.freeze(actor.allowed_actions.filter(x=>ACTIONS.includes(x)))});
 };
}
export function requireAgentCapability(actor,action){
 if(!actor?.verified_by_db||actor.active!==true||!Array.isArray(actor.allowed_actions)||
  !actor.allowed_actions.includes(action))fail('AGENT_CAPABILITY_DENIED');
 return true;
}
