# RLS Sprint — Handoff (2026-04-26 EOS)

This doc is the next-session kickoff. Read it first, then re-read
`docs/specs/rls_sprint_plan.md` for full context, then check
`MEMORY.md` → `project_rls_sprint_progress_2026-04-26.md` (already
up to date as of `a590abb`).

---

## Where we are

**57 tables under RLS, all enforcing on dev.** RLS is no longer
just-on-paper: as of commit `38b0dd5` (this session) the dev runtime
role `builtcrm_app` is `NOBYPASSRLS` and a latent recursion bug in
the POM policy was fixed. Every wave's denial check now actually
denies (contractor GUC returns expected rows, unrelated GUC returns
0 rows, no recursion errors anywhere).

**Recent session commits (newest first):**
- `a590abb` — Wave 6: 19 tables (transmittals, drawings, punch list,
  selections, closeout nested). Migration `0036`.
- `38b0dd5` — BYPASSRLS dev drift + POM recursion fix. Migration `0035`.
- `264bd2c` — Wave 5: documents + document_links. Migration `0034`.
- `191b339` — Wave 4: rfis, change_orders, submittals. Migration `0033`.
- `377a65b` — Wave 3: daily_logs.
- `4a06e11` — Wave 1: meetings, inspections, weekly_reports, prequal_project_exemptions.

---

## What's left, in order

### 1. Wave 4 nested children (~7 tables, ~0.5 session)
Mechanical nested-via-parent. Tables:
- `rfi_responses` (parent: `rfis`) — `src/db/schema/workflows.ts`
- `submittal_documents`, `submittal_transmittals` (parent: `submittals`) — `src/db/schema/submittals.ts`
- `daily_log_crew_entries`, `daily_log_delays`, `daily_log_issues`, `daily_log_photos`, `daily_log_amendments` (parent: `daily_logs`) — `src/db/schema/dailyLogs.ts`

Template (verbatim from wave 2 / wave 6 children):
```ts
tenantIsolation: pgPolicy("<table>_tenant_isolation", {
  for: "all",
  using: sql`${table.<parent_id>} IN (SELECT id FROM <parent_table>)`,
  withCheck: sql`${table.<parent_id>} IN (SELECT id FROM <parent_table>)`,
}),
```
Then `.enableRLS()` on the table. Generate migration, apply, smoke-test
(use `scripts/_wave6-smoke.mjs`-style inline script as a model — see
the wave-5 / wave-6 commit messages for examples), then convert any
bare `db.select()` against these tables to `withTenant`.

### 2. Prequal cluster (3 tables, ~0.5 session, has 1 design moment)
- `prequal_templates` — Pattern A, contractor-owned (`org_id = GUC`).
- `prequal_submissions` — **custom shape needed.** No `project_id`. Both `submitted_by_org_id` and `contractor_org_id` exist. Both orgs need read access. Recommend:
  ```sql
  USING (
    submitted_by_org_id = current_setting('app.current_org_id', true)::uuid
    OR contractor_org_id = current_setting('app.current_org_id', true)::uuid
  )
  ```
  Stop and confirm with user before shipping — this is a new policy template the sprint hasn't used before.
- `prequal_documents` — nested-via-parent on `prequal_submissions`.

Schema file: `src/db/schema/prequal.ts`. Already has `prequal_project_exemptions` RLS'd (wave 1) — use that block as the schema-edit landmark.

### 3. Notifications design slice (~1 session, design input required)
`notifications` is user-scoped: `recipient_user_id` + nullable `project_id`. The milestones / 2-clause-hybrid template doesn't fit. **This is a stop-and-ask item** — present the user with 2-3 policy shape options (e.g. `recipient_user_id = current_user_id` GUC vs. project-scope-with-recipient-filter vs. dbAdmin-only) and let them pick before writing the migration.

### 4. Background-job tables (~1 session)
`paymentTransactions` (~20 files), `syncEvents`, `webhookEvents`. Use Slice 3 webhook split + Slice 4 admin-pool routing for cross-org sweeps. Trigger.dev jobs in `src/jobs/` need an audit pass — confirm each one routes through `dbAdmin` for cross-org work, or `withTenant(eventOrgId, ...)` per-tenant. Wave 5/6 already routed reviewer-token paths and external-token paths through `dbAdmin` end-to-end; same pattern applies.

### 5. Remaining org-scoped table audit (~0.5 session)
A few tables I haven't fully classified yet:
- `data_exports`, `sso_providers`, `audit_events`, `activity_feed_items`, plus any leftover. Most are either Pattern A or explicitly cross-cutting (deferred). Run `grep -L "enableRLS" src/db/schema/*.ts` and classify each remaining table — most will be either trivial Pattern A or "deferred cross-cutting" with a security_posture entry.

