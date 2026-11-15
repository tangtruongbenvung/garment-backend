import test from 'node:test';
import assert from 'node:assert/strict';
import {auditA0019} from '../dd04-agent-control/a00-019-readiness-audit.mjs';
const HASH='a'.repeat(64);
const valid=()=>({
  environment:'STAGING',staging_project_verified:true,server_auth_verified:true,
  tenant_isolation_tested:true,agent_permissions_tested:true,
  migration_explicitly_authorized:true,transaction_atomicity_tested:true,
  idempotency_tested:true,independent_review_tested:true,
  finance_reservation_tested:true,finance_ceo_exception_tested:true,
  g1_g2_authority_tested:true,a07_publish_lock_tested:true,
  live_gateway_verified:true,agent_executor_verified:true,
  evidence_manifest_sha256:HASH,test_count:15,failed_tests:0
});
test('empty evidence fails closed',()=>{
 const a=auditA0019(null);assert.equal(a.ready,false);
 assert.equal(a.publish_allowed,false);assert.equal(a.executable,false);
});
test('all evidence means review ready, NEVER execution ready',()=>{
 const a=auditA0019(valid());assert.equal(a.ready,true);
 assert.equal(a.executable,false);assert.equal(a.publish_allowed,false);
 assert.equal(a.ceo_publication_approval_issued,false);
});
test('one missing security precondition blocks readiness',()=>{
 const e=valid();e.tenant_isolation_tested=false;
 const a=auditA0019(e);assert.equal(a.ready,false);
 assert.ok(a.blockers.some(x=>x.code==='TENANT_ISOLATION_NOT_TESTED'));
});
test('missing separate migration authorization blocks readiness',()=>{
 const e=valid();e.migration_explicitly_authorized=false;
 assert.equal(auditA0019(e).ready,false);
});
test('bad manifest or failed tests blocks readiness',()=>{
 const e=valid();e.evidence_manifest_sha256='spoofed';e.failed_tests=1;
 const a=auditA0019(e);assert.equal(a.ready,false);
 assert.ok(a.blockers.some(x=>x.code==='AUDIT_MANIFEST_HASH_INVALID'));
});
test('production evidence cannot certify staging readiness',()=>{
 const e=valid();e.environment='PRODUCTION';
 assert.equal(auditA0019(e).ready,false);
});
