-- DD04 A00-023 / STAGING ONLY / CEO-ROLE DATA CONTRACT REPAIR
-- UNAPPROVED REVIEW CANDIDATE. DO NOT EXECUTE ON ANY SUPABASE PROJECT.
-- Scope: EXACTLY ONE SECURITY DEFINER FUNCTION, no data or policy changes.
-- Live dd04_stage.ceo_enrollments CHECK (role='CEO') but A00-022 function
-- erroneously checked role='ceo', preventing legitimate verified CEO AAL2.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='15s';
CREATE OR REPLACE FUNCTION dd04_stage.a00_022_ceo_policy_decision(
 p_tenant uuid,p_policy uuid,p_expected_hash text,p_decision text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,dd04_stage,pg_temp AS $ceo$
DECLARE ceo uuid;
DECLARE changed integer;
BEGIN
 ceo:=auth.uid();
 IF ceo IS NULL OR auth.jwt()->>'aal'<>'aal2'
  OR p_decision NOT IN ('ACTIVE','REVOKED') THEN
  RAISE EXCEPTION 'CEO_MFA_AAL2_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dd04_stage.ceo_enrollments
  WHERE tenant_id=p_tenant AND user_id=ceo AND role='CEO'
    AND status='ACTIVE' AND verified_by_admin=true)
 THEN RAISE EXCEPTION 'CEO_IDENTITY_UNVERIFIED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM dd04_stage.a00_022_delegation_policies
   WHERE tenant_id=p_tenant AND policy_id=p_policy
     AND policy_sha256=p_expected_hash AND authorized_ceo_id=ceo
     AND (status='PROPOSED' OR (status='ACTIVE' AND p_decision='REVOKED'))
     AND (p_decision='REVOKED' OR (effective_from<=now() AND expires_at>now())))
 THEN RAISE EXCEPTION 'CEO_POLICY_VERSION_OR_SCOPE_INVALID'; END IF;
 PERFORM set_config('dd04.ceo_policy_op','CEO_VERIFIED',true);
 UPDATE dd04_stage.a00_022_delegation_policies
  SET status=p_decision
  WHERE tenant_id=p_tenant AND policy_id=p_policy
    AND policy_sha256=p_expected_hash
    AND (status='PROPOSED' OR (status='ACTIVE' AND p_decision='REVOKED'));
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>1 THEN RAISE EXCEPTION 'CEO_POLICY_CAS_CONFLICT'; END IF;
 PERFORM set_config('dd04.ceo_policy_op','',true);
 RETURN 'CEO_POLICY_'||p_decision;
END $ceo$;
REVOKE ALL ON FUNCTION dd04_stage.a00_022_ceo_policy_decision(uuid,uuid,text,text)
 FROM PUBLIC,anon,service_role,dd04_a00_runtime;
GRANT EXECUTE ON FUNCTION dd04_stage.a00_022_ceo_policy_decision(uuid,uuid,text,text)
 TO authenticated;
-- Do not change CEO identity enrollment, MFA predicate, hash/CAS,
-- any finance amount, G1/G2/publishing, browser credentials or production.
COMMIT;
