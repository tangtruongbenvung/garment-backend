import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../dd04-agent-control/supabase/30_A00_026_REFERENCE_MEDIA_REGISTRY_STAGING_REVIEW_ONLY_DO_NOT_RUN.sql',import.meta.url),'utf8');
test('unapproved A00-026 proposal is atomic private RLS metadata only',()=>{
 assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
 assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);
 for(const table of ['a00_026_identity_versions','a00_026_reference_assets','a00_026_scene_image_assets','a00_026_qc_evidence']){
  assert.ok(sql.includes('CREATE TABLE dd04_stage.'+table+'('),table);
  assert.ok(sql.includes('ALTER TABLE dd04_stage.'+table+' ENABLE ROW LEVEL SECURITY;'),table);
 }
 assert.ok(sql.includes('a00_026_guard_immutable'));
 assert.ok(sql.includes('FROM PUBLIC,anon,authenticated,service_role,dd04_a00_runtime'));
});
test('unapproved SQL never inserts, activates worker, G1/G2, or opens paid media',()=>{
 const bad=['INSERT INTO dd04_stage','GRANT INSERT','DISABLE TRIGGER','UPDATE dd04_stage.approvals',
  'CREATE POLICY','v55_publish_jobs','CREATE BUCKET','ALTER TABLE dd04_stage.tasks'];
 for(const x of bad)assert.ok(!sql.includes(x),x);
 assert.ok(sql.includes('CHECK(storage_bytes_verified=false)'));
 assert.ok(sql.includes("CHECK(visual_qc='PENDING')"));
});
