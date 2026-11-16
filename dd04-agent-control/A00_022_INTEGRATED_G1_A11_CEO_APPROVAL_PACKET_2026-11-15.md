# DD04-A00-022 — STAGING INTEGRATED G1 / A11 MIGRATION ACCEPTANCE & CEO APPROVAL
Date: 2026-11-15. Project: wbvkqfnrlasmtizjszab. Schema: dd04_stage.
Status: FINAL SQL REVIEW CANDIDATE, NOT APPLIED. Production absolutely untouched.

## 1. Exact SQL proposed for separate CEO approval
File: `dd04-agent-control/supabase/27_A00_022_INTEGRATED_G1_A11_STAGING_REVIEW_ONLY_DO_NOT_RUN.sql`
Raw UTF-8 SHA-256: `e64bea3d971582dee095e1c52c8783740f755c3f131a8a38cff991b06a7b5036`.
GitHub branch: feature/dd04-a00-020-atomic-ledger-handoff.
GitHub PR #7: https://github.com/tangtruongbenvung/garment-backend/pull/7 (DRAFT, DO NOT MERGE).
**Run only SQL 27 if explicitly approved** — SQL 27 ALREADY EMBEDS all five private tables
from SQL 26 and then adds protected procedures, compatibility guards and policies.
Do NOT apply SQL 26 separately.

## 2. Integration with legacy G1: independently recorded, not CEO impersonation
- Existing `dd04_stage.approvals` G1= PENDING is *untouched*. Existing
  `dd04_approval_guard`, `dd04_tasks_guard`, `dd04_commands_guard` stay ON.
- Five new private RLS-enabled tables: delegation policies, 4-agent independent review
  events, finance reservations, internal G1 immutable events, CEO financial exception queue.
- CEO policy activation/revocation: `a00_022_ceo_policy_decision`, checks Supabase
  `auth.uid()`, JWT `aal2`, ACTIVE + admin-verified CEO enrollment, exact policy digest
  and one ACTIVE policy/tenant. No worker credential grants CEO powers.
- Delegated G1 may be committed only by A00 with DB-confirmed A00/A02/A09/A11
  distinct subjects, registered proof hashes, current policy, finance reservation and
  canonical G1 PENDING. Decision `APPROVED_INTERNAL` is new append-only evidence, not
  legacy `APPROVED` or CEO approval. Review manifest SHA is recomputed in DB.
- Updated A00 context guard recognizes `a00_022_effective_g1()` while legacy tasks
  remain `PLANNED_WAIT_G1`; the CEO ledger must display both canonical and internal
  authority fields to prevent confusion.
- Root context RLS and ATTACH update RLS fixed; A03/A04 reviewed internally by A00.
  A05 final media requires independent A08/A09 quality proof. V5.5 pending handoff
  route corrected A00→A03→A04→A05→A08→A09. G2 and A07 publishing untouched.

## 3. A11 finance, fail-closed
- CEO must establish ACTIVE bounded policy; without it, no reservation and no G1.
- A11 server-side worker can call `a00_022_reserve_finance` only in SERIALIZABLE
  transaction; DB-acquired per-tenant+campaign advisory lock, sum ALL RESERVED amounts
  across commands, months and policy versions; reject exceeding single/campaign caps.
- Period key must equal local Asia/Bangkok month; this prevents externally choosing an
  arbitrary period to split commitments.
- Exact command input SHA and registered campaign required; one reservation per
  command+input SHA; stale policy/worker denied. Failed reservations produce no charge.
- `a00_022_queue_finance_exception` records A11 CEO exception in a NEW transaction;
  no auto-funding or spend in a failed transaction. Missing policy may still be queued
  with NULL policy_id. Reservation releases/payouts are NOT enabled by this migration.
- Worker tokens and passwords remain outside GitHub; private tables are not writable
  directly by anon/authenticated/service_role/runtime; only narrow audited
  SECURITY DEFINER functions granted to restricted backend role.

