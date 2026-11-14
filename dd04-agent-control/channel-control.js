"use strict";
// STAGING UI / local demo data only; never interpret as actual registered accounts or Agent runs.
const $=id=>document.getElementById(id);
const positions=[
 ["Mẹ bé đối đáp","Hài đối thoại","dí dỏm, ấm áp, nhiều lời thoại"],
 ["Bé khám phá","Khám phá đời thường","tò mò, chậm rãi, đáng yêu"],
 ["Nhà mình vui quá","Hài tình huống gia đình","tự nhiên, bất ngờ, ấm áp"],
 ["Gấu bông kể chuyện","Thú bông và tưởng tượng","ngộ nghĩnh, nhẹ nhàng"],
 ["Bé tập làm nghề","Đóng vai nghề nghiệp","tếu táo, nhiều hành động"],
 ["Chuyện nhỏ của mẹ","Góc nhìn người mẹ","đời thường, chân thật"],
 ["Siêu nhân tí hon","Anh hùng đời thường","hào hứng, tích cực"],
 ["Thế giới đồ chơi","Đồ chơi tưởng tượng","sáng tạo, vui nhộn"],
 ["Bé đố mẹ","Câu đố và hiểu nhầm","bất ngờ, trong sáng"],
 ["Ngày hội tí hon","Sân khấu và lễ hội","rộn ràng, lịch sự"],
 ["Những ngày mưa vui","Tình huống ngày mưa trong nhà","êm dịu, tinh nghịch"],
 ["Bé làm nhạc trưởng","Âm nhạc và tiết tấu hoạt hình gốc","vui tươi, nhịp nhàng"],
 ["Chuyến tàu tưởng tượng","Phiêu lưu qua những góc nhà","hào hứng, kể chuyện"],
 ["Mẹ làm học trò","Bé hướng dẫn mẹ những trò chơi nhỏ","đảo vai, hài hước"],
 ["Cuộc sống của chiếc tất","Nhân cách hóa vật dụng hư cấu","bất ngờ, nhẹ nhàng"],
 ["Chú thỏ và hai mẹ con","Thú bông là nhân vật phụ cố định","đáng yêu, ấm áp"],
 ["Bữa tiệc sắc màu","Màu sắc, hình khối và trí tưởng tượng","trong trẻo, tươi sáng"],
 ["Nhà mình có bí mật","Bất ngờ nhỏ trong gia đình","hồi hộp vui, không đáng sợ"],
 ["Bé làm phóng viên","Bé khám phá tin vui trong nhà","tếu táo, tò mò"],
 ["Giờ kể chuyện lạ","Truyện ngắn hư cấu có cú chốt hài","dịu dàng, hóm hỉnh"]
];
const names={A00:"Điều phối",A01:"Nghiên cứu xu hướng",A02:"Định hướng kênh",A03:"Viết kịch bản/caption",A04:"Nhân vật/ảnh",A05:"Sản xuất video",A06:"Quản lý kênh",A07:"Đăng sau G2",A08:"QC ngôn ngữ và nguyên bản",A09:"Tuân thủ/chính sách",A10:"Phân tích kết quả",A11:"Chi phí và KPI",A12:"Đối thủ",A13:"Tham chiếu viral",A14:"Bán hàng",A15:"Chăm sóc khách hàng",A16:"Lắng nghe cộng đồng",A17:"Tương tác minh bạch"};
const assigned=["A00","A01","A02","A03","A04","A05","A06","A07","A08","A09","A10","A11","A12","A13","A16","A17"];
const deps=[["A00","Điều phối, bảo đảm đúng kênh","PENDING_G1"],["A02","Duy trì hồ sơ chiến lược, chủ đề, giọng điệu","DRAFT_ONLY"],["A03","Kịch bản, caption, reply_library đúng profile v1","BLOCKED_G1"],["A04","Nhân vật và visual bible đồng nhất","BLOCKED_G1"],["A05","Video 20–60 giây theo script/visual bible","BLOCKED_G1"],["A08","So nội dung với hồ sơ kênh, trùng lặp, QC","NOT_RUN"],["A09","An toàn trẻ em, ngôn ngữ, quyền nội dung","NOT_RUN"],["A06","Đóng gói đúng kênh, trình G2","BLOCKED_G1"],["A07","Chỉ đăng khi G2+hash+quyền hợp lệ","BLOCKED_G2"],["A10","Dữ liệu thật 24h/72h/7 ngày sau đăng","NO_DATA"]];
let channels=[],selected="",pages={FANPAGE:0,TIKTOK:0},tab="strategy";
function make(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(className)e.className=className;return e;}
function demo(n){return Array.from({length:n},(_,i)=>{
 const p=positions[i%positions.length],platform=i%2?"TIKTOK":"FANPAGE",id=(platform==="TIKTOK"?"TT":"FB")+String(Math.floor(i/2)+1).padStart(3,"0");
 return {channel_id:id,platform,name:p[0]+" "+id,version:1,positioning:"Giải trí hài mẹ và bé hoạt hình hư cấu Việt Nam; nhấn vào "+p[1].toLowerCase(),
 audience:"Người xem Việt Nam quan tâm nội dung mẹ và bé 0–36 tháng",pillars:p[1],voice:p[2],
 character:"Mẹ và bé hoạt hình hư cấu Việt Nam nhất quán ngoại hình và tính cách qua từng video của kênh.",
 visual:"Phong cách hoạt hình cách điệu 3D, dọc 9:16, 20–60 giây.",
 rules:"Không sao chép nguyên câu chuyện kênh khác; không sử dụng tình huống nguy hiểm, trẻ em thật, tục tĩu, khen chéo hay quảng cáo sai.",
 cta:"Tương tác tự nhiên, không spam bình luận hoặc ép người xem.",
 goal:"Xây dựng bản sắc "+p[1].toLowerCase()+" và đánh giá sau 30 ngày vận hành có dữ liệu thật.",
 assigned_agents:assigned,profile_status:"DRAFT_DEMO_NOT_APPROVED"};
});}
function field(title,value,wide=false){const d=make("div",undefined,"datum"+(wide?" wide":""));d.append(make("label",title),make("p",value));return d;}
function filtered(){
 const q=$("search").value.trim().toLocaleLowerCase("vi");
 return channels.filter(c=>!q||(c.name+" "+c.channel_id+" "+c.pillars).toLocaleLowerCase("vi").includes(q));
}
function updatePlatformCounts(){
 const fb=channels.filter(c=>c.platform==="FANPAGE").length;
 const tt=channels.filter(c=>c.platform==="TIKTOK").length;
 $("total").textContent=channels.length;
 $("fbcount").textContent=fb;
 $("ttcount").textContent=tt;
}
function makeChannelRow(c){
 const b=make("button",undefined,"channel-row "+(c.platform==="FANPAGE"?"item-fb":"item-tt")+(c.channel_id===selected?" selected":""));
 b.type="button";
 b.setAttribute("role","listitem");
 b.setAttribute("aria-current",c.channel_id===selected?"true":"false");
 b.setAttribute("aria-label",c.channel_id+" - "+c.name+". Chủ đề "+c.pillars+". Phiên bản "+c.version);
 const identity=make("span",undefined,"channel-main");
 identity.append(make("span",c.channel_id,"channel-code"),make("strong",c.name,"channel-title"));
 const pill=make("span",c.pillars,"channel-description");
 const version=make("span","V"+c.version,"channel-version");
 b.append(identity,pill,version);
 b.addEventListener("click",()=>{
  selected=c.channel_id;
  list();
  detail();
  const destination=$("channelDetailsTitle");
  if(destination)destination.scrollIntoView({behavior:"smooth",block:"start"});
 });
 return b;
}
function list(){
 const all=filtered(),size=Number($("pagesize").value);
 $("matched").textContent=all.length+" / "+channels.length+" kênh phù hợp";
 for(const platform of ["FANPAGE","TIKTOK"]){
  const items=all.filter(c=>c.platform===platform);
  const key=platform==="FANPAGE"?"fb":"tt";
  const max=Math.max(1,Math.ceil(items.length/size));
  pages[platform]=Math.max(0,Math.min(pages[platform],max-1));
  const container=$(key+"List");
  container.replaceChildren();
  const shown=items.slice(pages[platform]*size,(pages[platform]+1)*size);
  if(shown.length===0)container.append(make("p","Không tìm thấy kênh phù hợp.","empty-list"));
  for(const c of shown)container.append(makeChannelRow(c));
  $(key+"ListCount").textContent=items.length+" kênh";
  $(key+"Page").textContent=(pages[platform]+1)+" / "+max;
  $(key+"Prev").disabled=pages[platform]===0;
  $(key+"Next").disabled=pages[platform]+1>=max;
 }
}
// Editing is local-memory-only. Every change creates a new UNAPPROVED profile revision.
const editFields=[["positioning","Định vị xuyên suốt"],["audience","Đối tượng"],["pillars","Trụ cột nội dung"],["voice","Giọng điệu và cá tính"],["character","Nhân vật / Character Bible"],["visual","Phong cách hình ảnh"],["cta","Quy tắc CTA"],["rules","Những điều cấm"],["goal","Mục tiêu kênh"]];
function exportProfiles(list){
 const payload={schema_version:"5.3",source:"BROWSER_STAGING_DRAFT_NOT_APPROVED",exported_for:"CEO_REVIEW_ONLY",channels:list.map(c=>({
 channel_id:c.channel_id,name:c.name,platform:c.platform,version:c.version,
 positioning:c.positioning,audience:c.audience,content_pillars:c.pillars,tone:c.voice,
 character_bible:c.character,visual_style:c.visual,forbidden:c.rules,
 cta_policy:c.cta,target_outcome:c.goal,assigned_agents:c.assigned_agents,
 profile_status:c.profile_status
 }))};
 const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="DD04_CHANNEL_PROFILES_STAGING_DRAFT.json";
 document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function editProfile(c){
 $("details").replaceChildren();
 const notice=make("p","Chỉ chỉnh sửa bản nháp trong bộ nhớ tab hiện tại. Chưa lưu Supabase, chưa duyệt G1/G2. Khi lưu bản nháp sẽ tăng phiên bản để buộc công việc mới rà lại.","checkpoint");
 $("details").append(notice);
 const form=make("div",undefined,"data-grid");
 for(const [key,label] of editFields){
  const wrap=make("div",undefined,"datum wide");
  const lab=make("label",label);lab.htmlFor="edit-"+key;
  const input=make("textarea");input.id="edit-"+key;input.value=c[key];input.rows=2;input.maxLength=900;input.setAttribute("aria-label",label);
  wrap.append(lab,input);form.append(wrap);
 }
 $("details").append(form);
 const actions=make("div",undefined,"tabs"),save=make("button","Lưu bản nháp trong phiên"),cancel=make("button","Hủy sửa");
 actions.append(save,cancel);$("details").append(actions);
 save.addEventListener("click",()=>{
  const next=Object.fromEntries(editFields.map(([key])=>[key,$("edit-"+key).value.trim()]));
  if(Object.values(next).some(value=>value.length<3)){const p=make("p","Mỗi trường cần ít nhất 3 ký tự; chưa lưu bản nháp.","checkpoint");$("details").prepend(p);return;}
  if(editFields.some(([key])=>c[key]!==next[key])){
   Object.assign(c,next);c.version++;c.profile_status="DRAFT_CHANGED_REVIEW_REQUIRED";
  }
  detail();
 });
 cancel.addEventListener("click",detail);
}
function renderStrategy(c){
 const grid=make("div",undefined,"data-grid");
 for(const [k,v,w] of [["Định vị xuyên suốt",c.positioning,true],["Đối tượng",c.audience,false],["Trụ cột nội dung",c.pillars,false],["Giọng điệu và cá tính",c.voice,false],["Nhân vật / Character Bible",c.character,true],["Phong cách hình ảnh",c.visual,false],["Quy tắc CTA",c.cta,false],["Những điều cấm",c.rules,true],["Mục tiêu kênh",c.goal,true]])grid.append(field(k,v,w));
 $("details").append(grid);
  $("details").append(make("p","Mọi Agent phải nhận đúng channel_id, profile_version và profile_sha256. Mọi thay đổi định vị cần tạo phiên bản mới, A02/A00 chuẩn bị đề xuất CEO phê duyệt.","checkpoint"));
 const tools=make("div",undefined,"tabs");
 const edit=make("button","Chỉnh sửa hồ sơ nháp"),exportOne=make("button","Xuất hồ sơ kênh JSON"),exportAll=make("button","Xuất toàn bộ hồ sơ JSON");
 tools.append(edit,exportOne,exportAll);$("details").append(tools);
 edit.addEventListener("click",()=>editProfile(c));
 exportOne.addEventListener("click",()=>exportProfiles([c]));
 exportAll.addEventListener("click",()=>exportProfiles(channels));
}
const mandatoryAgents=["A00","A02","A03","A04","A05","A06","A07","A08","A09","A10"];
function editAgentAssignments(c){
 $("details").replaceChildren(make("p","Chỉ thay đổi phân công mẫu trong phiên này; tất cả Agent thiết yếu phải được giữ, không làm phát sinh quyền đăng hoặc quyền duyệt.","checkpoint"));
 const grid=make("div",undefined,"agent-grid");
 for(const [id,label] of Object.entries(names)){
  const row=make("label",undefined,"agent"),input=document.createElement("input");input.type="checkbox";input.checked=c.assigned_agents.includes(id);input.dataset.agent=id;
  input.style.width="auto";input.style.marginRight="10px";input.disabled=mandatoryAgents.includes(id);
  row.append(input,make("span",id+" · "+label+(mandatoryAgents.includes(id)?" (bắt buộc)":"")));grid.append(row);
 }
 $("details").append(grid);
 const controls=make("div",undefined,"tabs"),save=make("button","Lưu phân công nháp"),cancel=make("button","Hủy");
 controls.append(save,cancel);$("details").append(controls);
 save.addEventListener("click",()=>{
  const next=[...grid.querySelectorAll("input")].filter(e=>e.checked).map(e=>e.dataset.agent);
  if(mandatoryAgents.some(a=>!next.includes(a)))return;
  if(JSON.stringify(next)!==JSON.stringify(c.assigned_agents)){
   c.assigned_agents=next;c.version++;c.profile_status="DRAFT_AGENT_TEAM_CHANGED_REVIEW_REQUIRED";
  }
  detail();
 });
 cancel.addEventListener("click",detail);
}
function renderAgents(c){
 $("details").append(make("p","Agent dùng chung toàn hệ thống nhưng từng nhiệm vụ phải gắn với "+c.channel_id+". Không có Agent nào được tự đổi hồ sơ chiến lược đã chốt.","muted"));
 const btn=make("button","Điều chỉnh Agent phụ trách — bản nháp");
 btn.addEventListener("click",()=>editAgentAssignments(c));
 $("details").append(btn);
 const grid=make("div",undefined,"agent-grid");
 for(const id of c.assigned_agents){const a=make("div",undefined,"agent");a.append(make("strong",id+" · "+names[id]),make("p",id==="A02"?"Quản trị chiến lược và đề xuất thay đổi có duyệt.":id==="A03"?"Kịch bản phải đúng trụ cột: "+c.pillars+"; không lấy kịch bản kênh khác.":id==="A04"?"Giữ nhân vật và phong cách của "+c.channel_id+".":id==="A05"?"Video phải dùng script và character bible cùng phiên bản.":id==="A08"?"Đối chiếu với profile, nội dung trước đây và các kênh khác.":id==="A09"?"Chặn sai lệch chính sách, không thay CEO duyệt.":id==="A07"?"Chỉ đăng khi G2 đã duyệt và đủ quyền hợp lệ.":"Nhận brief kênh đã khóa; chỉ xử lý trong chức năng được giao."));grid.append(a)}
 $("details").append(grid);
}
function renderTasks(c){
 const note=make("div",undefined,"checkpoint");note.textContent="Kế hoạch minh họa, chưa phải tác vụ thật. Tất cả đầu việc sản xuất đều PLANNED_WAIT_G1, không được tự thực thi."; $("details").append(note);
 const d=make("div",undefined,"tablewrap"),t=make("table"),head=make("tr");
 for(const h of ["Agent","Đầu việc phải làm đúng kênh","Trạng thái"])head.append(make("th",h));
 t.append(head);
 for(const [a,task,status] of deps){const tr=make("tr");for(const v of [a,task,status])tr.append(make("td",v));t.append(tr);}
 d.append(t);$("details").append(d);
 $("details").append(make("p","Bàn giao yêu cầu tối thiểu: campaign_id, channel_id, profile_version, profile_sha256, task_id, producer_agent, receiver_agent, output_refs, revision và nhật ký. Một chiến dịch có N kênh phải sinh N nhánh công việc A03. ","muted"));
}
function renderHistory(c){
 $("details").append(field("Phiên bản hồ sơ",c.channel_id+" · v"+c.version+" · "+c.profile_status,true));
 $("details").append(field("Trạng thái lịch sử nội dung","Chưa có video thật, chưa có asset_hash hoặc chỉ số hiệu quả thật.",true));
 $("details").append(field("Kiểm tra QC bắt buộc","A08 so với nội dung kênh + kênh khác; A09 đối chiếu an toàn trẻ em, ngôn từ, bản quyền. Bản nào lệch profile phải trả REWORK.",true));
 $("details").append(field("Quy trình cập nhật chiến lược","A02 đề xuất → A00 lập hồ sơ v2 và diff → CEO G1 quyết định → nhiệm vụ sau này chỉ dùng v2. Asset v1 cần rà lại trước G2.",true));
 $("details").append(make("p","Không có lịch sử hoạt động hay quyền duyệt thật được suy ra từ dữ liệu mô phỏng.","checkpoint"));
}
function detail(){
 const c=channels.find(x=>x.channel_id===selected);
 if(!c){$("details").replaceChildren(make("p","Không tìm thấy kênh.","muted"));return;}
 $("channelId").textContent=c.channel_id;
 $("channelName").textContent=c.name;
 $("selectedPlatform").textContent=c.platform==="FANPAGE"?"Facebook Fanpage":"TikTok";
 $("selectedPlatform").className="platform-tag "+(c.platform==="FANPAGE"?"fanpage":"tiktok");
 $("profileFlag").textContent="Hồ sơ V"+c.version+" · CHƯA G1";
 $("channelMeta").textContent="Định hướng: "+c.pillars+" · hồ sơ nháp v"+c.version+" · "+c.assigned_agents.length+" Agent được phân công trong mô phỏng";
 $("details").replaceChildren();
 if(tab==="strategy")renderStrategy(c);
 else if(tab==="agents")renderAgents(c);
 else if(tab==="tasks")renderTasks(c);
 else renderHistory(c);
 for(const b of document.querySelectorAll(".tabs button"))b.classList.toggle("active",b.dataset.view===tab);
}
function refresh(n){channels=demo(n);selected=channels[0].channel_id;pages={FANPAGE:0,TIKTOK:0};const counts=channels.reduce((a,c)=>{a[c.platform]=(a[c.platform]||0)+1;return a;},{});updatePlatformCounts();list();detail();}
function validateImportedRegistry(obj){
 if(!obj||typeof obj!=="object"||Array.isArray(obj)||!Array.isArray(obj.channels)||obj.channels.length<1||obj.channels.length>300)throw Error("JSON_CANNOT_READ_CHANNELS_1_TO_300");
 if(obj.registry_version!==undefined && obj.registry_version!==2)throw Error("REGISTRY_VERSION_MISMATCH");
 const ids=new Set();
 return obj.channels.map(row=>{
  if(!row||typeof row!=="object"||!/^[A-Za-z0-9_-]{2,64}$/.test(row.channel_id||"")||ids.has(row.channel_id))throw Error("CHANNEL_ID_DUPLICATE_OR_INVALID");
  ids.add(row.channel_id);
  if(!["FANPAGE","TIKTOK"].includes(row.platform))throw Error("INVALID_PLATFORM");
  if(typeof row.name!=="string"||row.name.trim().length<2||row.name.length>100)throw Error("INVALID_CHANNEL_NAME");
  if(!Number.isInteger(row.version)||row.version<1||row.version>99999)throw Error("INVALID_CHANNEL_VERSION");
  const fields=["positioning","audience","content_pillars","tone","character_bible","visual_style","forbidden","cta_policy","target_outcome"];
  if(fields.some(k=>typeof row[k]!=="string"||row[k].trim().length<3||row[k].length>1000))throw Error("INCOMPLETE_CHANNEL_PROFILE");
  if(!Array.isArray(row.assigned_agents)||row.assigned_agents.some(a=>!/^A(0[0-9]|1[0-7])$/.test(a))||new Set(row.assigned_agents).size!==row.assigned_agents.length)throw Error("INVALID_AGENT_ASSIGNMENTS");
  return {channel_id:row.channel_id,platform:row.platform,name:row.name,version:row.version,
   positioning:row.positioning,audience:row.audience,pillars:row.content_pillars,voice:row.tone,
   character:row.character_bible,visual:row.visual_style,rules:row.forbidden,cta:row.cta_policy,goal:row.target_outcome,
   assigned_agents:row.assigned_agents,profile_status:"LOCAL_JSON_UNVERIFIED_NOT_APPROVED"};
 });
}
async function importFile(file){
 if(!file)return;
 if(file.size>2*1024*1024){$("importStatus").textContent="Tệp quá 2MB. Không nhập.";return;}
 try{
  const raw=await file.text(),json=JSON.parse(raw),imported=validateImportedRegistry(json);
  channels=imported;selected=channels[0].channel_id;pages={FANPAGE:0,TIKTOK:0};tab="strategy";
  $("demoCount").value="20";$("demoCount").disabled=true;
  $("search").value="";
  const counts=channels.reduce((a,c)=>{a[c.platform]=(a[c.platform]||0)+1;return a;},{});
  updatePlatformCounts();
  $("importStatus").textContent="Đã nhập "+channels.length+" hồ sơ JSON cục bộ. CHƯA xác minh danh tính kênh, trạng thái CEO hoặc Supabase; dữ liệu sẽ mất khi tải lại.";
  list();detail();
 }catch(e){$("importStatus").textContent="FAIL: "+e.message+". Dữ liệu cũ được giữ nguyên.";}
 finally{$("registryFile").value="";}
}
$("registryFile").addEventListener("change",()=>void importFile($("registryFile").files[0]));
$("restoreDemo").addEventListener("click",()=>{$("demoCount").disabled=false;$("demoCount").value="20";refresh(20);$("importStatus").textContent="Đã khôi phục dữ liệu DEMO; không có thay đổi trên Supabase.";});
for(const id of ["search","pagesize"])$(id).addEventListener(id==="search"?"input":"change",()=>{
 pages={FANPAGE:0,TIKTOK:0};list();
});
$("demoCount").addEventListener("change",()=>refresh(Number($("demoCount").value)));
for(const [prefix,platform] of [["fb","FANPAGE"],["tt","TIKTOK"]]){
 $(prefix+"Prev").addEventListener("click",()=>{pages[platform]--;list();});
 $(prefix+"Next").addEventListener("click",()=>{pages[platform]++;list();});
}
for(const b of document.querySelectorAll(".tabs button"))b.addEventListener("click",()=>{tab=b.dataset.view;detail();});
refresh(20);