### 6. Phase 5 close-out (~1 session)
- **Verify `builtcrm_app NOBYPASSRLS` on prod.** Check via Neon console or a one-off audit script. If drifted, apply the same delete + recreate flow used on dev — see `scripts/recreate-builtcrm-app.sql` (idempotent guard, generates new password, re-grants on existing public-schema tables, includes a verification block). Then update prod `DATABASE_URL`.
- **Provision a non-bypass test role.** Currently `.env.test` runs as `neondb_owner` (which has BYPASSRLS), so the test suite doesn't exercise enforcement. Create a `builtcrm_test` role mirroring `builtcrm_app`, point `TEST_DATABASE_URL` at it, then run the existing 103-test suite to surface any test-only assumptions about admin reads.
- **CI gate.** Add a grep-based check (or eslint rule) flagging bare `db.select()` / `db.update()` / `db.insert()` / `db.delete()` outside `withTenant(...)` or `dbAdmin.` callers. Allowlist file: `src/db/seed.ts` and any other admin script. Wire into the existing CI workflow.
- **Failure-mode test suite** (per `rls_sprint_plan.md` §5): cross-tenant FK violation rejected, missing-SET-LOCAL bypass denied, pool reuse doesn't carry GUC, etc. Build a small test infrastructure that runs as the non-bypass role and asserts these cases.
- **Doc updates:**
  - `security_posture.md §6` — mark RLS RESOLVED.
  - `compliance_map.md` CC5.2 + CC6 — DB-layer enforcement now in place.
  - Document the Option A decision and the POM recursion fix in `compliance_map.md` (auditable history).

---

## Critical gotchas to remember

1. **Recursive policies are a planner-time error, not runtime.** If you write a multi-org clause C that references the SAME table being protected (`SELECT FROM POM` from inside POM's own policy), Postgres rejects the rewrite with `42P17` — short-circuiting OR doesn't save you. **Don't repeat the POM clause-C mistake on prequal_submissions** if you ever write a 3-clause version: if a clause subquery references the table itself, wrap the inner read in a `SECURITY DEFINER STABLE` function.

2. **Slice 3 entry-point pattern is now load-bearing.** Every `[id]` route in waves 4/5/6 uses it: `dbAdmin` head lookup → `getEffectiveContext(session, head.projectId)` → `withTenant(ctx.organization.id, ...)` for writes. Don't skip the `dbAdmin` head — bare `db.select()` on a now-RLS'd table returns empty before you can resolve the tenant.

3. **Sentinel error pattern for in-tx 4xx shapes.** When you move validation into `withTenant`, throwing inside the callback makes `AuthorizationError`'s catch block convert the response. If you need to preserve a specific error code/shape, declare a typed sentinel error class at file scope and add a separate `if (err instanceof X)` branch. Precedents: `DocumentMissingError` (wave 5), `SendPreconditionError` and the union-tag returns in wave 6 (send / pay / confirm / comments / publish routes).

4. **Pre-tenant flows route `dbAdmin` end-to-end.** Reviewer flow (wave 4) and transmittal anonymous-access flow (wave 6) both established this. Token IS the credential; no Better Auth session means no `getEffectiveContext`. If a future flow has the same shape (an anonymous link with a hashed-token credential), follow the same pattern.

5. **The dev `builtcrm_app` password is rotated.** It's in `.env.local` only — don't commit `.env.local` (it's gitignored). If a new dev workstation needs it, the SQL script `scripts/recreate-builtcrm-app.sql` is the source of truth for recreating the role; it generates a fresh password.

---

## Immediate kickoff prompt for the next session

```
Continue the RLS sprint. Read docs/specs/rls_sprint_handoff.md and the
project_rls_sprint_progress_2026-04-26 memory entry first, then start
on wave 4 nested children — rfi_responses + submittal_documents +
submittal_transmittals + the 5 daily_log_* tables. Use the
nested-via-parent template that's already proven on wave 2 children
and wave 6 children. ~7 tables in one migration, then a call-site
sweep (probably small — children are read mostly via parent loaders),
then build + lint + tests + smoke test + commit.
```

Tests baseline: 103/103 should still pass. If any drop, suspect a
loader Promise.all where one of the wave-4-nested tables is read
bare (outside withTenant) inside a parent loader's mixed batch.

---

## Files / artifacts to reference

- `docs/specs/rls_sprint_plan.md` — original plan, still authoritative for the architecture decisions and Phase 5 deliverables.
- `MEMORY.md` → `project_rls_sprint_progress_2026-04-26.md` — full state snapshot.
- `scripts/recreate-builtcrm-app.sql` — role-fix script (one-off, dev only; same shape applies to prod when verified drifted).
- `scripts/rls-perf-{milestones,daily-logs,rfis,documents}.ts` — perf/denial check scripts. Adapt the daily-logs version for any new hot table you ship.
- The most recent migration is `src/db/migrations/0036_sturdy_tiger_shark.sql`. Next will be `0037`.
