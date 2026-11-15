import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectCeoReadiness,sessionAssuranceFromVerifiedJwt} from '../dd04-agent-control/ceo-readiness-core.mjs';
const userId='b11f7154-5f5d-4b55-a497-90e8adf2525e';
const tenantId='123e4567-e89b-42d3-a456-426614174000';
const jwt=({aal='aal1',sub=userId,session_id='123e4567-e89b-42d3-a456-426614174111',iss='https://wbvkqfnrlasmtizjszab.supabase.co/auth/v1',exp=Math.floor(Date.now()/1000)+3600}={})=>{
 const p={aal,sub,session_id,iss,exp,role:'authenticated',aud:'authenticated'};
 return Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify(p)).toString('base64url')+'.'+'x'.repeat(64);
};
const fetchOk=async()=>({ok:true,json:async()=>({id:userId,email_confirmed_at:'2026-11-14T13:56:09Z',is_anonymous:false})});
const base={tenantId,publishableKey:'sb_publishable_unit_test',fetchImpl:fetchOk};
test('Only a server-validated JWT may be classified, never a manually spoofed role flag',()=>{
 const token=jwt({aal:'aal2'}),a=sessionAssuranceFromVerifiedJwt(token,userId);
 assert.equal(a.ok,true);assert.equal(a.aal,'aal2');
 assert.equal(sessionAssuranceFromVerifiedJwt(jwt({sub:tenantId}),userId).ok,false);
 assert.equal(sessionAssuranceFromVerifiedJwt(jwt({iss:'https://other.supabase.co/auth/v1'}),userId).ok,false);
 assert.equal(sessionAssuranceFromVerifiedJwt(jwt({exp:1}),userId).ok,false);
});
test('Auth without MFA and enrollment can never open CEO G1 or G2',async()=>{
 const out=await inspectCeoReadiness({...base,token:jwt(),lookup:async()=>({session_valid:true,mfa_session_verified:false,enrollment_table_present:false})});
 assert.equal(out.httpStatus,200);assert.equal(out.body.identity_verified,true);
 assert.equal(out.body.mfa_aal2,false);assert.equal(out.body.enrollment_verified,false);
 assert.deepEqual([out.body.G1_enabled,out.body.G2_enabled],[false,false]);
 assert.ok(out.body.missing.includes('MFA_AAL2_REQUIRED'));
 assert.ok(out.body.missing.includes('CEO_ENROLLMENT_TABLE_NOT_MIGRATED'));
});
test('Even verified aal2 and trusted enrollment never enable approval before DB gates are reviewed',async()=>{
 const out=await inspectCeoReadiness({...base,token:jwt({aal:'aal2'}),lookup:async()=>({session_valid:true,mfa_session_verified:true,enrollment_table_present:true,
 enrollment_present:true,enrollment_user_id:userId,enrollment_tenant_id:tenantId,verified_by_admin:true,role:'CEO',enrollment_status:'ACTIVE'})});
 assert.equal(out.body.mfa_aal2,true);assert.equal(out.body.enrollment_verified,true);
 assert.equal(out.body.ceo_approval_enabled,false);assert.equal(out.body.G1_enabled,false);assert.equal(out.body.G2_enabled,false);
 assert.equal(out.body.ready_for_gates,false);
});
test('Forged CEO role, unknown or revoked session and wrong tenant are rejected',async()=>{
 const forgery=await inspectCeoReadiness({...base,token:jwt({aal:'aal2'}),lookup:async()=>({session_valid:true,mfa_session_verified:true,enrollment_table_present:true,
 enrollment_present:true,enrollment_user_id:userId,enrollment_tenant_id:tenantId,verified_by_admin:false,role:'CEO',enrollment_status:'ACTIVE'})});
 assert.equal(forgery.body.enrollment_verified,false);
 const revoked=await inspectCeoReadiness({...base,token:jwt(),lookup:async()=>({session_valid:false})});
 assert.equal(revoked.httpStatus,401);
 const wrong=await inspectCeoReadiness({...base,tenantId:'wrong',token:jwt(),lookup:async()=>({})});
 assert.equal(wrong.httpStatus,503);
});
test('Readiness endpoint cannot mutate DB, grant role or approve and remains exact preview only',()=>{
 const server=readFileSync(new URL('../netlify/functions/dd04-ceo-readiness.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../dd04-agent-control/ceo-login.html',import.meta.url),'utf8');
 const client=readFileSync(new URL('../dd04-agent-control/ceo-login.js',import.meta.url),'utf8');
 assert.match(server,/isStagingPreviewUrl\(request.url\)/);
 assert.match(server,/BEGIN READ ONLY/);
 assert.match(server,/FROM auth\.sessions/);
 assert.match(server,/FROM auth\.mfa_factors/);
 assert.match(server,/to_regclass\('dd04_stage.ceo_enrollments'\)/);
 assert.match(server,/SELECT tenant_id,user_id,role,status,verified_by_admin/);
 assert.doesNotMatch(server,/\b(?:INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE)\b(?!.*?READ ONLY)/);
 assert.match(html,/id="checkReadinessBtn"/);
 assert.match(client,/function checkCeoReadiness\(\)/);
 assert.match(client,/fetch\("\/api\/dd04-ceo-readiness"/);
 assert.match(client,/A07: đang khóa/);
});
