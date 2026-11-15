"use strict";
// DD04-A00-017 V5.5: CEO observes Agent work, only financial exceptions need CEO decisions.
// The API key is explicitly publishable, never a service_role key.
const API="https://wbvkqfnrlasmtizjszab.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU";
const CALLBACK="https://deploy-preview-1--ducduy-ai-os-test.netlify.app/dd04-agent-control/ceo-login.html";
const EXPECTED_HOST="deploy-preview-1--ducduy-ai-os-test.netlify.app";
const $=id=>document.getElementById(id);
let accessToken="",refreshToken="",factorId="",recoveryMode=false;
let currentReadiness=null;
let worklistRows=[];
function message(text,ok=false){$("message").textContent=text;$("message").className=ok?"pass":"fail";}
function diagnostic(code){$("callbackDiagnostics").textContent="Chẩn đoán callback: "+code+". Không ghi/lưu token.";}
function tile(id,value,kind="neutral"){
 const el=$(id);el.textContent=value;el.dataset.state=kind;
}
function resetReadiness(){
 currentReadiness=null;
 tile("authState","Chờ xác minh");
 tile("ceoState","Chờ xác minh");
 tile("mfaState","Chờ xác minh");
 tile("gateState","Đang khóa");
 $("gateReviewPanel").hidden=true;
 $("gateApprovalSelect").replaceChildren(new Option("Chưa tải danh sách",""));
 $("gateApprovalId").value="";
 worklistRows=[];
 $("worklistSummary").textContent="Chưa tải dữ liệu từ server.";
 $("worklistBody").replaceChildren();
 $("mfaHelp").hidden=true;
 $("sessionGuidance").textContent="Đang kiểm tra danh tính và quyền CEO từ server. Mỗi phiên cần MFA riêng.";
}
function clearSecret(){$("secret").value="";$("totpCode").value="";$("totpEnroll").hidden=true;$("verifyPanel").hidden=true;}
function logout(){
 accessToken="";refreshToken="";factorId="";recoveryMode=false;clearSecret();resetReadiness();$("password").value="";
 $("newPassword").value="";$("confirmPassword").value="";$("passwordRecoveryPanel").hidden=true;
 $("sessionPanel").hidden=true;$("loginPanel").hidden=false;$("identity").textContent="";
 $("readinessStatus").textContent="Phiên đã đăng xuất; điều kiện G1/G2 chưa xác minh.";
 $("gateReviewStatus").textContent="Đã đăng xuất. Không có quyết định được ghi.";
 message("Đã xóa phiên khỏi tab hiện tại. Hồ sơ CEO trong cơ sở dữ liệu không thay đổi.",true);
}
// Callback handles fragment sessions and safe recovery token hashes; no token is ever logged.
// Immediately delete fragment and query parameters before rendering or making HTTP requests.
async function parseCallback(){
 const hash=location.hash;
 const query=location.search;
 if(hash||query)history.replaceState(null,"",location.pathname);
 if(!hash&&!query){diagnostic("DIRECT_PAGE_NO_AUTH");return;}
 const h=new URLSearchParams(hash.startsWith("#")?hash.slice(1):hash);
 const q=new URLSearchParams(query.startsWith("?")?query.slice(1):query);
 const p=h.has("access_token")?h:q;
 if(h.has("error")||q.has("error")){
  diagnostic("SUPABASE_ERROR_RETURNED");
  message("Supabase từ chối hoặc liên kết đã hết hạn. Hãy kiểm tra email và mẫu Reset Password; không gửi token cho người khác.");
  return;
 }
 if(p.get("access_token")&&(!p.get("token_type")||p.get("token_type").toLowerCase()==="bearer")){
  diagnostic("BEARER_SESSION_RECEIVED");
  accessToken=p.get("access_token")||"";
  refreshToken=p.get("refresh_token")||"";
  recoveryMode=p.get("type")==="recovery";
  return;
 }
 if(q.get("type")==="recovery" && q.get("token_hash")){
  diagnostic("RECOVERY_TOKEN_HASH_RECEIVED");
  try{
   const verified=await auth("/verify",{method:"POST",body:{type:"recovery",token_hash:q.get("token_hash")}});
   if(!verified?.access_token)throw new Error("NO_SESSION");
   accessToken=verified.access_token;
   refreshToken=verified.refresh_token||"";
   recoveryMode=true;
   await checkSession();
  }catch{
   diagnostic("RECOVERY_TOKEN_HASH_REJECTED");
   message("Liên kết token_hash không xác minh được hoặc đã dùng/hết hạn. Không tiếp tục thử lại email cũ.");
  }
  return;
 }
 if(q.has("code")){
  diagnostic("PKCE_CODE_UNSUPPORTED");
  message("Liên kết sử dụng PKCE code nhưng phiên này không có mã xác minh PKCE. Cần cấu hình lại mẫu email Reset Password; không dán mã code vào chat.");
  return;
 }
 if(!hash && !query){
  diagnostic("NO_AUTH_DATA");
  message("Liên kết không có dữ liệu xác thực.");
 }else{
  diagnostic((hash?"FRAGMENT":"QUERY")+"_WITHOUT_AUTH_FIELDS");
  message("Liên kết chưa có phiên xác thực. Địa chỉ chuyển hướng không cung cấp dữ liệu xác thực được hỗ trợ.");
 }
}
async function auth(path,{method="GET",body,authorized=false}={}){
 const headers={"apikey":PUBLISHABLE_KEY,"accept":"application/json"};
 if(body!==undefined)headers["content-type"]="application/json";
 if(authorized){
  if(!accessToken)throw new Error("Chưa đăng nhập hoặc phiên đã hết.");
  headers.authorization="Bearer "+accessToken;
 }
 const response=await fetch(API+"/auth/v1"+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(10000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(response.status===429?"Thao tác quá nhanh, hãy thử lại sau.":typeof data.msg==="string"?data.msg:typeof data.error_description==="string"?data.error_description:typeof data.message==="string"?data.message:"Supabase Auth từ chối yêu cầu (HTTP "+response.status+").");
 return data;
}
async function checkSession(){
 if(!accessToken)return;
 try{
  const user=await auth("/user",{authorized:true});
  if(!user?.id||!user?.email_confirmed_at||user?.is_anonymous===true)throw new Error("Tài khoản chưa đủ điều kiện email đã xác minh.");
  $("identity").textContent="Supabase Auth: Email đã xác minh. ID người dùng đã kiểm tra (được giữ riêng tư).";
  $("loginPanel").hidden=true;$("password").value="";
  if(recoveryMode){
   $("sessionPanel").hidden=true;$("passwordRecoveryPanel").hidden=false;
   diagnostic("RECOVERY_SESSION_VERIFIED");
   message("Đã xác minh liên kết khôi phục. Nhập mật khẩu mới; chưa có quyền CEO hoặc G1/G2.",true);
   return;
  }
  $("passwordRecoveryPanel").hidden=true;$("sessionPanel").hidden=false;
  message("Đã đăng nhập Auth; đang kiểm tra quyền CEO và MFA phiên này.",true);
  await loadFactors();
  await checkCeoReadiness();
 }catch(e){diagnostic("AUTH_USER_VERIFICATION_FAILED");logout();message("Không xác minh được phiên Supabase: "+e.message);}
}
async function passwordSignIn(){
 const email=$("email").value.trim(),password=$("password").value;
 if(!email||!password){message("Vui lòng nhập email và mật khẩu.");return;}
 try{
  const data=await auth("/token?grant_type=password",{method:"POST",body:{email,password}});
  accessToken=data.access_token||"";refreshToken=data.refresh_token||"";
  if(!accessToken)throw new Error("Supabase không trả về phiên đăng nhập.");
  await checkSession();
 }catch(e){message("Đăng nhập chưa thành công: "+e.message);}
 finally{$("password").value="";}
}
async function magicSignIn(){
 const email=$("email").value.trim();
 if(!email||!email.includes("@")){message("Nhập email hợp lệ để nhận liên kết.");return;}
 try{
  await auth("/otp?redirect_to="+encodeURIComponent(CALLBACK),{method:"POST",body:{email,create_user:false}});
  message("Đã gửi yêu cầu đăng nhập qua email. Chỉ mở liên kết mới; đừng gửi ảnh URL có token.",true);
 }catch(e){message("Không gửi được liên kết email: "+e.message);}
}
async function requestPasswordRecovery(){
 const email=$("email").value.trim();
 if(!email||!email.includes("@")){message("Vui lòng nhập email tài khoản staging đã được xác minh.");return;}
 try{
  await auth("/recover?redirect_to="+encodeURIComponent(CALLBACK),{method:"POST",body:{email}});
  message("Đã gửi yêu cầu thiết lập mật khẩu. Kiểm tra email mới; đường dẫn chỉ dùng một lần. Nếu Supabase giới hạn 2 email/giờ, không bấm lại liên tục.",true);
 }catch(e){message("Không gửi được email khôi phục: "+e.message);}
}
function strongPassword(password){
 return password.length>=12&&password.length<=128&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/[0-9]/.test(password)&&/[^a-zA-Z0-9]/.test(password);
}
async function savePassword(){
 if(!recoveryMode||!accessToken){message("Bạn cần mở liên kết khôi phục mới và xác minh phiên trước khi đặt mật khẩu.");return;}
 const password=$("newPassword").value,confirm=$("confirmPassword").value;
 if(!strongPassword(password)){message("Mật khẩu phải có ít nhất 12 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.");return;}
 if(password!==confirm){message("Hai lần nhập mật khẩu chưa trùng nhau.");return;}
 try{
  const user=await auth("/user",{method:"PUT",authorized:true,body:{password}});
  if(!user?.id)throw new Error("Không xác nhận được việc cập nhật mật khẩu.");
  logout();
  message("Đã cập nhật mật khẩu qua Supabase Auth. Hãy đăng nhập lại bằng mật khẩu mới rồi thiết lập MFA. Chưa cấp quyền CEO.",true);
 }catch(e){message("Chưa cập nhật được mật khẩu: "+e.message);}
 finally{$("newPassword").value="";$("confirmPassword").value="";}
}
async function loadFactors(){
 // Supabase Auth returns user.factors via GET /auth/v1/user; GET /factors is not a public list endpoint.
 const data=await auth("/user",{authorized:true});
 const factors=Array.isArray(data?.factors)?data.factors:[];
 const verified=factors.find(x=>x.factor_type==="totp"&&x.status==="verified");
 if(verified){
  factorId=verified.id;
  $("enrollBtn").hidden=true;
  $("verifyPanel").hidden=false;$("totpEnroll").hidden=true;
  message("Đã tìm thấy MFA TOTP. Hãy nhập mã Authenticator để nâng mức xác thực.",true);
 }else{
  factorId="";
  $("enrollBtn").hidden=false;
  message("Chưa tìm thấy TOTP đã xác minh ở phiên Auth. Chỉ tạo MFA mới nếu bạn thực sự chưa đăng ký.",true);
 }
}
async function enroll(){
 if(!accessToken){message("Đăng nhập trước khi thiết lập MFA.");return;}
 if(factorId){message("Đã có MFA TOTP; hãy nhập mã xác minh, không tạo thêm factor.");return;}
 try{
  const data=await auth("/factors",{method:"POST",authorized:true,body:{factor_type:"totp",friendly_name:"DD04 CEO staging"}});
  if(!data?.id||!data?.totp?.secret)throw new Error("Supabase không trả mã TOTP.");
  factorId=data.id;$("secret").value=data.totp.secret;$("secret").type="password";
  $("totpEnroll").hidden=false;$("verifyPanel").hidden=false;
  message("Đã tạo MFA TOTP chưa xác minh. Hãy thêm mã bí mật vào Authenticator rồi nhập OTP bên dưới.",true);
 }catch(e){message("Chưa thể đăng ký MFA: "+e.message);}
}
async function verify(){
 const code=$("totpCode").value.trim();
 if(!factorId||!/^[0-9]{6}$/.test(code)){message("Cần mã TOTP 6 chữ số và factor hợp lệ.");return;}
 try{
  const challenge=await auth("/factors/"+encodeURIComponent(factorId)+"/challenge",{method:"POST",authorized:true,body:{}});
  if(!challenge?.id)throw new Error("Không tạo được thử thách MFA.");
  const data=await auth("/factors/"+encodeURIComponent(factorId)+"/verify",{method:"POST",authorized:true,body:{challenge_id:challenge.id,code}});
  if(!data?.access_token)throw new Error("Supabase chưa trả phiên sau MFA.");
  accessToken=data.access_token;refreshToken=data.refresh_token||"";
  clearSecret();
  await auth("/user",{authorized:true});
  message("Đã xác minh MFA với Supabase. Đang kiểm tra lại quyền CEO và phiên AAL2...",true);
  await checkCeoReadiness();
 }catch(e){message("Xác minh MFA chưa đạt: "+e.message);}
 finally{$("totpCode").value="";}
}
async function checkCeoReadiness(){
 if(!accessToken){message("Đăng nhập và xác minh phiên trước khi kiểm tra quyền CEO.");return;}
 $("readinessStatus").textContent="Đang đối chiếu Auth, MFA và quyền CEO với Supabase staging...";
 try{
  const response=await fetch("/api/dd04-ceo-readiness",{
   method:"POST",headers:{"authorization":"Bearer "+accessToken,"accept":"application/json"},
   cache:"no-store",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(12000)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
   resetReadiness();
   $("readinessStatus").textContent="Không xác minh được: "+(result.error||"HTTP "+response.status)+". G1/G2 tiếp tục khóa.";
   return;
  }
  currentReadiness=result;
  tile("authState",result.identity_verified?"Đã xác minh":"Chưa xác minh",result.identity_verified?"ok":"warn");
  tile("ceoState",result.enrollment_verified?"CEO ACTIVE":"Chưa xác minh",result.enrollment_verified?"ok":"warn");
  tile("mfaState",result.mfa_aal2?"AAL2 đạt":"Cần xác minh MFA",result.mfa_aal2?"ok":"warn");
  tile("gateState","A07: đang khóa","blocked");
  $("gateReviewPanel").hidden=!(result.mfa_aal2&&result.enrollment_verified&&result.identity_verified);
  $("mfaHelp").hidden=result.mfa_aal2===true;
  if(!$("gateReviewPanel").hidden && $("gateApprovalSelect").options.length===1 && !$("gateApprovalSelect").value)await loadGateQueue();
  $("sessionGuidance").textContent=result.enrollment_verified
   ? "Quyền CEO ACTIVE. V5.5: CEO gửi lệnh/tài liệu và quản lý ngoại lệ tài chính; nội bộ Agent tự kiểm tra khi hệ thống được nghiệm thu."
   : "Tài khoản Auth đã xác minh; quyền CEO chưa được server xác nhận. Không có quyền duyệt G1/G2.";
  const missing=Array.isArray(result.missing)?result.missing:[];
  $("readinessStatus").textContent=
   result.mfa_aal2&&result.enrollment_verified
    ? "Đã xác minh Auth, CEO và MFA. Các cổng legacy vẫn khóa; công việc Agent xem tại mục 5. Mã: "+missing.join(", ")
    : "Thiếu điều kiện: "+missing.join(", ")+". Sổ công việc chỉ đọc; không tự phê duyệt từ trang này.";
 }catch{
  resetReadiness();
  $("readinessStatus").textContent="Không kiểm tra được server staging. Mọi quyết định vẫn khóa.";
 }
}
async function loadGateQueue(){
 const $queue=$("gateApprovalSelect");
 $queue.replaceChildren(new Option("Đang tải...", ""));
 $("gateQueueStatus").textContent="Đang kiểm tra Auth, MFA và danh sách chờ duyệt...";
 if(currentReadiness?.mfa_aal2!==true||currentReadiness?.enrollment_verified!==true){
  $queue.replaceChildren(new Option("Chưa đủ điều kiện MFA/CEO", ""));
  $("gateQueueStatus").textContent="Phải xác minh MFA AAL2 và quyền CEO trước khi tải danh sách.";return;
 }
 try{
  const r=await fetch("/api/dd04-ceo-gate-list",{
   method:"POST",headers:{"authorization":"Bearer "+accessToken,"accept":"application/json"},
   cache:"no-store",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(12000)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||"HTTP "+r.status);
  const items=Array.isArray(data.items)?data.items:[];
  $queue.replaceChildren(new Option(items.length?"Chọn yêu cầu để xem hồ sơ":"Chưa có yêu cầu chờ duyệt",""));
  for(const a of items){
   if(!/^[0-9a-f-]{36}$/i.test(a?.approval_id||""))continue;
   if(a.gate!=="G2")continue;
   const label="G2 đăng bài · "+a.command_id+" · V"+a.revision+" · "+a.command_status;
   $queue.add(new Option(label,a.approval_id));
  }
  $("gateQueueStatus").textContent="Đã tải "+items.length+" bài G2 đang chờ CEO. Kế hoạch G1 được Agent kiểm tra nội bộ; chưa thể ghi quyết định đăng.";
 }catch(e){
  $queue.replaceChildren(new Option("Không tải được danh sách",""));
  $("gateQueueStatus").textContent="Không tải được danh sách: "+e.message+". Không có quyết định được ghi.";
 }
}
async function reviewGate(){
 const id=$("gateApprovalId").value.trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
  $("gateReviewStatus").textContent="Cần approval_id UUID hợp lệ từ A00. Không thay đổi quyết định.";return;
 }
 if(!accessToken||currentReadiness?.mfa_aal2!==true||currentReadiness?.enrollment_verified!==true){$("gateReviewStatus").textContent="Cần xác minh Auth, CEO ACTIVE và MFA AAL2 trong phiên này.";return;}
 $("gateReviewStatus").textContent="Đang kiểm tra hồ sơ G1/G2 chỉ đọc...";
 try{
  const r=await fetch("/api/dd04-ceo-gate-review",{
   method:"POST",headers:{"authorization":"Bearer "+accessToken,
    "content-type":"application/json","accept":"application/json"},
   body:JSON.stringify({approval_id:id}),cache:"no-store",
   referrerPolicy:"no-referrer",signal:AbortSignal.timeout(12000)
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok){$("gateReviewStatus").textContent="KHÓA: "+(data.error||"HTTP "+r.status)+". Không có quyết định được ghi.";
   if([401,403].includes(r.status))await checkCeoReadiness();return;}
  const a=data.approval;
  if(a.gate!=="G2"){$("gateReviewStatus").textContent="G1 được chuyển thành kiểm tra nội bộ AI Agent theo V5.4, không nằm trong hàng duyệt CEO.";return;}
  $("gateReviewStatus").textContent=
   "Hồ sơ "+a.gate+" · "+a.command_id+" · V"+a.revision+" · "+a.decision+
   ". Bằng chứng còn thiếu: "+(data.missing||[]).join(", ")+
   ". QUYỀN DUYỆT: KHÓA. Không tạo công việc xuất bản.";
 }catch{$("gateReviewStatus").textContent="Không đọc được hồ sơ staging. G1/G2 vẫn khóa.";}
}
function showWorklist(){
 const selectedAgent=$("worklistAgentFilter").value;
 const selectedStatus=$("worklistStatusFilter").value;
 const displayed=worklistRows.filter(r=>(!selectedAgent||r.owner_agent===selectedAgent)&&
  (!selectedStatus||r.status===selectedStatus));
 const body=$("worklistBody");body.replaceChildren();
 for(const r of displayed){
  const tr=document.createElement("tr");
  const cells=[
   r.command_id+" / "+r.task_id,
   r.owner_agent+" · "+r.role,
   r.status+" (dữ liệu DB)",
   r.evidence_sha256?"Có hash · cần xem QC":"Chưa có hash QC",
   r.tracked_at?new Date(r.tracked_at).toLocaleString("vi-VN"):"Chưa ghi thời gian"
  ];
  for(const value of cells){const td=document.createElement("td");td.textContent=value;tr.append(td);}
  body.append(tr);
 }
 if(!displayed.length){const tr=document.createElement("tr"),td=document.createElement("td");
  td.colSpan=5;td.textContent="Không có công việc phù hợp hoặc dữ liệu chưa được tải.";tr.append(td);body.append(tr);}
 $("worklistSummary").textContent="Hiển thị "+displayed.length+"/"+worklistRows.length+
  " nhiệm vụ thật trong staging. Chưa xác nhận Agent LLM vận hành hay tự phê duyệt. Không thay đổi dữ liệu.";
}
async function loadAgentWorklist(){
 if(!accessToken){$("worklistSummary").textContent="Đăng nhập CEO staging trước khi tải danh sách.";return;}
 $("worklistSummary").textContent="Đang đối chiếu phiên Auth và đọc dữ liệu Supabase...";
 try{
  const res=await fetch("/api/dd04-ceo-agent-worklist",{
   method:"POST",headers:{"authorization":"Bearer "+accessToken,"accept":"application/json"},
   cache:"no-store",referrerPolicy:"no-referrer",signal:AbortSignal.timeout(12000)
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok){$("worklistSummary").textContent="Không tải được: "+(data.error||"HTTP "+res.status);return;}
  worklistRows=Array.isArray(data.rows)?data.rows.filter(x=>/^A(0[0-9]|1[0-7])$/.test(x.owner_agent||"")):[];
  const agents=[...new Set(worklistRows.map(x=>x.owner_agent))].sort();
  const statuses=[...new Set(worklistRows.map(x=>x.status))].sort();
  $("worklistAgentFilter").replaceChildren(new Option("Tất cả Agent",""));
  for(const a of agents)$("worklistAgentFilter").add(new Option(a,a));
  $("worklistStatusFilter").replaceChildren(new Option("Tất cả trạng thái",""));
  for(const state of statuses)$("worklistStatusFilter").add(new Option(state,state));
  showWorklist();
  if(data.truncated)$("worklistSummary").textContent+=" Danh sách giới hạn 200 nhiệm vụ gần nhất.";
 }catch{$("worklistSummary").textContent="Không kết nối được dịch vụ theo dõi trên staging.";}
}
function bind(id,fn){$(id).addEventListener("click",()=>void Promise.resolve(fn()).catch(e=>message("Yêu cầu chưa hoàn thành: "+e.message)));}
if(location.protocol!=="https:"||location.hostname!==EXPECTED_HOST){
 document.body.textContent="Chỉ dùng trang này trên HTTPS Deploy Preview #1 của Đức Duy.";
}else{
 void parseCallback();
 bind("passwordBtn",passwordSignIn);bind("magicBtn",magicSignIn);
 bind("recoveryBtn",requestPasswordRecovery);bind("savePasswordBtn",savePassword);bind("cancelRecoveryBtn",logout);
 bind("enrollBtn",enroll);bind("factorBtn",loadFactors);bind("verifyBtn",verify);bind("logoutBtn",logout);bind("checkReadinessBtn",checkCeoReadiness);bind("gateReviewBtn",reviewGate);bind("loadGateQueueBtn",loadGateQueue);bind("loadAgentWorklistBtn",loadAgentWorklist);
 $("worklistAgentFilter").addEventListener("change",showWorklist);
 $("worklistStatusFilter").addEventListener("change",showWorklist);
 $("gateApprovalSelect").addEventListener("change",()=>{$("gateApprovalId").value=$("gateApprovalSelect").value;});
 bind("showSecret",()=>{$("secret").type=$("secret").type==="password"?"text":"password"});
 window.addEventListener("pagehide",()=>{accessToken="";refreshToken="";recoveryMode=false;clearSecret();$("newPassword").value="";$("confirmPassword").value="";});
 // parseCallback handles token_hash verification asynchronously; fragment path needs a session check.
 if(accessToken)void checkSession();
}
