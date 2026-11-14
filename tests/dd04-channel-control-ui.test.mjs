import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dd04-agent-control/channel-control.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../dd04-agent-control/channel-control.js',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../dd04-agent-control/index.html',import.meta.url),'utf8');
test('Channel-first UI has search, pagination, platform filters, four dedicated management views',()=>{
 for(const x of ['channelList','search','platform','pagesize','demoCount','details','strategy','agents','tasks','history'])assert.match(html,new RegExp(x));
 assert.match(dashboard,/href="\.\/channel-control\.html"/);
 assert.match(js,/function renderStrategy\(c\)/);
 assert.match(js,/function renderAgents\(c\)/);
 assert.match(js,/function renderTasks\(c\)/);
 assert.match(js,/function renderHistory\(c\)/);
 assert.match(js,/const deps=/);
});
test('The demo UI does not write/read Supabase or hold approval credentials',()=>{
 assert.match(html,/connect-src 'none'/);
 assert.match(js,/DEMO_NOT_APPROVED|DRAFT_DEMO_NOT_APPROVED/);
 assert.match(js,/BLOCKED_G2/);
 assert.doesNotMatch(js,/\bfetch\(|localStorage|sessionStorage|service_role|sb_secret_/);
});

test('Channel strategy can be revised only as unapproved local draft',()=>{
 assert.match(js,/function editProfile\(c\)/);
 assert.match(js,/c\.version\+\+/);
 assert.match(js,/DRAFT_CHANGED_REVIEW_REQUIRED/);
 assert.match(js,/function exportProfiles\(list\)/);
 assert.match(js,/BROWSER_STAGING_DRAFT_NOT_APPROVED/);
 assert.match(js,/URL\.createObjectURL\(blob\)/);
 assert.doesNotMatch(js,/\bfetch\(|localStorage|sessionStorage/);
});
