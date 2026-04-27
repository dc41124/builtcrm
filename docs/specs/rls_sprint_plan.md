# Row-Level Security (RLS) Sprint Plan

**Status:** ✅ Slice A complete (2026-04-26). 85 of 99 tables under RLS. See "Final state" section below for what shipped vs. what's deferred. The original plan body is preserved below for historical reference.

This doc is the historical plan that drove the RLS sprint. The current source of truth for RLS architecture + remaining work is [security_posture.md §6](security_posture.md#row-level-security-rls). Read that first — it tracks live state. This file is reference-only now.

---

## Final state (2026-04-26 EOS)

### ✅ Shipped — 85 of 99 tables RLS'd, enforcing on dev

**Original sprint (phases 1–5, commits 2024-04-21 through 79eab85):**
- Phases 1/2/3/3b/3c — 20 tables (org-scoped Pattern A + multi-org 3-clause hybrid)
- Auth-chokepoint slice — `role_assignments`, `project_user_memberships`, `project_organization_memberships`
- Phase 4 pilot + waves 1–6 — 53 project-scoped tables (workflow + nested children + closeout + drawings + transmittals + selections + punch list)
- Wave 5 follow-on — BYPASSRLS dev drift fixed; POM clause-C recursion fixed
- Phase 5 close-out — CI gate (`scripts/check-rls-callsites.ts`), non-bypass test role (`builtcrm_test`), 5-test failure-mode suite (`tests/rls-failure-modes.test.ts`), security_posture.md + compliance_map.md updates

**Slice A — finishing pass (2026-04-26, commits 918fcbc → 18f7ec0):**
- **Bucket 3** (`918fcbc`, migration `0041`): 7 trivial tables — `inspectionTemplates` (Pattern A), `purchaseOrderLines` / `milestoneDependencies` / `subscriptionInvoices` (nested-via-parent), `uploadRequests` / `approvals` (project-scoped 2-clause hybrid), `userNotificationPreferences` (user-scoped). Sub-side template reads use the dbAdmin-escape pattern.
- **Bucket 1+2 doc** (`01374e2`): "Tables intentionally NOT RLS'd" subsection in security_posture.md §6 — 11 tables documented as deliberately un-RLS'd (Better Auth machinery, users, organizations, plan catalogs, auditEvents, activityFeedItems).
- **Bucket 4b** (`f35fee7`, migration `0042`): billing cluster — 6 tables (billingPackages / scheduleOfValues / drawRequests / retainageReleases hybrid; sovLineItems / drawLineItems nested). New sentinel-error pattern for in-tx 4xx shapes (`SovNotFoundError` etc.).
- **Slice B close-out** (`18f7ec0`): regenerated CI baseline (49 → 28 entries — Slice A paid down ~21 sites). Bumped table count 72 → 85 in security_posture.md + compliance_map.md.

### ⏸ Deferred — documented in security_posture.md §6

- **`projects`** (bucket 4a, `af1cf89`): attempted with the standard 2-clause hybrid; hit `42P17 infinite recursion` due to mutual recursion `projects` → POM → `projects`. Two viable fixes (SECURITY DEFINER STABLE wrapper on the POM subquery; or Pattern A only, dropping the POM clause) judged disproportionate to marginal isolation gain. Migration rolled back. App-layer `getEffectiveContext` already gates project access; downstream child tables are already RLS'd.
- **`conversations` / `conversationParticipants` / `messages`** (bucket 4c, `9c2d419`): DM semantics need a participant-scoped policy (`conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = current_user_id GUC)`) — not the project-scoped 2-clause hybrid every other table uses. Building it correctly is a 1–2 session design + sweep on its own (recursion handling on participants self-reference, every messaging call site needs `withTenantUser`). App layer already enforces DM semantics.

### 🔜 Pending future work (optional, no blocker)

1. **`builtcrm_app NOBYPASSRLS` audit on prod.** Deferred until prod host exists. Run `scripts/recreate-builtcrm-app.sql` and verify `pg_roles.rolbypassrls = false`.
2. **Pay down remaining 28 bare `db.*` baseline entries.** Most are writes to non-RLS tables (auditEvents, users, subscriptionPlans). Pay down opportunistically.
3. **Optional: revisit `projects` with SECURITY DEFINER fallback** if a future product surface needs sub/client orgs to read projects rows under their own GUC.
4. **Optional: messaging participant-scoped policy** when a dedicated session is available. Requires a new failure-mode test for the participant shape.

---

## Original sprint plan (preserved for reference)

Original status when written: Plan only — no code shipped.
Original owner: TBD
Original estimated scope: 4–5 implementation sessions.

---

## 1. Why RLS, and why now

The current authorization model is **app-layer only**. Every loader and state-changing action passes through `getEffectiveContext()` at [src/domain/context.ts](../../src/domain/context.ts), which resolves (user, project) → (effective role, membership) and applies the policy matrix in [src/domain/permissions.ts](../../src/domain/permissions.ts).

The chokepoint is correct — but it's a **single layer of defense**. A bug in `getEffectiveContext` resolution, a missing `getEffectiveContext` call on a new route, or a `db.select()` that bypasses the chokepoint could leak rows across organizations or projects with no DB-layer backstop. Postgres has no idea who the request is for.

RLS adds the backstop: `app_role` cannot read or write a row whose `organization_id` doesn't match the current request's tenant context. The DB enforces this. An app-layer authorization bug becomes a returned-empty-set instead of a cross-tenant data leak.

Trade-offs documented in security_posture.md §6:
- RLS requires `SET LOCAL` of tenant context on every connection, inside every transaction.
- A bug in that plumbing — connection pool reuse, missed reset, request cross-contamination — can cause **worse** leaks than the current app-layer-only approach.
- Therefore: needs a dedicated sprint with policy coverage, pooling integration, and failure-mode testing. Not a bolt-on.

---

## 2. Current-state grounding (2026-04-25 audit)

| Fact | Number / detail |
|---|---|
| Tenant-scoped tables (have `organization_id` or `project_id`) | **26** |
| Cross-cutting tables (auth, identity, system) — no policy needed | 7 |
| `db.transaction()` call sites in `src/` | **156**, scattered across API routes + domain actions |
| Postgres-js pool config | `max: 10`, `prepare: false`, single shared pool per process |
| `getEffectiveContext()` returns | `{ user, organization: {id}, project: {id, contractorOrganizationId}, role, permissions, membership }` |
| Auth chokepoint exposes `organizationId` | Yes, in `ctx.organization.id` |
| Session denormalizes tenant context at login | Yes — `auth_session.organizationId` populated by the session.create hook in [src/auth/config.ts](../../src/auth/config.ts) |

**Critical implication:** The pool is reused. `SET LOCAL` only persists for the current transaction. **Any query outside a transaction has no tenant context and would either bypass RLS (if app role has BYPASSRLS) or fail closed (if it doesn't).** The 156 existing `db.transaction()` call sites are the natural enforcement points; bare `db.select()` reads outside transactions are the migration challenge.

---

## 3. Architecture decisions

### 3.1 Tenant-context mechanism: `SET LOCAL app.current_org_id`

Postgres GUCs (Grand Unified Configuration) settings prefixed with a custom namespace (`app.current_org_id`) can be `SET LOCAL` inside a transaction and read by policies via `current_setting('app.current_org_id', true)::uuid`.

```sql
-- inside a transaction
SET LOCAL app.current_org_id = '<uuid>';

-- in a policy
USING (organization_id = current_setting('app.current_org_id', true)::uuid)
```

The `, true` second arg returns NULL (instead of erroring) when the GUC is unset — so the policy fails closed for any query missing the SET LOCAL, rather than crashing the request. **This is the core safety property.** No SET LOCAL → policy denies → query returns empty set / fails write.

### 3.2 Chokepoint: `withTenant(orgId, async tx => ...)` helper

The 156 scattered `db.transaction(async (tx) => {...})` call sites are the right enforcement point. Replacing the bare pattern with:

```typescript
// New helper in src/db/with-tenant.ts
await withTenant(ctx.organization.id, async (tx) => {
  // tx is a tenant-scoped transaction; SET LOCAL has been set
  await tx.insert(milestones).values(...);
  await tx.update(...);
});
```

`withTenant` would:
1. Open a transaction
2. Issue `SET LOCAL app.current_org_id = '<orgId>'` as the first statement
3. Run the caller's block
4. Commit/rollback as normal

**Decision rationale:** wrapper > Drizzle middleware. Drizzle's middleware support for transactions is thin; an explicit helper makes the SET LOCAL visible at the call site (better for code review) and keeps the pattern uncoupled from Drizzle internals. The helper is ~15 lines.

**Reads outside transactions:** there are bare `db.select()` reads in loaders and routes. These need to migrate to use a similar `withTenantRead(orgId, async tx => ...)` wrapper, OR explicitly opt out (admin tooling, system jobs). The migration is mechanical but large — same shape as the session-helper sweep that just landed.

### 3.3 Admin role: `BYPASSRLS` attribute

The `builtcrm_admin` role (used by migrations, seed, scheduled jobs) needs `BYPASSRLS`. Admin-only operations — backfills, full-archive exports, migration scripts — must be able to read every row across orgs.

The bootstrap script needs an addition:
```sql
ALTER ROLE builtcrm_admin BYPASSRLS;
```

`builtcrm_app` (runtime DML) explicitly does NOT get BYPASSRLS — it must always provide tenant context. This is enforced by `ALTER ROLE builtcrm_app NOBYPASSRLS` (already set as part of the 2026-04-25 bootstrap fix).

### 3.4 Background jobs: explicit tenant context per row

Trigger.dev jobs in `src/jobs/` (webhook-payload-purge, integration-token-refresh, etc.) typically run as the system. They have two patterns:

- **System-wide queries** (e.g. `webhook-payload-purge` deletes across all orgs) — must run as `builtcrm_admin` (the BYPASSRLS role). This means every job's DB connection needs to be the admin pool, not the runtime pool.
- **Per-tenant queries** (e.g. processing a webhook for a specific org) — should `withTenant(eventOrgId, ...)` so RLS still applies.

**Decision required:** do scheduled jobs use the admin pool (current behavior — they import from `@/db/client` which is the runtime pool, but run as the runtime user) or do they get their own admin connection? **Recommendation: admin pool for sweeps; tenant context for per-tenant work.** Refactor in phase 1.

### 3.5 Multi-org users (currently rare)

A user can have multiple `roleAssignments` rows across different orgs. Today they always operate within ONE org per session (organizationId is baked in at session.create). RLS doesn't change this; the session's `organizationId` is the single tenant context for the request.

Cross-org admin queries (super-admin tooling, reporting) are not in scope — those would use the BYPASSRLS admin role with explicit org IDs in WHERE clauses.

---

## 4. Policy strategy

### 4.1 Three policy patterns by table type

**Pattern A — directly org-scoped (14 tables)**
Tables with an `organization_id` column. Policy is straightforward:
```sql
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON integration_connections
  USING (organization_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);
```

**Pattern B — project-scoped (~20 tables)**
Tables with a `project_id` column. The org check goes through the `projects` table:
```sql
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON milestones
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
    )
  )
  WITH CHECK (...same...);
```

**Performance caveat:** the subquery runs per row evaluated. For hot tables (milestones, daily_logs, etc.), a join-based policy or a materialized lookup may be needed. Phase 2 measures this on the pilot table.

**Pattern C — cross-cutting (7 tables)**
`users`, `organizations`, `projects`, `audit_events`, etc. These don't get RLS in this sprint — they're either inherently cross-tenant (audit_events references multiple orgs) or are joined-against tables that need to be readable for the policy in Pattern B to work. Document the deferral.

### 4.2 Multi-tenant-membership

A project can have members from multiple orgs (sub orgs and client orgs collaborating on a contractor's project). The simple "org owns project" Pattern B policy doesn't capture this — a sub or client user with `current_org_id` set to their own org would be denied access to rows on a project owned by the contractor.

Two options were considered:
- **Option A (chosen):** policy uses a 3-clause check that combines Pattern A (own row) + project-ownership (contractor case) + project-membership lookup against `project_organization_memberships` (sub/client case). More clauses, runs subqueries against POMs.
- **Option B:** session sets `current_org_id` to the project's `contractor_organization_id` when the user is acting in a sub/client capacity. Simpler policies but requires session-resolution changes and dual-GUC plumbing for org-scoped (project-less) actions.

**Decision (Phase 3c):** Option A. Decided after Phase 3b shipped 13 tables on Pattern A using `app.current_org_id` = the user's own org. Option B would have required revisiting the GUC semantics for every policy already in production. Option A is additive — `withTenant(orgId, ...)` semantics stay unchanged (orgId is always the user's own org), and we apply the multi-org policy template only to tables that need it.

**Multi-org policy template (Pattern A+B+C):**
```sql
ALTER TABLE lien_waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON lien_waivers
  USING (
    -- A. The row's owner org reads/writes its own rows.
    organization_id = current_setting('app.current_org_id', true)::uuid
    OR
    -- B. The contractor org owns the project the row lives on (lets
    -- contractor PM see/manage every sub's rows on their projects).
    project_id IN (
      SELECT id FROM projects
      WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
    )
    OR
    -- C. The user's org has an active project_organization_memberships
    -- row on the project (lets clients + subs see rows they're entitled
    -- to on someone else's project — e.g. client accepting a lien
    -- waiver written by the contractor).
    project_id IN (
      SELECT project_id FROM project_organization_memberships
      WHERE organization_id = current_setting('app.current_org_id', true)::uuid
        AND membership_status = 'active'
    )
  )
  WITH CHECK (...same expression...);
```

Performance is bounded by the orgIdx on POMs (already exists) — Clause C subquery filters by `organization_id = GUC` first, returning a small project list per org. Measure on the first multi-org table (lien_waivers) and revisit if Clause C dominates plan cost.

**Tables that need the multi-org template** (any table where rows from sub/client orgs coexist with contractor rows on the same project): `lien_waivers`, `compliance_records`, plus most Phase 4 project-scoped tables (`milestones`, `daily_logs`, `documents`, etc. — to be confirmed table-by-table).

**Tables that don't** (single-org): everything Phase 3b shipped, plus `purchase_orders`, `cost_codes`, `vendors`, `closeout_packages`, `integration_connections`. Those use plain Pattern A.

---

## 5. Failure modes + tests

These are the cases that, if they leak, defeat the entire point of RLS. Each must have an automated test before phase 4.

| Failure mode | Test |
|---|---|
| **Connection pool reuse carries SET LOCAL** | Open two transactions on the same logical pool, set different orgs, verify the second can't read the first's rows. SET LOCAL should be auto-cleared at COMMIT/ROLLBACK; verify this. |
| **Missing SET LOCAL bypasses policy** | Run a query outside `withTenant()`, verify it returns empty / errors (depending on Postgres' default for unset GUCs). |
| **Bare `db.select()` outside transaction** | Lint rule + grep gate in CI: any `db.select()` / `db.update()` / `db.insert()` / `db.delete()` outside a `db.transaction()` or `withTenant()` call must be allowlisted. |
| **Cross-tenant FK violation** | Attempt to INSERT a milestone with a `project_id` from org A while `current_org_id` = org B. Should fail (WITH CHECK denies). |
| **Background job runs as wrong role** | Verify each `src/jobs/*.ts` task uses the admin pool, OR runs `withTenant()`. CI grep gate. |
| **SET LOCAL leak via Drizzle auto-commit** | Some Drizzle ops may auto-commit (Drizzle's behavior with implicit transactions is version-specific). Test that SET LOCAL doesn't persist between two consecutive `db.transaction()` calls on the same connection. |

---

## 6. Phased rollout

Each phase ships independently and is verified before the next begins.

### Phase 1 — Plumbing only, no enforcement (1 session)

**Deliverables:**
- `src/db/with-tenant.ts` — the helper. Opens transaction, runs `SET LOCAL`, executes block.
- `src/db/admin-with-tenant.ts` — equivalent for explicit admin overrides (rare).
- `scripts/new-env-bootstrap.sql` — add `ALTER ROLE builtcrm_admin BYPASSRLS` (note: requires re-running on existing envs).
- Unit tests for the failure modes in §5 (pool reuse, SET LOCAL leak, missing context).
- **No `ENABLE ROW LEVEL SECURITY` on any table yet.** This phase only verifies the plumbing works without leaks.

**Stop-and-ask trigger:** the `scripts/new-env-bootstrap.sql` change is doc-script touch (not schema). Surface for review.

**Verification:** run the failure-mode tests. They should all pass even though no policies exist yet (because none of them rely on policies — they verify the SET LOCAL / pool / transaction plumbing).

### Phase 2 — Pilot one table (1 session)

**Pick one tenant-scoped table that's representative but low-risk.** Recommendation: `notifications`.
- High write volume (good performance signal)
- Already has retention purge (we know its access patterns)
- User-visible enough that a regression would be caught fast in dev/staging

**Deliverables:**
- `ENABLE ROW LEVEL SECURITY` on `notifications`
- `CREATE POLICY tenant_isolation` (Pattern A — direct org_id check)
- Migrate the ~10 call sites that read/write `notifications` to use `withTenant()`
- Failure-mode tests scoped to this table (cross-org read denied, missing-context query denied, etc.)
- Soak in dev/staging for ~1 week before phase 3

**Stop-and-ask trigger:** `ENABLE ROW LEVEL SECURITY` is a schema change. Surface for review.

### Phase 3 — Expand to org-scoped tables (1 session)

The 14 directly-org-scoped tables (Pattern A). Mostly mechanical given phase 2's template.

**Deliverables:**
- Migration enabling RLS + policy on each of the 14 tables
- Migrate any remaining `db.transaction()` / bare-read sites to `withTenant()`
- Lint/CI gate (per §5) wired up

**Verification:** existing test suite passes (regression check), failure-mode tests pass, manual smoke of all 4 portals.

### Phase 4 — Expand to project-scoped tables (1–2 sessions)

The ~20 project-scoped tables (Pattern B). Performance-sensitive — the subquery-in-policy pattern may need to become a join-based policy or a materialized lookup for hot tables.

**Deliverables:**
- Migration enabling RLS + policy on the project-scoped tables, in waves of ~5 (so a regression in one wave doesn't block the others)
- Multi-org-membership handling (the Option B from §4.2 — `withTenant(orgId, projectId?)`)
- Performance measurement: compare pre/post latency on `milestones`, `daily_logs`, `documents` (highest-volume tables). If significant regression, switch to join-based policy.

### Phase 5 — Cleanup + documentation (0.5 session)

**Deliverables:**
- Remove `BYPASSRLS` audit (verify no app code accidentally uses admin pool)
- Update `security_posture.md §5` to mark RLS RESOLVED
- Update `compliance_map.md` CC5.2 + CC6 with the new DB-layer enforcement
- Decommission any leftover bare `db.transaction()` patterns

---

## 7. Non-goals (explicit)

- **Replacing app-layer authorization.** `getEffectiveContext()` + `permissions.ts` continue to be the primary gate. RLS is the backstop.
- **Cross-tenant admin tooling.** Super-admin queries (e.g. cross-org analytics, support tooling) explicitly use the BYPASSRLS admin role and are out of scope here.
- **Encrypting `tax_id` or other column-level masking.** Separate gap in §6.
- **Performance optimization beyond regression-prevention.** If a table needs join-based policies for performance, do it; otherwise the simple subquery is fine.
- **Read-only role provisioning.** Separate deferred item (§5 / §6).

---

## 8. Open design questions (decide before phase 1 starts)

1. **`withTenant()` signature** — does it accept just `orgId`, or also `projectId` for the multi-org-membership case (§4.2)? Recommendation: start with `orgId` for phase 2/3, extend in phase 4.
2. **Drizzle's behavior with `SET LOCAL`** — Drizzle doesn't have first-class GUC support. Verify by hand in phase 1 that `tx.execute(sql\`SET LOCAL ...\`)` works inside a Drizzle transaction without escaping.
3. **CI gate** — is grep + manual review enough, or do we want a TS AST gate (e.g. eslint-plugin-custom rule that flags `db.select()` outside `withTenant`)? Start with grep, escalate if regressions slip through.
4. **Failure-mode test infrastructure** — these tests need a real Postgres. Do they run in CI against a Neon branch (slow but realistic) or against a docker-compose Postgres in CI? Current test infra in this repo is light — phase 1 also needs to spin up the test harness.

---

## 9. Open product questions (none blocking phase 1)

None. RLS is purely technical; it doesn't change the product surface. The user-visible behavior should be **identical** before and after — the only difference is what happens when an authorization bug slips through (today: cross-tenant leak; after: empty set / error).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Phase 4 ships, hot table gets slow | Phase 2 measures the pilot; phase 4 has a wave structure so a regression in one table doesn't block others. Join-based policies as fallback. |
| Background job mis-runs as runtime role and hits RLS | Phase 1 audits all `src/jobs/*.ts` to confirm pool selection; phase 5 cleanup re-verifies. |
| Multi-org membership case slips into phase 3 (org-scoped tables) | None of the 14 org-scoped tables in phase 3 have multi-org membership semantics. Verify table-by-table during phase 3. |
| Drizzle `SET LOCAL` doesn't persist | Phase 1's first deliverable is a working failure-mode test that verifies SET LOCAL persists for the transaction. If it doesn't, we use raw postgres-js connections inside `withTenant()` and skip Drizzle's transaction wrapper for this concern. |
| `current_setting('app.current_org_id', true)` returns NULL where unexpected | The `, true` argument returns NULL silently; policy comparison `org_id = NULL` is falsy → row denied. This is the **safe** failure mode. Verified in phase 1. |

---

## 11. Definition of done

The sprint is complete when:
1. All 26 tenant-scoped tables have RLS enabled with the appropriate policy
2. All app-runtime queries route through `withTenant()` (or `withTenantRead()`)
3. CI gate prevents new bare `db.select()` from being introduced
4. Failure-mode test suite (§5) is green and runs on every PR
5. `security_posture.md §5` and `compliance_map.md` updated to reflect the new DB-layer enforcement
6. Manual smoke pass: cross-org access attempts return empty/error in dev, normal usage works across all 4 portals
7. One week of soak in staging with no regressions before any phase ships to prod
