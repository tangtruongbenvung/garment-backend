import test from 'node:test';import assert from 'node:assert/strict';
import {generateA03WithOpenAI,checkA03Response} from '../dd04-agent-control/a03-openai-provider.mjs';
const plan={campaign_id:'CAMP_DEMO',channels:[
 {channel_id:'FB001',platform:'FANPAGE',name:'Mẹ và Bé Vui'},
 {channel_id:'TT001',platform:'TIKTOK',name:'Nhà Bé Hóm Hỉnh'}
]};
const financeAuthorization={source:'SERVER_VERIFIED_FINANCE',allowed:true,scope:'A03_STAGING_DRAFT',max_output_tokens:2500};
const scripts=plan.channels.map((x,i)=>({
 channel_id:x.channel_id,platform:x.platform,title:'Chuyện vui '+(i?'buổi tối':'buổi sáng'),
 creative_direction:i?'Trinh thám đồ chơi':'Gia đình đảo vai',
 story:'Bé hoạt hình cùng mẹ tạo một tình huống hài gia đình dễ thương',
 hook:'Mẹ ơi hôm nay con làm thám tử nhé!',
 caption:'Câu chuyện mẹ và bé hoạt hình hư cấu đầy tiếng cười',
 duration_seconds:30,
 scenes:[{visual:'Mở đầu mẹ và bé trong căn phòng gia đình Việt Nam',speech:'Con có chuyện muốn kể mẹ nghe'},
 {visual:'Bé tìm món đồ chơi bị thất lạc và hỏi mẹ',speech:'Mẹ tìm chiếc tất giúp con nhé'},
 {visual:'Bé tìm thấy gấu bông đội tất và cả hai vui vẻ',speech:'À hóa ra gấu bông đang giữ nó'}],
 reply_library:{positive:['Cảm ơn bạn đã xem nha!'],
  question:['Đây là hai nhân vật hoạt hình hư cấu.'],
  criticism:['Cảm ơn bạn góp ý, chúng tôi sẽ xem xét.']}
}));
const mock=async(_url,opts)=>({ok:true,status:200,json:async()=>({
 model:'test-model',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({scripts})}]}],
 usage:{input_tokens:100,output_tokens:400}})});
test('No LLM request before server verified financial authorization',async()=>{
 let called=false;
 const result=await generateA03WithOpenAI({plan,apiKey:'a'.repeat(35),model:'gpt-test',
  fetchImpl:async()=>{called=true;return mock()}});
 assert.equal(result.ok,false);assert.equal(called,false);
 assert.equal(result.error,'CEO_FINANCE_POLICY_REQUIRED');
});
test('Actual provider adapter outputs 2 channels, unique creative directions, no publish',async()=>{
 const got=await generateA03WithOpenAI({plan,apiKey:'a'.repeat(35),model:'gpt-test',
  financeAuthorization,fetchImpl:mock});
 assert.equal(got.ok,true);assert.equal(got.script_count,2);
 assert.equal(got.real_llm_execution,true);assert.equal(got.publishing_allowed,false);
 assert.equal(got.scripts[0].qc.A08,'PENDING');
 assert.notEqual(got.scripts[0].creative_direction,got.scripts[1].creative_direction);
});
test('AI output missing one channel, duplicate approach, or incorrect platform fails',async()=>{
 const original={scripts};
 assert.equal(checkA03Response({scripts:[scripts[0]]},{campaign_id:'CAMP_DEMO',
  scripts:[{channel_id:'FB001',platform:'FANPAGE'},{channel_id:'TT001',platform:'TIKTOK'}]}).ok,false);
 const duplicate={scripts:[scripts[0],{...scripts[1],creative_direction:scripts[0].creative_direction}]};
 const ref={campaign_id:'CAMP_DEMO',scripts:plan.channels.map(x=>({...x,channel_name:x.name}))};
 assert.equal(checkA03Response(duplicate,ref).error,'LLM_CREATIVE_DUPLICATION');
 const swapped={scripts:[scripts[0],{...scripts[1],platform:'FANPAGE'}]};
 assert.equal(checkA03Response(swapped,ref).ok,false);
 assert.equal(checkA03Response(original,ref).ok,true);
});
test('No simulated LLM success on provider 429 or invalid JSON',async()=>{
 const base={plan,apiKey:'a'.repeat(35),model:'gpt-test',financeAuthorization};
 const rate=await generateA03WithOpenAI({...base,fetchImpl:async()=>({ok:false,status:429})});
 assert.equal(rate.error,'AI_PROVIDER_HTTP_429');
 const bad=await generateA03WithOpenAI({...base,fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'not-json'}]}]})})});
 assert.equal(bad.error,'AI_PROVIDER_NON_JSON_OUTPUT');
});
