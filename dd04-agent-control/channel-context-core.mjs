import { createHash } from 'node:crypto';
export const CHANNEL_SCHEMA_VERSION='5.3';
export const AGENT_IDS=Array.from({length:18},(_,i)=>'A'+String(i).padStart(2,'0'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{2,64}$/.test(x);
const agentFunctions={
 A00:'Điều phối và khóa duyệt',A01:'Nghiên cứu xu hướng',A02:'Chiến lược và định vị kênh',A03:'Kịch bản, caption, reply_library',
 A04:'Nhân vật, hình ảnh, brand kit',A05:'Video, âm thanh, dựng',A06:'Quản trị hồ sơ và lịch kênh',A07:'Đăng sau G2',
 A08:'Kiểm soát chất lượng và tính nguyên bản',A09:'Tuân thủ và an toàn',A10:'Phân tích dữ liệu kênh',
 A11:'KPI và chi phí',A12:'Đối thủ và tham chiếu',A13:'Ý tưởng viral có nguồn',A14:'Bán hàng',
 A15:'Chăm sóc khách hàng',A16:'Lắng nghe cộng đồng',A17:'Tương tác cộng đồng minh bạch'
};
const required=['A00','A02','A03','A04','A05','A06','A07','A08','A09','A10'];
function string(x,max=300){return typeof x==='string'&&x.trim().length>0&&x.length<=max;}
export function validateChannelProfile(p){
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('CHANNEL_PROFILE_REQUIRED');
 if(!identifier(p.channel_id)||!['FANPAGE','TIKTOK'].includes(p.platform))throw Error('INVALID_CHANNEL_ID_OR_PLATFORM');
 if(!string(p.name,100)||!string(p.positioning,500)||!string(p.audience,250)||!string(p.content_pillars,700)||
 !string(p.tone,350)||!string(p.character_bible,900)||!string(p.visual_style,350)||!string(p.forbidden,700)||
 !string(p.cta_policy,350)||!string(p.target_outcome,350))throw Error('CHANNEL_BRIEF_INCOMPLETE');
 if(!Number.isInteger(p.version)||p.version<1)throw Error('CHANNEL_PROFILE_VERSION_INVALID');
 if(!Array.isArray(p.assigned_agents)||p.assigned_agents.some(x=>!AGENT_IDS.includes(x))||
 new Set(p.assigned_agents).size!==p.assigned_agents.length||required.some(x=>!p.assigned_agents.includes(x)))throw Error('AGENT_TEAM_INCOMPLETE');
 return true;
}
export function snapshotChannel(p){
 validateChannelProfile(p);
 const fields=['channel_id','name','platform','version','positioning','audience','content_pillars','tone','character_bible','visual_style','forbidden','cta_policy','target_outcome','assigned_agents'];
 const canonical=Object.fromEntries(fields.map(k=>[k,p[k]]));
 return Object.freeze({...canonical,profile_sha256:sha(canonical),profile_status:'DRAFT_STAGING_UNAPPROVED'});
}
export function makeAgentHandoff(profile,task){
 const p=snapshotChannel(profile);
 if(!task||!identifier(task.campaign_id)||!identifier(task.task_id)||!AGENT_IDS.includes(task.agent_id))throw Error('INVALID_TASK_ENVELOPE');
 if(!p.assigned_agents.includes(task.agent_id))throw Error('AGENT_NOT_ASSIGNED_TO_CHANNEL');
 if(task.channel_id!==p.channel_id||task.profile_sha256!==p.profile_sha256||task.profile_version!==p.version)
 throw Error('CHANNEL_CONTEXT_MISMATCH');
 if(!string(task.objective,800))throw Error('TASK_OBJECTIVE_REQUIRED');
 return Object.freeze({schema_version:CHANNEL_SCHEMA_VERSION,source:'A00_STAGING_DRAFT',
 campaign_id:task.campaign_id,task_id:task.task_id,channel_id:p.channel_id,
 producer_agent:'A00',receiver_agent:task.agent_id,profile_version:p.version,profile_sha256:p.profile_sha256,
 task_objective:task.objective,channel_context:{
 positioning:p.positioning,audience:p.audience,content_pillars:p.content_pillars,
 tone:p.tone,character_bible:p.character_bible,visual_style:p.visual_style,
 forbidden:p.forbidden,cta_policy:p.cta_policy,target_outcome:p.target_outcome},
 expected_output:agentFunctions[task.agent_id],requires_review:['A03','A04','A05'].includes(task.agent_id)?['A08','A09']:[],
 status:'PLANNED_WAIT_G1',execution_allowed:false,publishing_allowed:false,
 approvals:{G1:'PENDING',G2:'PENDING'},handoff_sha256:sha({task,profile_hash:p.profile_sha256})});
}
export function inspectDeliverable(envelope,output){
 if(!envelope||!output||envelope.status!=='PLANNED_WAIT_G1')return {ok:false,reason:'UNVERIFIED_TASK'};
 if(output.channel_id!==envelope.channel_id||output.profile_version!==envelope.profile_version||
 output.profile_sha256!==envelope.profile_sha256)return {ok:false,reason:'CHANNEL_CONTEXT_CHANGED'};
 if(output.producer_agent!==envelope.receiver_agent)return {ok:false,reason:'AGENT_OWNERSHIP_MISMATCH'};
 return {ok:true,reason:'CONTEXT_MATCH_ONLY_NOT_QC_PASS',publish_allowed:false};
}
export function createDemoChannels(count=20){
 if(!Number.isInteger(count)||count<1||count>300)throw Error('DEMO_CHANNEL_LIMIT');
 const themes=[
 ['Mẹ bé đối đáp','Hài đối thoại','giọng dí dỏm, nhanh và ấm áp'],
 ['Bé khám phá','Khám phá đời thường','tò mò, nhẹ nhàng'],
 ['Nhà mình vui quá','Hài tình huống gia đình','ấm áp, bất ngờ'],
 ['Gấu bông kể chuyện','Nhân vật thú bông đồng hành','ngộ nghĩnh, tinh tế'],
 ['Bé tập làm nghề','Đóng vai và tưởng tượng','vui nhộn, dễ hiểu'],
 ['Chuyện nhỏ của mẹ','Góc nhìn người mẹ','thân thiện, tự nhiên'],
 ['Siêu nhân tí hon','Anh hùng đời thường','hào hứng, tích cực'],
 ['Thế giới đồ chơi','Đồ chơi và nhân vật hư cấu','giàu tưởng tượng'],
 ['Bé đố mẹ','Câu đố và hiểu nhầm','nhanh nhẹn, gần gũi'],
 ['Ngày hội tí hon','Sân khấu và lễ hội mini','rộn ràng, lịch sự']
 ];
 return Array.from({length:count},(_,i)=>{
  const [name,pillars,tone]=themes[i%themes.length],platform=i%2?'TIKTOK':'FANPAGE';
  const id=platform==='FANPAGE'?'FB':'TT';
  const suffix=String(Math.floor(i/2)+1).padStart(3,'0');
  return {channel_id:id+suffix,name:name+' '+id+suffix,platform,version:1,
   positioning:'Kênh hoạt hình giải trí mẹ và bé hư cấu Việt Nam theo hướng '+pillars.toLowerCase(),
   audience:'Gia đình Việt Nam quan tâm nội dung mẹ và bé 0–36 tháng',
   content_pillars:pillars,
   tone,character_bible:'Mẹ Việt Nam hoạt hình và bé 0–36 tháng hư cấu; đặc điểm nhân vật nhất quán trong từng kênh',
   visual_style:'Hoạt hình 3D cách điệu, tỷ lệ 9:16, khung hình sáng, 20–60 giây',
   forbidden:'Không mô phỏng trẻ thật; không hành vi nguy hiểm, không tục tĩu, không giả mạo hoặc quảng cáo thiếu chứng cứ',
   cta_policy:'Không ép tương tác, ưu tiên câu kết tự nhiên; không seeding hoặc khen chéo',
   target_outcome:'Nội dung vui, có câu chuyện rõ, tạo nét nhận diện khác các kênh còn lại',
   assigned_agents:[...required,'A01','A11','A12','A13','A16','A17'],
   campaign_state:'DEMO_UNAPPROVED',operational_status:'DEMO_NOT_CONNECTED'};
 });
}
