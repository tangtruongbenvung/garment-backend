# DD04-A00-020 — STAGING SQL REVIEW & ACCEPTANCE GATE
Date: 2026-11-15 | Project: `wbvkqfnrlasmtizjszab` | Schema: `dd04_stage`
Scope: A00-020 transaction persistence, internal handoff, Master Task Ledger. **No production modification**.

## Verified real database facts (read-only Supabase)
- Recorded migrations: DD04 base V2, CEO enrollment audit, CEO bootstrap guard, V5.5 evidence locked. **A00-020 absent**.
- 14 total tables in `dd04_stage`; 14 have RLS enabled and 0 RLS policies. Database linter identifies 14 RLS-no-policy notices.
- Exactly 2 commands, 14 task rows, 14/14 `PLANNED_WAIT_G1`.
- Exactly 2 approvals, both G1 `PENDING`.
- 0 tables named `a00_workflow_instances`, `a00_task_contexts`, `a00_transition_events`.
- Guard `dd04_stage.guard_task_state` denies legacy task transitions; approval guard denies G1/G2 decisions.
- Database security advisor: leaked password protection disabled (separate security warning).
Evidence: connector read-only SELECT and Supabase migrations/advisors, 2026-11-15. No migration run.

## Existing implementation
- Draft PR #6 from feature/dd04-a00-020-atomic-ledger-handoff into feature/dd04-a00-019-readiness-audit.
- Atomic plan writer operates against existing guarded tables but has **no exposed write endpoint** and lacks real DB-bound actor resolver.
- Internal transition repository depends on physical schema 22, independently verified actor and final gate/authority design; currently **NOT RUNNABLE** on staging.
- CEO worklist endpoint is read-only and must be tested on actual Netlify Deploy Preview with CEO AAL2 authentication.
- Workflow node tests have passed on prior CI; this does not demonstrate a live DB transaction. Recheck CI after each code change.

## SECURITY REVIEW: BLOCKERS
1. SQL 22 is a **schema draft, not an approved execution migration**. It does not create verified runtime Agent/tenant/capability membership, a dedicated least-privilege writer DB role, or complete permission grant/revoke review.
2. G1 is still PENDING and legacy task guards are locked. Existing transactional worker intentionally rejects START while G1 is pending. The new CEO-delegation policy needs separately reviewed authorization design; do not bypass by setting a boolean/UPDATE approval manually.
3. The new context table can diverge from legacy task status. Define canonical state, reconciliation, backfill and read API interpretation before enabling writes.
4. Current `resolveVerifiedActor` / `resolveVerifiedA00` are DI contracts, not verified implementations. Must verify Auth worker identity, tenant membership, capability and session revocation in DB, not trust caller booleans.
5. Concurrent handoffs need real SERIALIZABLE test including 40001 retry policy and race with task cancellation/G1 revocation. Independent review must prove A08/A09 checks evidence; actor A00 alone should not be able to self-certify compliance.
6. Idempotency and event hash protocol must be stable across retried calls. Every handoff outcome and AUTO_READY requires immutable evidence, not simply a staged PENDING event.
7. Full finance reservation/CEO exception controls, immutable G2 approval packet and A07 platform rights are outside A00-020; remain locked.
8. Never expose privileged DB URL or service_role to browser. Existing RLS no-policy is fail-closed, not runtime authorization.

## Staging acceptance matrix
| Test | Expected | Current |
|---|---|---|
| Live SELECT worklist via DB | Actual tasks | PASS (connector SQL); API preview not tested |
| Baseline RLS, G1/G2 triggers | Locked | PASS read-only inspection |
| SQL candidate security review | Approved exact revision | FAIL/PENDING |
| Staging migration (separately authorized) | New tables + RLS + privileges | NOT RUN |
| Server DB actor verifier | Revoked/cross-tenant/forged denied | NOT TESTED |
| Atomic task plan INSERT+event+rollback | Evidence in staging | NOT TESTED |
| Concurrent idempotency and stale version | No duplicate/partial write | NOT TESTED |
| Independent Agent QC & auto handoff | Valid hash/version & separate reviewer | NOT TESTED |
| Provider A03/A04/A05/A08/A09 live execution | Real media and QC evidence | NOT ACTIVATED |
| A07 blocked without G2 | Fail-closed | Existing guards remain; no real publish test |

## CEO separate staging SQL decision (not yet given)
The only SQL currently available is `dd04-agent-control/supabase/22_A00_020_REVIEW_ONLY_DO_NOT_RUN.sql`, blob SHA at previous inspection `4182901eada90717317d7b81c7d3f9aa24c7ee82`. **Do not approve or execute this draft yet**: items (1)-(6) need remediation, final reviewed SQL and hash. No implicit approval from generic 'continue' wording.

When review is complete, require explicit instruction equivalent to:
“I approve the exact final reviewed migration SQL filename + content hash for Supabase staging project wbvkqfnrlasmtizjszab only. No production change.”
Then apply migration via migration tool, verify schema/permissions, conduct deterministic negative tests with staging test identities, log PASS/FAIL, and only then activate content pipeline.

## Agent pipeline release gate
A03: N distinct scripts for N channels, channel profile/version/hash, reply_library.json.
A04: original fictional Vietnamese mother/baby character assets, traceable prompts/ownership.
A05: actual 20-60s video with technical output evidence.
A08: independent video/linguistic QC evidence.
A09: compliance + privacy + platform policy QC evidence.
No spending without finance-approved limits, no publication without CEO G2 and valid platform rights.

## 2026-11-15 code remediation follow-up
- Added `a00-020-db-actor-resolver.mjs`: opaque server worker credential (SHA-256 lookup), DB row tenant/agent/expiry/status/capability verification, revocation fail closed. **No workers provisioned and no secrets generated or exposed.**
- Updated SQL 22 review draft: `a00_worker_identities` table, RLS enabled by default and revoked browser grants, QC_PASS event action. **This is a revised unapproved SQL version; old SHA is superseded.**
- `a00-020-save-task-plan.mjs` now requires explicit A00 SAVE_PLAN capability.
- `a00-020-atomic-ledger-repository.mjs` requires runtime action capability, canonical legacy task gate, A08+A09 QC_PASS evidence before internal REVIEW_PASS, and logs QC passes without publication permissions. Auto-ready checks canonical task status.
- Added tests for expired/revoked/forged workers, tenant isolation, denied action capability, QC evidence and pending G1. Initial CI caught a syntax error in the new test fixture; fixed in follow-up commit. **Only the latest CI workflow result can certify test PASS.**
- Remaining blockers: dedicated least-privilege DB writer role + full audit provisioning/revocation, connection between locked legacy task states and new context with authoritative authorization, safe backfill/reconciliation, real Supabase writes and rollback tests, actual CEO read API preview proof, independent verified QC artifacts, staging migration CEO authorization. A03/A04/A05 remain disabled.
- Security note: all RLS policies absent on existing 14 tables; enabling production-like runtime requires reviewed grants and policies, not merely `verified_by_db` boolean in a test double.
