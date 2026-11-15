-- DD04 A00-023 SQL 29 security checks, disposable PostgreSQL CI only.
DO $acl$
BEGIN
 IF has_function_privilege('anon','public.dd04_a00_023_activate_a11_v1()','EXECUTE')
 OR has_function_privilege('service_role','public.dd04_a00_023_activate_a11_v1()','EXECUTE')
 OR has_function_privilege('dd04_a00_runtime','public.dd04_a00_023_activate_a11_v1()','EXECUTE')
 OR NOT has_function_privilege('authenticated','public.dd04_a00_023_activate_a11_v1()','EXECUTE')
 THEN RAISE EXCEPTION 'A11_PUBLIC_FACADE_BAD_ACL'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.dd04_a00_023_activate_a11_v1()'::regprocedure)
 THEN RAISE EXCEPTION 'A11_PUBLIC_FACADE_MUST_BE_SECURITY_INVOKER'; END IF;
 IF (SELECT count(*) FROM dd04_stage.a00_022_delegation_policies WHERE status='ACTIVE')<>1
 THEN RAISE EXCEPTION 'EXPECTED_ONE_CI_ACTIVE_POLICY'; END IF;
 RAISE NOTICE 'PASS_A11_PUBLIC_WRAPPER_MINIMAL_ACL_INVOCATION_MODE';
END $acl$;
BEGIN;
SET LOCAL ROLE authenticated;
DO $noauth$
DECLARE error_text text;
BEGIN
 BEGIN
  PERFORM public.dd04_a00_023_activate_a11_v1();
  RAISE EXCEPTION 'UNAUTHENTICATED_CEO_WRAPPER_SUCCEEDED';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS error_text=MESSAGE_TEXT;
  IF error_text<>'CEO_MFA_AAL2_REQUIRED' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'PASS_A11_WRAPPER_DENIES_AUTHENTICATED_ROLE_WITHOUT_VERIFIED_SESSION';
END $noauth$;
ROLLBACK;
BEGIN;
SET LOCAL ROLE anon;
DO $anon$
DECLARE error_text text;
BEGIN
 BEGIN
  PERFORM public.dd04_a00_023_activate_a11_v1();
  RAISE EXCEPTION 'ANON_WRAPPER_SUCCEEDED';
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS error_text=MESSAGE_TEXT;
  IF error_text NOT LIKE 'permission denied for function %' THEN RAISE; END IF;
 END;
 RAISE NOTICE 'PASS_A11_WRAPPER_REJECTS_ANONYMOUS_CALL';
END $anon$;
ROLLBACK;
