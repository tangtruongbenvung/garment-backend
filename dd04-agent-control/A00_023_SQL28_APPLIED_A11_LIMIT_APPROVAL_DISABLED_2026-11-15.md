# DD04 A00-023 — SQL 28 APPROVED MIGRATION AND A11 FINANCE APPROVAL WORKFLOW CHANGE
Date: 2026-11-15 | Staging project `wbvkqfnrlasmtizjszab`, `dd04_stage`.

## A. CEO's two instructions
1. Exact SQL 28 approved, SHA256 `046872aca84636038eeafafeb6d9b2518e14808bf4237dafce93966804e8e9fe`, staging only.
2. CEO approves policy A11 version 1 and instructs: `Tắt tính năng phê duyệt hạn mức tài chính của A11` (disable repetitive finance-limit approvals). This is **not** authorization for any positive AI provider spending or publication.

## B. SQL 28 execution — PASS
- Verified correct Git blob SHA `7e9047ee8670eda540f01ac15598d6ad01f878a0` and exact CI raw hash; CI prior to execution: all three jobs PASS.
- Supabase `apply_migration` on staging returned `success:true`.
- Migration history: `20261115074244_dd04_a00_023_ceo_role_uppercase_fix_staging`.
- Postcheck `pg_get_functiondef`: function now checks `role='CEO'`, old lowercase string absent. Existing CEO table enforces uppercase and has one ACTIVE admin-verified CEO. No production change.

## C. A11 approval process change
- Policy v1 id `0c42f63e-6484-4519-8811-7c66b8e9d852`, SHA256 `8f206452d6338b282b59b6aa368747157de52dca4349946b874a201b8de25e94`, max per request **0 VND**, max per campaign **0 VND**, expires 2026-11-22.
- CEO's policy approval is recorded **in the project instruction/conversation**; live policy **remains PROPOSED**, not ACTIVE. Activation through DB function requires authenticated staging CEO `auth.uid()`, `auth.jwt().aal='aal2'`, exact policy id/hash and ACTIVE verified CEO enrollment. We DO NOT bypass this with a privileged SQL editor or synthetic JWT.
- Updated `a00-022-delegated-transaction-preflight.mjs`: no recurring CEO limit approval request; inactive policy => hard HOLD, spend above cap => `A11_LIMIT_EXCEEDED_HARD_DENY`, `requires_ceo_finance:false`, `finance_limit_approval_enabled:false`, `spend_allowed:false`. A11 still enforces transaction lock, hard limits, audit and safe spending.
- Added CEO site UI with a single explicit MFA AAL2 action for fixed v1 0 VND policy. It calls the existing guarded Supabase policy RPC using the user's bearer token + public API key, never service_role / DB password and never an arbitrary amount. **This UI is not evidence of a successful live activation or exposed schema.** If Data API does not expose the private schema, it fails closed; do not expand exposure without separate review.
- No app code calls `a00_022_queue_finance_exception`. Existing DB function remains provisioned from previously approved SQL 27; this request did **not** authorize deleting it or a new SQL migration. **DB-level disabling of that optional future queue would require a reviewed migration.**
- A11 internal operations within the fixed ceiling may be automatic after the policy becomes ACTIVE and worker authority is proven. Any request for nonzero spend is denied at zero cap and cannot be auto-approved; a new explicitly authorized finance policy would be needed for any real spend.
- A07 G2 CEO publishing gate unchanged.

## D. Current live database state
- Migration 28 installed with uppercase CEO role fixed.
- One policy v1 PROPOSED, 0 ACTIVE.
- A00/A02/A09/A11 worker identities = 4, all REVOKED and server tokens stored in Vault; no ACTIVE workers.
- 0 finance reservations, 0 internal G1, 0 publish jobs.
- 14 canonical tasks still PLANNED_WAIT_G1, two legacy G1 approvals PENDING.

## E. Acceptance and remaining action
- SQL 28 migration and DB postcheck: PASS.
- A11 per-limit approval workflow in source: code and tests; CI must pass on latest commit.
- CEO MFA AAL2 policy activation: PENDING actual signed user action; cannot be marked PASS from conversation alone.
- A11/G1 transaction/Agent handoff on staging: NOT YET PASS (requires ACTIVE policy, temporary scoped worker identities, actual backend login).
- No production migration, API spend, publication, G2 override.
