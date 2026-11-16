# DD04-A00-032 — REFERENCE VIDEO STUDY & 3D AI COMMAND CENTER STAGING

Date: 2026-11-16, CEO-provided reference video `1K7HIJUAB_ATSLJ5.mp4`, approx. 35.13s, 910×512, H.264/AAC, 30 fps.
Scope: GitHub PR #7 DRAFT, staging HTML/JS/CSS prototype only.

## 1. Reference observations (what the video visibly contains)
- Dark, high-contrast black/navy dashboard, cyan/teal neon central assistant face and animated branching connection paths.
- Branding at top left `TÔI HỌC AI + TIỂU TUYẾT`; a central label `SECOND BRAIN`.
- Upper-row status and log panels with timestamps; left-side intake/Telegram, Facebook Page and web/website card groups; right-side task activity/cards, and a bottom sequence linking Content Manager, Page Admin, SEO Writer, Customer Service.
- A human presenter/avatar illustration appears near bottom-left; no clear demonstration of an interactive 3D mesh viewer or verifiable real-backend agent execution.
- This is a visual reference, **not** evidence of a real production API, analytics system or true polygonal 3D.

## 2. DD-04 implementation created
- `dd04-agent-control/dashboard-3d-preview.html`
- `dd04-agent-control/dashboard-3d-preview.css`
- `dd04-agent-control/dashboard-3d-preview.js`
- A00 represented by a CSS-3D scene with real perspective/transforms/orbital rings; SVG branching connections; responsive dark interface; reduced-motion support.
- Selectable roles for all 18 Agents A00–A17, a highlighted path through A03/A04/A05/A08/A09, and CEO G2/A07 publish hold.
- 20-channel target shown explicitly as target, not operational accounts; active workers and G2 counts shown as '--' until authenticated data exists.
- **No external scripts, no API requests, no Supabase token, no database reads/writes, no paid provider, no publishing**. CSP `connect-src 'none'` and self-only scripts.
- CSS 3D effects are a low-cost prototype, **NOT** a GLB rigged character or WebGL 3D model. Do not mislabel as actual 3D avatar. Simple fallback preserves UI without GPU.

## 3. Next build — genuine 3D and verified real Agent activity
1. Review visual concept with CEO; choose whether a rotating AI brain icon or a realistic animated A00 avatar is actually required. Do not confuse the video source's 2D neon assistant with GLB animated avatar.
2. For real 3D meshes, load a licensed GLB/glTF 2.0 asset using Three.js GLTFLoader, optionally React Three Fiber if integrated frontend is React. Avoid external runtime CDN in sensitive authenticated dashboard; pin dependencies, bundle via build. Official references: https://threejs.org/docs/pages/GLTFLoader.html and https://r3f.docs.pmnd.rs/advanced/scaling-performance .
3. Use a read-only, authenticated, scoped staging server endpoint to display **real** Master Task Ledger and status; validate CEO AAL2 and use existing RLS; no direct browser Supabase secrets. Never invent live statuses or fabricate Agent transition events.
4. Map actual A00 → A03 → A04 → A05 → A08/A09 handoff log to connections and colors. State mapping: NOT_STARTED grey, RUNNING teal, WAITING_REVIEW amber, BLOCKED red, PASS green only with audited evidence; CEO G2 alone unlocks A07.
5. Keep frontend performance: pause animation in background, user option reduced motion, cache glTF geometry, avoid high frame rate continuous rendering on mobile.
6. Future separate product area: per-channel Character Bible 3D inspector of mother/baby, **not** the same as central 3D Agent diagram. Requires separately verified channel-specific mesh/rig/license and identity hashes.

## 4. Acceptance
- PASS code: staging-only interactive 18-Agent CSS 3D prototype, fails closed on real status, no data write.
- PENDING: live browser smoke test and authenticated staging data integration.
- NOT DONE: full 3D WebGL GLB agent/avatar rendering, actual 3D mother/baby model viewer, real telemetry/worker control.
- No migration, production changes, paid API calls, content uploads or postings.

## 5. Link (deploy only if PR #7 preview published)
`/dd04-agent-control/dashboard-3d-preview.html` on the **verified** Deploy Preview host. CI success alone does not prove Netlify was deployed; confirm deployment before claiming live URL.
