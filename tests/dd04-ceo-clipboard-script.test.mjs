import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../dd04-agent-control/scripts/dd04-set-ceo-password-once-ASCII.ps1',import.meta.url),'utf8');
test('local Windows clipboard option reads one time and clears before HTTP',()=>{
 assert.match(code,/Get-Clipboard -Raw -ErrorAction Stop/);
 assert.match(code,/Set-Clipboard -Value "" -ErrorAction Stop/);
 assert.ok(code.indexOf('Get-Clipboard -Raw') < code.indexOf('Set-Clipboard -Value ""'));
 assert.ok(code.indexOf('Set-Clipboard -Value ""') < code.indexOf('$user = Invoke-RestMethod'));
 assert.match(code,/Read-Host "Nhan ENTER de doc khoa trong Clipboard; nhap M de go thu cong"/);
 assert.match(code,/Read-Host "Khoa bi mat quan tri staging \(nhap an\)" -AsSecureString/);
 assert.match(code,/if\(-not \$Apply\)/);
 assert.match(code,/if\(\$confirmation -cne "SET STAGING PASSWORD"\)/);
 assert.doesNotMatch(code,/Write-Host\s+\$adminPlain|Out-File|Set-Content.*\$adminPlain/);
});
test('admin key never leaves staging fixed user and script has safe fail-closed marker',()=>{
 assert.match(code,/\$ProjectId = "wbvkqfnrlasmtizjszab"/);
 assert.match(code,/\$ExpectedUserId = "b11f7154-5f5d-4b55-a497-90e8adf2525e"/);
 assert.match(code,/\$MarkerFile/);
 assert.match(code,/\$stage = "ADMIN_GET_AUTH_USER"/);
 assert.match(code,/HTTP_UNAUTHORIZED_KEY/);
 assert.equal(/[^\x00-\x7F]/.test(code),false);
});
