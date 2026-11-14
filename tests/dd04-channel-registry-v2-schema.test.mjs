import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../dd04-agent-control/supabase/15_CHANNEL_REGISTRY_V2_REVIEW_ONLY.sql',import.meta.url),'utf8');
const ui=readFileSync(new URL('../dd04-agent-control/channel-control.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../dd04-agent-control/channel-control.html',import.meta.url),'utf8');
test('V2 SQL is explicitly review-only, in existing private DD04 schema and keeps existing V2 tables',()=>{
 assert.match(sql,/REVIEW ONLY \| DO NOT EXECUTE UNTIL CEO APPROVAL/);
 assert.match(sql,/CREATE TABLE dd04_stage\.channels/);
 const tables=['channels','channel_profile_versions','channel_agent_assignments','channel_content_history','channel_task_context','channel_change_requests'];
 for(const t of tables){assert.match(sql,new RegExp('CREATE TABLE dd04_stage\\.'+t+'\\b'));assert.match(sql,new RegExp('ALTER TABLE dd04_stage\\.'+t+' ENABLE ROW LEVEL SECURITY'));}
 assert.doesNotMatch(sql,/CREATE TABLE public\.|DROP TABLE|TRUNCATE|DELETE FROM dd04_stage\.|ALTER TABLE dd04_stage\.(commands|tasks|approvals)\b/);
 assert.match(sql,/REVOKE ALL ON dd04_stage\.channels/);
 assert.match(sql,/FROM PUBLIC,anon,authenticated/);
 assert.doesNotMatch(sql,/CREATE POLICY .* TO authenticated|GRANT ALL TO anon|SECURITY DEFINER/);
});
test('V2 keeps immutable channel profile versions, tenant joins to existing tasks',()=>{
 assert.match(sql,/CREATE TRIGGER dd04_channel_profile_immutable BEFORE UPDATE OR DELETE/);
 assert.match(sql,/FOREIGN KEY\(tenant_id,command_id,task_id\) REFERENCES dd04_stage\.tasks/);
 assert.match(sql,/REFERENCES dd04_stage\.channel_profile_versions\(tenant_id,channel_id,profile_version,profile_sha256\)/);
 assert.match(sql,/current_version>=0/);
 assert.match(sql,/proposed_version>current_version/);
});
test('V2 UI accepts JSON only locally, rejects duplicates and tracks unverified staging origin',()=>{
 assert.match(html,/id="registryFile" accept="\.json,application\/json"/);
 assert.match(ui,/function validateImportedRegistry\(obj\)/);
 assert.match(ui,/CHANNEL_ID_DUPLICATE_OR_INVALID/);
 assert.match(ui,/LOCAL_JSON_UNVERIFIED_NOT_APPROVED/);
 assert.match(ui,/file\.size>2\*1024\*1024/);
 assert.doesNotMatch(ui,/\bfetch\(|localStorage|sessionStorage/);
});
