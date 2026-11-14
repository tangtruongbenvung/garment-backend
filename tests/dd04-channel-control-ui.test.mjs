import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../dd04-agent-control/channel-control.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../dd04-agent-control/channel-control.js',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../dd04-agent-control/index.html',import.meta.url),'utf8');
test('Channel-first UI has search, pagination, platform filters, four dedicated management views',()=>{
 for(const x of ['fbList','ttList','search','pagesize','demoCount','details','strategy','agents','tasks','history'])assert.match(html,new RegExp(x));
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

test('Top-of-page directory presents independent Fanpage and TikTok columns above detail views',()=>{
 for(const id of ['fbList','ttList','fbPrev','fbNext','ttPrev','ttNext','fbPage','ttPage','fbListCount','ttListCount','search','pagesize','demoCount','registryFile'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/class="channel-columns"/);
 assert.match(html,/class="platform-panel facebook-panel"/);
 assert.match(html,/class="platform-panel tiktok-panel"/);
 assert.ok(html.indexOf('class="channel-columns"')<html.indexOf('class="right channel-details"'));
 assert.ok(html.indexOf('class="channel-columns"')<html.indexOf('class="stats"'));
 assert.match(js,/for\(const platform of \["FANPAGE","TIKTOK"\]\)/);
 assert.match(js,/pages=\{FANPAGE:0,TIKTOK:0\}/);
 assert.match(js,/\$\(key\+"List"\)/);
 assert.match(js,/pages\[platform\]\*size/);
 assert.match(js,/\$\(prefix\+"Prev"\)/);
 assert.match(js,/\$\(prefix\+"Next"\)/);
 assert.match(js,/scrollIntoView/);
 assert.doesNotMatch(js,/\bfetch\(|localStorage|sessionStorage/);
});

test('Selected channel details separate strategy, creative guide, guardrails and grouped agent ownership',()=>{
 assert.match(html,/id="channelDetailsTitle"/);
 assert.match(js,/function infoSection\(title,note,items\)/);
 assert.match(js,/Định vị & khán giả/);
 assert.match(js,/Nhân vật & phong cách/);
 assert.match(js,/Nguyên tắc & giới hạn/);
 assert.match(js,/Điều phối & chiến lược/);
 assert.match(js,/Sản xuất nội dung/);
 assert.match(js,/Quản lý & kiểm duyệt/);
 assert.match(js,/Hiệu quả & cộng đồng/);
 assert.match(js,/task-state/);
 assert.match(html,/class="panel workflow-details"/);
});
