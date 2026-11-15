import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../dd04-agent-control/supabase/22_V5_4_CONTENT_EVIDENCE_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('V5.4 review-only schema binds per-channel revision and audit; never unlocks G2 or production',()=>{
 for(const t of ['v54_internal_policies','v54_internal_g1_evidence','v54_publish_packets','v54_agent_qc_events','v54_ceo_publish_decisions']){
  assert.match(sql,new RegExp('CREATE TABLE dd04_stage\\.'+t));
  assert.match(sql,new RegExp('ALTER TABLE dd04_stage\\.'+t+' ENABLE ROW LEVEL SECURITY'));
  assert.match(sql,new RegExp('REVOKE ALL ON dd04_stage\\.'+t+' FROM PUBLIC,anon,authenticated'));
 }
 assert.match(sql,/PRIMARY KEY\(tenant_id,content_id,channel_id,revision\)/);
 assert.match(sql,/CHECK \(status='PROPOSED'\)/);
 assert.match(sql,/CHECK \(result='PENDING'\)/);
 assert.match(sql,/CHECK \(packet_state='PREVIEW'\)/);
 assert.match(sql,/CHECK\(decision='PENDING' AND ceo_user_id IS NULL/);
 assert.match(sql,/BEFORE UPDATE OR DELETE ON dd04_stage.v54_ceo_publish_decisions/);
 assert.doesNotMatch(sql,/\b(?:DROP TABLE|TRUNCATE|ALTER TABLE dd04_stage\.approvals|DISABLE TRIGGER|CREATE POLICY|GRANT INSERT|GRANT UPDATE)\b/i);
 assert.doesNotMatch(sql,/\b(?:INSERT INTO dd04_stage|UPDATE dd04_stage|DELETE FROM dd04_stage)\b/i);
});
