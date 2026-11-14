"use strict";
(()=>{
 const el=id=>document.getElementById(id);
 const live={records:[],lastIds:[],connected:false};
 const strictHost=/^deploy-preview-1--ducduy-ai-os-test[.]netlify[.]app$/;
 const allowedStatus=new Set(["WAITING_CEO_PLAN","PLANNED_WAIT_G1","READY","IN_PROGRESS","REVIEW","REWORK","HOLD","DONE","BLOCKED"]);
 const api="/api/dd04-a00/commands/";
 function make(tag,text,cls){
  const n=document.createElement(tag);
  if(text!==undefined)n.textContent=String(text);
  if(cls)n.className=cls;
  return n;
 }
 function reset(){
  live.records=[];live.connected=false;
  for(const id of ["liveSummary","liveNodes","liveLines","liveTasks","liveAudit","liveDetails"])el(id).replaceChildren();
  el("liveDetails").append(make("p","Không có bản ghi được API xác minh.","muted"));
  el("liveTasks").append(make("p","Không có dữ liệu được xác minh.","muted"));
  el("liveAudit").append(make("p","Không có dữ liệu được xác minh.","muted"));
 }
 function notice(value,error=false){
  const n=el("liveMessage");n.textContent=value;n.className="live-message"+(error?" error":"");
 }
 function addStat(title,value){
  const c=make("div");c.append(make("small",title),make("b",value));el("liveSummary").append(c);
 }
 function field(box,title,value){
  const row=make("div",undefined,"field");row.append(make("strong",title+"  "),make("span",value));box.append(row);
 }
 function viewRecord(record){
  const b=make("div",undefined,"live-record");
  field(b,"Mã lệnh",record.command_id);
  field(b,"Trạng thái",record.status);
  field(b,"Nguồn",record.origin);
  field(b,"Thời gian",record.received_at);
  field(b,"G1",Array.isArray(record.approvals)?record.approvals.map(a=>a.stage+":"+a.decision).join(", "):"Không xác định");
  field(b,"Biên bản",record.meeting&&record.meeting.status||"Không có");
  field(b,"Nhiệm vụ",Array.isArray(record.task_graph)?record.task_graph.length:"Không xác định");
  el("liveDetails").append(b);
 }
 function table(records,source){
  const t=make("table"),thead=make("thead"),head=make("tr");
  for(const label of ["Mã lệnh","Agent","Task ID","Trạng thái","Phiên bản","Nguồn"]){head.append(make("th",label))}
  thead.append(head);t.append(thead);
  const body=make("tbody");
  for(const r of records){
   for(const task of r.task_graph){
    const tr=make("tr");
    for(const value of [r.command_id,task.owner_agent,task.task_id,task.status,task.revision||"—",source]){
     tr.append(make("td",value));
    }
    body.append(tr);
   }
  }
  t.append(body);el("liveTasks").append(t);
 }
 function events(records){
  for(const r of records)for(const event of r.audit||[]){
   const row=make("div",undefined,"live-record");
   row.append(make("strong",event.event||"Không có event"),make("p",(event.at||"") +" · "+(event.actor||"UNKNOWN")));
   el("liveAudit").append(row);
  }
 }
 function map(records){
  const agents=[...new Set(records.flatMap(r=>r.task_graph.map(t=>t.owner_agent)))].filter(id=>/^A(0[0-9]|1[0-7])$/.test(id));
  if(!agents.includes("A00"))agents.unshift("A00");
  const selected=agents.filter(id=>id!=="A00");
  const scene=el("liveScene"),nodes=el("liveNodes"),svg=el("liveLines"),w=scene.clientWidth,h=scene.clientHeight;
  svg.setAttribute("viewBox","0 0 "+w+" "+h);
  const cx=w*.5,cy=h*.48,radius=Math.min(w*.37,225);
  const ns="http://www.w3.org/2000/svg";
  selected.forEach((id,i)=>{
   const angle=-Math.PI/2+i/selected.length*Math.PI*2;
   const x=cx+Math.cos(angle)*radius,y=cy+Math.sin(angle)*radius*.72;
   const path=document.createElementNS(ns,"path");
   path.setAttribute("d","M "+cx+" "+cy+" Q "+((cx+x)/2)+" "+((cy+y)/2-25)+" "+x+" "+y);
   path.setAttribute("class","live-path");svg.append(path);
   const node=make("div",undefined,"live-node");
   const statuses=[...new Set(records.flatMap(r=>r.task_graph.filter(t=>t.owner_agent===id).map(t=>t.status)))];
   node.append(make("b",id),make("small",statuses.join(", ")||"Không có nhiệm vụ"));
   node.style.left=x+"px";node.style.top=y+"px";nodes.append(node);
  });
 }
 function render(records,source='A00_API'){
  reset();
  // Remove empty-state placeholders after records pass API validation.
  for(const id of ['liveDetails','liveTasks','liveAudit'])el(id).replaceChildren();
  live.records=records;live.connected=true;
  const all=records.flatMap(r=>r.task_graph);
  const agents=new Set(all.map(t=>t.owner_agent));
  const working=all.filter(t=>t.status==="IN_PROGRESS").length;
  const planned=all.filter(t=>t.status==="PLANNED_WAIT_G1").length;
  addStat("Lệnh API đã đọc",records.length);
  addStat("Tác vụ đã tạo",all.length);
  addStat("Agent được phân tuyến",agents.size);
  addStat("Chờ G1 / chưa thực thi",planned);
  if(working)notice("Đọc được "+records.length+" lệnh; có "+working+" tác vụ ghi IN_PROGRESS, cần kiểm chứng bằng runtime telemetry.",false);
  else notice("PASS · Đã đọc "+records.length+" bản ghi API thật. Chưa có bằng chứng Agent đang thực thi; "+planned+" tác vụ đang chờ G1.",false);
  records.forEach(viewRecord);table(records,source);events(records);map(records);
 }
 function valid(record,id){
  return record&&record.schema_version==="5.3"&&record.command_id===id&&Array.isArray(record.task_graph)&&
   typeof record.status==="string"&&
   record.task_graph.length<=18&&record.task_graph.every(t=>t&&/^A(0[0-9]|1[0-7])$/.test(t.owner_agent)&&typeof t.status==="string"&&typeof t.task_id==="string");
 }
 async function load(){
  if(!strictHost.test(location.hostname)||location.protocol!=="https:"){notice("Chỉ truy cập từ Deploy Preview #1 của Đức Duy. Không nhập khóa ở trang khác.",true);return}
  const token=el("liveToken").value.trim();
  if(token.length<32){notice("Khóa thử nghiệm chưa hợp lệ; cần ít nhất 32 ký tự.",true);return}
  const ids=[...new Set(el("liveIds").value.split(",").map(s=>s.trim()).filter(Boolean))];
  if(!ids.length||ids.length>5||ids.some(s=>!/^cmd_[a-f0-9]{20}$/.test(s))){notice("Cần 1–5 mã lệnh hợp lệ dạng cmd_ + 20 ký tự hex.",true);return}
  const btn=el("liveLoad");btn.disabled=true;reset();notice("Đang đọc dữ liệu từ A00 API…");
  const found=[],errors=[];
  try{
   for(const id of ids){
    try{
     const response=await fetch(api+id,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
     const record=await response.json();
     if(response.ok&&valid(record,id))found.push(record);
     else errors.push(id+": HTTP "+response.status+" "+(response.status===404?"(không có bản ghi trong deploy này)":response.status===401?"(khóa không hợp lệ)":"(dữ liệu hoặc phản hồi không hợp lệ)"));
    }catch(e){errors.push(id+": không kết nối được API");}
   }
   if(found.length)render(found);
   if(errors.length)notice("Đọc thành công "+found.length+"/"+ids.length+" bản ghi. "+errors.join(" · "),true);
   if(!found.length&&!errors.length)notice("Không có bản ghi API được xác minh.",true);
  }finally{btn.disabled=false;}
 }
 let listMode=false;
 async function loadAll(){
  if(!strictHost.test(location.hostname)||location.protocol!=="https:"){notice("Không đúng domain Deploy Preview #1.",true);return}
  const token=el("liveToken").value.trim();
  if(token.length<32){notice("Nhập khóa staging hợp lệ trước khi đọc danh sách.",true);return}
  const btn=el("liveAll");btn.disabled=true;reset();notice("Đang tải danh sách lệnh đã lưu trong deploy này…");
  try{
   const response=await fetch("/api/dd04-a00/commands",{headers:{Authorization:"Bearer "+token},cache:"no-store"});
   const data=await response.json();
   if(!response.ok){notice("Không đọc được danh sách: HTTP "+response.status+" · "+(data.error||"Lỗi API"),true);listMode=false;return}
   if(!Array.isArray(data.records)||!["DEPLOY_SCOPED_BLOBS_API","SUPABASE_STAGING_POSTGRES"].includes(data.source)){notice("API không trả về dữ liệu được xác minh.",true);return}
   const records=data.records.filter(r=>valid(r,r.command_id));
   if(!records.length){notice("Chưa có lệnh trong deploy hiện tại. Hãy tạo lệnh thử mới ở trang operator-test; không dùng dữ liệu DEMO.",true);listMode=true;return}
   render(records,data.source);
   if(data.truncated)notice("Đã đọc "+records.length+" lệnh từ "+data.source+", API giới hạn 30 bản ghi. Có thể đọc thêm theo mã lệnh.",true);
   listMode=true;
  }catch(e){notice("Không gọi được API danh sách lệnh.",true)}
  finally{btn.disabled=false}
 }
 el("liveAll").addEventListener("click",loadAll);

 el("liveLoad").addEventListener("click",load);
 el("liveClear").addEventListener("click",()=>{
   el("liveToken").value="";el("liveIds").value="";listMode=false;reset();notice("Đã xóa khóa khỏi ô nhập và xóa bản ghi khỏi giao diện.");
 });
 window.addEventListener("pagehide",()=>{el("liveToken").value="";reset();});
 window.addEventListener("resize",()=>{if(live.connected){el("liveNodes").replaceChildren();el("liveLines").replaceChildren();map(live.records);}});
 reset();
})();
