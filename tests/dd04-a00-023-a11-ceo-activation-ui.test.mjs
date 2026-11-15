import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../dd04-agent-control/ceo-login.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../dd04-agent-control/ceo-login.html',import.meta.url),'utf8');
test('A11 v1 activation stays CEO-only: active session and AAL2 required',()=>{
 for(const guard of ['currentReadiness?.identity_verified!==true',
   'currentReadiness?.enrollment_verified!==true',
   'currentReadiness?.mfa_aal2!==true','window.confirm(',
   'p_expected_hash','p_decision:"ACTIVE"','Content-Profile'])
  assert.ok(js.includes(guard),guard);
 assert.ok(js.includes('bind("activateA11V1Btn",activateA11ZeroV1)'));
 assert.ok(html.includes('id="activateA11V1Btn"'));
});
test('A11 approval UX cannot change policy caps, API spend or production',()=>{
 assert.ok(js.includes('0c42f63e-6484-4519-8811-7c66b8e9d852'));
 assert.ok(js.includes('8f206452d6338b282b59b6aa368747157de52dca4349946b874a201b8de25e94'));
 assert.ok(js.includes('"/rest/v1/rpc/a00_022_ceo_policy_decision"'));
 assert.ok(js.includes('PUBLISHABLE_KEY'));
 assert.ok(!js.includes('SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(!js.includes('p_decision:"APPROVED"'));
 assert.ok(html.includes('0 đồng/lần'));
 assert.ok(html.includes('0 đồng/chiến dịch'));
});
