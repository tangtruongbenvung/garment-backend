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
 ["Ngày hội tí hon","Sân khấu và lễ hội","rộn ràng, lịch sự"]
];
const names={A00:"Điều phối",A01:"Nghiên cứu xu hướng",A02:"Định hướng kênh",A03:"Viết kịch bản/caption",A04:"Nhân vật/ảnh",A05:"Sản xuất video",A06:"Quản lý kênh",A07:"Đăng sau G2",A08:"QC ngôn ngữ và nguyên bản",A09:"Tuân thủ/chính sách",A10:"Phân tích kết quả",A11:"Chi phí và KPI",A12:"Đối thủ",A13:"Tham chiếu viral",A14:"Bán hàng",A15:"Chăm sóc khách hàng",A16:"Lắng nghe cộng đồng",A17:"Tương tác minh bạch"};
const assigned=["A00","A01","A02","A03","A04","A05","A06","A07","A08","A09","A10","A11","A12","A13","A16","A17"];
const deps=[["A00","Điều phối, bảo đảm đúng kênh","PENDING_G1"],["A02","Duy trì hồ sơ chiến lược, chủ đề, giọng điệu","DRAFT_ONLY"],["A03","Kịch bản, caption, reply_library đúng profile v1","BLOCKED_G1"],["A04","Nhân vật và visual bible đồng nhất","BLOCKED_G1"],["A05","Video 20–60 giây theo script/visual bible","BLOCKED_G1"],["A08","So nội dung với hồ sơ kênh, trùng lặp, QC","NOT_RUN"],["A09","An toàn trẻ em, ngôn ngữ, quyền nội dung","NOT_RUN"],["A06","Đóng gói đúng kênh, trình G2","BLOCKED_G1"],["A07","Chỉ đăng khi G2+hash+quyền hợp lệ","BLOCKED_G2"],["A10","Dữ liệu thật 24h/72h/7 ngày sau đăng","NO_DATA"]];
let channels=[],selected="",page=0,tab="strategy";
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
function filtered(){const q=$("search").value.toLocaleLowerCase("vi"),p=$("platform").value;return channels.filter(c=>(!p||c.platform===p)&&(!q||(c.name+" "+c.channel_id+" "+c.pillars).toLocaleLowerCase("vi").includes(q)));}
function list(){
 const a=filtered(),size=Number($("pagesize").value),max=Math.max(1,Math.ceil(a.length/size));page=Math.min(page,max-1);
 $("matched").textContent=a.length+" / "+channels.length+" kênh minh họa";
 $("channelList").replaceChildren();
 for(const c of a.slice(page*size,(page+1)*size)){
  const b=make("button",undefined,"channel-row"+(c.channel_id===selected?" selected":""));b.type="button";
  b.append(make("strong",c.name),make("small",c.channel_id+" · "+c.platform+" · V"+c.version+" · CHỜ G1"));
  b.addEventListener("click",()=>{selected=c.channel_id;list();detail();});$("channelList").append(b);
 }
 $("page").textContent=(page+1)+" / "+max;$("prev").disabled=page===0;$("next").disabled=page+1>=max;
}
function renderStrategy(c){
 const grid=make("div",undefined,"data-grid");
 for(const [k,v,w] of [["Định vị xuyên suốt",c.positioning,true],["Đối tượng",c.audience,false],["Trụ cột nội dung",c.pillars,false],["Giọng điệu và cá tính",c.voice,false],["Nhân vật / Character Bible",c.character,true],["Phong cách hình ảnh",c.visual,false],["Quy tắc CTA",c.cta,false],["Những điều cấm",c.rules,true],["Mục tiêu kênh",c.goal,true]])grid.append(field(k,v,w));
 $("details").append(grid);
 $("details").append(make("p","Mọi Agent phải nhận đúng channel_id, profile_version và profile_sha256. Mọi thay đổi định vị cần tạo phiên bản mới, A02/A00 chuẩn bị đề xuất CEO phê duyệt.","checkpoint"));
}
function renderAgents(c){
 $("details").append(make("p","Agent dùng chung toàn hệ thống nhưng từng nhiệm vụ phải gắn với "+c.channel_id+". Không có Agent nào được tự đổi hồ sơ chiến lược đã chốt.","muted"));
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
 $("channelId").textContent=c.channel_id+" · "+c.platform;
 $("channelName").textContent=c.name;
 $("channelMeta").textContent="Định hướng: "+c.pillars+" · hồ sơ nháp v"+c.version+" · "+c.assigned_agents.length+" Agent được phân công trong mô phỏng";
 $("details").replaceChildren();
 if(tab==="strategy")renderStrategy(c);
 else if(tab==="agents")renderAgents(c);
 else if(tab==="tasks")renderTasks(c);
 else renderHistory(c);
 for(const b of document.querySelectorAll(".tabs button"))b.classList.toggle("active",b.dataset.view===tab);
}
function refresh(n){channels=demo(n);selected=channels[0].channel_id;page=0;const counts=channels.reduce((a,c)=>{a[c.platform]=(a[c.platform]||0)+1;return a;},{});$("total").textContent=n;$("fbcount").textContent=counts.FANPAGE||0;$("ttcount").textContent=counts.TIKTOK||0;list();detail();}
for(const id of ["search","platform","pagesize"])$(id).addEventListener(id==="search"?"input":"change",()=>{page=0;list();});
$("demoCount").addEventListener("change",()=>refresh(Number($("demoCount").value)));
$("prev").addEventListener("click",()=>{page--;list();});
$("next").addEventListener("click",()=>{page++;list();});
for(const b of document.querySelectorAll(".tabs button"))b.addEventListener("click",()=>{tab=b.dataset.view;detail();});
refresh(20);