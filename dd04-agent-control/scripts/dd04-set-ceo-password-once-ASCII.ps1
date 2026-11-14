# DD04-A00-009 - one-time CEO Auth password bootstrap, local Windows PowerShell ONLY.
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
Write-Host ("Mode: " + $(if($Apply){"APPLY ONE TIME"}else{"READ-ONLY CHECK"}))
if(Test-Path -LiteralPath $MarkerFile) {
  throw "Ma da duoc chay thu dat mat khau truoc do. DUNG. Hay kiem tra dang nhap va lien he quan tri thay vi thu lan hai."
}

try {
  $expectedEmail = (Read-Host "Nhap email cua tai khoan Auth dang co trong Supabase Staging").Trim()
  if(-not $expectedEmail.Contains("@") -or $expectedEmail.Length -gt 254) { throw "Email khong hop le." }

  Write-Host "Nhap SECRET KEY rieng cua Supabase project staging. KHONG dan khoa vao chat hoac luu vao file."
  Write-Host "Lay trong Supabase project wbvkqfnrlasmtizjszab > Project Settings > API Keys > Secret."
  $admin = Read-Host "Khoa bi mat quan tri staging" -AsSecureString
  $adminPlain = Get-TemporaryPlainText $admin
  if(-not ($adminPlain.StartsWith("sb_secret_") -or $adminPlain.StartsWith("eyJ"))) {
    throw "Khoa quan tri phai la sb_secret_ hoac legacy service_role JWT; khong dung publishable / anon key."
  }

  # Modern secret key: apikey header. Legacy service_role JWT: apikey + Bearer.
  # Supabase Auth Admin API must only be called from this trusted local process.
  $headers = @{ apikey = $adminPlain; accept = "application/json" }
  if($adminPlain.StartsWith("eyJ")) { $headers.authorization = "Bearer $adminPlain" }

  # GET exact fixed user, then confirm email and verification state.
  $user = Invoke-RestMethod -Method Get -Uri $BaseUrl -Headers $headers -TimeoutSec 15
  if($user.PSObject.Properties.Name -contains 'user') { $user = $user.user }
  if([string]$user.id -ne $ExpectedUserId) { throw "ID tai khoan khong trung. DUNG." }
  if([string]::IsNullOrWhiteSpace([string]$user.email) -or
     -not [string]::Equals([string]$user.email,$expectedEmail,[StringComparison]::OrdinalIgnoreCase)) {
    throw "Email khong trung ban ghi Supabase. DUNG."
  }
  if(-not ($user.PSObject.Properties.Name -contains 'email_confirmed_at') -or -not $user.email_confirmed_at -or
     (($user.PSObject.Properties.Name -contains 'is_anonymous') -and $user.is_anonymous -eq $true)) {
    throw "Tai khoan chua xac minh email hoac la tai khoan an danh. DUNG."
  }
  Write-Host "PASS - Dung project va dung nguoi dung, email da xac minh." -ForegroundColor Green
  if(-not $Apply) {
    Write-Host "READ-ONLY PASS - chua cap nhat mat khau. Chay lai voi -Apply de thuc thi."
    return
  }

  Write-Host "Ban sap thiet lap mat khau cho MOT tai khoan trong Auth staging. Khong the hoan tac tu dong."
  $confirmation = Read-Host 'Go chinh xac SET STAGING PASSWORD de xac nhan'
  if($confirmation -cne "SET STAGING PASSWORD") { throw "Chua xac nhan. DUNG." }

  $passwordSecure = Read-Host "Nhap MAT KHAU MOI (khong hien chu)" -AsSecureString
  $passwordAgain = Read-Host "Nhap LAI mat khau moi (khong hien chu)" -AsSecureString
  $passwordPlain = Get-TemporaryPlainText $passwordSecure
  $againPlain = Get-TemporaryPlainText $passwordAgain
  if($passwordPlain.Length -lt 12 -or $passwordPlain.Length -gt 128 -or
     $passwordPlain -cnotmatch '[a-z]' -or $passwordPlain -cnotmatch '[A-Z]' -or
     $passwordPlain -notmatch '[0-9]' -or $passwordPlain -notmatch '[^a-zA-Z0-9]') {
    throw "Mat khau khong dat: tu 12-128 ky tu, co chu hoa, chu thuong, so, ky tu dac biet."
  }
  if($passwordPlain -cne $againPlain) { throw "Hai lan nhap mat khau khong trung. DUNG." }

  # Mark BEFORE PUT to prevent accidental retries after ambiguous network failure.
  [void][IO.Directory]::CreateDirectory($MarkerDir)
  $stamp = "ATTEMPTED - "+[DateTime]::UtcNow.ToString('o')+[Environment]::NewLine+
      "Project="+$ProjectId+[Environment]::NewLine+"User="+$ExpectedUserId+[Environment]::NewLine
  [IO.File]::WriteAllText($MarkerFile,$stamp,[Text.Encoding]::UTF8)
  $body = @{ password = $passwordPlain } | ConvertTo-Json -Compress
  $result = Invoke-RestMethod -Method Put -Uri $BaseUrl -Headers $headers -ContentType "application/json" -Body $body -TimeoutSec 20
  if($result.PSObject.Properties.Name -contains 'user') { $result = $result.user }
  if([string]$result.id -ne $ExpectedUserId) { throw "Phan hoi cap nhat khong dung ID; DUNG va kiem tra Auth Logs." }
  Write-Host "PASS - Supabase Auth xac nhan cap nhat mat khau dung tai khoan staging." -ForegroundColor Green
  Write-Host "KHONG can email. Dang nhap qua trang CEO staging roi kich hoat MFA."
  Write-Host "Ban ghi chong chay lap da duoc tao trong LocalAppData (khong chua khoa hoac mat khau)."
} catch {
  # Never print untrusted HTTP exceptions; they may expose headers/body.
  Write-Host "STOP - thao tac chua duoc xac nhan hoan thanh." -ForegroundColor Red
  Write-Host "Khong chay -Apply lan nua neu chua xac minh trang thai. Khong gui loi chi tiet co chua credential len chat."
} finally {
  $body = $null; $headers = $null
  $adminPlain = $null; $passwordPlain = $null; $againPlain = $null
  $admin = $null; $passwordSecure = $null; $passwordAgain = $null
  [GC]::Collect()
}
