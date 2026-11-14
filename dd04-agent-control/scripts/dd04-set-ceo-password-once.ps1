# DD04-A00-009 — one-time CEO Auth password bootstrap, local Windows PowerShell ONLY.
# No emails, no schema changes, no CEO grants, no G1/G2.
[CmdletBinding()]
param([switch]$Apply)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectId = "wbvkqfnrlasmtizjszab"
$ExpectedUserId = "b11f7154-5f5d-4b55-a497-90e8adf2525e"
$BaseUrl = "https://$ProjectId.supabase.co/auth/v1/admin/users/$ExpectedUserId"
$MarkerDir = Join-Path $env:LOCALAPPDATA "DucDuyAiOs"
$MarkerFile = Join-Path $MarkerDir "dd04-ceo-first-password.attempted"
$admin = $null
$passwordSecure = $null
$passwordAgain = $null
$adminPlain = $null
$passwordPlain = $null
$againPlain = $null
$headers = $null
$body = $null

function Get-TemporaryPlainText([Security.SecureString]$Secret) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host "=== DUC DUY DD04 STAGING - FIRST PASSWORD ==="
Write-Host "Project: $ProjectId (STAGING ONLY)"
Write-Host "User ID: $ExpectedUserId (EXACT MATCH)"
Write-Host "Mode: $(if($Apply){'APPLY ONE TIME'}else{'READ-ONLY CHECK'})"
if(Test-Path -LiteralPath $MarkerFile) {
  throw "Mã đã được chạy thử đặt mật khẩu trước đó. DỪNG. Hãy kiểm tra đăng nhập và liên hệ quản trị thay vì thử lần hai."
}

try {
  $expectedEmail = (Read-Host "Nhập email của tài khoản Auth đang có trong Supabase Staging").Trim()
  if(-not $expectedEmail.Contains("@") -or $expectedEmail.Length -gt 254) { throw "Email không hợp lệ." }

  Write-Host "Nhập SECRET KEY riêng của Supabase project staging. KHÔNG dán khóa vào chat hoặc lưu vào file."
  Write-Host "Lấy trong Supabase project wbvkqfnrlasmtizjszab > Project Settings > API Keys > Secret."
  $admin = Read-Host "Khóa bí mật quản trị staging" -AsSecureString
  $adminPlain = Get-TemporaryPlainText $admin
  if(-not ($adminPlain.StartsWith("sb_secret_") -or $adminPlain.StartsWith("eyJ"))) {
    throw "Khóa quản trị phải là sb_secret_ hoặc legacy service_role JWT; không dùng publishable / anon key."
  }

  # Modern secret key: apikey header. Legacy service_role JWT: apikey + Bearer.
  # Supabase Auth Admin API must only be called from this trusted local process.
  $headers = @{ apikey = $adminPlain; accept = "application/json" }
  if($adminPlain.StartsWith("eyJ")) { $headers.authorization = "Bearer $adminPlain" }

  # GET exact fixed user, then confirm email and verification state.
  $user = Invoke-RestMethod -Method Get -Uri $BaseUrl -Headers $headers -TimeoutSec 15
  if($user.user) { $user = $user.user }
  if([string]$user.id -ne $ExpectedUserId) { throw "ID tài khoản không trùng. DỪNG." }
  if([string]::IsNullOrWhiteSpace([string]$user.email) -or
     -not [string]::Equals([string]$user.email,$expectedEmail,[StringComparison]::OrdinalIgnoreCase)) {
    throw "Email không trùng bản ghi Supabase. DỪNG."
  }
  if(-not $user.email_confirmed_at -or $user.is_anonymous -eq $true) {
    throw "Tài khoản chưa xác minh email hoặc là tài khoản ẩn danh. DỪNG."
  }
  Write-Host "PASS - Đúng project và đúng người dùng, email đã xác minh." -ForegroundColor Green
  if(-not $Apply) {
    Write-Host "READ-ONLY PASS - chưa cập nhật mật khẩu. Chạy lại với -Apply để thực thi."
    return
  }

  Write-Host "Bạn sắp thiết lập mật khẩu cho MỘT tài khoản trong Auth staging. Không thể hoàn tác tự động."
  $confirmation = Read-Host 'Gõ chính xác SET STAGING PASSWORD để xác nhận'
  if($confirmation -cne "SET STAGING PASSWORD") { throw "Chưa xác nhận. DỪNG." }

  $passwordSecure = Read-Host "Nhập MẬT KHẨU MỚI (không hiện chữ)" -AsSecureString
  $passwordAgain = Read-Host "Nhập LẠI mật khẩu mới (không hiện chữ)" -AsSecureString
  $passwordPlain = Get-TemporaryPlainText $passwordSecure
  $againPlain = Get-TemporaryPlainText $passwordAgain
  if($passwordPlain.Length -lt 12 -or $passwordPlain.Length -gt 128 -or
     $passwordPlain -cnotmatch '[a-z]' -or $passwordPlain -cnotmatch '[A-Z]' -or
     $passwordPlain -notmatch '[0-9]' -or $passwordPlain -notmatch '[^a-zA-Z0-9]') {
    throw "Mật khẩu không đạt: từ 12-128 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt."
  }
  if($passwordPlain -cne $againPlain) { throw "Hai lần nhập mật khẩu không trùng. DỪNG." }

  # Mark BEFORE PUT to prevent accidental retries after ambiguous network failure.
  [void][IO.Directory]::CreateDirectory($MarkerDir)
  $stamp = "ATTEMPTED - "+[DateTime]::UtcNow.ToString('o')+[Environment]::NewLine+
      "Project="+$ProjectId+[Environment]::NewLine+"User="+$ExpectedUserId+[Environment]::NewLine
  [IO.File]::WriteAllText($MarkerFile,$stamp,[Text.Encoding]::UTF8)
  $body = @{ password = $passwordPlain } | ConvertTo-Json -Compress
  $result = Invoke-RestMethod -Method Put -Uri $BaseUrl -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 20
  if($result.user) { $result = $result.user }
  if([string]$result.id -ne $ExpectedUserId) { throw "Phản hồi cập nhật không đúng ID; DỪNG và kiểm tra Auth Logs." }
  Write-Host "PASS - Supabase Auth xác nhận cập nhật mật khẩu đúng tài khoản staging." -ForegroundColor Green
  Write-Host "KHÔNG cần email. Đăng nhập qua trang CEO staging rồi kích hoạt MFA."
  Write-Host "Bản ghi chống chạy lặp đã được tạo trong LocalAppData (không chứa khóa hoặc mật khẩu)."
} catch {
  # Never print untrusted HTTP exceptions; they may expose headers/body.
  Write-Host "STOP - thao tác chưa được xác nhận hoàn thành." -ForegroundColor Red
  Write-Host "Không chạy -Apply lần nữa nếu chưa xác minh trạng thái. Không gửi lỗi chi tiết có chứa credential lên chat."
} finally {
  $body = $null; $headers = $null
  $adminPlain = $null; $passwordPlain = $null; $againPlain = $null
  $admin = $null; $passwordSecure = $null; $passwordAgain = $null
  [GC]::Collect()
}
