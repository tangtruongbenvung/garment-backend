import test from 'node:test';
import assert from 'node:assert/strict';
import {agentsFor,makeCommand,dispatch} from '../dd04-agent-control/runtime-core.mjs';
class FakeStore {
  records=new Map();
  async get(key){return this.records.get(key)||null}
  async setJSON(key,value){this.records.set(key,structuredClone(value))}
}
test('phân tuyến sản xuất gồm A03 A04 A05 A08 A09',()=>{
 const a=agentsFor('Tạo video hoạt hình mẹ và bé');
 for(const id of ['A00','A03','A04','A05','A08','A09'])assert.ok(a.includes(id));
});
test('lệnh hợp lệ chờ G1 và chưa tự chạy tác vụ',()=>{
 const r=makeCommand({external_id:'case-001',message_text:'Sản xuất một video hoạt hình'},'2026-11-14T00:00:00Z');
 assert.equal(r.status,'WAITING_CEO_PLAN');
 assert.equal(r.approvals[0].decision,'PENDING');
 assert.equal(r.meeting.status,'DRAFT_ROUTING_ONLY');
 assert.ok(r.task_graph.every(x=>x.status==='PLANNED_WAIT_G1'));
});
test('không nhận media khi chưa có adapter xác minh',()=>{
 assert.throws(()=>makeCommand({external_id:'case-002',message_text:'Sản xuất video minh họa',media_refs:['url']}),/MEDIA_NOT_ENABLED/);
});
test('chống lệnh trùng idempotent',async()=>{
 const store=new FakeStore(),input={external_id:'case-003',message_text:'Hãy nghiên cứu xu hướng hiện nay'};
 const a=await dispatch(store,input),b=await dispatch(store,input);
 assert.equal(a.code,201);assert.equal(b.code,200);assert.equal(b.body.duplicate,true);assert.equal(store.records.size,1);
});
test('lệnh trùng ID nhưng thay nội dung bị từ chối',async()=>{
 const store=new FakeStore();
 await dispatch(store,{external_id:'case-004',message_text:'Nghiên cứu xu hướng video'});
 const b=await dispatch(store,{external_id:'case-004',message_text:'Đăng bài trực tiếp lên TikTok'});
 assert.equal(b.code,409);
});
test('không nhận đầu vào sai định dạng',()=> {
 for(const input of [{external_id:'a',message_text:'Nội dung đủ dài'}, {external_id:'case-005',message_text:'abc'}, {external_id:'case-006',message_text:'Xin chào nội dung',media_refs:[{}]}]){
  assert.throws(()=>makeCommand(input));
 }
});
