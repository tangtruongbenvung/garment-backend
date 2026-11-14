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
function infoSection(title,note,items){
 const section=make("section",undefined,"info-section");
 const head=make("div",undefined,"info-section-head");
 head.append(make("h3",title),make("p",note,"muted"));
 section.append(head);
 const grid=make("div",undefined,"data-grid");
 for(const item of items)grid.append(field(item[0],item[1],item[2]||false));
 section.append(grid);
 return section;
}
function renderStrategy(c){
 $("details").append(
  infoSection("01 · Định vị & khán giả","Nền tảng định hướng để tất cả Agent xây nội dung nhất quán.",[
   ["Định vị kênh",c.positioning,true],["Đối tượng người xem",c.audience,false],["Trụ cột nội dung",c.pillars,false],["Mục tiêu chính",c.goal,true]
  ]),
  infoSection("02 · Nhân vật & phong cách","Bộ quy chuẩn sáng tạo A03, A04 và A05 phải bám sát.",[
   ["Giọng điệu và cá tính",c.voice,false],["Phong cách hình ảnh",c.visual,false],["Nhân vật / Character Bible",c.character,true]
  ]),
  infoSection("03 · Nguyên tắc & giới hạn","A08/A09 sử dụng các mục này làm tiêu chí kiểm duyệt.",[
   ["Quy tắc tương tác / CTA",c.cta,false],["Những điều không được làm",c.rules,true]
  ])
 );
 const footer=make("div",undefined,"detail-footer");
 footer.append(make("p","Mọi Agent cần đúng channel_id, phiên bản và profile_sha256. Đề xuất đổi định vị phải trình CEO duyệt G1 trước khi áp dụng.","checkpoint"));
 const actions=make("div",undefined,"detail-actions");
 const edit=make("button","Chỉnh sửa hồ sơ nháp"),exportOne=make("button","Xuất hồ sơ kênh JSON"),exportAll=make("button","Xuất tất cả hồ sơ JSON");
 actions.append(edit,exportOne,exportAll);footer.append(actions);$("details").append(footer);
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
 const toolbar=make("div",undefined,"detail-toolbar");
 toolbar.append(make("p",c.assigned_agents.length+" Agent tham gia hồ sơ kênh "+c.channel_id+". Mỗi nhiệm vụ phải nhận đúng phiên bản định hướng.","muted"));
 const edit=make("button","Điều chỉnh Agent — bản nháp");edit.addEventListener("click",()=>editAgentAssignments(c));toolbar.append(edit);
 $("details").append(toolbar);
 const groups=[
  ["Điều phối & chiến lược",["A00","A01","A02","A12","A13"]],
  ["Sản xuất nội dung",["A03","A04","A05"]],
  ["Quản lý & kiểm duyệt",["A06","A07","A08","A09"]],
  ["Hiệu quả & cộng đồng",["A10","A11","A14","A15","A16","A17"]]
 ];
 for(const [label,ids] of groups){
  const active=ids.filter(id=>c.assigned_agents.includes(id));if(!active.length)continue;
  const section=make("section",undefined,"info-section");
  section.append(make("h3",label));
  const grid=make("div",undefined,"agent-grid");
  for(const id of active){
   const card=make("article",undefined,"agent");
   card.append(make("strong",id+" · "+names[id]),make("p",id==="A02"?"Giữ chiến lược và đề xuất thay đổi có duyệt.":id==="A03"?"Kịch bản đúng trụ cột: "+c.pillars+".":id==="A04"?"Nhân vật và hình ảnh đúng bản sắc kênh.":id==="A05"?"Video theo script và nhân vật đã khóa.":id==="A08"?"Kiểm tra lệch định hướng và trùng nội dung.":id==="A09"?"Kiểm soát chính sách, an toàn trẻ em.":id==="A07"?"Chỉ đăng sau G2 hợp lệ.":"Nhận đúng hồ sơ kênh, đúng chức năng."));
   grid.append(card);
  }
  section.append(grid);$("details").append(section);
 }
}
function renderTasks(c){
 $("details").append(make("div","Kế hoạch minh họa, chưa phải công việc thực tế. Tất cả đầu việc sản xuất vẫn chờ G1 và chưa có Agent AI tự thực thi.","checkpoint"));
 const section=make("section",undefined,"info-section");
 section.append(make("h3","Luồng công việc của "+c.channel_id));
 const tablewrap=make("div",undefined,"tablewrap"),table=make("table",undefined,"task-table");
 const header=make("tr");
 for(const h of ["Agent","Nhiệm vụ","Tình trạng"])header.append(make("th",h));
 table.append(header);
 for(const [agent,task,status] of deps){
  const row=make("tr");
  row.append(make("td",agent,"agent-code-cell"),make("td",task));
  const cell=make("td"),state=make("span",status.replaceAll("_"," "),"task-state");
  cell.append(state);row.append(cell);table.append(row);
 }
 tablewrap.append(table);section.append(tablewrap);$("details").append(section);
 $("details").append(make("p","Mỗi nhiệm vụ gắn campaign_id, channel_id, phiên bản hồ sơ, SHA-256 và Agent tiếp nhận. Một chiến dịch N kênh cần N nhánh A03.","muted"));
}
function renderHistory(c){
 $("details").append(
  infoSection("Phiên bản chiến lược","Bản nháp, chưa có hồ sơ được CEO phê duyệt.",[
   ["Phiên bản hiện tại",c.channel_id+" · V"+c.version,false],["Trạng thái",c.profile_status,false]
  ]),
  infoSection("Lịch sử nội dung & QC","Chỉ hiển thị dữ liệu xác thực khi Registry đã có quyền truy cập phù hợp.",[
   ["Lịch sử video","Chưa có dữ liệu video thật.",false],["Kiểm tra chất lượng","A08 rà tính nguyên bản, tính nhất quán; A09 rà chính sách, ngôn ngữ và an toàn.",true]
  ]),
  infoSection("Quy trình thay đổi định hướng","Không tự cập nhật nội dung hoặc phê duyệt phiên bản mới.",[
   ["Trình tự","A02 đề xuất → A00 lập bản mới → CEO duyệt G1 → các Agent mới được nhận phiên bản đã duyệt.",true]
  ])
 );
 $("details").append(make("p","Chưa có số liệu thực tế hoặc quyền phê duyệt được xác nhận. Tất cả chỉ là hồ sơ staging.","checkpoint"));
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
