-- DD04-A00-012 | CEO INITIAL BOOTSTRAP | STAGING ONLY
-- CEO-approved exception to second-verifier rule for the first and only CEO.
-- Target EXACT project wbvkqfnrlasmtizjszab. No production or G1/G2 changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
BEGIN
 IF (SELECT count(*) FROM dd04_stage.ceo_enrollments WHERE status='ACTIVE') <> 0
 THEN RAISE EXCEPTION 'DD04_CEO_ALREADY_ACTIVE'; END IF;
 IF (SELECT count(*) FROM dd04_stage.ceo_enrollments
     WHERE tenant_id='6bc73b49-a396-4c7d-b390-ab6339d547cd'
       AND user_id='b11f7154-5f5d-4b55-a497-90e8adf2525e'
       AND role='CEO' AND status='PENDING'
       AND verified_by_admin=false AND verified_by IS NULL) <> 1
 THEN RAISE EXCEPTION 'DD04_INITIAL_CEO_NOT_PENDING'; END IF;
 IF (SELECT count(*) FROM auth.users
     WHERE id='b11f7154-5f5d-4b55-a497-90e8adf2525e'
       AND email='tangtruongbenvung@gmail.com'
       AND email_confirmed_at IS NOT NULL) <> 1
 THEN RAISE EXCEPTION 'DD04_CEO_AUTH_NOT_VERIFIED'; END IF;
 IF NOT EXISTS (SELECT 1 FROM auth.sessions s
       JOIN auth.mfa_factors f ON f.id=s.factor_id AND f.user_id=s.user_id
       WHERE s.user_id='b11f7154-5f5d-4b55-a497-90e8adf2525e'
         AND s.aal='aal2' AND f.status='verified' AND f.factor_type='totp'
         AND (s.not_after IS NULL OR s.not_after>now())
         AND s.updated_at>now()-interval '24 hours')
 THEN RAISE EXCEPTION 'DD04_RECENT_MFA_AAL2_REQUIRED'; END IF;
END $$;
ALTER TABLE dd04_stage.ceo_enrollments
 ADD COLUMN verification_method text NOT NULL DEFAULT 'SECOND_ADMIN',
 ADD COLUMN verification_evidence_sha256 text;
ALTER TABLE dd04_stage.ceo_enrollments
 ADD CONSTRAINT dd04_ceo_verification_method_check
 CHECK (verification_method IN ('SECOND_ADMIN','INITIAL_OWNER_MFA'));
ALTER TABLE dd04_stage.ceo_enrollments
 DROP CONSTRAINT dd04_ceo_enrollment_admin_evidence;
ALTER TABLE dd04_stage.ceo_enrollments
 ADD CONSTRAINT dd04_ceo_enrollment_admin_evidence CHECK (
  (status='PENDING' AND verified_by_admin=false AND verified_by IS NULL
   AND verified_at IS NULL AND verification_method='SECOND_ADMIN'
   AND verification_evidence_sha256 IS NULL)
  OR
  (status IN ('ACTIVE','SUSPENDED') AND verified_by_admin=true
   AND verified_by IS NOT NULL AND verified_at IS NOT NULL
   AND (
      (verification_method='SECOND_ADMIN'
       AND verified_by<>user_id AND verification_evidence_sha256 IS NULL)
      OR
      (verification_method='INITIAL_OWNER_MFA'
       AND verified_by=user_id
       AND verification_evidence_sha256 ~ '^[0-9a-f]{64}$'
       AND tenant_id='6bc73b49-a396-4c7d-b390-ab6339d547cd'::uuid
       AND user_id='b11f7154-5f5d-4b55-a497-90e8adf2525e'::uuid)
   ))
 );
-- Privileged DB bootstrap only, no new RLS policies or browser grants.
COMMIT;
