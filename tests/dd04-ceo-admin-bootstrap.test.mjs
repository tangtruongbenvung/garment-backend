import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src=readFileSync(new URL('../dd04-agent-control/scripts/dd04-set-ceo-password-once.ps1',import.meta.url),'utf8');
test('Admin bootstrap is local Windows staging-only, dry run by default',()=>{
 assert.match(src,/param\(\[switch\]\$Apply\)/);
 assert.match(src,/\$ProjectId = "wbvkqfnrlasmtizjszab"/);
 assert.match(src,/\$ExpectedUserId = "b11f7154-5f5d-4b55-a497-90e8adf2525e"/);
 assert.match(src,/if\(-not \$Apply\)/);
 assert.doesNotMatch(src,/ykhrtrvstymfjnzdgzna|ducduy-ai-os-test\.netlify\.app|netlify\/functions/);
});
test('Single-account update is identity verified, deliberate, no admin credentials stored',()=>{
 assert.match(src,/Invoke-RestMethod -Method Get -Uri \$BaseUrl/);
 assert.match(src,/if\(\[string\]\$user.id -ne \$ExpectedUserId\)/);
 assert.match(src,/OrdinalIgnoreCase/);
 assert.match(src,/email_confirmed_at/);
 assert.match(src,/SET STAGING PASSWORD/);
 assert.match(src,/WriteAllText\(\$MarkerFile/);
 assert.match(src,/Invoke-RestMethod -Method Put -Uri \$BaseUrl/);
 assert.ok(src.indexOf('WriteAllText($MarkerFile') < src.indexOf('Invoke-RestMethod -Method Put'));
 assert.match(src,/Read-Host "Khóa bí mật quản trị staging" -AsSecureString/);
 assert.match(src,/Read-Host "Nhập MẬT KHẨU MỚI \(không hiện chữ\)" -AsSecureString/);
 assert.doesNotMatch(src,/Set-Content.+(?:\$adminPlain|\$passwordPlain)|Write-Host\s+\$adminPlain|Write-Host\s+\$passwordPlain/);
 assert.doesNotMatch(src,/\/auth\/v1\/admin\/users\/\$other|dd04_stage|service_role=.*["']/);
});
test('Password never accepted without 12-character and complexity checks',()=>{
 assert.match(src,/\$passwordPlain\.Length -lt 12/);
 assert.match(src,/\$passwordPlain -cnotmatch '\[a-z\]'/);
 assert.match(src,/\$passwordPlain -cnotmatch '\[A-Z\]'/);
 assert.match(src,/\$passwordPlain -notmatch '\[0-9\]'/);
 assert.match(src,/\$passwordPlain -notmatch '\[\^a-zA-Z0-9\]'/);
 assert.match(src,/\$passwordPlain -cne \$againPlain/);
});