## 4. Evidence on disposable PostgreSQL 17, NOT Supabase staging
GitHub Actions Run #624, ID `43689495580`:
https://github.com/tangtruongbenvung/garment-backend/actions/runs/43689495580
All three jobs PASS: `test-a00`, `validate-sql-ephemeral`,
`validate-windows-powershell`.
- Actual SQL 27 parses and applies after SQL 24 fixture, single BEGIN/COMMIT.
- Five RLS tables, immutable triggers, private table privileges and narrowly
  granted DB functions verified.
- Synthetic CEO AAL1 denied; AAL2 authorized a PROPOSED finance policy.
- Dedicated *ephemeral* backend DB login, role dd04_a00_runtime, four temporary
  worker subjects submitted proofs; A11 reserved 400+250 against cap 700.
- Split additional 100 spending request denied, CEO exception queued, independent
  four-Agent manifest allowed internal G1 commit, effective G1 observed in the
  same SERIALIZABLE transaction.
- ROLLBACK leaves zero reservation, review, internal G1 and finance exception rows.
- Legacy G1 remained PENDING; no G2, publishing, outbound API or paid AI calls.
- CI auth.uid/auth.jwt are **test fixtures**; live CEO AAL2/auth pipeline NOT YET TESTED.

## 5. Live staging current facts (read-only verification)
- `a00_022_%` tables = **0**.
- Commands=2; tasks=14; 14 PLANNED_WAIT_G1; two legacy G1 PENDING.
- ACTIVE worker identities=0; existing a00_transition_events=0;
  v55_publish_jobs=0; ACTIVE v55 finance policies=0.
- A00-020/021 migration remains intact. No SQL 27 migration applied, production
  unchanged, no spending, no Agent activation.

## 6. Conditions for staging runtime acceptance AFTER separate CEO approval
1. Reopen exact SQL 27 on GitHub and compare content SHA256 byte-for-byte with
   `e64bea3d971582dee095e1c52c8783740f755c3f131a8a38cff991b06a7b5036`. If mismatch STOP; never apply prior candidate or SQL 26 separately.
2. Apply once to project wbvkqfnrlasmtizjszab, schema dd04_stage, record version,
   no production writes. Postcheck all five private RLS tables, policies, new functions,
   existing G1/G2 triggers and 14 historical tasks.
3. CEO signs in Supabase staging and verifies MFA AAL2 and ACTIVE enrollment.
   Configure a PROPOSED delegation finance policy and approve exact limits/version
   through audited CEO flow. CEO must decide the **actual VND limits**; this is not
   inferred from existing revenue or budget. Do not auto-activate limit 0 or arbitrary.
4. Provision server-held, tenant-bound A00/A02/A09/A11 credentials with expiry,
   revocation, distinct subjects, actual document/storage artifact byte hashes.
5. Real staging test transaction and rollback using dedicated dd04_a00_backend login:
   reserve across two commands, reject over-cap concurrent attempts, deny stale/forged
   worker, independent reviews, commit new G1, create task context, verify revisions
   and immutable event; verify rejection of unauthorized G2/A07.
6. Update CEO Master Task Ledger to distinguish canonical G1 PENDING vs internal G1
   APPROVED_INTERNAL; G2 always CEO final asset/caption/target channels/schedule.
7. Only after full operational PASS + separate AI provider spending authorization
   begin A03→A04→A05→A08/A09; A07 remains CEO-G2 gated.

## 7. Exact separate approval requested
> Tôi phê duyệt migration DD04-A00-022 chỉ trên Supabase staging project
> `wbvkqfnrlasmtizjszab`, schema `dd04_stage`, đúng tệp
> `27_A00_022_INTEGRATED_G1_A11_STAGING_REVIEW_ONLY_DO_NOT_RUN.sql`
> có SHA-256 `e64bea3d971582dee095e1c52c8783740f755c3f131a8a38cff991b06a7b5036`. Chỉ cho phép migration và nghiệm thu staging;
> chưa cho phép thay đổi production, kích hoạt chi phí API AI hoặc đăng bài.

**Decision:** SQL integration and CI PASS; actual staging migration NOT APPLIED,
runtime G1/A11 and Agent handoff NOT YET PASS. No production modification.
