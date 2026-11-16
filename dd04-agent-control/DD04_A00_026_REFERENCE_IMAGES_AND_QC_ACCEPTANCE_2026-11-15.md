# DD04 A00-026 — REFERENCE IMAGE CREATION AND VISUAL QC STAGING ACCEPTANCE
Date: 2026-11-15. Branch: feature/dd04-a00-020-atomic-ledger-handoff, PR #7.
**Scope:** staging code, not production, no paid AI API and no publishing.

## 1. Deliverables implemented
- `dd04-agent-control/a00-026-reference-image-core.mjs`: reads PNG/JPEG/WebP candidate bytes, checks declared MIME against signature, width/height bounds, actual file SHA256, tenant/channel/version scope, immutable content-addressed key under `dd04-staging/<tenant>/channels/<channel>/identity-v<version>/reference/<role>/<sha256>`. Separate mother/baby; verifies bytes retrieved back from private storage adapter and prevents replacing references through putIfAbsent contract.
- `dd04-agent-control/a00-026-scene-image-handoff.mjs`: a scene image needs matching locked Character Bible/Visual Style hash, an A08/A09 reviewed reference pair, registered script/shot, re-read storage bytes and the exact approved storyboard frame SHA. A05 receives only a **preflight** result; no rendering/payment/publishing.
- Reviewer evidence always PENDING until A08/A09 independently review **actual** image pixels, Vietnamese cultural suitability, child safety, face/style continuity and provenance. JSON with 'PASS' is NOT trusted; `checkTrustedReferenceReview` accepts only server-only authenticated immutable staging audit repository result. No such live repository has been deployed.
- `dd04-agent-control/supabase/30_A00_026_REFERENCE_MEDIA_REGISTRY_STAGING_REVIEW_ONLY_DO_NOT_RUN.sql`: candidate DB catalog with four private RLS tables for channel version, reference image metadata, frame metadata and append-only QC events. **NOT APPLIED**, no grants/writers or private storage bucket created. Need new exact SHA approval and audited storage repository design before migration.
- `tests/dd04-a00-026-reference-image.test.mjs` + `tests/dd04-a00-026-sql-contract.test.mjs`: memory-only byte validation, separate roles, invalid MIME, wrong channel, changed binary, immutable store, tampered QC, proper handoff denial, contract-only schema ACL.

## 2. Real sample images (pilot FB001 candidate only)
One original generated 3D animated fictional Vietnamese mother/baby character sheet, separated into reference candidate PNGs. The exact binary files are attached as conversation artifacts, **not uploaded to GitHub or Supabase Storage**.

- Mother: `DD04_FB001_MOTHER_REFERENCE_CANDIDATE.png`, 686 × 906, SHA-256 `fe7b936db23d994b8f6e6c2508958820c39a4d33aa4ffd875038e6e60e9312f2`.
- Baby: `DD04_FB001_BABY_REFERENCE_CANDIDATE.png`, 694 × 698, SHA-256 `8320db6c54129a7404a4960f81f64b0a23411f3ae60eba610050b6c6e7bb5dab`.
- `DD04_A00_026_FB001_REFERENCE_MANIFEST.json`: candidate metadata and digests, `visual_qc=PENDING_A08`, `cultural_qc=PENDING_A09`, G2 NOT_APPROVED, no staged storage reference.
- `DD04_A00_026_FB001_REFERENCE_PACK.zip`: downloadable bundle of candidate PNGs and manifest.

Sample images are visual drafts, **NOT confirmed matching** the exact generated Character Bible attributes of FB001, NOT valid finalized channel references, NOT proof consistency across video frames, and must be reviewed/edited for profile fit.

## 3. Acceptance gates for use with real A04/A05 agents
1. CEO reviews pilot channel character appearance and approves internal *design identity* as the channel's reference direction; no G2 publication approval implied.
2. Provision **private** Supabase Storage bucket with authenticated server adapter, write-once semantics and byte read-back, independent A08/A09 audit persistence. Requires separate schema/storage security review, staging-only authorization.
3. Upload two candidates and inspect actual decoded pixels. A08 explicitly confirms character lock and quality, A09 reviews Vietnamese cultural appropriateness; independent actors and bytes hash immutable.
4. Generate scenes using those references, verify each scene's bytes SHA and alignment with Character Bible, A08/A09 recheck visual consistency, then hand over to A05 for **actual** 20–60s video rendering with legally authorized provider.
5. CEO final G2 must approve exact output video SHA, caption, channel and schedule, after A08/A09 pass. No provider spend or A07 posting authorized.

## 4. Status
- **PASS (code/CI):** stable reference metadata, byte SHA, per-channel scoping, fail-closed QC and storyboard handoff contracts.
- **CREATED (real local artifacts):** 2 pilot PNG files and JSON manifest.
- **NOT PASS:** secure storage backend deployment, real persisted reference asset verification, visual A08/A09 reviews, autonomous Agent orchestration, actual video render or publication.
- Previous A11 zero-cost finance policy stays inactive and is not a channel-content approval requirement.
- Production unchanged; Supabase staging database unchanged by A00-026.
