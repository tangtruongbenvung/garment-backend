// DD04 A00-021 — strictly staging-only PostgreSQL login for Agent backend.
// This is a SERVER LIBRARY, not an HTTP endpoint. Never expose in browser bundles.
// Runtime worker tokens must be separately authorized, provisioned, and revoked.
import {createVerifiedPgTlsConfig} from './pg-tls.mjs';
import {createA0020DbActorResolver} from './a00-020-db-actor-resolver.mjs';
import {createA0020TaskPlanWriter} from './a00-020-save-task-plan.mjs';
import {createA0020ArtifactAttacher} from './a00-020-attach-artifact.mjs';
import {createA0020LedgerRepository} from './a00-020-atomic-ledger-repository.mjs';

const PROJECT='wbvkqfnrlasmtizjszab';
const TENANT=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function assertA0021BackendDbUrl(raw){
 let url;
 try{url=new URL(raw)}catch{throw new Error('A00_BACKEND_DB_URL_REQUIRED')}
 if(!['postgres:','postgresql:'].includes(url.protocol)||
    url.hostname!=='db.'+PROJECT+'.supabase.co'||
    (url.port&&url.port!=='5432')||url.pathname!=='/postgres'||
    decodeURIComponent(url.username)!=='dd04_a00_backend'||!url.password)
  throw new Error('A00_BACKEND_LOGIN_OR_STAGING_TARGET_INVALID');
 if(url.searchParams.get('sslmode')==='disable')
  throw new Error('A00_BACKEND_TLS_REQUIRED');
 return {target:'A00_STAGING_ONLY',role:'dd04_a00_backend'};
}
export async function createA0021Runtime({
  connectionString,caPem,tenantId,environment='STAGING'
}={}){
 if(environment!=='STAGING'||!TENANT.test(tenantId||''))
  throw new Error('A00_STAGING_TENANT_REQUIRED');
 assertA0021BackendDbUrl(connectionString);
 const tls=createVerifiedPgTlsConfig(connectionString,tenantId,caPem);
 const {Pool}=await import('pg');
 const pool=new Pool({...tls,max:2,connectionTimeoutMillis:6000,
  idleTimeoutMillis:8000,statement_timeout:8000,query_timeout:10000});
 const resolveActor=createA0020DbActorResolver({expectedTenantId:tenantId});
 return Object.freeze({
  pool,
  taskPlans:createA0020TaskPlanWriter(pool,resolveActor),
  artifacts:createA0020ArtifactAttacher(pool,resolveActor),
  ledger:createA0020LedgerRepository(pool,resolveActor),
  async close(){await pool.end()}
 });
}
// Deliberately no create-from-process.env shortcut: the trusted server caller
// must pass its own secret manager values, with per-environment scoping.
