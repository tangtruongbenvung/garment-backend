# DD04-A00-022 — BIÊN BẢN ÁP DỤNG MIGRATION & NGHIỆM THU STAGING

Ngày 15/11/2026. Supabase project: `wbvkqfnrlasmtizjszab`. Schema: `dd04_stage`.
Scope: **STAGING ONLY**. Production, G2 publishing, external AI API spend remain locked.

## 1. Ủy quyền CEO, SQL chứng thực
CEO phê duyệt **riêng** migration file `dd04-agent-control/supabase/27_A00_022_INTEGRATED_G1_A11_STAGING_REVIEW_ONLY_DO_NOT_RUN.sql`, raw UTF-8 SHA-256 `e64bea3d971582dee095e1c52c8783740f755c3f131a8a38cff991b06a7b5036`.

Source file Git blob `438fe29570c2ee442a8930d0ae24eba31fe68ba4` on branch `feature/dd04-a00-020-atomic-ledger-handoff`, 36,001 UTF-8 characters. CI [GitHub Actions #624](https://github.com/tangtruongbenvung/garment-backend/actions/runs/43689495580) printed matching SHA-256 and all 3 jobs PASS.

## 2. Migration staging đã chạy thành công

- Supabase `apply_migration` returned `success:true`.
- Exact migration name: `dd04_a00_022_integrated_g1_a11_staging`
- Version in Supabase migration history: **`20261115072517`**.
- Did not run draft SQL 26 separately, did not alter production.

## 3. Post-migration live database read-only assertions

- `a00_022_%` tables: **5**, RLS **enabled on all 5**.
- Trigger enabled (`tgenabled='O'`): `a00_022_finance_deny_update`, `a00_022_internal_g1_guard`, `a00_022_policy_guard`, `a00_context_transition_guard`, `a00_transition_event_guard`, `a00_v55_handoff_insert_guard`, `dd04_approval_guard`, `dd04_commands_guard`, `dd04_tasks_guard`.
- `dd04_a00_runtime`: direct INSERT internal G1=false; direct INSERT finance reservation=false; can EXECUTE restricted `a00_022_commit_g1`=true; `anon` cannot EXECUTE this RPC; `authenticated` can call guarded CEO policy decision function.
- `a00_022_effective_g1(...)` returns **false** for unapproved command.
- `commands=2`; `tasks=14`; `PLANNED_WAIT_G1=14`; two legacy G1 approvals still `PENDING`.
- `a00_022_delegation_policies=0`; `a00_022_review_events=0`; `a00_022_finance_reservations=0`; `a00_022_internal_g1_events=0`; `a00_022_ceo_finance_queue=0`.
- `ACTIVE worker identities=0`; `a00_transition_events=0`; `v55_publish_jobs=0`.

## 4. Live staging negative transaction tests (ROLLBACK)

Supabase `execute_sql` opened a transaction, inserted a **PROPOSED** test policy, then intentionally tried:
1. Direct INSERT of `ACTIVE` finance policy — denied by `CEO_POLICY_PROPOSAL_ONLY`.
2. Call `a00_022_commit_g1` without a backend-scoped worker — denied `A00_022_RESTRICTED_WORKER_REQUIRED`.
3. Call `a00_022_reserve_finance` without authorized A11 worker — denied `A00_022_RESTRICTED_WORKER_REQUIRED`.

All denials checked explicitly in SQL; unexpected error or an unauthorized success would have caused the test to fail. Transaction ended with `ROLLBACK`. Subsequent read-only counts confirm **zero persisted test policies/reviews/reservations/internal G1**. Supabase output omitted individual NOTICE messages; evidence is the successful SQL call + persisted zero counts.

## 5. Positive tests available only in isolated CI
CI PostgreSQL 17 with synthetic CEO Auth / ephemeral backend login proved:
- AAL1 denied/AAL2 accepted for **synthetic** CEO.
- Four independently credentialed A00/A02/A09/A11 reviewers.
- A11 SERIALIZABLE reservation for same campaign across commands 400 + 250 out of 700 budget; extra 100 refused.
- Valid manifest → internal G1 commit; rollback left no test rows.

**These results DO NOT prove positive staging runtime transactions**, which still require a real worker credential and real CEO AAL2 finance policy. No Netlify write endpoint or worker activation has been authorized.

## 6. Remaining acceptance gates

- Create a CEO-reviewed **PROPOSED** policy with explicit maximum spend limits and version/hash. Activate via verified real CEO MFA AAL2 only after **separate financial authorization**. User approved *migration/test*, not any spend limit or API AI cost.
- Provision A00/A02/A09/A11 tenant-scoped worker credentials (secret only on server, expiry/revocation and distinct subject identities), confirm Netlify preview only.
- Perform real staging backend positive G1/A11 serializable test with audit/rollback and concurrent over-budget negative attempts.
- Ensure A00 task-plan/context writer can create legacy tasks/context with G1 internal; reconcile CEO Master Task Ledger display showing both canonical `PENDING` and audited internal `APPROVED_INTERNAL`. Do not present legacy G1 as CEO-approved.
- Validate real A03→A04→A05→A08→A09 artifact byte hash & independent QC, no paid provider calls until separately approved.
- A07 remains publish-locked until exact final asset/caption/channels/schedule G2 CEO approval.

## 7. Report
**PASS:** exact approved staging migration, five-table RLS/ACL, existing guards, fail-closed negative SQL tests, CI PostgreSQL transaction simulations.
**NOT YET PASS:** real CEO policy activation, live backend worker G1/A11 successful COMMIT, concurrent staging over-budget test, 18 Agent handoff, AI content providers.
**Unchanged:** production, AI costs, publisher privileges, CEO G2.

