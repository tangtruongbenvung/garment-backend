"use strict";
// DD04-A00-009. Staging-only Auth UI. No database writes, CEO grants or approvals.
// The API key is explicitly publishable, never a service_role key.
const API="https://wbvkqfnrlasmtizjszab.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_eYGZHWqLAvhuFjIU3ej3Zg_eQdL5lrU";
const CALLBACK="https://deploy-preview-1--ducduy-ai-os-test.netlify.app/dd04-agent-control/ceo-login.html";
const EXPECTED_HOST="deploy-preview-1--ducduy-ai-os-test.netlify.app";
const $=id=>document.getElementById(id);
let accessToken="",refreshToken="",factorId="",recoveryMode=false;
function message(text,ok=false){$("message").textContent=text;$("message").className=ok?"pass":"fail";}
function clearSecret(){$("secret").value="";$("totpCode").value="";$("totpEnroll").hidden=true;$("verifyPanel").hidden=true;}
function logout(){
 accessToken="";refreshToken="";factorId="";recoveryMode=false;clearSecret();$("password").value="";
 $("newPassword").value="";$("confirmPassword").value="";$("passwordRecoveryPanel").hidden=true;
 $("sessionPanel").hidden=true;$("loginPanel").hidden=false;$("identity").textContent="";
 message("Đã xóa phiên khỏi bộ nhớ tab. Không có quyền CEO được cấp.",true);
}
function parseCallback(){
 // Scrub the address bar before reading remote data or rendering a user identity.
 const hash=location.hash;
 if(hash)history.replaceState(null,"",location.pathname+location.search);
 if(!hash)return;
 const p=new URLSearchParams(hash.startsWith("#")?hash.slice(1):hash);
 if(p.get("error")){message("Liên kết xác thực bị từ chối hoặc hết hạn. Vui lòng yêu cầu liên kết mới.");return;}
 if(p.get("access_token")&&p.get("token_type")?.toLowerCase()==="bearer"){
  accessToken=p.get("access_token")||"";
  refreshToken=p.get("refresh_token")||"";
  if(p.get("type")==="recovery")recoveryMode=true;
 }else message("Liên kết chưa có phiên xác thực. Hãy đăng nhập bằng email.");
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
   message("Đã xác minh liên kết khôi phục. Nhập mật khẩu mới; chưa có quyền CEO hoặc G1/G2.",true);
   return;
  }
  $("passwordRecoveryPanel").hidden=true;$("sessionPanel").hidden=false;
  message("Đăng nhập Supabase thành công. Chưa xác định quyền CEO; G1/G2 vẫn khóa.",true);
  await loadFactors();
 }catch(e){logout();message("Không xác minh được phiên Supabase: "+e.message);}
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
 const data=await auth("/factors",{authorized:true});
 const factors=Array.isArray(data)?data:(data.factors||[]);
 const verified=factors.find(x=>x.factor_type==="totp"&&x.status==="verified");
 if(verified){
  factorId=verified.id;
  $("verifyPanel").hidden=false;$("totpEnroll").hidden=true;
  message("Đã tìm thấy MFA TOTP. Hãy nhập mã Authenticator để nâng mức xác thực.",true);
 }else{
  factorId="";
  message("Chưa có MFA TOTP đã xác nhận. Bấm Tạo MFA để đăng ký mới. Không có quyền CEO được cấp.",true);
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
  message("Mã MFA được Supabase xác minh thành công. Chưa có phân quyền CEO hoặc G1/G2; không có quyết định nào được ghi.",true);
 }catch(e){message("Xác minh MFA chưa đạt: "+e.message);}
 finally{$("totpCode").value="";}
}
function bind(id,fn){$(id).addEventListener("click",()=>void Promise.resolve(fn()).catch(e=>message("Yêu cầu chưa hoàn thành: "+e.message)));}
if(location.protocol!=="https:"||location.hostname!==EXPECTED_HOST){
 document.body.textContent="Chỉ dùng trang này trên HTTPS Deploy Preview #1 của Đức Duy.";
}else{
 parseCallback();
 bind("passwordBtn",passwordSignIn);bind("magicBtn",magicSignIn);
 bind("recoveryBtn",requestPasswordRecovery);bind("savePasswordBtn",savePassword);bind("cancelRecoveryBtn",logout);
 bind("enrollBtn",enroll);bind("factorBtn",loadFactors);bind("verifyBtn",verify);bind("logoutBtn",logout);
 bind("showSecret",()=>{$("secret").type=$("secret").type==="password"?"text":"password"});
 window.addEventListener("pagehide",()=>{accessToken="";refreshToken="";recoveryMode=false;clearSecret();$("newPassword").value="";$("confirmPassword").value="";});
 if(accessToken)void checkSession();
}
