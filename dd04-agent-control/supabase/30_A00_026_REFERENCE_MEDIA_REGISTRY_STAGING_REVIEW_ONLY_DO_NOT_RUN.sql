-- DD04-A00-026 | STAGING ONLY | DESIGN CANDIDATE | DO NOT APPLY
-- Private asset catalog, not a storage bucket or image generator.
-- CEO approval of exact hash required before any staging migration.
-- No direct runtime ACL, no production changes, no AI API spend.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='5s';
CREATE TABLE dd04_stage.a00_026_identity_versions(
 tenant_id uuid NOT NULL,channel_id text NOT NULL CHECK(channel_id ~ '^[A-Za-z0-9_-]{2,64}$'),
 channel_version integer NOT NULL CHECK(channel_version>0),
 channel_identity_sha256 text NOT NULL CHECK(channel_identity_sha256 ~ '^[a-f0-9]{64}$'),
 character_bible_sha256 text NOT NULL CHECK(character_bible_sha256 ~ '^[a-f0-9]{64}$'),
 visual_style_sha256 text NOT NULL CHECK(visual_style_sha256 ~ '^[a-f0-9]{64}$'),
 continuity_rules_sha256 text NOT NULL CHECK(continuity_rules_sha256 ~ '^[a-f0-9]{64}$'),
 profile_sha256 text CHECK(profile_sha256 IS NULL OR profile_sha256 ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','REVIEWED','SUPERSEDED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,channel_id,channel_version),
 UNIQUE(tenant_id,channel_id,channel_identity_sha256)
);
CREATE TABLE dd04_stage.a00_026_reference_assets(
 tenant_id uuid NOT NULL,channel_id text NOT NULL,
 channel_version integer NOT NULL,
 character_role text NOT NULL CHECK(character_role IN ('MOTHER','BABY')),
 character_id text NOT NULL,
 object_storage_key text NOT NULL CHECK(object_storage_key LIKE 'dd04-staging/%' AND length(object_storage_key)<700),
 bytes_sha256 text NOT NULL CHECK(bytes_sha256 ~ '^[a-f0-9]{64}$'),
 mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),
 width integer NOT NULL CHECK(width BETWEEN 256 AND 8192),
 height integer NOT NULL CHECK(height BETWEEN 256 AND 8192),
 byte_length bigint NOT NULL CHECK(byte_length BETWEEN 45 AND 12582912),
 storage_bytes_verified boolean NOT NULL DEFAULT false CHECK(storage_bytes_verified=false),
 visual_qc text NOT NULL DEFAULT 'PENDING' CHECK(visual_qc='PENDING'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,channel_id,channel_version,character_role,bytes_sha256),
 FOREIGN KEY(tenant_id,channel_id,channel_version)
  REFERENCES dd04_stage.a00_026_identity_versions(tenant_id,channel_id,channel_version)
);
CREATE TABLE dd04_stage.a00_026_scene_image_assets(
 tenant_id uuid NOT NULL,channel_id text NOT NULL,channel_version integer NOT NULL,
 script_id text NOT NULL,scene_id text NOT NULL,
 reference_pair_sha256 text NOT NULL CHECK(reference_pair_sha256 ~ '^[a-f0-9]{64}$'),
 object_storage_key text NOT NULL CHECK(object_storage_key LIKE 'dd04-staging/%'),
 bytes_sha256 text NOT NULL CHECK(bytes_sha256 ~ '^[a-f0-9]{64}$'),
 status text NOT NULL DEFAULT 'PENDING_QC' CHECK(status='PENDING_QC'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,channel_id,channel_version,script_id,scene_id,bytes_sha256),
 FOREIGN KEY(tenant_id,channel_id,channel_version)
  REFERENCES dd04_stage.a00_026_identity_versions(tenant_id,channel_id,channel_version)
);
CREATE TABLE dd04_stage.a00_026_qc_evidence(
 evidence_id uuid NOT NULL DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL,channel_id text NOT NULL,channel_version integer NOT NULL,
 asset_bytes_sha256 text NOT NULL CHECK(asset_bytes_sha256 ~ '^[a-f0-9]{64}$'),
 reviewer_agent text NOT NULL CHECK(reviewer_agent IN ('A08','A09')),
 reviewer_subject_id uuid NOT NULL,
 verdict text NOT NULL CHECK(verdict IN ('PASS','FAIL','HOLD')),
 evidence_sha256 text NOT NULL CHECK(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 evidence_source text NOT NULL CHECK(evidence_source='AUTHENTICATED_DB_EVENT'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,evidence_id),
 FOREIGN KEY(tenant_id,channel_id,channel_version)
  REFERENCES dd04_stage.a00_026_identity_versions(tenant_id,channel_id,channel_version)
);
-- Immutable metadata-only staging proposal. Even after approval this schema
-- grants no writer and must be paired with a separately reviewed authenticated
-- object-storage and evidence-ingestion implementation.
CREATE FUNCTION dd04_stage.a00_026_guard_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,dd04_stage AS $guard$
BEGIN
 RAISE EXCEPTION 'A00_026_ASSET_METADATA_IMMUTABLE';
END $guard$;
CREATE TRIGGER a00_026_identity_immutability BEFORE UPDATE OR DELETE ON dd04_stage.a00_026_identity_versions
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.a00_026_guard_immutable();
CREATE TRIGGER a00_026_reference_immutability BEFORE UPDATE OR DELETE ON dd04_stage.a00_026_reference_assets
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.a00_026_guard_immutable();
CREATE TRIGGER a00_026_scene_immutability BEFORE UPDATE OR DELETE ON dd04_stage.a00_026_scene_image_assets
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.a00_026_guard_immutable();
CREATE TRIGGER a00_026_qc_immutability BEFORE UPDATE OR DELETE ON dd04_stage.a00_026_qc_evidence
 FOR EACH ROW EXECUTE FUNCTION dd04_stage.a00_026_guard_immutable();
ALTER TABLE dd04_stage.a00_026_identity_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_026_reference_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_026_scene_image_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dd04_stage.a00_026_qc_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dd04_stage.a00_026_identity_versions,
 dd04_stage.a00_026_reference_assets,dd04_stage.a00_026_scene_image_assets,
 dd04_stage.a00_026_qc_evidence
 FROM PUBLIC,anon,authenticated,service_role,dd04_a00_runtime;
REVOKE ALL ON FUNCTION dd04_stage.a00_026_guard_immutable() FROM PUBLIC,anon,authenticated,service_role,dd04_a00_runtime;
-- No DB staging migration, Storage bucket, worker grant, paid API, G1/G2 mutation
-- or publishing permission is included by authoring this file.
COMMIT;
