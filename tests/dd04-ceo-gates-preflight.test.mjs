import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightGate} from '../dd04-agent-control/ceo-gates-preflight.mjs';
const actor={ok:true,role:'CEO',userId:'123e4567-e89b-42d3-a456-426614174111',tenantId:'123e4567-e89b-42d3-a456-426614174000'};
const command={command_id:'cmd_91c7ce5ec8760df9fa0f',tenant_id:actor.tenantId,input_sha256:'a'.repeat(64),status:'WAITING_CEO_PLAN'};
const baseApproval={tenant_id:actor.tenantId,command_id:command.command_id,gate:'G1',revision:1,decision:'PENDING',
 proposal_sha256:'a'.repeat(64),approved_by:null,decided_at:null};
const g1Evidence={revision:1,proposal_sha256:'a'.repeat(64),budget_vnd:200000,scope_text:'Tạo kế hoạch A03 riêng cho 5 kênh'};
test('G1 preflight permits only current pending immutable command hash and signed CEO actor',()=>{
 const result=preflightGate({actor,command,approval:baseApproval,evidence:g1Evidence,gate:'G1',decision:'APPROVED'});
 assert.equal(result.ok,true);assert.equal(result.executable,false);
 assert.equal(preflightGate({actor:{...actor,role:'STAFF'},command,approval:baseApproval,evidence:g1Evidence,gate:'G1',decision:'APPROVED'}).reason,'VERIFIED_CEO_REQUIRED');
 assert.equal(preflightGate({actor,command:{...command,input_sha256:'b'.repeat(64)},approval:baseApproval,evidence:g1Evidence,gate:'G1',decision:'APPROVED'}).reason,'COMMAND_SNAPSHOT_CHANGED');
 assert.equal(preflightGate({actor,command,approval:{...baseApproval,decision:'APPROVED'},evidence:g1Evidence,gate:'G1',decision:'APPROVED'}).reason,'PENDING_GATE_RECORD_REQUIRED');
 assert.equal(preflightGate({actor,command,approval:baseApproval,evidence:{...g1Evidence,revision:2},gate:'G1',decision:'APPROVED'}).reason,'STALE_PROPOSAL_OR_HASH');
});
test('G2 preflight demands G1 approval, frozen output hash/channel/schedule, server QC and A09',()=>{
 const c={...command,status:'HOLD'};
 const target_channels=['FB001','TT001'],publish_schedule={at:'2026-11-17T11:00:00+07:00'},asset_sha256='b'.repeat(64);
 const approval={...baseApproval,gate:'G2',asset_sha256,target_channels,publish_schedule};
 const evidence={revision:1,proposal_sha256:'a'.repeat(64),asset_sha256,target_channels,publish_schedule,qc_pass:true,compliance_pass:true};
 const g1={tenant_id:actor.tenantId,command_id:command.command_id,gate:'G1',decision:'APPROVED'};
 const review={source:'SERVER_DB_AUDIT',command_id:command.command_id,asset_sha256,A08:'PASS',A09:'PASS'};
 const params={actor,command:c,approval,evidence,gate:'G2',decision:'APPROVED',g1,review};
 const result=preflightGate(params);
 assert.equal(result.ok,true);assert.equal(result.executable,false);
 assert.equal(preflightGate({...params,g1:null}).reason,'G1_APPROVAL_REQUIRED');
 assert.equal(preflightGate({...params,evidence:{...evidence,target_channels:['TT002']}}).reason,'G2_FINAL_ASSET_CHANNEL_OR_SCHEDULE_CHANGED');
 assert.equal(preflightGate({...params,review:{...review,A09:'HOLD'}}).reason,'G2_SERVER_QC_EVIDENCE_REQUIRED');
});
