import test from 'node:test';
import assert from 'node:assert/strict';
import {createPgRepository,assertStagingDatabaseUrl} from '../dd04-agent-control/supabase-pg-repository.mjs';

const tenant='123e4567-e89b-42d3-a456-426614174000';
function mockPool(){
 const commands=new Map(), tasks=new Map(),approvals=new Map(), events=new Map();
 let released=0,committed=0,rolledBack=0;
 const client={
  release(){released++},
  async query(sql,params=[]){
   if(sql==='BEGIN')return {rowCount:0,rows:[]};
   if(sql==='COMMIT'){committed++;return {rowCount:0,rows:[]}}
   if(sql==='ROLLBACK'){rolledBack++;return {rowCount:0,rows:[]}}
   if(sql.startsWith('select current_database()'))return {rows:[{db_name:'postgres',db_user:'postgres.wbvkqfnrlasmtizjszab'}]};
   if(sql.startsWith('select count(*)::int as table_count from information_schema.tables'))return {rows:[{table_count:7}]};
   if(sql.startsWith('insert into dd04_stage.commands')){
    const key=params[3],existing=commands.get(key);
    if(existing)return {rowCount:0,rows:[]};
    commands.set(key,{tenant_id:params[0],command_id:params[1],source:params[2],external_id:key,
     input_sha256:params[4],message_text:params[5],status:params[6],
     received_at:params[7],schema_version:params[8]});
    return {rowCount:1,rows:[{command_id:params[1]}]}
   }
   if(sql.startsWith('select command_id,input_sha256,status')){
    const r=commands.get(params[2]);return {rowCount:r?1:0,rows:r?[r]:[]};
   }
   if(sql.startsWith('select count(*)::int as n')){
    return {rowCount:1,rows:[{n:(tasks.get(params[1])||[]).length}]};
   }
   if(sql.startsWith('insert into dd04_stage.tasks')){
    const row={task_id:params[2],owner_agent:params[3],dependency_task_id:params[4],
     status:params[5],revision:params[6],output_refs:JSON.parse(params[7])};
    tasks.set(params[1],[...(tasks.get(params[1])||[]),row]);
    return {rowCount:1,rows:[]}
   }
   if(sql.startsWith('insert into dd04_stage.approvals')){
    approvals.set(params[1],[{gate:params[2],decision:'PENDING',approved_by:null,decided_at:null}]);
    return {rowCount:1,rows:[]}
   }
   if(sql.startsWith('insert into dd04_stage.task_events')){
    events.set(params[1],[{event_name:params[2],actor_ref:params[4],occurred_at:new Date().toISOString(),evidence_sha256:params[5]}]);
    return {rowCount:1,rows:[]}
   }
   if(sql.startsWith('select command_id,external_id,source')){
    const row=[...commands.values()].find(x=>x.command_id===params[1]);
    return {rowCount:row?1:0,rows:row?[row]:[]}
   }
   if(sql.startsWith('select task_id,owner_agent'))return {rows:tasks.get(params[1])||[]};
   if(sql.startsWith('select gate,decision'))return {rows:approvals.get(params[1])||[]};
   if(sql.startsWith('select event_name,actor_ref'))return {rows:events.get(params[1])||[]};
   if(sql.startsWith('select command_id from dd04_stage.commands')){
    return {rows:[...commands.values()].map(r=>({command_id:r.command_id}))}
   }
   throw Error('UNEXPECTED_SQL '+sql.slice(0,75))
  }
 };
 return {pool:{connect:async()=>client},stats:()=>({commands:commands.size,tasks:[...tasks.values()].flat().length,
  approvals:[...approvals.values()].flat().length,events:[...events.values()].flat().length,
  committed,rolledBack,released})};
}
test('Reject production project, foreign database and disabled TLS',()=>{
 const safe='postgresql://postgres:secret@db.wbvkqfnrlasmtizjszab.supabase.co:5432/postgres';
 assert.equal(assertStagingDatabaseUrl(safe,tenant).mode,'DIRECT');
 assert.equal(assertStagingDatabaseUrl('postgresql://postgres.wbvkqfnrlasmtizjszab:secret@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',tenant).mode,'TRANSACTION_POOLER');
 assert.throws(()=>assertStagingDatabaseUrl(safe.replace('wbvkqfnrlasmtizjszab','ykhrtrvstymfjnzdgzna'),tenant),/DATABASE_TARGET_NOT_DD04_STAGING/);
 assert.throws(()=>assertStagingDatabaseUrl(safe+'?sslmode=disable',tenant),/DATABASE_SSL_REQUIRED/);
 assert.throws(()=>assertStagingDatabaseUrl(safe,'random'),/STAGING_DATABASE_CONFIGURATION_REQUIRED/);
});
test('Atomic acceptance writes one command, 7 tasks, one pending G1 and audit event',async()=>{
 const db=mockPool(),repo=createPgRepository(db.pool,tenant);
 const input={external_id:'a00-test-008',message_text:'Tạo video hoạt hình mẹ và bé 30 giây'};
 const a=await repo.accept(input),b=await repo.accept(input);
 assert.equal(a.code,201);assert.equal(a.body.task_count,7);
 assert.equal(b.code,200);assert.equal(b.body.duplicate,true);
 assert.deepEqual(db.stats().commands,1);
 assert.equal(db.stats().tasks,7);assert.equal(db.stats().approvals,1);assert.equal(db.stats().events,1);
 assert.equal(db.stats().committed,2);assert.equal(db.stats().released,2);
 const record=await repo.get(a.body.command_id);
 assert.equal(record.command_id,a.body.command_id);
 assert.equal(record.status,'WAITING_CEO_PLAN');
 assert.equal(record.task_graph.length,7);
 assert.equal(record.approvals[0].decision,'PENDING');
 assert.equal(record.meeting.status,'DRAFT_ROUTING_ONLY');
 assert.equal(record.audit[0].event,'COMMAND_ACCEPTED');
 const all=await repo.list();assert.equal(all.source,'SUPABASE_STAGING_POSTGRES');assert.equal(all.records.length,1);
});
test('Idempotency conflict is rejected without duplicate tasks',async()=>{
 const db=mockPool(),repo=createPgRepository(db.pool,tenant);
 await repo.accept({external_id:'same-008',message_text:'Hãy tạo video hoạt hình mẹ và bé'});
 const outcome=await repo.accept({external_id:'same-008',message_text:'Hãy tạo video hoạt hình mẹ và bé khác'});
 assert.equal(outcome.code,409);
 assert.equal(outcome.body.error,'IDEMPOTENCY_CONFLICT');
 assert.equal(db.stats().commands,1);assert.equal(db.stats().tasks,7);
 assert.equal(db.stats().rolledBack,1);
});
test('Missing ID returns null; no data is synthesized',async()=>{
 const db=mockPool(),repo=createPgRepository(db.pool,tenant);
 assert.equal(await repo.get('cmd_aaaaaaaaaaaaaaaaaaaa'),null);
 assert.equal(await repo.get('bad'),null);
});

test('Authenticated read-only diagnostic probes staging DB without exposing credentials',async()=>{
 const db=mockPool(),repository=createPgRepository(db.pool,tenant);
 const info=await repository.diagnose();
 assert.deepEqual(info,{ok:true,stage:'DATABASE_READ_ONLY',tables:7});
 assert.equal(db.stats().commands,0);
});
