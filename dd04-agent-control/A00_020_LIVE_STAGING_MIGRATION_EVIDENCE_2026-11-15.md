# DD04 A00-020 — LIVE STAGING MIGRATION ACCEPTANCE REPORT
Date: 2026-11-15 | Scope: migration + non-mutating read-only security checks
CEO approval: explicit in project conversation, exact SHA256 and target.

## Immutable input and authorization
- Supabase project: `wbvkqfnrlasmtizjszab`; project name `ducduy-ai-os-dd04-staging`; database PostgreSQL 17.11.
- Source: `dd04-agent-control/supabase/24_A00_020_FINAL_CANDIDATE_STAGING_ONLY_DO_NOT_RUN.sql`.
- Approved raw UTF-8 SHA256: `0b2f684246e7c222e2cf593e6a8c27fac331cf35e1b8704dc91799ee927d2685`.
- Verified: GitHub file blob SHA `530f3f3a6dcc7e382406a2e7c4b6a72cb7360b37` same on the CI-tested commit and the head branch; CI run 522 emitted the exact approved SHA256; all 3 jobs PASS.
- No A00-020 migration was present in migration history before execution.

## Migration execution
- Executed only via Supabase `apply_migration` on project `wbvkqfnrlasmtizjszab`.
- Migration: `20261115025815_dd04_a00_020_runtime_rls_atomic_ledger_staging`.
- Supabase returned `success:true`. Migration history confirmed exact name and version.
- No production migration, no changed production GitHub branch, no AI API spend, no publication.

## Real staging verification (read-only)
1. PASS: four new tables exist `a00_worker_identities`, `a00_workflow_instances`, `a00_task_contexts`, `a00_transition_events`.
2. PASS: `dd04_a00_runtime` exists with `rolcanlogin=false`, `rolbypassrls=false`, `rolsuper=false`.
3. PASS: each new table has RLS enabled. New policies: 3 context, 2 transition, 2 workflow; worker identity table has 0 policies (intended deny by default).
4. PASS: active guard triggers: context transition, transition event, immutable transition audit, V5.5 pending handoff. Existing V5.5 immutable handoff trigger retained.
5. PASS: no direct SELECT for anon, INSERT for authenticated, or UPDATE for service_role on new tables according to PostgreSQL privilege checks.
6. PASS: `a00_authorized(...,'READ')` returns false without a provisioned worker; `a00_current_agent()` / `a00_current_subject()` return NULL.
7. PASS: legacy data unchanged: 14 tasks, 14 `PLANNED_WAIT_G1`, 2 G1 approvals PENDING, 0 workers, 0 publish jobs, 0 runtime transition events.
8. PASS: schema advisors show only the RLS-no-policy informational findings, including 0-policy worker identities, plus existing Supabase leaked-password-protection warning (separate).
9. INCOMPLETE: attempted `BEGIN; SET LOCAL ROLE dd04_a00_runtime; ...` under connector's current Postgres session was denied with SQLSTATE 42501, `permission denied to set role`. PostgreSQL `pg_auth_members` confirms `postgres` membership has `can_set_role=false`, `can_inherit=false`, `can_admin=true`. This demonstrates **the current database connection cannot run as a restricted Agent role**. The negative worker RLS test ran successfully on isolated PostgreSQL 17 CI, NOT on live staging.

## Release blockers — do NOT mark operational PASS
- **Dedicated server-only runtime DB connection/role membership with SET privilege has not been provisioned**. It requires a separate audited configuration decision; never grant privileged browser, anon, authenticated or service_role access.
- No worker secrets or ACTIVE workers are provisioned; no Agent has been authenticated end-to-end.
- No real INSERT/UPDATE/COMMIT/ROLLBACK using restricted runtime identity on live staging; no real concurrent idempotency, cross-tenant, QC or handoff tests.
- Registered artifact `storage_ref` still needs independent byte/hash verification from a trusted storage writer, not only DB metadata.
- Original G1 is PENDING for both existing commands and legacy transition trigger remains locked. The newly requested CEO-delegated internal approval model requires a separate audited design, not an ad hoc update of `approvals`.
- Netlify CEO MFA AAL2 Deploy Preview and A11 financial authority still require live tests.
- No A03/A04/A05 or A08/A09 executor has been activated, no AI API calls or spend allowed.

## Next acceptance test order
1. Propose secure backend DB role/worker enrollment and separate limited grant approval; verify `SET ROLE` using non-owner server-only identity.
2. Provision short-lived test workers A00/A03/A08/A09 (random secrets into server secret manager, digest only in DB), test expiry/revocation, scopes and cross tenant.
3. Use staging-only test command not existing CEO commands, after approved internal G1 mechanism, to exercise task plan -> registered artifact -> ATTACH -> SUBMIT -> QC A08/A09 -> REVIEW_PASS/FAIL -> handoff with actual COMMIT/ROLLBACK/concurrent duplicate calls.
4. Verify CEO worklist read-only and immutable logs across tasks, artifacts and handoff.
5. Only after operational PASS and separate AI spending approval: A03 -> A04 -> A05 -> A08/A09; A07 requires CEO final publication approval.

## Outcome
- **MIGRATION: PASS.**
- **SCHEMA AND FAIL-CLOSED READ-ONLY POSTCHECKS: PASS.**
- **AGENT TRANSACTION / OPERATIONAL ACCEPTANCE: BLOCKED — NOT YET PASS.**
- **PRODUCTION: UNCHANGED.**
