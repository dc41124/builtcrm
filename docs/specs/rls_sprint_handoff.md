# RLS Sprint — Handoff (2026-04-26 EOS, REVISED)

**SPRINT IS *NOT* COMPLETE.** The original handoff under-scoped item 5
("Remaining org-scoped table audit"). What was actually shipped:

- **72 of 99 tables** under RLS, all enforcing on dev runtime role.
- Phase 5 close-out shipped (CI gate, non-bypass test role, failure-mode
  test suite, doc updates) — but against the 72-table scope, not the full
  scope. The doc updates currently say "RLS RESOLVED" which is true *for
  the tables that were RLS'd*; the 27 un-RLS'd tables include several
  that should be RLS'd in a follow-up slice.

This file is the next-session kickoff for finishing the job.

---

## Where we are (as of commit `79eab85`)

**Shipped this sprint (5 commits this session):**
- `2c836ca` (0037) — Wave 4 nested children (8 tables)
- `4bd59ae` (0038) — Prequal cluster (3 tables, NEW own-side multi-org policy shape)
- `776fdc9` (0039) — Notifications (1 table, NEW user-scoped policy + `withTenantUser` helper)
- `6aece43` (0040) — Background-job tables (3 tables)
- `79eab85` — Phase 5 close-out (CI gate + builtcrm_test role + failure-mode tests + docs)

**72 tables RLS'd, 27 NOT.** Audit script: `scripts/_audit-rls-coverage.mjs`
(can be removed once item below is complete).

---

## What's left

### Slice A — un-RLS'd table audit + remaining migrations (~1.5–2 sessions, NOT 0.5)

The 27 un-RLS'd tables fall into 4 buckets. Cluster-by-cluster work below.

#### Bucket 1: Out-of-scope (KEEP AS-IS)
No tenant model — RLS doesn't apply. Document in `security_posture.md §6`
under a new "Tables intentionally NOT RLS'd" subsection.
- `authUser`, `authTwoFactor`, `authSession`, `authAccount`, `authVerification` — Better Auth machinery
- `users` — shared identity (joins auth ↔ app, no org_id)
- `organizations` — root tenant entity (RLS by org_id is meaningless — it IS the org)
- `billingPackages`, `subscriptionPlans` — global plan catalog (read by anyone, written by admin migrations)

#### Bucket 2: Deliberate cross-cutting (KEEP AS-IS, document)
System-managed, reads are export-endpoint-mediated. Same `security_posture.md §6` subsection.
- `auditEvents` — written cross-org by `system_user`, `writeSystemAuditEvent`, anonymous webhooks. RLS would break system-effect writes (would need a 3-way clause: own-org OR system-actor OR anonymous-context).
- `activityFeedItems` — same pattern as auditEvents.

