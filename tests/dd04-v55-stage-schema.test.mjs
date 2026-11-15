import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../dd04-agent-control/supabase/24_V5_5_COMMAND_MEDIA_FINANCE_HANDOFF_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('V5.5 migration proposal remains review-only and locked, all 5 tables RLS protected',()=>{
 for(const name of ['v55_command_media','v55_finance_policies','v55_finance_cases','v55_agent_handoff_events','v55_publish_jobs']){
  assert.match(sql,new RegExp('CREATE TABLE dd04_stage\\.'+name));
  assert.match(sql,new RegExp('ALTER TABLE dd04_stage\\.'+name+' ENABLE ROW LEVEL SECURITY'));
  assert.match(sql,new RegExp('REVOKE ALL ON dd04_stage\\.'+name+' FROM PUBLIC,anon,authenticated'));
  assert.match(sql,new RegExp('BEFORE UPDATE OR DELETE ON dd04_stage\\.'+name));
 }
 assert.match(sql,/CHECK\(status='PROPOSED'\)/);
 assert.match(sql,/CHECK\(status='WAITING_CEO'\)/);
 assert.match(sql,/CHECK\(verdict='PENDING'\)/);
 assert.match(sql,/CHECK\(status='BLOCKED'\)/);
 assert.doesNotMatch(sql,/\b(?:DROP TABLE|TRUNCATE|DISABLE TRIGGER|GRANT INSERT|GRANT UPDATE|CREATE POLICY)\b/i);
 assert.doesNotMatch(sql,/\b(?:INSERT INTO dd04_stage|UPDATE dd04_stage|DELETE FROM dd04_stage)\b/i);
});
