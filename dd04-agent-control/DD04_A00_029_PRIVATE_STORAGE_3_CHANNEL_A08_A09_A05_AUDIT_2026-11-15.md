# DD04 A00-029 — PRIVATE STAGING STORAGE + REAL-IMAGE PILOT / A08-A09 / A05

Date: 2026-11-15. Scope: staging only, PR #7 Draft. No production migration, external provider spend, publishing, or unverifiable QC claim.

## Live Supabase staging checks
Project `wbvkqfnrlasmtizjszab`, tenant `6bc73b49-a396-4c7d-b390-ab6339d547cd`:
- `storage.buckets`: **zero rows**.
- `dd04_stage.a00_026_%` private media tables: **zero**; SQL30 remains **UNAPPROVED, NOT APPLIED**.
- ACTIVE workers: **zero**.
- No actual Supabase Storage image upload/readback verified. The connected Supabase management tool exposes SQL, migrations and Edge Functions, but not the Storage object binary upload action; no safe live object upload path was available from this chat.
- Supabase docs direct all Storage object writes through its Storage API, not by direct writes to `storage.objects`: https://supabase.com/docs/guides/storage/schema/design

## Delivered code in PR #7
1. `dd04-agent-control/a00-029-private-storage-adapter.mjs`
   - Fixed project `wbvkqfnrlasmtizjszab`, bucket `dd04-media-private-staging`.
   - Required authenticated backend authorizer, per-tenant/channel/version content-addressed object keys and strict SHA256 file names.
   - POST private image object with `x-upsert:false`; GET private authenticated object and verify bytes SHA256.
   - Fail-closed on missing key, changed hash, wrong channel/tenant, public bucket configuration and storage response errors. No public links.
2. `dd04-agent-control/scripts/dd04-a00-029-provision-bucket.mjs`
   - Separate **inert** one-shot operator script using Supabase Storage API, not SQL schema writes.
   - Requires server-side secret, exact staging endpoint and explicit `DD04_A00_029_PROVISION=EXACT_STAGING_PRIVATE_BUCKET` opt-in; creates only a private bucket with PNG/JPEG/WebP, 12MB maximum, then reads back and verifies bucket settings.
   - NOT executed in connected Supabase; no bucket exists yet. No service key stored in repository.
3. Automated tests `tests/dd04-a00-029-private-storage.test.mjs` and `tests/dd04-a00-029-bucket-provision.test.mjs`: injected Storage API doubles test POST/GET bytes, overwrite 409, cross-channel restriction, tamper, private bucket rejection, explicit operator approval and no production host.

## Actual source-image pilot using existing conversation files
Local rehearsal ZIP `DD04_A00_029_3_CHANNEL_PRIVATE_READBACK_REHEARSAL.zip`:
- Source files: `DD04_FB001_MOTHER_REFERENCE_CANDIDATE.png`,
 `DD04_FB001_BABY_REFERENCE_CANDIDATE.png` and two cropped halves of
 `bếp_nhà_bông_và_mẹ_ly_bé_xoài.png` identified as `FB002` and `TT002` **design boards**, NOT final high-resolution mother/baby identities.
- Test channels: **FB001, FB002, TT002** (3), input objects **4**.
- Each PNG decoded, local write to private exclusive storage path under tenant/channel/version, no overwrite, reread and SHA256 matched; **4/4 local readback PASS**.
- Important: PRIVATE LOCAL FILESYSTEM REHEARSAL IS NOT SUPABASE STAGING STORAGE and is NOT a successful Supabase upload.
- Every candidate remains unapproved. Preliminary visual screening:
  - FB001: **A08 HOLD** — mother/baby are earlier 3D cartoon style, do not meet newest semi-photoreal Vietnamese character direction, lacks other reference angles.
  - FB002: **A08 HOLD** — collage/label layout, missing separate canonical full-size face references.
  - TT002: **A08 HOLD** — collage/label layout, no separate locked faces.
  - A09 preliminary: no overt harmful/culturally inappropriate scene in the still-image boards, but **independent signed A09 PASS is not established**, and speech, video actions and music rights have not been inspected.
- A05 pilot briefs for each of 3 channels (30 seconds, five shots, original Vietnamese dialog pending) included, all **RENDER BLOCKED**.
- Actual immutable A08/A09 live audit events: **zero**. Live successful A05 handoffs: **zero**.

## Remaining gates (not fake PASS)
- Create private bucket `dd04-media-private-staging` through official Supabase Storage API or Supabase dashboard; exact bucket settings private/12MB/image MIME. Configure server-only backend key, no browser or GitHub secret.
- Explicit separately reviewed SQL30 media catalog / worker audit permissions, if persistence needed, before DB migration.
- 2-4 channels must obtain **actual individual high-res mother+child references** consistent with approved Character Bible. Do not confuse style posters with canonical identities.
- Upload those image bytes and read them back from Supabase Storage under authorized credentials, compare SHA256.
- Independent A08/A09 inspect actual images and post immutable, separately authenticated QC records against exact byte hash and channel identity. Any HOLD stops A05.
- A05 creates 20–60s pilot video only after true QC PASS and authorized renderer, checks file probe+SHA and returns to A08/A09 for final review; CEO G2 required before A07 posting.

## Evidence and release gate
- **PASS**: storage adapter and provisioning code; CI on latest commit (check GitHub Action); 4/4 real input file local exclusive write/readback SHA.
- **NOT PASS**: hosted storage bucket, live upload/readback, authenticated A08/A09, released A05 video.
- Current production, G2 and API-spending controls unchanged.
