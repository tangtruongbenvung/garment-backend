# DD04-A00-027 — 20 INDEPENDENT CHANNEL IDENTITY PACKS (SEEDING → SALES)
Date: 2026-11-15 | GitHub PR #7 DRAFT | staging-only.

## CEO design decision
The approved mother/baby image is **one common realism/style reference**, not a shared character face.
Every one of 20 channels must have its OWN fictional Vietnamese mother and baby identity, wardrobe, consistent voice/persona, home setting, palette and story signature. Keep identical within every video and across all videos, including the transition from building an audience to transparent product sales.

## Created deliverables — conversation export
- ZIP: `DD04_20_KENH_NHAN_DIEN_MOI_BAN_HANG_V1.zip` (delivered in conversation)
- Root folder: `DD04_20_KENH_BO_NHAN_DIEN_V1_2026-11-15`
- Channel index: `MASTER_CHANNEL_LEDGER.csv` / `MASTER_CHANNEL_LEDGER.json`
- Per channel: `HUONG_DAN_KENH.md`, `channel_profile.json`, `character_bible.json`,
 `visual_style.json`, `continuity_rules.json`, `reference_manifest.json`,
 `a04_reference_prompts.json`, `phase_content_plan.json`,
 `agent_handoff.json`, `a08_a09_qc.json`, `reply_library.json`,
 `BANG_MAU_VA_DAC_DIEM_KENH.png`.
- Global shared style image: SHA256 `d61ea7286a8ed957792cb5cb2e0f5a473af7769edde5dcc25e3358deab59ba31` — **STYLE ONLY**.
- Each channel has 7 reference image slots (mother frontal, 3/4, expressions; baby frontal, 3/4, expressions; mother+baby joint). **140 slots PENDING**; no channel-specific rendered reference PNG falsely claimed.
- Verified 20 distinct channel design hashes and profile hashes, 10 Fanpage + 10 TikTok, 245 file SHA256 manifest entries. The exported ZIP also passed CRC integrity check.

## GitHub staging source of truth
`dd04-agent-control/registries/dd04-20-channel-identity-registry-v1.json`:
20 names and distinct characters + platform, baby age, unique story direction, version and pending reference status. Registered identities are **not** proof that 20 platform accounts exist.

CI test `tests/dd04-a00-027-channel-registry.test.mjs`: exactly 10/10, 20 different mother/baby aliases, baby ages in 0–36 months, common image style-only, channel-to-channel independence and identity lock across MOI → CHUYEN_TIEP → BAN_HANG.

## Content and sales governance
- Days 1–30: entertainment without disguised product advertising; evaluate real per-channel metrics daily.
- After 30 days: select 5–10 strong channels for priority, improve others; do not automatically delete channels.
- Transition: keep same mother/baby and visual bible, naturally include clothes in a fictional scene only when legitimate product data exists.
- Sales: A14/A15 can use Bin kids or other verified brand only with true SKU, size, authorized material description, price and inventory; no fabricated claims or cross-seeding.
- All copy, captions, messages, reply_library are Vietnamese polite, accurate and human-sounding.
- Agent A03→A04→A05→A08/A09; no image/video actual render or Agent automated execution claimed.
- A08 checks real image face and clothing continuity, real file byte SHA and defects; A09 checks Vietnamese cultural fit, child safety, copyright and transparent marketing. CEO final G2 required for exact final asset, caption, channel and schedule.
- Financial approval for no-cost channel-building disabled by CEO direction; no provider AI paid calls authorized.

## Next release gates
1. Generate a **separate** mother/baby reference sheet PER channel from its own prompt, not the shared CEO style example; A08/A09 verify before marking reference status READY.
2. Private Supabase staging Storage / immutability / audit proof require separate reviewed migration and permissions.
3. Bind A03/A04/A05 runtime inputs to the exact `channel_id + version + profile_sha256 + reference asset sha256`; reject cross-channel use.
4. Generate sample videos for a small set of channels only after actual production tooling is authorized, test A08/A09, then apply strict CEO G2 before publishing.
5. This source registry is intentionally concise. The **complete 20-channel dossiers remain in the downloadable ZIP**, not incorrectly presented as already imported into Supabase.
