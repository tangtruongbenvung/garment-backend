# DD04-A00-023 — STAGING WORKER IDENTITY & G1/A11 ACCEPTANCE EVIDENCE

**Date:** 2026-11-15
**Project:** `wbvkqfnrlasmtizjszab` / schema `dd04_stage`
**Status:** worker identity provisioning PASS; security negative tests PASS; **live positive G1/A11 NOT YET PASS**.
**Scope:** staging only, no production change, no API spend and no publication.

## 1. Actual persistent staging changes (not a schema migration)

- Created **four distinct tenant-scoped worker identity records**, one each A00/A02/A09/A11, with cryptographically random 48-byte secrets and distinct subject UUIDs.
- Passwords never returned in tool output, chat or GitHub. PostgreSQL generated each secret inside a single transaction, stored plaintext **only** as a Supabase Vault secret, and stored SHA-256 only in `a00_worker_identities.credential_sha256`.
- Vault names: `dd04_a00_023_agent_a00_staging`, `dd04_a00_023_agent_a02_staging`, `dd04_a00_023_agent_a09_staging`, `dd04_a00_023_agent_a11_staging`.
- All **status REVOKED**, `allowed_actions=['READ']`, expiry 7 days from enrollment. No backend/Netlify worker env secret provisioned and no token disclosed.
- Verified: four distinct `subject_id`, four distinct credential digests, four Vault records, zero ACTIVE workers.
- Distinct identities support independent review, but do not mean review events exist.

## 2. Live staging worker AUTH + rollback-only tests

A single transaction read each Vault secret *inside the SQL DO block*, never returned it, and verified:
1. Credential with REVOKED worker is denied READ.
2. Temporarily update that worker to ACTIVE **only inside the test transaction**; correct `a00_authorized`, `a00_current_agent`, `a00_current_subject` and tenant binding observed.
3. Another tenant and an ungranted action SAVE_PLAN were denied.
4. `a00_022_check_worker` was still denied in an administrative `postgres` session even when worker token matched; this proves A00-022 requires the correct real backend session user, not just a copied token.
5. Return to REVOKED inside transaction; confirm authorization becomes false; finally ROLLBACK.

Result: four worker cases PASS. Permanent status afterward: four REVOKED, zero ACTIVE.

## 3. A11 test finance policy proposed, NOT activated

- Proposal ID `0c42f63e-6484-4519-8811-7c66b8e9d852`.
- Policy version: **1**, status **PROPOSED**, scope `DD04_INTERNAL_CONTENT_ONLY`.
- `max_single_spend_vnd=0`, `max_campaign_spend_vnd=0`.
- Hash: `8f206452d6338b282b59b6aa368747157de52dca4349946b874a201b8de25e94`.
- Applies to verified CEO enrollment; effective 2026-11-15 07:36:38 UTC, expiry 2026-11-22 07:36:38 UTC.
- **No CEO approval of financial limits has been received yet.** Creating PROPOSED does not confer authority. No policy ACTIVE, no money committed, no provider API calls.
- IMPORTANT: A00-023 financial policy needs separate CEO authorization before activation, EVEN at 0 VND. Real CEO must be authenticated with AAL2 in the authorized staging UI.

## 4. Discovered staging blocker, confirmed from live schema

`dd04_stage.ceo_enrollments` has DB constraint `CHECK(role='CEO')`, and verified CEO row has `role='CEO'`. But the applied A00-022 function `a00_022_ceo_policy_decision` requires `role='ceo'`; verified CEO would be rejected.

Prepared **staging-only corrective SQL**:
`dd04-agent-control/supabase/28_A00_023_CEO_ROLE_CASE_FIX_STAGING_REVIEW_ONLY_DO_NOT_RUN.sql`

- **SHA256 raw UTF-8:** `046872aca84636038eeafafeb6d9b2518e14808bf4237dafce93966804e8e9fe`.
- GitHub blob SHA: `7e9047ee8670eda540f01ac15598d6ad01f878a0`.
- Only replaces the narrow CEO policy-decision function to check `role='CEO'`; all MFA AAL2, admin verification, expected policy digest, status CAS, triggers, privileges remain unchanged.
- CI GitHub Actions run **638** (`43690797982`), three jobs PASS. Isolated PostgreSQL 17 fixture now uses exact uppercase `CEO` constraint: AAL1 activation denied; synthetic AAL2 permitted; A11 cap and four-review G1 transaction PASS.
- **SQL 28 has NOT been executed on Supabase staging.** Separate CEO approval with exact filename + hash is required. No implicit authorization from request to implement A00-023.

## 5. Live staging final safety postcheck

- Four workers REVOKED; 0 ACTIVE.
- One A11 policy PROPOSED (0 VND); 0 ACTIVE.
- 0 A11 reservations; 0 internal G1 events; 0 Agent transition events; 0 publish jobs.
- 14 original tasks remain PLANNED_WAIT_G1; two legacy G1 approvals PENDING.
- No production writes, published posts or AI costs.

## 6. Unfinished acceptance gates

- Obtain **separate CEO authorization for SQL 28 migration**; verify exact hash, apply to staging, check role guard and unchanged permissions/data.
- Obtain **explicit CEO finance decision** for policy ID/hash and zero VND caps before activating A11 policy, using true CEO MFA AAL2; never fake auth/JWT or update policy directly.
- Separate operational authorization to temporarily activate short-lived A00/A02/A09/A11 worker roles, bind one-time secrets to server-only Netlify Deploy Preview settings, and return to REVOKED after testing.
- Real backend `session_user=dd04_a00_backend` and `SET LOCAL ROLE dd04_a00_runtime` must execute a positive SERIALIZABLE G1/A11 zero-cost reservation with independent artifact hashes, commit/rollback, cross-tenant, concurrency, expiry and revocation checks.
- Existing A03/A04/A05 executions and A08/A09 QC remain blocked until release gates PASS. CEO G2 must approve final exact media/caption/channels/schedule; A07 cannot auto-publish.

## 7. Result

**PASS:** tenant-scoped worker enrollment locked by default, Vault secrets, independent identity checks, live negative auth/cross-tenant/revocation tests, 0-VND PROPOSED policy, isolated A11/G1 CI and prepared CEO-role correction.
**NOT YET PASS:** live authenticated CEO policy activation; positive staging runtime G1/A11 transaction; real handoff. No authority to activate paid providers or publish.
