import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCommand } from '../dd04-agent-control/runtime-core.mjs';
import { normalizeLegacyA00,checkEventTransition } from '../dd04-agent-control/persistence-contract.mjs';
const cmd=()=>makeCommand({external_id:'audit-0001',message_text:'Sản xuất kịch bản video hoạt hình mẹ bé'});
test('A00 legacy record converts to 7 planned tasks, G1 pending, no mutation',()=>{
 const old=cmd(),raw=JSON.stringify(old),normalized=normalizeLegacyA00(old);
 assert.equal(normalized.command.status,'WAITING_CEO_PLAN');
 assert.equal(normalized.tasks.length,7);
 assert.equal(normalized.approvals[0].decision,'PENDING');
 assert.equal(normalized.events[0].event_name,'COMMAND_ACCEPTED');
 assert.equal(normalized.migration_status,'REVIEW_ONLY_NOT_EXECUTED');
 assert.equal(JSON.stringify(old),raw);
});
test('reject unsupported or unverifiable task state',()=>{
 const old=cmd();old.task_graph[1].status='IN_PROGRESS';
 assert.throws(()=>normalizeLegacyA00(old),/UNVERIFIED_TASK_STATE/);
});
test('reject fake CEO approvals in snapshot',()=>{
 const old=cmd();old.approvals[0].decision='APPROVED';
 assert.throws(()=>normalizeLegacyA00(old),/UNVERIFIED_G1/);
});
test('only verified G1 permits task readiness proposal',()=>{
 assert.equal(checkEventTransition('PLANNED_WAIT_G1','READY',{}).reason,'VERIFIED_G1_REQUIRED');
 assert.equal(checkEventTransition('PLANNED_WAIT_G1','READY',{verified_ceo_g1:true}).ok,true);
});
test('QC requires evidence and forbids DONE to IN_PROGRESS',()=>{
 assert.equal(checkEventTransition('REVIEW','DONE',{}).reason,'EVIDENCE_REQUIRED');
 assert.equal(checkEventTransition('REVIEW','DONE',{sha256:'a'.repeat(64)}).ok,true);
 assert.equal(checkEventTransition('DONE','IN_PROGRESS',{sha256:'b'.repeat(64)}).reason,'TRANSITION_NOT_ALLOWED');
});
