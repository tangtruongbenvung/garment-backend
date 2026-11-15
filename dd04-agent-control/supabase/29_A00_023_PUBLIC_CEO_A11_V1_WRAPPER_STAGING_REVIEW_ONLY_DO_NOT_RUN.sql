-- DD04 A00-023: Staging-only narrow public RPC facade for signed CEO AAL2.
-- UNAPPROVED MIGRATION: DO NOT RUN UNTIL CEO APPROVES EXACT FILE AND SHA256.
-- PGRST106 occurs because dd04_stage is intentionally not exposed by the Data API.
-- This wrapper exposes NO dd04_stage table, takes NO caller-controlled arguments,
-- uses SECURITY INVOKER (not SECURITY DEFINER), and passes fixed zero-VND v1
-- policy ID + hash into the previously deployed CEO AAL2-checked function.
-- The existing private function validates auth.uid(), JWT AAL2, verified CEO,
-- exact policy hash, authorized owner, effective dates and immutable CAS.
BEGIN;
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';

CREATE FUNCTION public.dd04_a00_023_activate_a11_v1()
RETURNS text LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,public,dd04_stage,pg_temp
AS $a11$
 SELECT dd04_stage.a00_022_ceo_policy_decision(
   '6bc73b49-a396-4c7d-b390-ab6339d547cd'::uuid,
   '0c42f63e-6484-4519-8811-7c66b8e9d852'::uuid,
   '8f206452d6338b282b59b6aa368747157de52dca4349946b874a201b8de25e94'::text,
   'ACTIVE'::text
 );
$a11$;

REVOKE ALL ON FUNCTION public.dd04_a00_023_activate_a11_v1()
 FROM PUBLIC,anon,service_role,dd04_a00_runtime;
GRANT EXECUTE ON FUNCTION public.dd04_a00_023_activate_a11_v1()
 TO authenticated;

-- IMPORTANT: neither dd04_stage schema nor its private tables are exposed;
-- no G1 mutation, G2 change, worker activation, API spend or publishing.
COMMIT;
