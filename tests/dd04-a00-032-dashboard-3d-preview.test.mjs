import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../dd04-agent-control/',import.meta.url);
const html=readFileSync(new URL('dashboard-3d-preview.html',root),'utf8');
const css=readFileSync(new URL('dashboard-3d-preview.css',root),'utf8');
const js=readFileSync(new URL('dashboard-3d-preview.js',root),'utf8');
test('A00-032 has 18 Agent inspector controls and no fabricated live metrics',()=>{
 assert.match(html,/<html lang="vi">/);
 assert.ok(html.includes('CHẾ ĐỘ MINH HỌA'));
 assert.ok(html.includes('id="agentGrid"'));
 assert.equal((js.match(/\['A\d\d'/g)||[]).length,18);
 assert.ok(html.includes('Chưa kết nối xác thực'));
 assert.ok(html.includes('CEO G2'));
 assert.ok(!js.includes('Math.random'));
});
test('3D UI only selects local Agent roles, no backend, publishing or spending',()=>{
 assert.ok(css.includes('perspective:700px'));
 assert.ok(css.includes('transform-style:preserve-3d'));
 assert.ok(css.includes('prefers-reduced-motion'));
 assert.ok(html.includes("connect-src 'none'"));
 assert.ok(!/\bfetch\s*\(/.test(js));
 assert.ok(!/\.supabase\.co|service_role|publish_jobs/.test(js));
 assert.ok(!/src="https?:\/\//.test(html));
 assert.ok(html.includes('script type="module" src="./dashboard-3d-preview.js"'));
});
