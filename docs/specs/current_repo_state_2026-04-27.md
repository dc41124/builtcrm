# BuiltCRM — Current Repo State

**Repo path:** `c:\Users\David Cardona\Desktop\builtcrm\`
**As of:** April 27, 2026
**Compiled from:** direct filesystem + `git log` + live schema/migration inspection.
Supersedes [`current_repo_state_2026-04-24.md`](current_repo_state_2026-04-24.md).

---

## Change summary since 2026-04-24

Three days, **57 commits**, three discrete tracks landed plus a major
post-sprint follow-on. The April-24 working-tree drift (Closeout) is
**all committed**. Working tree is clean.

### Track 1 — Phase 4+ module sprint, finished

- **Step 48 — Closeout Packages.** Was uncommitted in the April-24
  snapshot; now landed (migration `0003_tricky_bishop`).
- **Step 49 — Subcontractor Prequalification.** New module — schema
  (`src/db/schema/prequal.ts`, 5 tables: `prequal_templates`,
  `prequal_submissions`, `prequal_documents`, `prequal_project_exemptions`,
  + scoring tables), API routes under `src/app/api/prequal/`, contractor +
  subcontractor portal pages, three test files
  (`prequal-flow`, `prequal-policy`, `prequal-scoring`). Commit `47afd37`.
- **Step 49.5 — milestone_kind enum + CHECK constraint** (`889be33`,
  `f46a564`).

### Track 2 — Hardening pass (commit `9fc3947` and successors)

Bundle of post-Phase-4+ security and ops work:

- **Retention jobs.** Three new 90-day purges to bound unbounded-growth
  tables: `notification-purge.ts`, `audit-event-purge.ts`,
  `activity-feed-purge.ts`. Each writes a `*-purge.run_complete` system
  audit event with `deletedCount`. Scheduled at 04:00 / 04:15 / 04:30 UTC
  to avoid pool overlap.
- **Typed session + idle timeout.** Better Auth session shape now carries
  the denormalized tenant context. `requireServerSession()` throws on
  missing context (regression-fixed in `b9e2a89`).
- **Fresh-env bootstrap validation.** Validated `bootstrap_new_env.md`
  end-to-end against a Neon branch. Validation uncovered the "Neon
  Create-role UI silently grants `neon_superuser`" defect — fix is now
  baked into `scripts/new-env-bootstrap.sql` (creates
  `builtcrm_app` via SQL with explicit `NOCREATEROLE NOCREATEDB
  NOREPLICATION NOBYPASSRLS`). MEMORY entry
  `project_neon_role_creation_defect.md` captures the gotcha.
- **`organizations.tax_id` encryption** (`be12f48`, `0964b22`).
  AES-256-GCM via `TAX_ID_ENCRYPTION_KEY` and
  `encryptTaxId` / `decryptTaxId` in `src/lib/integrations/crypto.ts`.
  Loader returns masked value (`***-**-NNNN`); plaintext only via
  `POST /api/org/tax-id/reveal` (rate-limited 5/min,
  contractor_admin / subcontractor_owner only) which writes a
  `tax_id.revealed` audit event. Backfill via
  `scripts/backfill-encrypt-tax-id.ts`. Fallback removed in `0964b22`.

### Track 3 — Self-serve user-data flows (GDPR / privacy)

- **Self-serve account deletion** (`3a8aee8`). Anonymize + 30-day grace
  period. New jobs: `account-anonymization-sweep.ts`,
  `deletion-reminder-sweep.ts`. New lib: `src/lib/user-deletion/`.
  Plan source: `docs/specs/user_deletion_and_export_plan.md`.
- **GDPR Article 15 export** (`a710189`). User can request a
  zip of all their data; download link emailed; expires after 7 days.
  New job: `data-export-cleanup.ts`. New lib: `src/lib/user-export/`.

### Track 4 — RLS sprint (the big one — ~40 commits)

End-to-end DB-layer tenant isolation. Six phases plus a finishing slice
plus a same-day post-sprint follow-on. Full design in
[`rls_sprint_plan.md`](rls_sprint_plan.md); live state in
[`security_posture.md` §6](security_posture.md#row-level-security-rls).
Compressed timeline:

| Phase | What landed |
|---|---|
| 1 | `withTenant` helper, plumbing tests, admin-pool client (`src/db/with-tenant.ts`, `src/db/admin-client.ts`, `src/db/admin-pool.ts`) |
| 2 | Pilot — `organization_licenses` |
| 3 / 3b / 3c | Org-scoped Pattern A across the safe tables: certifications, saved_reports, sso_providers, stripe_customers, organization_subscriptions, data_exports, organization_users, invitations, vendors, cost_codes, closeout_packages, lien_waivers, compliance_records, purchase_orders, integration_connections |
| 4 | Auth chokepoint (role_assignments, PUMs, POMs); pilot on milestones; six waves across project-scoped workflow tables (rfis, change_orders, submittals, daily_logs, documents/document_links, transmittals, drawings, punch, selections, closeout nested), plus prequal cluster, notifications (user-scoped — added `withTenantUser`), and background-job tables (payment_transactions, sync_events, webhook_events). Two latent defects fixed mid-sprint: BYPASSRLS dev drift (`builtcrm_app` had been silently re-granted BYPASSRLS) and POM clause-C recursion (`42P17`) |
| 5 | CI gate (`scripts/check-rls-callsites.ts`), non-bypass test role (`builtcrm_test` via `scripts/create-builtcrm-test-role.sql`), 5-test failure-mode suite (`tests/rls-failure-modes.test.ts`) |
| Slice A | Finishing pass — buckets 3 (7 trivial tables), 4a (`projects` deferred — recursion gotcha documented), 4b (billing cluster), 4c (messaging cluster deferred — DM semantics need participant-scoped policy). Final state: **85 of 99 tables under RLS, 11 deliberately un-RLS'd, 3 deferred with §6 rationale** |
| Post-sprint sweep (2026-04-26, `2dfe132`) | After Slice A landed, contractor login threw `invalid input syntax for type uuid: ""` — a `db.*` call against an RLS-enabled table running outside `withTenant` fired the policy's `''::uuid` cast. Sweep wrapped 49 sites across 22 files. Replacement gate: schema-aware [scripts/rls-audit.js](../../scripts/rls-audit.js) (auto-discovers RLS-enabled tables, walks every src/ file). Wired as [tests/rls-bare-db-audit.test.ts](../../tests/rls-bare-db-audit.test.ts) — fails the build if any unsafe site appears |
| Post-sprint follow-on (2026-04-27, `64e4139`) | Same-day: project-home page still threw the same UUID-cast error. Root cause: audit's regex matched `.from/.insert/.update/.delete` but not `.leftJoin/.innerJoin/.rightJoin/.fullJoin`. One real instance — `loadConversationsForUser` did a leftJoin from `messages` (not RLS'd) into `documents` (RLS'd). Audit extended; 110/110 tests green. Lesson logged in `security_posture.md §6` |

### Track 5 — Webhook column nullability (latest commit, `3232f42`)

`webhook_events.organization_id` made nullable to support webhook arrivals
that haven't yet resolved a tenant. Migration `0043_furry_vulcan.sql`,
schema update in `src/db/schema/integrations.ts`, route handler change in
`src/app/api/webhooks/[provider]/route.ts`.

### Live DB

**~99 public tables** (was 95 on April 24). Growth driven by Step 48
closeout completion + Step 49 prequal + the Step 49.5 enum + the various
RLS-scaffolding migrations.

---

## A. Snapshot

- **Branch:** `main` (clean, up-to-date with `origin/main`)
- **Git user:** `dc41124 <dc41124@gmail.com>`
- **Last 10 commits (newest-first):**
  1. `3232f42` webhook stuff
  2. `64e4139` 3.1 RLS post-sprint follow-on: fix join-side coverage gap
  3. `2dfe132` 3.1 RLS post-sprint: sweep all bare-db calls on RLS-enabled tables
  4. `f9b4b08` docs: mark RLS sprint plan as complete + remove superseded handoff
  5. `18f7ec0` 3.1 RLS Slice A close-out: baseline regen + doc updates
  6. `9c2d419` 3.1 RLS Slice A bucket 4c: defer messaging cluster, document rationale
  7. `f35fee7` 3.1 RLS Slice A bucket 4b: billing cluster (85 of 99 RLS'd)
  8. `af1cf89` 3.1 RLS Slice A bucket 4a: defer projects, document recursion finding
  9. `01374e2` 3.1 RLS Slice A bucket 1+2 doc: "Tables intentionally NOT RLS'd"
  10. `918fcbc` 3.1 RLS Slice A bucket 3: 7 trivial tables under RLS (79 of 99 RLS'd)
- **Phase claim:** **Phase 4+ module sprint complete** (Steps 44–49.5).
  RLS sprint complete on dev. The active execution doc is
  [`phase_4plus_build_guide.md`](phase_4plus_build_guide.md). The
  source-of-truth scope doc is
  [`builtcrm_phase4_portfolio_scope.md`](builtcrm_phase4_portfolio_scope.md).

### Working tree

Clean. Nothing uncommitted, no untracked files in `src/`.

---

## B. Tech stack as actually installed

From `package.json`. **Unchanged vs. April 24** — the RLS sprint, the
hardening pass, and the user-data flows shipped without new prod deps.

### Production dependencies (no delta)

| Package | Version |
|---|---|
| `@authenio/samlify-node-xmllint` | ^2.0.0 |
| `@aws-sdk/client-s3` | ^3.670.0 |
| `@aws-sdk/s3-request-presigner` | ^3.670.0 |
| `@react-pdf/renderer` | ^4.5.1 |
| `@sentry/nextjs` | ^10.50.0 |
| `@trigger.dev/sdk` | ^3.3.0 |
| `@upstash/ratelimit` | ^2.0.8 |
| `@upstash/redis` | ^1.34.3 |
| `archiver` | ^7.0.1 |
| `better-auth` | ^1.0.0 |
| `drizzle-orm` | ^0.41.0 |
| `frappe-gantt` | ^1.2.2 |
| `nanoid` | ^5.0.7 |
| `next` | ^14.2.15 |
| `pdfjs-dist` | ^4.10.38 |
| `postgres` | ^3.4.5 |
| `react` | ^18.3.1 |
| `react-dom` | ^18.3.1 |
| `react-pdf` | ^9.2.1 |
| `recharts` | ^3.8.1 |
| `samlify` | ^2.12.0 |
| `stripe` | ^22.0.2 |
| `zod` | ^3.23.8 |

### Notable absences still in effect

- **No QuickBooks / Xero / Sage / Postmark / SendGrid / Google Calendar /
  Outlook SDKs.** Catalog metadata only. Email is still a console-log
  stub (`sendResetPassword`, deletion confirmation, GDPR export link).
  Tracked in MEMORY as `project_hosting_and_email_deferred.md`.
- **No Playwright / testing-library UI.** Vitest only.
- **Next.js 14**, not 15.

---

## C. Database schema (actual)

### Schema files under `src/db/schema/` — 27 source files

Was 26 + uncommitted closeout on April 24. Now 27 committed. Newly
**committed** since April 24:

```
closeoutPackages.ts   (6 tables — committed via 0003_tricky_bishop)
prequal.ts            (5 tables — committed via Step 49)
```

Full inventory:

```
_shared.ts            shared timestamps helper
index.ts              barrel — 26 domain exports
audit.ts              (3) activity_feed_items, audit_events, …
auth.ts               (6) Better Auth + 2fa tables
billing.ts            (8) billing_packages, SOV, draws, lien_waivers, retainage_releases, …
closeoutPackages.ts   (6) closeout_packages, sections, items, comments, counters, …
dailyLogs.ts          (7) daily_logs, crew_entries, amendments, photos, delays, issues, …
documents.ts          (3) documents, document_links, …
drawings.ts           (6) drawing_sets, sheets, markups, measurements, comments, …
exports.ts            (2) data_exports, …
identity.ts           (9) users, organizations, memberships, roles, invitations, …
inspections.ts        (5) inspection_templates, inspections, results, result_photos, …
integrations.ts       (5) integration_connections, sync_events, payment_transactions, webhook_events, …
meetings.ts           (6) meetings, agenda_items, attendees, minutes, action_items, …
messaging.ts          (4) conversations, participants, messages, …
notifications.ts      (2) notifications, user_notification_preferences
prequal.ts            (5) prequal_templates, prequal_submissions, prequal_documents, prequal_project_exemptions, …
procurement.ts        (5) cost_codes, vendors, purchase_orders, purchase_order_lines, …
projects.ts           (6) projects + memberships + milestones + dependencies + …
punchList.ts          (4) punch_items, punch_item_photos, punch_item_comments, …
savedReports.ts       (2) saved_reports, …
selections.ts         (5) selection_categories, items, options, decisions, …
sso.ts                (2) sso_providers, …
submittals.ts         (4) submittals, submittal_documents, submittal_transmittals, …
subscriptions.ts      (5) subscription_plans, organization_subscriptions, subscription_invoices, stripe_customers, …
transmittals.ts       (5) transmittals, documents, recipients, access_events, …
weeklyReports.ts      (3) weekly_reports, weekly_report_sections, …
workflows.ts          (7) upload_requests, compliance_records, rfis, rfi_responses, change_orders, approvals, …
```

### Migrations — journalled, healthy

**44 migration files** at `src/db/migrations/` (was 4 on April 24):

```
0000_baseline.sql                 (1853 lines — baseline collapse)
0001_far_toro.sql              0023_big_luckman.sql
0002_clumsy_living_tribunal.sql 0024_wandering_warlock.sql
0003_tricky_bishop.sql         0025_dry_lady_ursula.sql
0004_stiff_gertrude_yorkes.sql 0026_needy_betty_brant.sql
0005_curvy_roxanne_simpson.sql 0027_narrow_wallflower.sql
0006_dazzling_jean_grey.sql    0028_useful_rhino.sql
0007_careless_serpent_society.sql 0029_silky_scarlet_witch.sql
0008_flat_iron_monger.sql      0030_productive_silver_centurion.sql
0009_lonely_arclight.sql       0031_simple_human_fly.sql
0010_workable_may_parker.sql   0032_famous_hellcat.sql
0011_brown_excalibur.sql       0033_swift_silver_centurion.sql
0012_keen_triathlon.sql        0034_nifty_corsair.sql
0013_rare_lord_hawal.sql       0035_steady_viper.sql
0014_daily_venom.sql           0036_sturdy_tiger_shark.sql
0015_superb_titania.sql        0037_yellow_colleen_wing.sql
0016_cool_zarda.sql            0038_melodic_hex.sql
0017_flaky_hellion.sql         0039_youthful_tyrannus.sql
0018_calm_morbius.sql          0040_absent_sentry.sql
0019_powerful_randall.sql      0041_glamorous_silk_fever.sql
0020_conscious_felicia_hardy.sql 0042_special_colleen_wing.sql
0021_chubby_ghost_rider.sql    0043_furry_vulcan.sql
0022_special_bromley.sql
```

`_journal.json` has 44 entries; `db:generate` / `db:migrate` is the
healthy path forward. The April-24 drift item "0003 uncommitted" is
**resolved**.

### Schema-writing conventions

Unchanged. FK constraint naming uses the long form
`{srcTable}_{srcCol}_{refTable}_{refCol}_fk`; when it would exceed
Postgres' 63-char limit, the table declares the FK explicitly via
`foreignKey({ ..., name: "{srcTable}_{srcCol}_fk" })` and drops
`.references()` from the column. UUID PKs throughout. All mutable tables
carry `created_at` + `updated_at` from `timestamps` in `_shared.ts`.

### RLS plumbing — new this snapshot

Three new files under `src/db/`:

- `with-tenant.ts` — `withTenant(orgId, async tx => ...)` and
  `withTenantUser(orgId, userId, async tx => ...)` helpers. Set
  `app.current_org_id` (and `app.current_user_id`) GUCs via `SET LOCAL`
  inside a transaction.
- `admin-client.ts` — `dbAdmin` singleton bound to a BYPASSRLS pool,
  for cross-org system writes (Trigger.dev sweeps, anonymous webhook
  receivers, notification fan-out, GDPR export).
- `admin-pool.ts` — pool config for the admin client.

23 schema files contain `.enableRLS()` calls; 85 tables have it set.
Live verification: `node scripts/rls-audit.js` reports
**0 unsafe / 785 tx-safe / 234 admin / 6 parameterized** as of `64e4139`.

---

## D. App routes (actual)

Top-level groups under `src/app/`: `(auth)`, `(portal)`, `api`, plus
`reviewer/`, `receipts/`, `no-portal/`, `test/`, `t/`,
`global-error.tsx`, `not-found.tsx`, root `page.tsx`.

### `(auth)` — unchanged

`forgot-password`, `invite/[token]`, `login`, `reset-password`,
`select-portal`, `signup`, `signup/contractor`, `welcome`.

### `(portal)/contractor`

**Global:** `approvals`, `billing`, `budget`, `change-orders`,
`compliance`, `cost-codes`, `dashboard`, `documents`, `messages`,
`notifications`, `payment-tracking`, **`prequalification`** *(new)*,
`reports`, `retainage`, `rfis`, `settings`, `subcontractors`,
`upload-requests`, `vendors`.

**Project-scoped** (`contractor/project/[projectId]`): `approvals`,
`billing`, `change-orders`, `closeout-packages`, `compliance`,
`daily-logs`, `documents`, `drawings`, `financials`, `inspections`,
`meetings`, `messages`, `payments`, `procurement`, `punch-list`,
`rfis`, `schedule`, `selections`, `submittals`, `transmittals`,
`upload-requests`, `weekly-reports`.

### `(portal)/subcontractor`

**Global:** `compliance`, `daily-logs`, `documents`, `messages`,
`notifications`, `payments`, **`prequalification`** *(new)*, `rfis`,
`schedule`, `settings`, `today`, `upload-requests`.

**Project-scoped:** `compliance`, `daily-logs`, `documents`, `drawings`,
`financials`, `inspections`, `meetings`, `messages`, `payments`,
`punch-list`, `rfis`, `schedule`, `submittals`, `upload-requests`.

### `(portal)/commercial`

**Global:** `notifications`, `settings`.
**Project-scoped:** `approvals`, `billing`, `change-orders`, `closeout`,
`contracts`, `daily-logs`, `documents`, `messages`, `payments`,
`photos`, `progress`, `schedule`, `weekly-reports`.

### `(portal)/residential`

**Global:** `notifications`, `settings`.
**Project-scoped:** `billing`, `budget`, `closeout`, `confirmed-choices`,
`decisions`, `documents`, `journal`, `messages`, `progress`, `schedule`,
`scope-changes`, `selections`, `walkthrough-items`, `weekly-reports`.

### Cross-portal shared UI under `(portal)/`

`closeout-icons.tsx`, `closeout-packages.css`, `closeout-shared.tsx`,
`inspections-shared.tsx`, `inspections.css`, `meetings-rail.tsx`,
`meetings-shared.tsx`, `meetings.css`, **`prequalification.css`**
*(new)*, `transmittals-shared.tsx`, `transmittals.css`.

### `api/` — route families

```
approvals  auth  avatar  change-orders  closeout-packages  compliance
contractor/stripe/connect  conversations
daily-log-amendments  daily-log-crew-entries  daily-log-photos  daily-logs
documents  draw-requests  drawings  export  files
inspection-photos  inspection-results  inspection-templates  inspections
integrations  invitations  lien-waivers
meetings  meetings-carry-preview  milestones  notifications
oauth/[provider]  org/{tax-id, …}  payments/manual
prequal/{…}*  procurement/{cost-codes, purchase-orders, vendors}
punch-item-photos  punch-items  retainage-releases
reviewer/[token]  rfis  search  selections
signup/contractor-bootstrap  sov  submittal-documents  submittals
transmittals  upload-requests  upload/{request, finalize}
user/{deletion, export, …}*  webhooks/[provider]  webhooks/stripe
weekly-reports/{…}
```

`*` = new since April 24.

### Public non-portal routes — unchanged

`reviewer/[token]`, `receipts/[paymentTransactionId]`, `t/…`,
`no-portal`, `test/upload`, `welcome`.

---

## E. Domain layer

### `src/domain/loaders/*.ts` — 57 files

Was 54 on April 24. Three new loaders correspond to the new feature
modules (prequal + supporting flows). All other loaders carried forward.

### Authorization

Unchanged structure:

- `src/domain/permissions.ts` — `POLICY` map + `buildPermissions`,
  `assertCan`, `AuthorizationError`.
- `src/domain/context.ts` — `getEffectiveContext(session, projectId)`
  single gate.
- `src/domain/policies/plan.ts` — plan-feature gating.
- `src/domain/audit.ts`, `src/domain/activity.ts`,
  `src/domain/system-user.ts`.

**New as of this snapshot:** the app-layer chokepoint is now backed by
DB-layer RLS for 85 of 99 tables. Loaders that previously read via
`db.select(...)` now do `withTenant(orgId, tx => tx.select(...))` (or
`withTenantUser` for notifications). System cron jobs and anonymous
webhook receivers route through `dbAdmin` instead.

### Side-effect modules

- `domain/documents/` — supersession, auth-time gating.
- `domain/procurement/` — PO state machine.
- `domain/schedule/` — milestone + dependency mutations.

### Auth (`src/auth/`)

Unchanged shape — Better Auth + Drizzle adapter. New: session
denormalization tightened, `requireServerSession()` throws on missing
context (`b9e2a89`), idle timeout configured. `sendResetPassword` still
logs to console.

---

## F. Components and shell

`src/components/` structure unchanged. Cross-portal UI files under
`src/app/(portal)/` listed in §D. Per-report charts remain inline in
`reports-ui.tsx`; `src/components/charts/` still only holds
`AgingBarChart.tsx`.

---

## G. Jobs, storage, integrations

### `src/jobs/` — 14 Trigger.dev v3 tasks (was 7)

Pre-existing:
```
integration-sync-event-cleanup.ts
integration-token-refresh.ts
integration-webhook-processor.ts
stripe-payment-reconciliation.ts
upload-request-reminder.ts
webhook-payload-purge.ts
weekly-report-generation.ts
```

**New since April 24:**
```
account-anonymization-sweep.ts   — Track 3 (account deletion)
activity-feed-purge.ts           — Track 2 (retention)
audit-event-purge.ts             — Track 2 (retention)
data-export-cleanup.ts           — Track 3 (GDPR export)
deletion-reminder-sweep.ts       — Track 3 (account deletion)
notification-purge.ts            — Track 2 (retention)
prequal-expiry-sweep.ts          — Track 1 (Step 49)
```

### Storage (`src/lib/storage.ts`)

Unchanged. R2 orphan cleanup still tracked as a known leak in
`security_posture.md §6` (mark-and-sweep design pending).

### `src/lib/` — expanded

```
api/                       audit-categories.ts        closeout-packages/
daily-logs/                document-categories.ts     drawings/
env.ts                     exports/                   format/
format-file-size.ts        ganttAdapter.ts            geocoding/
imports/                   integrations/              invitations/
meetings/                  notification-catalog.ts    notifications/
pdf/                       portal-colors.ts           portal-nav-counts.ts
portal-nav.ts              portal-shell.ts            punch-list/
ratelimit.ts               redis.ts                   reports/
saml/                      storage.ts                 stripe.ts
submittals/                tax-id-mask.ts*            transmittals/
user-deletion/*            user-export/*              weather/
weekly-reports/
```

`*` = new since April 24.

### Integrations

Shape unchanged:

- **Stripe** — real (Connect onboarding + webhooks + subscriptions +
  Connect payments + draw charges).
- **SAML SSO** via `samlify`.
- **Sentry** — `@sentry/nextjs`.
- **Upstash rate-limiter** — auth + invitation + tax-id reveal.
- **Email provider** — still not wired. Three console-log stubs:
  password reset, account-deletion confirmation/reminder, GDPR export
  download link.

---

## H. Reports page state

No change vs. April 24. All 13 contractor Reports consume live loaders
in `src/domain/loaders/reports.ts`, each child slice `try/catch`-isolated.
Approximations cataloged in
[`production_grade_upgrades/reports_wiring_running_list.md`](production_grade_upgrades/reports_wiring_running_list.md).

---

## I. Documentation inventory

### New docs in `docs/specs/` since April 24

| File | Type |
|---|---|
| `rls_sprint_plan.md` | MD — historical plan + Slice A close-out section |
| `tax_id_encryption_plan.md` | MD — encryption plan (status: RESOLVED) |
| `user_deletion_and_export_plan.md` | MD — Tracks 3 plan |
| `rollback_strategy.md` | MD — incident rollback patterns |
| `current_repo_state_2026-04-27.md` | MD — **this file** |

### Updated since April 24

- [`security_posture.md`](security_posture.md) — §6 expanded heavily.
  RLS section now ~85 lines covering architecture, policy shapes,
  un-RLS'd table list, residual debt, post-sprint sweep, and the
  join-side coverage gap follow-on.
- [`compliance_map.md`](compliance_map.md) — RLS criteria moved from
  "planned" → "implemented (dev)". Table count bumped 72 → 85.
- [`phase_4plus_build_guide.md`](phase_4plus_build_guide.md) —
  Steps 48 / 49 / 49.5 marked ✅.
- [`bootstrap_new_env.md`](bootstrap_new_env.md) — Neon role-creation
  defect documented; SQL-only role provisioning is now the only
  supported path.

### Unchanged

`docs/specs/production_grade_upgrades/` (`README.md`,
`reports_wiring_running_list.md`,
`wip_cost_based_percent_complete.md`).
`docs/design/` — 25 HTML mockups. `docs/prototypes/` — 23 JSX files.
`docs/schema/` — 5 prototype schema TS files. `docs/handoff_notes/` —
2 files. `docs/archive/` — empty.

### `docs/specs/Step 49/`

The Step 49 build guide + design proposal + prototype schema TS
that were untracked on April 24 are now committed and the module
has shipped.

---

## J. Known drift between plans and reality

1. **CLAUDE.md counts are still stale.** Claims "36 tables + 2 mods
   across 5 files" and "24 HTML files" / "24 JSX prototypes" in `docs/`.
   Actual: **~99 live tables, 27 schema TS files, 25 HTML, 23 JSX in
   `docs/prototypes/`** plus 6 feature-module JSX files living under
   `docs/specs/`. CLAUDE.md updates are a universal stop-and-ask
   trigger; intentionally not auto-corrected.
2. **HANDOFF.md still says "Phase 3 Complete".** Carried forward from
   the April-20 and April-24 lists. Same triage status.
3. **JSX prototypes misfiled under `docs/specs/`.** Now 13+ `.jsx` files
   and 3 `.html` files that belong under `docs/prototypes/` or
   `docs/design/`. Six (drawings, inspections, meetings, transmittals,
   closeout, prequal) are the Phase 4+ module prototypes.
4. **Contractor cross-project redirect shims:** `approvals`,
   `payment-tracking`, `retainage`, `budget`. Same status. Verify on
   next sweep.
5. **`.env.example` vs. `src/lib/env.ts`:** Still potentially out of
   sync. New env vars added since April 24: `TAX_ID_ENCRYPTION_KEY`
   (Track 2). The hosting decision (still open per MEMORY) blocks the
   sync verification.
6. **Two RLS clusters deferred (`projects`, messaging).** Documented in
   `security_posture.md §6` "Tables intentionally NOT RLS'd". Both have
   per-cluster rationale and a defined unblocker. Don't restart without
   re-reading the recursion + participant-shape pitfalls.
7. **CI baseline carries 28 tracked bare `db.*` sites** (down from 49
   at original sprint close). Mostly writes to non-RLS tables
   (`auditEvents`, `users`, `subscriptionPlans`). Pay down
   opportunistically; the gate prevents new sites from accumulating.
8. **Email provider not wired** — three `console.log` stubs for password
   reset, account-deletion confirmation/reminder, GDPR export link.
   Blocked on transactional-email-provider decision (MEMORY:
   `project_hosting_and_email_deferred.md`).

---

## K. Environment & config

**Config files (all in repo root):**

| File | Notes |
|---|---|
| `package.json` | See §B. No prod-dep delta vs. April 24. |
| `package-lock.json` | Present. |
| `tsconfig.json` | Unchanged. |
| `tsconfig.tsbuildinfo` | Present (root artifact). |
| `next.config.mjs` | Minimal. |
| `drizzle.config.ts` | Targets `./src/db/migrations`. |
| `tailwind.config.mjs` | Renamed from `.ts` (April 24). |
| `postcss.config.mjs` | Present. |
| `trigger.config.ts` | Present. |
| `vitest.config.ts` | Present. |
| `sentry.*.config.ts` / instrumentation | Present. |
| `.env.example` | Present (potentially out of sync — see drift #5). |
| `.env.local` | Present. |
| `.env.test` / `.env.test.example` | Present. |

**Tests (`tests/`):**

```
access.test.ts            draws.test.ts             meetings.test.ts
prequal-flow.test.ts*     prequal-policy.test.ts*   prequal-scoring.test.ts*
rls-bare-db-audit.test.ts*                          rls-failure-modes.test.ts*
rls-organization-licenses.test.ts*                  transmittals.test.ts
uploads.test.ts           with-tenant.test.ts*      fixtures/  helpers/
global-setup.ts           setup.ts
```

`*` = new since April 24. Test count: **110 tests** (per
`security_posture.md §6`, all green as of `64e4139`). Coverage still
lags drawings, inspections, closeout — same gap as April 24, not
worsened.

**`scripts/` — 11 new since April 24:**

```
_audit-rls-coverage.mjs              _slice-a-bucket3-smoke.mjs
_background-job-tables-smoke.mjs     _slice-a-bucket4b-smoke.mjs
_notifications-smoke.mjs             _wave4-nested-smoke.mjs
_prequal-smoke.mjs                   apply-sql.ts
backfill-encrypt-tax-id.ts           check-rls-callsites.baseline.txt
check-rls-callsites.ts               create-builtcrm-test-role.sql
list-ids.ts                          new-env-bootstrap.sql
recreate-builtcrm-app.sql            rls-audit.js
rls-perf-daily-logs.ts               rls-perf-documents.ts
rls-perf-milestones.ts               rls-perf-rfis.ts
```

**Other top-level folders:** `.claude/`, `.next/`, `.trigger/`,
`public/marketing.html`.

---

## Critical files to read when starting a new session

- [`CLAUDE.md`](../../CLAUDE.md) — tech stack + conventions + Phase 4+
  rules + FK-naming note (counts are stale — see drift #1).
- [`docs/specs/builtcrm_phase4_portfolio_scope.md`](builtcrm_phase4_portfolio_scope.md) —
  active scope (source of truth).
- [`docs/specs/phase_4plus_build_guide.md`](phase_4plus_build_guide.md) —
  Steps 44–49.5 ✅.
- [`docs/specs/security_posture.md`](security_posture.md) — **read §6
  before touching RLS, retention jobs, or auth chokepoints**. Lists every
  deliberately un-RLS'd table and every deferred work item with rationale.
- [`docs/specs/compliance_map.md`](compliance_map.md) — SOC 2
  criterion-by-criterion.
- [`docs/specs/bootstrap_new_env.md`](bootstrap_new_env.md) — fresh-env
  bootstrap (now SQL-only role provisioning).
- [`docs/specs/rls_sprint_plan.md`](rls_sprint_plan.md) — historical
  RLS plan + Slice A final-state section. Read for design decisions
  on policy shapes; live state is in `security_posture.md §6`.
- [`docs/specs/production_grade_upgrades/README.md`](production_grade_upgrades/README.md) —
  upgrade catalog (WIP %-complete, reports approximations).
- `src/db/schema/index.ts` — live schema barrel (26 exports).
- `src/db/migrations/meta/_journal.json` — journalled migration
  inventory (44 entries, healthy).
- `src/db/with-tenant.ts` — RLS plumbing.
- `src/db/admin-client.ts` — `dbAdmin` for system-context writes.
- `scripts/rls-audit.js` — schema-aware bare-db gate (load-bearing).
- `src/domain/context.ts` — authorization gate.
- `src/domain/permissions.ts` — policy map.
- `src/auth/config.ts` — Better Auth setup.
- `src/domain/loaders/reports.ts` — reports composition root.
