import test from 'node:test';import assert from 'node:assert/strict';
import {createDemoChannels} from '../dd04-agent-control/channel-context-core.mjs';
import {previewRegistry,previewAssignment,previewCampaignTasks,previewProfileChange} from '../dd04-agent-control/channel-registry-v2.mjs';
const input=n=>({channels:createDemoChannels(n)});
test('V2 registry count, platform breakdown, guarded unsigned profiles and 300 capacity',()=>{
 for(const n of [1,5,20,300]){
  const x=previewRegistry(input(n));
  assert.equal(x.channel_count,n);assert.equal(x.channels.length,n);
  assert.equal(x.count_by_platform.FANPAGE+x.count_by_platform.TIKTOK,n);
  assert.equal(x.writing_enabled,false);assert.equal(x.publishing_allowed,false);
  assert.equal(new Set(x.channels.map(c=>c.profile_sha256)).size,n);
 }
});
test('Each of five channel tasks belongs to exactly its channel, with matching frozen profile',()=>{
 const p=input(5),out=previewCampaignTasks(p,'DD04-V2-TEST');
 assert.equal(out.task_count,5);
 assert.equal(new Set(out.tasks.map(t=>t.channel_id)).size,5);
 assert.equal(new Set(out.tasks.map(t=>t.profile_sha256)).size,5);
 for(const task of out.tasks){assert.equal(task.receiver_agent,'A03');assert.equal(task.status,'PLANNED_WAIT_G1');assert.equal(task.execution_allowed,false);}
});
test('Cross-channel, invalid assignments, and hidden profile edits fail closed',()=>{
 const p=input(2);
 assert.throws(()=>previewAssignment(p,'NOPE','A03'),/CHANNEL_NOT_FOUND/);
 assert.throws(()=>previewAssignment(p,p.channels[0].channel_id,'BAD'),/AGENT_NOT_ASSIGNED/);
 const duplicate=input(2);duplicate.channels[1].channel_id=duplicate.channels[0].channel_id;
 assert.throws(()=>previewRegistry(duplicate),/DUPLICATE_CHANNEL_ID/);
 assert.throws(()=>previewProfileChange(p,p.channels[0].channel_id,{approved_by:'fake'}),/PROFILE_CHANGE_UNAUTHORIZED_FIELD/);
});
test('A02 proposed channel revision preserves original and cannot self-approve',()=>{
 const p=input(1),old=p.channels[0],x=previewProfileChange(p,old.channel_id,{tone:'Vui vẻ nhưng thong thả, không hô hào'});
 assert.equal(x.from_version,1);assert.equal(x.to_version,2);
 assert.notEqual(x.from_sha256,x.to_sha256);
 assert.equal(old.version,1);assert.equal(x.status,'WAITING_CEO_G1');assert.equal(x.effective,false);
 assert.equal(x.publish_allowed,false);
});
