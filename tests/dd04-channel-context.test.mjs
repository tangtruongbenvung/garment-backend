import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoChannels,snapshotChannel,makeAgentHandoff,inspectDeliverable} from '../dd04-agent-control/channel-context-core.mjs';
test('registry scales demo from 20 to 300 while channel profiles remain distinct',()=>{
 const channels=createDemoChannels(300);
 assert.equal(channels.length,300);
 assert.equal(new Set(channels.map(x=>x.channel_id)).size,300);
 assert.equal(channels.filter(c=>c.platform==='FANPAGE').length,150);
 assert.equal(channels.filter(c=>c.platform==='TIKTOK').length,150);
 assert.equal(createDemoChannels(20).length,20);
 assert.ok(channels.every(c=>snapshotChannel(c).profile_sha256.length===64));
});
test('profile identity and version frozen in per-agent handoff',()=>{
 const [profile,other]=createDemoChannels(2);
 const a=snapshotChannel(profile);
 const task={campaign_id:'CMP-001',task_id:'TASK-001',channel_id:profile.channel_id,
 agent_id:'A03',objective:'Viet kich ban theo dung kenh',profile_version:1,profile_sha256:a.profile_sha256};
 const work=makeAgentHandoff(profile,task);
 assert.equal(work.channel_context.content_pillars,profile.content_pillars);
 assert.equal(work.receiver_agent,'A03');
 assert.equal(work.execution_allowed,false);
 assert.equal(work.approvals.G1,'PENDING');
 assert.deepEqual(work.requires_review,['A08','A09']);
 assert.throws(()=>makeAgentHandoff(other,task),/CHANNEL_CONTEXT_MISMATCH/);
 assert.throws(()=>makeAgentHandoff(profile,{...task,profile_version:2}),/CHANNEL_CONTEXT_MISMATCH/);
 assert.throws(()=>makeAgentHandoff(profile,{...task,profile_sha256:'0'.repeat(64)}),/CHANNEL_CONTEXT_MISMATCH/);
 assert.deepEqual(inspectDeliverable(work,{channel_id:profile.channel_id,producer_agent:'A03',profile_sha256:a.profile_sha256,profile_version:1}),{ok:true,reason:'CONTEXT_MATCH_ONLY_NOT_QC_PASS',publish_allowed:false});
 assert.equal(inspectDeliverable(work,{channel_id:other.channel_id,producer_agent:'A03',profile_sha256:a.profile_sha256,profile_version:1}).reason,'CHANNEL_CONTEXT_CHANGED');
});
test('requires full channel identity before issuing agent task',()=>{
 const p=createDemoChannels(1)[0];
 assert.throws(()=>snapshotChannel({...p,positioning:''}),/CHANNEL_BRIEF_INCOMPLETE/);
 assert.throws(()=>snapshotChannel({...p,assigned_agents:['A03']}),/AGENT_TEAM_INCOMPLETE/);
 const s=snapshotChannel(p);
 const task={campaign_id:'CMP-001',task_id:'TASK-001',channel_id:p.channel_id,agent_id:'A03',objective:'Create draft',profile_version:1,profile_sha256:s.profile_sha256};
 assert.throws(()=>makeAgentHandoff(p,{...task,agent_id:'A15'}),/AGENT_NOT_ASSIGNED_TO_CHANNEL/);
});
