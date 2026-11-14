"use strict";
// Preview UI only. No storage or agent execution, no production use.
const $=id=>document.getElementById(id);
let last=null;
const host="deploy-preview-1--ducduy-ai-os-test.netlify.app";
const t=(tag,value,klass)=>{
 const e=document.createElement(tag);
 if(value!==undefined)e.textContent=String(value);
 if(klass)e.className=klass;
 return e;
};
function show(message,ok=false){$("status").textContent=message;$("status").className=ok?"pass":"fail";}
function channelRows(){
 const n=Number($("count").value);
 if(!Number.isInteger(n)||n<1||n>20){show("Số kênh cần từ 1 đến 20.");return;}
 const previous=Array.from($("channels").children).map(e=>({
  id:e.querySelector('[data-role="id"]')?.value,
  name:e.querySelector('[data-role="name"]')?.value,
  platform:e.querySelector('[data-role="platform"]')?.value
 }));
 $("channels").replaceChildren();
 for(let i=0;i<n;i++){
  const row=t("div");
  row.style.cssText="display:grid;grid-template-columns:80px minmax(0,1fr) 135px;gap:7px;margin:8px 0;align-items:center";
  const id=document.createElement("input");
  id.type="text";id.dataset.role="id";id.value=previous[i]?.id||"demo-"+String(i+1).padStart(2,"0");
  id.setAttribute("aria-label","Mã kênh "+(i+1));id.maxLength=64;
  const name=document.createElement("input");
  name.type="text";name.dataset.role="name";name.value=previous[i]?.name||"Kênh demo "+(i+1);
  name.setAttribute("aria-label","Tên kênh "+(i+1));name.maxLength=100;
  const platform=document.createElement("select");platform.dataset.role="platform";platform.setAttribute("aria-label","Nền tảng kênh "+(i+1));
  for(const p of ["FANPAGE","TIKTOK"]){const o=document.createElement("option");o.value=p;o.textContent=p;platform.append(o);}
  platform.value=previous[i]?.platform|| (i%2===0?"FANPAGE":"TIKTOK");
  row.append(id,name,platform);$("channels").append(row);
 }
}
function print(result){
 $("results").replaceChildren();$("totals").textContent=
 "Đã tạo "+result.script_count+"/"+result.channel_count+" bản nháp · "+result.status+
 " · Bộ mẫu cố định, không gọi LLM, không ghi database.";
 for(const s of result.scripts){
  const card=t("article",undefined,"panel");card.style.margin="12px 0";
  card.append(t("h2",s.channel_id+" · "+s.creative.title));
  card.append(t("p","Nền tảng: "+s.platform+" · Góc sáng tạo: "+s.creative.approach+" · 30 giây"));
  const summary=t("p","Tình huống: "+s.creative.story);card.append(summary);
  const ol=t("ol");for(const scene of s.scenes){const li=t("li",scene.from+"–"+scene.to+" giây: "+scene.visual+" "+(scene.speech||""));ol.append(li);}
  card.append(ol,t("p","Câu chốt: "+s.creative.punchline),t("p","Caption: "+s.caption));
  card.append(t("p","QC A08: "+s.review.A08+" · Compliance A09: "+s.review.A09+" · G1/G2: CHƯA DUYỆT · KHÔNG ĐĂNG", "warning"));
  $("results").append(card);
 }
}
async function generate(){
 if(location.protocol!=="https:"||location.hostname!==host){show("Chỉ cho phép trên Deploy Preview staging.");return;}
 const token=$("token").value;
 if(token.length<32){show("Cần khóa staging hợp lệ, không dùng token CEO hay mật khẩu.");return;}
 const channels=Array.from($("channels").children).map(e=>({
  channel_id:e.querySelector('[data-role="id"]').value.trim(),
  name:e.querySelector('[data-role="name"]').value.trim(),
  platform:e.querySelector('[data-role="platform"]').value
 }));
 if(channels.length!==Number($("count").value)){show("Số kênh không khớp, hãy kiểm tra.");return;}
 const campaign_id=$("campaign").value.trim();
 $("generate").disabled=true;
 show("Đang yêu cầu bản nháp kiểm thử...");
 try{
  const res=await fetch("/api/dd04-a00/a03-preview",{
   method:"POST",
   headers:{"content-type":"application/json","authorization":"Bearer "+token},
   body:JSON.stringify({campaign_id,channels}),cache:"no-store",referrerPolicy:"no-referrer"
  });
  const data=await res.json();
  if(!res.ok||!data.ok)throw new Error(data.error||"HTTP "+res.status);
  if(data.scripts.length!==channels.length||data.script_count!==channels.length||data.real_llm_execution!==false)throw new Error("SCRIPT_COUNT_OR_STAGE_MISMATCH");
  last=data;print(data);$("download").disabled=false;
  show("PASS: "+data.script_count+" kịch bản khác hướng, tương ứng "+channels.length+" kênh. Chỉ là bản nháp mẫu.",true);
 }catch(e){last=null;$("download").disabled=true;show("Chưa tạo được: "+e.message);}
 finally{$("generate").disabled=false;}
}
function download(){
 if(!last)return;
 const blob=new Blob([JSON.stringify(last,null,2)],{type:"application/json;charset=utf-8"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="DD04_A03_"+last.campaign_id+"_draft_scripts_reply_library.json";
 document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
}
$("count").addEventListener("change",channelRows);
$("generate").addEventListener("click",()=>void generate());
$("download").addEventListener("click",download);
$("clear").addEventListener("click",()=>{last=null;$("token").value="";$("results").replaceChildren();$("download").disabled=true;$("totals").textContent="Đã xóa kết quả.";show("Đã xóa khóa khỏi giao diện.",true);});
window.addEventListener("pagehide",()=>{last=null;$("token").value="";});
channelRows();