#### Bucket 3: Trivial Pattern A / nested-via-parent (~6 tables, ~0.5 session)
Mechanical. Each is a one-line policy + a small call-site sweep.
- `inspectionTemplates` — Pattern A (`org_id = GUC`). Contractor-owned templates.
- `purchaseOrderLines` — nested-via-parent on `purchaseOrders` (already RLS'd).
- `milestoneDependencies` — nested-via-parent on `milestones` (already RLS'd).
- `userNotificationPreferences` — user-scoped, mirror `notifications` (uses `withTenantUser`). Cross-user system writes via `dbAdmin`.
- `subscriptionInvoices` — nested-via-parent on `organizationSubscriptions` (already RLS'd).
- `uploadRequests` — project-scoped 2-clause hybrid (already-established template).
- `approvals` — same as uploadRequests.

Note: that's actually 7 tables. Most are 1-table-per-commit work.

#### Bucket 4: Design moments (~3 design discussions, ~1 session of work)
**Each of these needs a brief design-moment surface-options-and-confirm
exchange, then mechanical migration + sweep.**

**B4.1 — `projects` (the keystone).** Has `contractor_organization_id`. The natural policy is the 2-clause hybrid (contractor owns + active POM). BUT:
- Every other RLS policy that joins through `projects` would now get the policy applied on the join's inner read. Planner shape changes for ~30 existing policies.
- Risk: a project-scoped child policy like `daily_logs` does `project_id IN (SELECT id FROM projects WHERE contractor_org_id = GUC)` — when `projects` itself is RLS'd, that subquery now ALSO runs with the policy. Two layers of policy on the same row may interact subtly.
- Recommendation: add the policy, run the full failure-mode suite, watch for "unexpectedly empty" results in any wave's smoke script. Have the recreate-on-rollback path ready.
- This needs its own commit and verification step — don't bundle it.

**B4.2 — Billing cluster** (`scheduleOfValues`, `sovLineItems`, `drawRequests`, `drawLineItems`, `retainageReleases`).
- All are project-scoped + multi-org client visibility (clients pay draws).
- Likely all use the project-scoped 2-clause hybrid (contractor owns + active POM). The POM clause covers commercial/residential client orgs.
- Nested children (`sovLineItems`, `drawLineItems`) use nested-via-parent.
- Sweep is heavy — billing routes are dense (~20 files) and Stripe webhook handlers already touch this cluster.

**B4.3 — Messaging cluster** (`conversations`, `conversationParticipants`, `messages`).
- Conversations have private DM semantics that the project-scoped hybrid doesn't capture cleanly. A DM between contractor and one specific sub shouldn't be visible to other subs on the same project.
- Likely shape: `conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE org_id = GUC OR user_id = current_user_id)` — but this requires `app.current_user_id` AND introduces a per-row participant lookup.
- This is the most novel design moment of the lot. Defer until you have time to think it through.

### Slice B — Phase 5 close-out, REDONE (~0.25 session)

After Slice A ships, the close-out artifacts need to update:
1. **Regenerate the CI gate baseline.** Slice A will fix some pre-existing bare-db sites and add some new dbAdmin/withTenant call sites. Run `npx tsx scripts/check-rls-callsites.ts --update-baseline` and commit the smaller diff.
2. **Extend the failure-mode test suite.** Add 1-2 cases for any new policy shapes introduced in Slice A. The existing 5 tests cover the main shapes; messaging's participant-scoped policy probably warrants a new case.
3. **Re-update `security_posture.md §6`.** Bump table count from 72 → 88-ish (depending on which Slice A buckets ship). Add the new "Tables intentionally NOT RLS'd" subsection (Buckets 1+2 above). Update the policy-shape catalog if messaging introduces a new shape.
4. **Re-update `compliance_map.md`** Changelog row.
5. **Smoke test** — run all of `scripts/_*-smoke.mjs` to verify nothing regressed.

### Slice C — Prod NOBYPASSRLS verify (~one-shot when prod exists)

UNCHANGED. Deferred until prod host exists.

---

## Critical gotchas to remember

(Same as before — preserved for fresh-chat continuity.)

1. **Recursive policies are a planner-time error, not runtime.** If you write a multi-org clause C that references the SAME table being protected (`SELECT FROM POM` from inside POM's own policy), Postgres rejects the rewrite with `42P17` — short-circuiting OR doesn't save you. If a clause subquery references the table itself, wrap the inner read in a `SECURITY DEFINER STABLE` function.

2. **Slice 3 entry-point pattern is now load-bearing.** Every `[id]` route in waves 4/5/6 uses it: `dbAdmin` head lookup → `getEffectiveContext(session, head.projectId)` → `withTenant(ctx.organization.id, ...)` for writes. Don't skip the `dbAdmin` head — bare `db.select()` on a now-RLS'd table returns empty before you can resolve the tenant.

3. **Sentinel error pattern for in-tx 4xx shapes.** When you move validation into `withTenant`, throwing inside the callback makes `AuthorizationError`'s catch block convert the response. If you need to preserve a specific error code/shape, declare a typed sentinel error class at file scope and add a separate `if (err instanceof X)` branch.

4. **Pre-tenant flows route `dbAdmin` end-to-end.** Reviewer flow (wave 4), transmittal anonymous-access (wave 6), webhooks (background-job slice). Token IS the credential; no Better Auth session means no `getEffectiveContext`.

5. **Nested-via-parent is unsafe with nullable parent FKs.** Precedent: `daily_log_crew_entries.dailyLogId` is nullable (subs submit orphan rows before GC creates the log). A `IN (SELECT id FROM parent)` policy denies orphan rows entirely. Use the parent's project-scoped policy on the child's own column instead.

6. **System-writer pattern for cross-user/cross-org effects.** Notification fan-out, audit writes, cron sweeps — all route through `dbAdmin`. WITH CHECK clauses on user-scoped or single-org tables would otherwise deny these legitimate writes. Precedent: `emit.ts` defaults to `dbAdmin`.

7. **The dev `builtcrm_app` password is rotated.** In `.env.local` only. Recreate via `scripts/recreate-builtcrm-app.sql` if needed.

8. **The `builtcrm_test` role is provisioned.** Password in `.env.test` as `TEST_NONBYPASS_DATABASE_URL` (gitignored). Recreate via `scripts/create-builtcrm-test-role.sql` (idempotent).

---

## Immediate kickoff prompt for the next session

```
Continue the RLS sprint — finish Slice A from docs/specs/rls_sprint_handoff.md
(remaining 16-table audit), then redo Phase 5 close-out (Slice B). Read the
handoff doc and the project_rls_sprint_progress_2026-04-26 memory entry first.

Recommended order:
1. Bucket 3 (trivial Pattern A + nested) — 7 tables, one migration. Ship + verify.
2. Bucket 1+2 documentation in security_posture.md (no code change).
3. Bucket 4 design moments one at a time:
   a. projects (keystone — verify carefully against existing waves' smoke scripts)
   b. billing cluster (~20 file sweep)
   c. messaging cluster (NEW participant-scoped policy shape — design moment)
4. Slice B Phase 5 close-out updates (baseline regen + extended failure-mode
   tests + doc bumps).

Stop and ask before each Bucket 4 design moment. Bucket 3 can autorun.
```

Tests baseline: 108/108 should still pass throughout. Failure-mode suite
will need extending if Bucket 4 introduces new policy shapes.

---

## Files / artifacts to reference

- `docs/specs/rls_sprint_plan.md` — original plan
- `MEMORY.md` → `project_rls_sprint_progress_2026-04-26.md` — full state snapshot
- `docs/specs/security_posture.md §6` — RLS architecture catalog (currently says "RESOLVED" — needs revision when Slice A ships)
- `docs/specs/compliance_map.md` CC5.2 + CC6.6 — same
- `scripts/_audit-rls-coverage.mjs` — un-RLS'd table enumeration (delete when Slice A complete)
- `scripts/check-rls-callsites.ts` + `.baseline.txt` — CI gate (regen baseline after Slice A)
- `scripts/create-builtcrm-test-role.sql` — non-bypass test role provisioning
- `tests/rls-failure-modes.test.ts` — extend with new policy shapes from Slice A
- Per-wave smoke scripts: `scripts/_wave4-nested-smoke.mjs`, `_prequal-smoke.mjs`, `_notifications-smoke.mjs`, `_background-job-tables-smoke.mjs` — re-run after Slice A.

The most recent migration is `src/db/migrations/0040_absent_sentry.sql`. Slice A starts at `0041`.
