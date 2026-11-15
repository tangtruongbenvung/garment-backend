import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const api=read('../netlify/functions/dd04-ceo-agent-worklist.mjs');
const js=read('../dd04-agent-control/ceo-login.js');
const html=read('../dd04-agent-control/ceo-login.html');
test('worklist on private staging requires verified CEO Auth and real database session',()=>{
 assert.match(api,/isStagingPreviewUrl\(request.url\)/);
 assert.match(api,/verifyAuthUser\(/);
 assert.match(api,/sessionAssuranceFromVerifiedJwt\(/);
 assert.match(api,/FROM auth\.sessions s/);
 assert.match(api,/dd04_stage\.ceo_enrollments/);
 assert.match(api,/status='ACTIVE'/);
 assert.match(api,/BEGIN READ ONLY/);
 assert.match(api,/WHERE t\.tenant_id=\$1::uuid/);
 assert.match(api,/buildAgentWorklist\(tasks\.rows\)/);
 assert.match(api,/autonomous_approval_enabled:false,publishing_enabled:false/);
 assert.doesNotMatch(api,/\b(?:INSERT INTO|UPDATE dd04_stage|DELETE FROM|DISABLE TRIGGER)\b/i);
});
test('CEO sees filterable actual worklist, no claims of live agent execution',()=>{
 for(const id of ['loadAgentWorklistBtn','worklistAgentFilter','worklistStatusFilter','worklistBody','worklistSummary']){
  assert.ok(html.includes('id="'+id+'"'));
 }
 assert.match(js,/fetch\("\/api\/dd04-ceo-agent-worklist"/);
 assert.match(js,/worklistRows\.filter\(/);
 assert.match(js,/Chưa xác nhận Agent LLM vận hành hay tự phê duyệt/);
 assert.match(js,/\$\("gateReviewPanel"\)\.hidden=true/);
});
