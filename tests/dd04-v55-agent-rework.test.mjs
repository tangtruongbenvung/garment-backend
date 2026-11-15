import test from 'node:test';import assert from 'node:assert/strict';
import {createAgentWorkflow,simulateAgentStep} from '../dd04-agent-control/v55-agent-rework-simulator.mjs';
const base={command_id:'cmd_ad8d209b8d5a73044753',channel_id:'FB001',content_id:'BIN_TEST_001',
 source_sha256:'a'.repeat(64)};
const b='b'.repeat(64),c='c'.repeat(64),report='d'.repeat(64);
test('A03 draft → A08 review → A09 PASS → A07 platform permission review (no publish)',()=>{
 const initial=createAgentWorkflow(base);assert.equal(initial.ok,true);
 const drafted=simulateAgentStep(initial.workflow,{agent_id:'A03',action:'SUBMIT_DRAFT',output_sha256:b});
 const qc08=simulateAgentStep(drafted.workflow,{agent_id:'A08',action:'PASS',output_sha256:b,review_sha256:report});
 const qc09=simulateAgentStep(qc08.workflow,{agent_id:'A09',action:'PASS',output_sha256:b,review_sha256:report});
 assert.equal(qc09.ok,true);assert.equal(qc09.workflow.current_agent,'A07');
 assert.equal(qc09.workflow.stage,'READY_FOR_PLATFORM_PERMISSION_REVIEW');
 assert.equal(qc09.published,false);assert.equal(qc09.live_worker,false);
 assert.equal(qc09.workflow.events.length,3);
});
test('A08 REWORK → A03 revises → two QC passes required again',()=>{
 let w=createAgentWorkflow(base).workflow;
 w=simulateAgentStep(w,{agent_id:'A03',action:'SUBMIT_DRAFT',output_sha256:b}).workflow;
 w=simulateAgentStep(w,{agent_id:'A08',action:'REWORK',output_sha256:b}).workflow;
 assert.equal(w.stage,'REWORK');
 const revised=simulateAgentStep(w,{agent_id:'A03',action:'REVISE',output_sha256:c});
 assert.equal(revised.workflow.revision,2);
 assert.deepEqual(revised.workflow.review,{A08:'PENDING',A09:'PENDING'});
 assert.equal(revised.workflow.output_sha256,c);
 assert.equal(simulateAgentStep(revised.workflow,{agent_id:'A09',action:'PASS',output_sha256:b,review_sha256:report}).ok,false);
});
test('A07 cannot impersonate QC or publish, stale hash and repeated PASS denied',()=>{
 let w=createAgentWorkflow(base).workflow;
 assert.equal(simulateAgentStep(w,{agent_id:'A07',action:'PUBLISH',output_sha256:b}).ok,false);
 w=simulateAgentStep(w,{agent_id:'A03',action:'SUBMIT_DRAFT',output_sha256:b}).workflow;
 assert.equal(simulateAgentStep(w,{agent_id:'A08',action:'PASS',output_sha256:c,review_sha256:report}).ok,false);
 w=simulateAgentStep(w,{agent_id:'A08',action:'PASS',output_sha256:b,review_sha256:report}).workflow;
 assert.equal(simulateAgentStep(w,{agent_id:'A08',action:'PASS',output_sha256:b,review_sha256:report}).reason,'DUPLICATE_REVIEW');
});
