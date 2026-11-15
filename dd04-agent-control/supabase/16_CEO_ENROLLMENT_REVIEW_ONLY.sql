-- DD04-A00-010 | CEO ENROLLMENT AND AUDIT | REVIEW ONLY | DO NOT EXECUTE
-- Exact isolated Supabase project: wbvkqfnrlasmtizjszab
-- No automatic CEO bootstrap and no G1/G2 decision unlock.
-- Requires a SEPARATE explicit CEO approval of this exact SQL and target.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE dd04_stage.ceo_enrollments(
 tenant_id uuid NOT NULL,
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL DEFAULT 'CEO' CHECK(role='CEO'),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','ACTIVE','SUSPENDED')),
 verified_by_admin boolean NOT NULL DEFAULT false,
 verified_by uuid REFERENCES auth.users(id),
 verified_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dd04_ceo_enrollment_pk PRIMARY KEY(tenant_id,user_id),
 CONSTRAINT dd04_ceo_enrollment_admin_evidence CHECK (
  (status='PENDING' AND verified_by_admin=false AND verified_by IS NULL AND verified_at IS NULL)
  OR (status IN ('ACTIVE','SUSPENDED') AND verified_by_admin=true AND verified_by IS NOT NULL
      AND verified_by<>user_id AND verified_at IS NOT NULL)
 )
);
-- Only one ACTIVE CEO per tenant. Existing and unverified users are not granted anything.
CREATE UNIQUE INDEX dd04_ceo_one_active_per_tenant ON dd04_stage.ceo_enrollments(tenant_id)
 WHERE status='ACTIVE';
CREATE TABLE dd04_stage.ceo_enrollment_events(
 event_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,
 user_id uuid NOT NULL,
 event_kind text NOT NULL CHECK(event_kind IN ('PROPOSED','ACTIVATED','SUSPENDED','REJECTED')),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[0-9a-f]{64}$'),
 details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(details)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT dd04_ceo_enrollment_event_user_fk FOREIGN KEY(tenant_id,user_id)
  REFERENCES dd04_stage.ceo_enrollments(tenant_id,user_id)
);
CREATE FUNCTION dd04_stage.deny_ceo_enrollment_event_edit() RETURNS trigger
 LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,dd04_stage
 AS $$ BEGIN RAISE EXCEPTION 'DD04_CEO_ENROLLMENT_AUDIT_APPEND_ONLY'; END $$;
CREATE TRIGGER dd04_ceo_enrollment_events_no_edit BEFORE UPDATE OR DELETE
 ON dd04_stage.ceo_enrollment_events FOR EACH ROW EXECUTE FUNCTION dd04_stage.deny_ceo_enrollment_event_edit();
ALTER TABLE dd04_stage.ceo_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.ceo_enrollment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dd04_stage.ceo_enrollments,dd04_stage.ceo_enrollment_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE dd04_stage.ceo_enrollment_events_event_id_seq FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION dd04_stage.deny_ceo_enrollment_event_edit() FROM PUBLIC,anon,authenticated;
-- No INSERT/UPDATE of any user's enrollment here, no Auth user creation, no G1/G2 mutation.
-- A later approved server-only bootstrap transaction must confirm exact tenant/user,
-- verified second administrator and CEO's explicit approval. Do not run manually yet.
COMMIT;
