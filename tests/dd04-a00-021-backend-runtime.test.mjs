import test from 'node:test';
import assert from 'node:assert/strict';
import {assertA0021BackendDbUrl,createA0021Runtime}
 from '../dd04-agent-control/a00-021-backend-runtime.mjs';
const host='db.wbvkqfnrlasmtizjszab.supabase.co';
const good=`postgresql://dd04_a00_backend:fake-fixture-password@${host}:5432/postgres`;
test('pins isolated staging backend login without any privileged database user',()=>{
 assert.deepEqual(assertA0021BackendDbUrl(good),{
  target:'A00_STAGING_ONLY',role:'dd04_a00_backend'});
});
test('rejects production, postgres/service_role, wrong schema, unsafe SSL and missing secret',()=>{
 const bad=[
  good.replace(host,'db.ykhrtrvstymfjnzdgzna.supabase.co'),
  good.replace('dd04_a00_backend','postgres'),
  good.replace('dd04_a00_backend','service_role'),
  good.replace('/postgres','/template1'),
  good+'?sslmode=disable',
  good.replace('fake-fixture-password',''),
  good.replace(':5432',':5433')
 ];
 for(const url of bad)
  assert.throws(()=>assertA0021BackendDbUrl(url),/A00_BACKEND_/);
});
test('runtime constructor refuses production and invalid tenant before network use',()=>{
 assert.throws(()=>createA0021Runtime({
  connectionString:good,tenantId:'6bc73b49-a396-4c7d-b390-ab6339d547cd',
  environment:'PRODUCTION'}),/A00_STAGING_TENANT_REQUIRED/);
});
