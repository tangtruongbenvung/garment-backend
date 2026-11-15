import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../netlify/functions/dd04-a00-021-backend-probe.mjs',import.meta.url),'utf8');
test('staging probe accepts POST, verified Supabase JWT, AAL2 and preview hostname only',()=>{
 for(const required of ['isStagingPreviewUrl(request.url)',"request.method!=='POST'",
 'verifyAuthUser({token',"session.aal!=='aal2'",'DD04_STAGING_TENANT_ID'])
  assert.ok(source.includes(required),required);
});
test('connection health probe executes no DML, no G1/G2 updates or external spending',()=>{
 assert.match(source,/BEGIN READ ONLY/);
 assert.match(source,/SET LOCAL ROLE dd04_a00_runtime/);
 assert.match(source,/DD04_A00_BACKEND_DATABASE_URL/);
 assert.match(source,/dd04_stage\.a00_authorized/);
 assert.doesNotMatch(source,/client\.query\(['"`]?(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i);
 assert.doesNotMatch(source,/INSERT INTO dd04_stage|api\.openai\.com/i);
});
test('never returns database secret, URL or raw exceptions',()=>{
 assert.match(source,/STAGING_DATABASE_CONNECTION_UNAVAILABLE/);
 assert.match(source,/worker_active:false,read_only:true,can_publish:false,can_spend:false/);
 assert.doesNotMatch(source,/JSON\\.stringify\\([^)]*connectionString/);
 assert.doesNotMatch(source,/error\.message|err\.stack|console\.log\(.*env/);
});
