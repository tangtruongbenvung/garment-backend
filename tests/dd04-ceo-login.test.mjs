import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const dir=new URL('../dd04-agent-control/',import.meta.url);
const page=readFileSync(new URL('ceo-login.html',dir),'utf8');
const js=readFileSync(new URL('ceo-login.js',dir),'utf8');
test('CEO page isolated to staging and never grants database roles or enables approval',()=>{
 assert.match(page,/noindex,nofollow/);
 assert.match(page,/connect-src https:\/\/wbvkqfnrlasmtizjszab\.supabase\.co/);
 assert.match(js,/EXPECTED_HOST="deploy-preview-1--ducduy-ai-os-test\.netlify\.app"/);
 assert.match(js,/const CALLBACK="https:\/\/deploy-preview-1--ducduy-ai-os-test\.netlify\.app\/dd04-agent-control\/ceo-login\.html"/);
 assert.doesNotMatch(js,/service_role|sb_secret_/);
 assert.doesNotMatch(js,/localStorage|document\.cookie|sessionStorage/);
 assert.doesNotMatch(js,/dd04_stage\.approvals|update\s+dd04_stage/);
});
test('Hash token is removed from address before remote requests or rendering',()=>{
 const from=js.indexOf('function parseCallback()');
 const start=js.indexOf('const hash=location.hash;',from);
 const clear=js.indexOf('history.replaceState(null,"",location.pathname+location.search);',from);
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
 assert.match(js,/Chưa có phân quyền CEO hoặc G1\/G2/);
});
