import test from 'node:test';
import assert from 'node:assert/strict';
import {rootCertificates} from 'node:tls';
import {createVerifiedPgTlsConfig} from '../dd04-agent-control/pg-tls.mjs';

const tenant='123e4567-e89b-42d3-a456-426614174000';
const uri='postgresql://postgres.wbvkqfnrlasmtizjszab:placeholder@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require';
const ca=rootCertificates[0];

test('requires a well-formed CA certificate and never disables TLS',()=>{
 assert.throws(()=>createVerifiedPgTlsConfig(uri,tenant,undefined),/DB_CA_CERTIFICATE_REQUIRED/);
 assert.throws(()=>createVerifiedPgTlsConfig(uri,tenant,'not a certificate'),/DB_CA_CERTIFICATE_INVALID/);
 const cfg=createVerifiedPgTlsConfig(uri,tenant,ca);
 assert.equal(cfg.ssl.rejectUnauthorized,true);
 assert.equal(cfg.ssl.servername,'aws-0-ap-northeast-1.pooler.supabase.com');
 assert.equal(cfg.ssl.ca,ca.trim());
 assert.equal(new URL(cfg.connectionString).searchParams.has('sslmode'),false);
 assert.equal(new URL(cfg.connectionString).hostname,'aws-0-ap-northeast-1.pooler.supabase.com');
});
test('does not accept production DB even when a legitimate CA is supplied',()=>{
 assert.throws(()=>createVerifiedPgTlsConfig(uri.replace('postgres.wbvkqfnrlasmtizjszab','postgres.ykhrtrvstymfjnzdgzna'),tenant,ca),/DATABASE_TARGET_NOT_DD04_STAGING/);
 assert.throws(()=>createVerifiedPgTlsConfig(uri.replace('sslmode=require','sslmode=disable'),tenant,ca),/DATABASE_SSL_REQUIRED/);
});
