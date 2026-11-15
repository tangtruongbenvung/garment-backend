import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../netlify/functions/dd04-a00-021-backend-probe.mjs',import.meta.url),'utf8');
test('staging probe requires POST, verified JWT, MFA AAL2 and preview',()=>{
 for(const required of ['isStagingPreviewUrl(request.url)',"request.method!=='POST'",
  'verifyAuthUser({token',"session.aal!=='aal2'",'DD04_STAGING_TENANT_ID']){
  assert.ok(source.includes(required),required);
 }
});
test('staging probe is strictly READ ONLY with a scoped database identity',()=>{
 for(const required of ['BEGIN READ ONLY','SET LOCAL ROLE dd04_a00_runtime',
   'DD04_A00_BACKEND_DATABASE_URL','dd04_stage.a00_authorized']){
  assert.ok(source.includes(required),required);
 }
 for(const forbidden of ['INSERT INTO dd04_stage.','UPDATE dd04_stage.',
  'DELETE FROM dd04_stage.','api.openai.com','console.log(process.env)']){
  assert.ok(!source.includes(forbidden),forbidden);
 }
});
test('staging probe never returns DB secrets and always ends transaction',()=>{
 for(const required of ['STAGING_DATABASE_CONNECTION_UNAVAILABLE','ROLLBACK',
  'can_publish:false','can_spend:false']){
  assert.ok(source.includes(required),required);
 }
 for(const forbidden of ['JSON.stringify(connectionString)','error.message',
  'err.stack','DD04_A00_WORKER_CREDENTIAL']){
  assert.ok(!source.includes(forbidden),forbidden);
 }
});
