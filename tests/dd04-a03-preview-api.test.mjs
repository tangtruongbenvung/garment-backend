import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const server=readFileSync(new URL('../netlify/functions/dd04-a00.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../dd04-agent-control/a03-preview.html',import.meta.url),'utf8');
const client=readFileSync(new URL('../dd04-agent-control/a03-preview.js',import.meta.url),'utf8');
test('A03 API remains authenticated and read-only preview before persistent repository',()=>{
 const auth=server.indexOf("if(!equal(bearer,secret))");
 const preview=server.indexOf("pathname.endsWith('/a03-preview')");
 const db=server.indexOf("let repository;");
 assert.ok(auth>0&&auth<preview);
 assert.ok(preview>0&&preview<db,'preview must not read/write Supabase');
 assert.match(server,/const draft=planScripts\(JSON\.parse\(raw\)\)/);
 assert.match(server,/real_llm_execution:false/); // health reports no running LLM
 assert.match(server,/\/api\/dd04-a00\/a03-preview'/);
});
test('A03 UI sends explicit channel list and no CEO approvals',()=>{
 assert.match(html,/id="count" type="number" min="1" max="20" value="5"/);
 assert.match(html,/Chưa sử dụng LLM|chưa sử dụng LLM|chưa sử dụng LLM/i);
 assert.match(client,/data\.script_count!==channels\.length/);
 assert.match(client,/authorization:"Bearer "\+token/);
 assert.match(client,/download="DD04_A03_|a\.download="DD04_A03_/);
 assert.doesNotMatch(client,/localStorage|sessionStorage|service_role|fetch\(["']https:\/\/(?:\w+\.)?supabase/);
});
