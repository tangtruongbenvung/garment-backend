import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dir=new URL('../dd04-agent-control/',import.meta.url);
const page=readFileSync(new URL('ceo-login.html',dir),'utf8');
const js=readFileSync(new URL('ceo-login.js',dir),'utf8');
test('CEO page isolated to staging and never grants database roles or enables approval',()=>{
 assert.match(page,/noindex,nofollow/);
 assert.match(page,/connect-src 'self' https:\/\/wbvkqfnrlasmtizjszab\.supabase\.co/);
 assert.match(js,/EXPECTED_HOST="deploy-preview-1--ducduy-ai-os-test\.netlify\.app"/);
 assert.match(js,/const CALLBACK="https:\/\/deploy-preview-1--ducduy-ai-os-test\.netlify\.app\/dd04-agent-control\/ceo-login\.html"/);
 assert.doesNotMatch(js,/const\s+\w+\s*=\s*["\x27](?:sb_secret_|eyJ[^"\x27]*service_role)/);
 assert.doesNotMatch(js,/localStorage|document\.cookie|sessionStorage/);
 assert.doesNotMatch(js,/dd04_stage\.approvals|update\s+dd04_stage/);
});
test('Hash token is removed from address before remote requests or rendering',()=>{
 const from=js.indexOf('function parseCallback()');
 const start=js.indexOf('const hash=location.hash;',from);
 const clear=js.indexOf('history.replaceState(null,"",location.pathname);',from);
 const token=js.indexOf('p.get("access_token")',from);
 assert.ok(from>=0&&start>from&&clear>start&&token>clear);
 assert.match(js,/window\.addEventListener\("pagehide",/);
});
test('Supabase Auth email flow cannot create users and requires password or magic link',()=>{
 assert.match(js,/create_user:false/);
 assert.match(js,/\/token\?grant_type=password/);
 assert.match(js,/\/auth\/v1/);
 assert.match(js,/\/user",{authorized:true}/);
});
test('TOTP challenge and verify must complete before MFA success feedback',()=>{
 assert.match(js,/factor_type:"totp"/);
 assert.match(js,/\/challenge/);
 assert.match(js,/\/verify/);
 assert.match(js,/if\(!data\?\.access_token\)throw/);
 assert.match(js,/Đã xác minh MFA với Supabase/);
 assert.match(js,/await checkCeoReadiness\(\)/);
});

test('first-time password uses recovery email and cannot update without verified recovery session',()=>{
 assert.match(page,/id="passwordRecoveryPanel" hidden/);
 assert.match(page,/id="newPassword" type="password"/);
 assert.match(page,/id="confirmPassword" type="password"/);
 assert.match(js,/\/recover\?redirect_to=/);
 assert.match(js,/recoveryMode=p.get\("type"\)==="recovery"/);
 assert.match(js,/if\(!recoveryMode\|\|!accessToken\)/);
 assert.match(js,/await auth\("\/user",\{method:"PUT",authorized:true,body:\{password\}\}\)/);
 assert.match(js,/password!==confirm/);
 assert.match(js,/function strongPassword\(password\)/);
 assert.match(js,/logout\(\);\s*message\("Đã cập nhật mật khẩu/);
 assert.doesNotMatch(js,/console\.log\(password\)|localStorage|service_role\s*=/);
});

test('recovery callback supports token_hash, scrubs URL, never logs tokens',()=>{
 assert.match(js,/const query=location.search/);
 assert.match(js,/history.replaceState\(null,"",location.pathname\)/);
 assert.match(js,/q.get\("token_hash"\)/);
 assert.match(js,/await auth\("\/verify",\{method:"POST",body:\{type:"recovery",token_hash:q.get\("token_hash"\)\}\}\)/);
 assert.match(js,/if\(q.has\("code"\)\)/);
 assert.doesNotMatch(js,/console\.log\(.*(?:accessToken|refreshToken|token_hash)/);
});

test('callback diagnostics expose only fixed labels, never secret values',()=>{
 assert.match(page,/id="callbackDiagnostics"/);
 assert.match(js,/diagnostic\("BEARER_SESSION_RECEIVED"\)/);
 assert.match(js,/diagnostic\("RECOVERY_TOKEN_HASH_RECEIVED"\)/);
 assert.match(js,/diagnostic\("PKCE_CODE_UNSUPPORTED"\)/);
 assert.match(js,/diagnostic\("DIRECT_PAGE_NO_AUTH"\)/);
 assert.match(js,/diagnostic\(\(hash\?"FRAGMENT":"QUERY"\)\+"_WITHOUT_AUTH_FIELDS"\)/);
 assert.match(js,/\$\("callbackDiagnostics"\)\.textContent="Chẩn đoán callback: "\+code/);
 assert.doesNotMatch(js,/callbackDiagnostics"\)\.textContent.*(?:accessToken|refreshToken|token_hash)/);
});

test('MFA factor listing uses verified Auth user factors (not unsupported GET factors endpoint)',()=>{
 assert.match(js,/const data=await auth\("\/user",\{authorized:true\}\)/);
 assert.match(js,/Array\.isArray\(data\?\.factors\)\?data\.factors:\[\]/);
 assert.doesNotMatch(js,/auth\("\/factors",\{authorized:true\}\)/);
 assert.match(page,/id="checkReadinessBtn"/);
 assert.match(js,/bind\("checkReadinessBtn",checkCeoReadiness\)/);
});

test('CEO Auth and MFA status uses server-provided enrollment, not obsolete hard-coded denial',()=>{
 assert.match(page,/id="sessionGuidance"/);
 assert.match(page,/id="authState"/);
 assert.match(page,/id="ceoState"/);
 assert.match(page,/id="mfaState"/);
 assert.match(page,/id="gateState"/);
 assert.match(page,/id="mfaHelp"/);
 assert.match(page,/id="gateReviewPanel" hidden/);
 assert.doesNotMatch(page,/Chưa có quyền CEO và chưa thể duyệt G1\/G2/);
 assert.match(js,/result\.enrollment_verified\?"CEO ACTIVE"/);
 assert.match(js,/result\.mfa_aal2\?"AAL2 đạt"/);
 assert.match(js,/\$\("gateReviewPanel"\)\.hidden=true;/);
 assert.match(js,/if\(!accessToken\|\|currentReadiness\?\.mfa_aal2!==true/);
 assert.match(js,/await loadFactors\(\);\s*await checkCeoReadiness\(\);/);
 assert.match(js,/message\("Đã xác minh MFA với Supabase/);
 assert.match(js,/resetReadiness\(\)/);
 assert.doesNotMatch(js,/Chưa có phân quyền CEO hoặc G1\/G2/);
});
