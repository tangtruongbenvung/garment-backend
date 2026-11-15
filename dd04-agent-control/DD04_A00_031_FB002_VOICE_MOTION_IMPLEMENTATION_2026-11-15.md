# DD04 A00-031 — Vietnamese voice + animated character A05 pilot
Date: 2026-11-15. PR #7 DRAFT. Staging only. No production migration, provider billing or platform publication.

## CEO request
Upgrade FB002 mother/baby content beyond static Ken Burns stills with **actual frame-changing character gestures** and **natural, funny Vietnamese mother/toddler dialogue**. Keep same character within and across channel; A08/A09 + CEO G2 required before publication.

## Generated real local movement demonstration
- GIF: `DD04_FB002_MAU_CHUYEN_DONG_NHAN_VAT.gif`, 9 AI-generated animated frames at 160ms/frame, 390x439. Mother and toddler change expressions and move toys in a Vietnamese kitchen setting; faces may drift subtly and have NOT passed A08 visual consistency.
- MP4: `DD04_FB002_CHUYEN_DONG_NHAN_VAT_DEMO_5s.mp4`, 5.75 sec, H264 540x608, 24fps, no audio. This short looping animation **IS NOT a full 20–60 second production-ready video**, has no voice or actual verified lip sync.
- The original 30-second FB002 MP4 produced previously remains a six-shot moving-still storyboard with subtitles and background music, not full natural character motion.
- Local bundle: `DD04_A00_031_FB002_GIONG_NOI_VA_CHUYEN_DONG_DEMO.zip`, SHA-256 `f9d5ab116f63348ef79f07ebe7e879da853439c70c26c55fb3f2d349a5d054bf`. Contains GIF/MP4, six-shot 30sec Vietnamese script JSON, SHA manifest, README.

## New A05 voice-motion script and gate in GitHub
- `dd04-agent-control/a00-031-voice-motion-pack.mjs`: 30sec FB002 storyboard, six 5-second scenes, one fixed mother voice, minimal age-appropriate toddler speech, gesture/emotion/lip-sync prompts, channel ID and reference hash locks, immutable voice/audio/video SHA placeholders, automatic refusal for mismatches and G2/publish always locked.
- `tests/dd04-a00-031-voice-motion.test.mjs`: validates length, voices, toddler speech, per-shot hashes, no false lip sync or publishing approvals.
- CI [Run #789](https://github.com/tangtruongbenvung/garment-backend/actions/runs/43703939375) PASS all jobs.

## Verified external provider options, not connected or executed
- FPT Speech TTS v5 official API `POST https://api.fpt.ai/hmi/tts/v5`, server-only api_key, voice `banmai` female North; async result URL and 5000-char per request limit. Source: https://docs.fpt.ai/docs/vi/speech/api/text-to-speech.html
- ElevenLabs Flash v2.5 supports Vietnamese, voice quality needs listening test; source: https://elevenlabs.io/docs/overview/capabilities/voices
- Kling image→video / motion control can preserve subject visual reference and animate character, but must test per shot; source: https://kling.ai/dev/apiReference/model
- HeyGen and fal integrations available for the user to CONNECT; neither is confirmed connected. Do not make any provider API charge without legitimate connection and explicit budget authorization. Keep secrets in server-side environment, not chat/GitHub.

## Remaining real gates
1. Lock channel-specific FB002 high-resolution mother/baby reference assets and exact storage hashes in private staging bucket. Existing Storage bucket configured but real upload/readback not accepted.
2. A05 must generate actual Vietnamese voice audio files from legitimate provider or licensed locally-created recordings; confirm listening quality and accents; preserve voice per channel, no real child voice impersonation.
3. Produce real animated 20–60s shot clips with verified identity, voiced dialogues and synced mouth. Duration/file hash and rights recorded.
4. Independent A08/A09 actual visual/audio review (not just fabricated JSON), CEO G2 final asset/caption/channel/schedule. Only then consider A07 through legitimate platform permissions.
5. The SQL30 media-registry migration is STILL unapproved and unexecuted. No production writes. No paid API calls yet.
## Outcome
PASS: generated short actual AI multi-frame animation demo and A05 voice/motion production script; CI passed.
NOT PASS: speech file synthesized, actual lipsync, final animated 30s video, A08/A09, G2 or publication.
