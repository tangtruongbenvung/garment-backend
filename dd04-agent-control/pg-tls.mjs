// DD04 A00 staging-only TLS configuration: never weaken certificate checks.
// PostgreSQL connection-string SSL parameters are removed so node-postgres does
// not silently override the verified CA supplied by the server-side adapter.
import { X509Certificate } from 'node:crypto';
import { assertStagingDatabaseUrl } from './supabase-pg-repository.mjs';

export function createVerifiedPgTlsConfig(connectionString,tenantId,caPem){
 assertStagingDatabaseUrl(connectionString,tenantId);
 if(typeof caPem!=='string'||!caPem.trim())throw new Error('DB_CA_CERTIFICATE_REQUIRED');
 const ca=caPem.trim().replace(/\\n/g,'\n');
 if(ca.length>20000||!/^-----BEGIN CERTIFICATE-----\r?\n[\s\S]+?\r?\n-----END CERTIFICATE-----$/.test(ca))
  throw new Error('DB_CA_CERTIFICATE_INVALID');
 try { new X509Certificate(ca); } catch { throw new Error('DB_CA_CERTIFICATE_INVALID'); }
 const u=new URL(connectionString);
 const servername=u.hostname;
 for(const key of ['sslmode','sslrootcert','sslcert','sslkey'])u.searchParams.delete(key);
 return {
  connectionString:u.toString(),
  ssl:{ca,servername,rejectUnauthorized:true}
 };
}
