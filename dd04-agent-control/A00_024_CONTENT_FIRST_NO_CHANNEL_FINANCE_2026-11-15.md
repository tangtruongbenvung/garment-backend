# DD04 — A00-024 CONTENT FACTORY FIRST (2026-11-15)

**CEO directive:** disable channel-building finance approval functionality; concentrate implementation effort on Agent content production for fictional Vietnamese mother-and-baby animation.

## Scope and operating rule
- Initial pilot target: **20 channels — 10 Fanpage and 10 TikTok**, *not* 300-channel KPI.
- Each channel: one distinct Vietnamese comedy concept; fictional Vietnamese mother and baby 0–36 months, 20–60 seconds, 9:16.
- Internal no-cost concept/script/storyboard preparation **does not need an A11 finance approval**. A11 cost policy activation is no longer a blocker for preview design work.
- No authority for paid AI APIs, images/video render services, production deployment, or platform posting follows from this instruction.
- CEO approval of final precise video/image/caption/target channel/schedule (G2) is unchanged. A08 and A09 review content and compliance, not spending.
- Existing DB internal G1 function currently requires A11 finance reservation; **it was NOT bypassed or changed**. Hence actual worker DB handoffs still require a separately reviewed transition to zero-cost internal content authority. No G1 PASS claim at this stage.

## Implemented on GitHub branch `feature/dd04-a00-020-atomic-ledger-handoff`
- Removed unapproved proposed SQL 29 A11 activation RPC and its test. **SQL 29 not applied to staging**.
- Removed CEO UI A11 activation panel and handler from `ceo-login.html/js`. Finance approval is not on the path for free content draft preparation.
- Added `dd04-agent-control/a00-024-content-factory-draft.mjs`:
  - Reuses A03 `planScripts` with one unique story per channel.
  - Builds fixed fictional mother/baby character bible and consistent image prompt per scene for A04.
  - Builds A05 duration-timed motion/voice/subtitle/music direction for every scene.
  - Packages per-channel Vietnamese caption and `reply_library.json` from A03.
  - Provides A08 image/voice/safety/content QC checks and A09 compliance/anti-spam checks; both PENDING.
  - Generates per-channel SHA256 manifest, count metrics, stage handoff plan and a final CEO G2-required lock.
  - ALWAYS `videos_rendered=0`, `paid_api_calls=0`, `publish_allowed=false` and `agent_execution=false`. This is **prompt/storyboard automation, NOT generated video output**.
- Added authenticated `POST /api/dd04-a00/content-factory-preview` under existing preview-token and hostname security controls. Request body is the same bounded campaign/channels JSON as the A03 preview.
- Extended `dd04-agent-control/a03-preview.html/js`: button `A03 → A04 → A05 · Tạo hồ sơ dựng video`, export full JSON packs, on-screen shot plans.
- Added automated `tests/dd04-a00-024-content-factory.test.mjs`: 20 channels (10+10), 80 A04 prompt scenes, 80 A05 shot plans, unique package hashes, deterministic output, correct G2 locked and zero spend.
- CI checks now include the A00-024 package and UI; retains existing SQL ephemeral checks, but runs **NO new staging migration**.

## Staging safeguards
- Supabase project `wbvkqfnrlasmtizjszab`: previous A00-022 and A00-023 SQL28 migrations remain; no new migration or production changes in A00-024.
- A11 v1 0-VND remains `PROPOSED`, not ACTIVE; worker identities A00/A02/A09/A11 remain REVOKED.
- Any *real* image/video model use would be a separate provider-connected capability subject to an explicit API-spend policy; no access token was embedded in code.
- No real video, rendered images, uploaded asset, publication or real Agent autonomous DB handoff claimed.

## Next engineering gates (content first)
1. Introduce stable character/reference image storage and byte SHA256 checks on staging, staging-only credentials, edit/redo metadata and versioned campaign folders; images only after legitimate API/tool setup.
2. A04 generate reference + scene images with approved provider or an authorized, zero-cost renderer, preserve cartoon character identity.
3. A05 create actual 20–60-second vertical video files with licensed original sound/subtitle timing; prove ffprobe media duration 9:16 and file hash.
4. Implement Agent A08 and A09 *real* review evidence and reply_library.json checks; independent reviewers must not review their own asset.
5. Build a reviewed DB migration which decouples the **zero-spend content-preparation** G1 transition from finance reservation but does not relax G2/publishing/paid-service restrictions.
6. CEO approves G2 per exact asset/caption/channel/schedule; A07 publishes only with legitimate platform permissions and after G2.

## Acceptance
- **PASS on branch**: storyboard generator and content factory preview implemented.
- **CI**: check latest GitHub Actions before acceptance.
- **NOT PASS**: actual image/video render, autonomous 18-Agent execution, live handoff, publishing, conversion analytics; no claim beyond code.
