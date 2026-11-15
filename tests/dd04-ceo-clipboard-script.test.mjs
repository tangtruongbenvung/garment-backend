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

test('PowerShell file has exactly one top-level try/catch/finally and no duplicated tail',()=>{
 const occurrences=(code.match(/\[GC\]::Collect\(\)/g)||[]).length;
 assert.equal(occurrences,1,'duplicate trailing script caused Unexpected token errors');
 assert.ok(code.trimEnd().endsWith('}'),'script must end with closing finally');
 assert.equal((code.match(/\$stage = "ADMIN_GET_AUTH_USER"/g)||[]).length,1);
 assert.equal((code.match(/Set-Clipboard -Value "" -ErrorAction Stop/g)||[]).length,1);
 assert.doesNotMatch(code,/\n\) \{/);
});

test('HTTP error handling stays strict-mode safe for exceptions without Response property',()=>{
 assert.match(code,/\$ex\.PSObject\.Properties\['Response'\]/);
 assert.match(code,/\$response\.PSObject\.Properties\['StatusCode'\]/);
 assert.doesNotMatch(code,/\$ex\.Response/);
 assert.doesNotMatch(code,/Write-Host\s+\$_\.Exception|Write-Host\s+\$ex\.Message/);
});

test('blank ENTER on Windows PowerShell 5.1 is converted safely before Trim under StrictMode',()=>{
 assert.match(code,/\$clipboardMode = \[string\]\(Read-Host/);
 assert.match(code,/\$clipboardMode = \$clipboardMode\.Trim\(\)/);
 assert.doesNotMatch(code,/\$clipboardMode = \(Read-Host[^\n]*\)\.Trim\(\)/);
 assert.match(code,/DD04-CEO-CLIPBOARD-20261115-FIX4/);
});
