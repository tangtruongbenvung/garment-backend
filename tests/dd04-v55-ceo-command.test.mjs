import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeCeoCommandDraft,validateCeoSessionRecord} from '../dd04-agent-control/v55-ceo-command-core.mjs';
const UUID='b11f7154-5f5d-4b55-a497-90e8adf2525e';
const TENANT='6bc73b49-a396-4c7d-b390-ab6339d547cd';
const raw={request_id:'ceo_12345678-1234-4234-9234-123456789abc',message_text:'A00 hãy phân công xây video hoạt hình mẹ bé cho năm kênh'};
test('CEO command produces deterministic idempotency and auditable pre-G1 task drafts',()=>{
 const first=makeCeoCommandDraft(raw),second=makeCeoCommandDraft(raw);
 assert.equal(first.ok,true);assert.deepEqual(first,second);
 assert.match(first.command_id,/^cmd_[a-f0-9]{20}$/);
 assert.match(first.input_sha256,/^[a-f0-9]{64}$/);
 assert.equal(first.source,'CEO_STAGING_WEB');
 assert.equal(first.status,'WAITING_CEO_PLAN');
 assert.ok(first.taskGraph.some(t=>t.owner_agent==='A08'));
 assert.ok(first.taskGraph.every(t=>t.status==='PLANNED_WAIT_G1'));
 assert.equal(first.auto_approval_enabled,false);
 assert.equal(first.agent_execution_enabled,false);
});
test('malformed, changed and media pseudo-uploads are rejected rather than stored',()=>{
 assert.equal(makeCeoCommandDraft({...raw,message_text:'short'}).ok,false);
 assert.equal(makeCeoCommandDraft({...raw,request_id:'x'}).ok,false);
 assert.equal(makeCeoCommandDraft({...raw,media_refs:['https://secret.example/token']}).error,'ATTACHMENT_STORAGE_NOT_ENABLED');
 assert.notEqual(makeCeoCommandDraft({...raw,message_text:raw.message_text+' mới'}).input_sha256,makeCeoCommandDraft(raw).input_sha256);
});
test('MFA AAL2 and database verified CEO are mandatory',()=>{
 const ok={userId:UUID,tenantId:TENANT,claims:{aal:'aal2',session_id:UUID},
  verified:{session_valid:true,ceo_valid:true}};
 assert.equal(validateCeoSessionRecord(ok).ok,true);
 assert.equal(validateCeoSessionRecord({...ok,claims:{aal:'aal1',session_id:UUID}}).ok,false);
 assert.equal(validateCeoSessionRecord({...ok,verified:{session_valid:true,ceo_valid:false}}).ok,false);
 assert.equal(validateCeoSessionRecord({...ok,verified:{session_valid:false,ceo_valid:true}}).ok,false);
});
test('staging endpoint authenticates CEO and submits only atomic legacy draft; no G1/G2 approval or publish',()=>{
 const fn=readFileSync(new URL('../netlify/functions/dd04-ceo-command.mjs',import.meta.url),'utf8');
 const js=readFileSync(new URL('../dd04-agent-control/ceo-login.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../dd04-agent-control/ceo-login.html',import.meta.url),'utf8');
 assert.match(fn,/isStagingPreviewUrl\(request.url\)/);
 assert.match(fn,/verifyAuthUser\(/);
 assert.match(fn,/claims\.aal!=='aal2'/);
 assert.match(fn,/dd04_stage\.ceo_enrollments/);
 assert.match(fn,/FROM auth\.sessions s/);
 assert.match(fn,/ON CONFLICT\(tenant_id,source,external_id\) DO NOTHING/);
 assert.match(fn,/await client\.query\('BEGIN'\)/);
 assert.match(fn,/await client\.query\('ROLLBACK'\)/);
 assert.match(fn,/dd04_stage\.task_events/);
 assert.match(fn,/CEO_COMMAND_RECEIVED/);
 assert.match(fn,/\b'G1',1,/);
 assert.match(fn,/autonomous_execution:false,publishing_enabled:false/);
 assert.doesNotMatch(fn,/\b(?:UPDATE dd04_stage\.approvals|decision='APPROVED'|DISABLE TRIGGER|PUBLISHED)\b/);
 assert.match(html,/id="ceoSubmitCommandBtn"/);
 assert.match(html,/id="ceoCommandText"/);
 assert.match(js,/fetch\("\/api\/dd04-ceo-command"/);
 assert.match(js,/currentReadiness\?\.mfa_aal2!==true/);
});
