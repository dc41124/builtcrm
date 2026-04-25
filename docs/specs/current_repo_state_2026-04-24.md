# BuiltCRM — Current Repo State

**Repo path:** `c:\Users\David Cardona\Desktop\builtcrm\`
**As of:** April 24, 2026
**Compiled from:** direct filesystem + live DB inspection + `git log`.
Supersedes [`current_repo_state_2026-04-20.md`](current_repo_state_2026-04-20.md).

---

## Change summary since 2026-04-20

The repo is **deep into Phase 4+**. Two major tracks have landed in the
four days since the prior snapshot:

### Track 1 — Security hardening (post-Phase-4+ prep)

Landed between April 20 and the module sprint. Includes:

- **Option A baseline collapse** (`e4c869c`) — the 23 hand-written
  `.sql` files called out in the April-20 drift section were collapsed
  into a single `0000_baseline.sql` (1,853 lines), and drizzle-kit's
  journalled migration flow was resumed. `_journal.json` now has real
  entries. The "empty `drizzle.__drizzle_migrations`" drift is **fixed**.
- **Fresh-env bootstrap doc** (`66e43c4`) — new
  [`bootstrap_new_env.md`](bootstrap_new_env.md), step-by-step
  provisioning for prod / new Neon branch / fresh dev.
- **Step 1:** global API error handler.
- **Step 2:** rate limiting on auth + invitation endpoints via
  `@upstash/ratelimit` (+ `src/lib/ratelimit.ts`).
- **Step 3:** Sentry integration (`@sentry/nextjs`). Follow-up commit
  fixed Sentry client config for Turbopack compatibility.
- **Step 4:** background-job audit logging coverage.
- **Step 5:** webhook payload retention TTL — new
  `src/jobs/webhook-payload-purge.ts`.
- **Step 6:** security + compliance doc updates — new
  [`security_posture.md`](security_posture.md) and
  [`compliance_map.md`](compliance_map.md).

### Track 2 — Phase 4+ module sprint (Steps 44–48)

- **Step 44 — Drawings.** Full module landed in six commits:
  schema + upload pipeline + read-only viewer → markup / measurement /
  comment write + edit tools → split-view compare with luminance diff →
  as-built toggle + closeout feed + lazy thumbnails → sheet metadata
  edit + two-point calibration + mobile polish → seed drawings + modal
  upload + audit-pass fixes → drawings token resolution + missing
  modal/field CSS → set rename + real PDFs for seed data.
  Commits `0619946` … `604c0e9`. New dep: `pdfjs-dist`, `react-pdf`.
- **Step 45 — Inspections.** Inspections module with template library
  and punch-list integration. Commit `01d6373` + follow-up
  `a28f3ad` (let assigned sub edit scheduled inspections).
- **Step 46 — Meetings.** Agendas, minutes, attendees, action items
  (`0d5c2fb`). Polish commit `76173cc` tightened UI to JSX spec.
- **Step 47 — Transmittals.** Transmittals module (`4fe8a12`).
- **Step 48 — Closeout Packages.** **In-flight, uncommitted.** Schema,
  loader, UI, PDF cover template, and API routes all exist in the
  working tree; `closeout_*` tables are already pushed to the live DB.
  See "Working tree" below.

### Other config / infra changes

- `tailwind.config.ts` → `tailwind.config.mjs` (`c5ba908`).
- New `tsconfig.tsbuildinfo` in root (buildinfo config commit `0ff392b`).
- Step 49 build guide drafted under
  [`docs/specs/Step 49/`](Step%2049/) — subcontractor prequalification,
  not yet started.

### Live DB

**95 public tables** (was 72 on April 20). Growth driven by Drawings,
Inspections, Meetings, Transmittals, and the in-flight Closeout tables.

---

## A. Snapshot

- **Branch:** `main`
- **Git user:** `dc41124 <dc41124@gmail.com>`
- **Last 10 commits (newest-first):**
  1. `4fe8a12` Step 47 (5.2 #47): Transmittals module
  2. `0ff392b` buildinfo config
  3. `76173cc` Step 46 polish: tighten meetings UI to JSX spec
  4. `0d5c2fb` Step 46 (5.2 #46): Meetings module — agendas, minutes, attendees, action items
  5. `c5ba908` Rename tailwind.config.ts → tailwind.config.mjs
  6. `c58f649` Fix Sentry client config for Turbopack compatibility
  7. `2c0df8d` Step 6: security + compliance doc updates
  8. `f56929c` Step 5: webhook payload retention TTL
  9. `aad5203` Step 4: background job audit logging coverage
  10. `7e8d492` Step 3: Sentry integration
- **Phase claim:** deep mid-**Phase 4+**. The authoritative working doc
  remains [`builtcrm_phase4_portfolio_scope.md`](builtcrm_phase4_portfolio_scope.md)
  with step-by-step execution tracked in
  [`phase_4plus_build_guide.md`](phase_4plus_build_guide.md). Steps
  44–47 are marked ✅ in the build guide; Step 48 (Closeout Packages)
  is marked ✅ in the build guide but **not yet committed** (staged in
  the working tree).

### Working tree (uncommitted)

Modified:

- `docs/specs/phase_4plus_build_guide.md` — Step 47/48 marked ✅
- `src/app/(portal)/contractor/(global)/reports/reports-ui.tsx`
- `src/db/migrations/meta/_journal.json` — new journal entry for 0003
- `src/db/schema/index.ts` — closeoutPackages export added
- `src/db/seed.ts` — closeout seed data
- `src/lib/notification-catalog.ts`,
  `src/lib/notifications/recipients.ts`,
  `src/lib/notifications/routing.ts` — closeout notification wiring
- `src/lib/portal-nav.ts` — closeout nav entries
- `tsconfig.tsbuildinfo`

Untracked:

- `docs/specs/Step 49/` — subcontractor prequalification build guide +
  design proposal + prototype schema TS (Phase 5 prep)
- `docs/specs/builtcrm_closeout_packages_module.jsx` — JSX prototype
- `src/app/(portal)/closeout-icons.tsx`,
  `closeout-packages.css`, `closeout-shared.tsx` — shared closeout UI
- `src/app/(portal)/commercial/project/[projectId]/closeout/`
- `src/app/(portal)/contractor/project/[projectId]/closeout-packages/`
- `src/app/(portal)/residential/project/[projectId]/closeout/`
- `src/app/api/closeout-packages/`
- `src/db/migrations/0003_tricky_bishop.sql` + `meta/0003_snapshot.json`
- `src/db/schema/closeoutPackages.ts`
- `src/domain/loaders/closeout-packages.ts`
- `src/lib/closeout-packages/`, `src/lib/pdf/closeout-cover-template.tsx`

---

## B. Tech stack as actually installed

From `package.json`.

### Production dependencies

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

### Dev dependencies

Unchanged from April 20 (Tailwind v4, Vitest, TypeScript 5.6, ESLint 8,
drizzle-kit 0.31, tsx 4.19).

### Delta vs. April 20

**Newly installed:** `@sentry/nextjs`, `@upstash/ratelimit`,
`pdfjs-dist`, `react-pdf`. Dev deps unchanged.

### Notable absences still in effect

- **No QuickBooks / Xero / Sage / Postmark / SendGrid / Google Calendar /
  Outlook SDKs.** Still catalog metadata only. `sendResetPassword` still
  logs URL to console (`src/auth/config.ts`).
- **No Playwright / testing-library UI.** Only Vitest.
- **Next.js 14,** not 15.

---

## C. Database schema (actual)

### Schema files under `src/db/schema/`

27 schema source files (26 table-bearing + `_shared.ts` + `index.ts`
barrel; `index.ts` is not in the per-domain count). New since April 20:
`drawings.ts`, `inspections.ts`, `meetings.ts`, `transmittals.ts`, and
the uncommitted `closeoutPackages.ts`.

```
_shared.ts            shared timestamps helper
index.ts              barrel — 25 domain exports
audit.ts              (2) activity_feed_items, audit_events
auth.ts               (5) Better Auth + 2fa tables
billing.ts            (7) billing_packages, SOV, draws, lien_waivers, retainage_releases, …
closeoutPackages.ts*  (5) closeout_packages, sections, items, comments, counters  [uncommitted]
dailyLogs.ts          (6) daily_logs, crew_entries, amendments, photos, delays, issues
documents.ts          (2) documents, document_links
drawings.ts           (5) drawing_sets, sheets, markups, measurements, comments
exports.ts            (1) data_exports
identity.ts           (8) users, organizations, memberships, roles, invitations, …
inspections.ts        (4) inspection_templates, inspections, results, result_photos
integrations.ts       (4) integration_connections, sync_events, payment_transactions, webhook_events
meetings.ts           (5) meetings, agenda_items, attendees, minutes, action_items
messaging.ts          (3) conversations, participants, messages
notifications.ts      (1) notifications
procurement.ts        (4) cost_codes, vendors, purchase_orders, purchase_order_lines
projects.ts           (5) projects + memberships + milestones + dependencies
punchList.ts          (3) punch_items, punch_item_photos, punch_item_comments
savedReports.ts       (1) saved_reports
selections.ts         (4) selection_categories, items, options, decisions
sso.ts                (1) sso_providers
submittals.ts         (3) submittals, submittal_documents, submittal_transmittals
subscriptions.ts      (4) subscription_plans, organization_subscriptions, subscription_invoices, stripe_customers
transmittals.ts       (4) transmittals, documents, recipients, access_events
weeklyReports.ts      (2) weekly_reports, weekly_report_sections
workflows.ts          (6) upload_requests, compliance_records, rfis, rfi_responses, change_orders, approvals
```

`*` = uncommitted in the working tree but already pushed to the live DB.

### Live DB table inventory (95 tables in `public`)

```
activity_feed_items               approvals                         audit_events
auth_account                      auth_session                      auth_user
auth_verification                 billing_packages                  change_orders
closeout_counters                 closeout_package_comments         closeout_package_items
closeout_package_sections         closeout_packages                 compliance_records
conversation_participants         conversations                     cost_codes
daily_log_amendments              daily_log_crew_entries            daily_log_delays
daily_log_issues                  daily_log_photos                  daily_logs
data_exports                      document_links                    documents
draw_line_items                   draw_requests                     drawing_comments
drawing_markups                   drawing_measurements              drawing_sets
drawing_sheets                    inspection_result_photos          inspection_results
inspection_templates              inspections                       integration_connections
invitations                       lien_waivers                      meeting_action_items
meeting_agenda_items              meeting_attendees                 meeting_minutes
meetings                          messages                          milestone_dependencies
milestones                        notifications                     organization_certifications
organization_licenses             organization_subscriptions        organization_users
organizations                     payment_transactions              project_organization_memberships
project_user_memberships          projects                          punch_item_comments
punch_item_photos                 punch_items                       purchase_order_lines
purchase_orders                   retainage_releases                rfi_responses
rfis                              role_assignments                  saved_reports
schedule_of_values                selection_categories              selection_decisions
selection_items                   selection_options                 sov_line_items
sso_providers                     stripe_customers                  submittal_documents
submittal_transmittals            submittals                        subscription_invoices
subscription_plans                sync_events                       transmittal_access_events
transmittal_documents             transmittal_recipients            transmittals
two_factor                        upload_requests                   user_notification_preferences
users                             vendors                           webhook_events
weekly_report_sections            weekly_reports
```

### Migrations (journalled — no longer hand-written)

**4 migration files checked in** at `src/db/migrations/`:

```
0000_baseline.sql                 (1853 lines — collapse of prior 23 hand-written files)
0001_far_toro.sql                 (108 lines)
0002_clumsy_living_tribunal.sql   (69 lines)
0003_tricky_bishop.sql            (93 lines — uncommitted, closeout packages)
```

With matching snapshots + `_journal.json` under
`src/db/migrations/meta/`. **Migration tracking is now healthy**:
`_journal.json` has 4 entries and `db:generate` / `db:migrate` are the
intended workflow going forward. The April-20 drift item
"migration tracking empty, hand-written history" is resolved.

### Schema-writing conventions

- FK constraint naming uses the long form
  `{srcTable}_{srcCol}_{refTable}_{refCol}_fk`. When the generated name
  exceeds Postgres' 63-char limit, the table declares the FK explicitly
  via `foreignKey({ ..., name: "{srcTable}_{srcCol}_fk" })` and drops
  `.references()` from the column. See the CLAUDE.md note and the 8
  tables in `projects.ts`, `workflows.ts`, `subscriptions.ts`,
  `billing.ts`, `integrations.ts`, `inspections.ts`, and `punchList.ts`
  that use this pattern.
- All tables with mutable state carry `created_at` + `updated_at` from
  `timestamps` in `_shared.ts`.
- UUID primary keys throughout.

---

## D. App routes (actual)

Top-level groups under `src/app/`: `(auth)`, `(portal)`, `api`, plus
`reviewer/`, `receipts/`, `no-portal/`, `test/`, `t/`, `global-error.tsx`,
`not-found.tsx`, root `page.tsx`.

### `(auth)`

`forgot-password`, `invite/[token]`, `login`, `reset-password`,
`select-portal`, `signup`, `signup/contractor`, `welcome`.

### `(portal)` shared (cross-portal)

New under `(portal)/` since April 20: `closeout-icons.tsx`,
`closeout-packages.css`, `closeout-shared.tsx`, `inspections-shared.tsx`,
`inspections.css`, `meetings-rail.tsx`, `meetings-shared.tsx`,
`meetings.css`, `transmittals-shared.tsx`, `transmittals.css`.

### `(portal)/contractor`

**Global:** `approvals`, `billing`, `budget`, `change-orders`,
`compliance`, `cost-codes`, `dashboard`, `documents`, `messages`,
`notifications`, `payment-tracking`, `reports`, `retainage`, `rfis`,
`settings` (+ `integrations`, `invitations`, `payments`),
`upload-requests`, `vendors`.

**Project-scoped** (`contractor/project/[projectId]`): `approvals`,
`billing`, `change-orders`, `closeout-packages`*, `compliance`,
`daily-logs` (incl. `[logId]`), `documents`, `drawings`, `financials`,
`inspections`, `meetings`, `messages`, `payments`, `procurement`,
`punch-list`, `rfis`, `schedule`, `selections`, `submittals`,
`transmittals`, `upload-requests`, `weekly-reports`.

New since April 20: `drawings`, `inspections`, `meetings`,
`transmittals`, `closeout-packages` (`*` = uncommitted).

### `(portal)/subcontractor`

**Global:** `compliance`, `daily-logs` (incl. `[logId]`), `documents`,
`messages`, `notifications`, `payments`, `rfis`, `schedule`, `settings`,
`today`, `upload-requests`.

**Project-scoped:** `compliance`, `daily-logs/[logId]`, `documents`,
`drawings`, `financials`, `inspections`, `meetings`, `messages`,
`payments`, `punch-list`, `rfis`, `schedule`, `submittals`,
`upload-requests`.

New since April 20: `drawings`, `inspections`, `meetings`.

### `(portal)/commercial`

**Global:** `notifications`, `settings`.

**Project-scoped:** `approvals`, `billing`, `change-orders`, `closeout`*,
`contracts`, `daily-logs` (incl. `[logId]`), `documents`, `messages`,
`payments`, `photos`, `progress`, `schedule`, `weekly-reports`.

### `(portal)/residential`

**Global:** `notifications`, `settings`.

**Project-scoped:** `billing`, `budget`, `closeout`*,
`confirmed-choices`, `decisions`, `documents`, `journal` (incl.
`[logId]`), `messages`, `progress`, `schedule`, `scope-changes`,
`selections`, `walkthrough-items`, `weekly-reports`.

### `(portal)/client` (shared)

`project/[projectId]` with `schedule` sub-route.

### `api/`

Route families (each often has nested `[id]/{action}` subroutes):

`approvals`, `auth`, `avatar`, `change-orders`, `closeout-packages`*,
`compliance`, `contractor/stripe/connect`, `conversations`,
`daily-log-amendments`, `daily-log-crew-entries`, `daily-log-photos`,
`daily-logs`, `documents`, `draw-requests`, `drawings`, `export`,
`files`, `inspection-photos`, `inspection-results`,
`inspection-templates`, `inspections`, `integrations`, `invitations`,
`lien-waivers`, `meetings`, `meetings-carry-preview`, `milestones`,
`notifications`, `oauth/[provider]`, `org/{…}`, `payments/manual`,
`procurement/{cost-codes,purchase-orders,vendors}`,
`punch-item-photos`, `punch-items`, `retainage-releases`,
`reviewer/[token]`, `rfis`, `search`, `selections`,
`signup/contractor-bootstrap`, `sov`, `submittal-documents`,
`submittals`, `transmittals`, `upload-requests`,
`upload/{request,finalize}`, `user/{…}`, `webhooks/[provider]`,
`webhooks/stripe`, `weekly-reports/{…}`.

New since April 20: `closeout-packages` (uncommitted), `drawings`,
`inspection-photos`, `inspection-results`, `inspection-templates`,
`inspections`, `meetings`, `meetings-carry-preview`, `transmittals`.

### Public non-portal routes

- `reviewer/[token]` — external SSO-less reviewer entry (submittals +
  transmittals).
- `receipts/[paymentTransactionId]` — public receipt page.
- `t/…`, `no-portal`, `test/upload`, `welcome`.

---

## E. Domain layer

### `src/domain/loaders/*.ts` — 54 files

Added since April 20: `closeout-packages.ts` (uncommitted), `drawings.ts`,
`inspections.ts`, `meetings.ts`, `transmittals.ts`. Everything else
carried forward from the April-20 inventory.

### Authorization

Unchanged structure:

- `src/domain/permissions.ts` — `POLICY` map + `buildPermissions`,
  `assertCan`, `AuthorizationError`.
- `src/domain/context.ts` — `getEffectiveContext(session, projectId)`
  single gate.
- `src/domain/policies/plan.ts` — plan-feature gating.
- `src/domain/audit.ts`, `src/domain/activity.ts`,
  `src/domain/system-user.ts`.

### Side-effect modules under `src/domain/`

- `domain/documents/` — document supersession, auth-time gating.
- `domain/procurement/` — PO state machine.
- `domain/schedule/` — milestone + dependency mutations.

### Auth (`src/auth/`)

Unchanged since April 20. Better Auth + Drizzle adapter,
`databaseHooks` for domain-user sync and session denormalization. Still
email+password only; `sendResetPassword` still logs to console. SAML
SSO via `samlify` + `samlify-node-xmllint`.

---

## F. Components and shell

Structure under `src/components/` unchanged. New cross-portal UI files
live directly under `src/app/(portal)/`:

- `closeout-icons.tsx`, `closeout-packages.css`, `closeout-shared.tsx`
- `inspections-shared.tsx`, `inspections.css`
- `meetings-rail.tsx`, `meetings-shared.tsx`, `meetings.css`
- `transmittals-shared.tsx`, `transmittals.css`

`src/components/charts/` still only holds `AgingBarChart.tsx`; per-report
charts remain inline in `reports-ui.tsx`.

---

## G. Jobs, storage, integrations

### `src/jobs/` — 7 Trigger.dev v3 tasks (was 6)

- `integration-sync-event-cleanup.ts`
- `integration-token-refresh.ts`
- `integration-webhook-processor.ts`
- `stripe-payment-reconciliation.ts`
- `upload-request-reminder.ts`
- `webhook-payload-purge.ts` — **new (Step 5).** Enforces webhook-payload
  retention TTL.
- `weekly-report-generation.ts`

### Storage (`src/lib/storage.ts`)

Unchanged.

### `src/lib/` (expanded since April 20)

```
audit-categories.ts       closeout-packages/*  daily-logs/
document-categories.ts    drawings/            env.ts
exports/                  format/              format-file-size.ts
ganttAdapter.ts           geocoding/           imports/
integrations/             invitations/         meetings/
notification-catalog.ts   notifications/       pdf/
portal-colors.ts          portal-nav-counts.ts portal-nav.ts
portal-shell.ts           punch-list/          ratelimit.ts
redis.ts                  reports/             saml/
storage.ts                stripe.ts            submittals/
transmittals/             weather/             weekly-reports/
```

`*` = uncommitted. New since April 20: `closeout-packages/`, `drawings/`,
`invitations/`, `meetings/`, `ratelimit.ts`, `transmittals/`. `pdf/`
picked up a new `closeout-cover-template.tsx` (uncommitted).

### Integrations

Unchanged shape:

- **Stripe** — real. Connect onboarding, webhooks, subscriptions,
  Connect payments, draw charges.
- **SAML SSO** via `samlify`.
- **Sentry** — **new (Step 3).** `@sentry/nextjs` installed; Turbopack
  compatibility fix shipped.
- **Upstash rate-limiter** — **new (Step 2).** Backs auth + invitation
  endpoints.
- **Email provider** — still not wired. `sendResetPassword` logs reset
  URL to console.

---

## H. Reports page state

No change vs. April 20. All 13 contractor Reports still consume live
loaders in `src/domain/loaders/reports.ts`, each child slice
`try/catch`-isolated. Documented approximations remain cataloged in
[`production_grade_upgrades/reports_wiring_running_list.md`](production_grade_upgrades/reports_wiring_running_list.md).

---

## I. Documentation inventory

### New docs in `docs/specs/` since April 20

| File | Type |
|---|---|
| `bootstrap_new_env.md` | MD — fresh-env bootstrap steps |
| `security_posture.md` | MD — threat model + data-at-rest mechanics |
| `compliance_map.md` | MD — SOC 2 criterion-by-criterion coverage |
| `builtcrm_drawings_module.jsx` | JSX prototype |
| `builtcrm_inspections_module.jsx` | JSX prototype |
| `builtcrm_meetings_module.jsx` | JSX prototype |
| `builtcrm_transmittals_module.jsx` | JSX prototype |
| `builtcrm_closeout_packages_module.jsx` | JSX prototype (untracked) |
| `Step 49/` | folder — subcontractor prequalification build guide + design proposal + schema prototype (untracked) |
| `current_repo_state_2026-04-24.md` | MD — **this file** |

### `docs/specs/production_grade_upgrades/`

Unchanged since April 20 — `README.md`,
`reports_wiring_running_list.md`, `wip_cost_based_percent_complete.md`.

### `docs/design/` — 25 HTML mockups

Unchanged.

### `docs/prototypes/` — 23 JSX files

Unchanged in folder. Newer module JSX prototypes (drawings, inspections,
meetings, transmittals, closeout) live under `docs/specs/` instead of
`docs/prototypes/`. Continuation of the drift called out in April 20's
section J.5.

### `docs/schema/` — 5 prototype schema TS files

Unchanged. Still reference-only; canonical schema is `src/db/schema/*.ts`.

### `docs/handoff_notes/` — 2 files

Unchanged (`step17_messages.md`, `step18_documents.md`).

### `docs/archive/` — empty.

---

## J. Known drift between plans and reality

1. **Closeout Packages is built but uncommitted.** The build guide
   marks Step 48 ✅, but ~15 files (schema, loader, UI, CSS, API routes,
   lib, PDF template, migration 0003, JSX prototype) are in the
   working tree only. Commit before the next session.
2. **HANDOFF.md is still stale.** Still says "Phase 3 Complete". Kept
   in the drift list from April 20.
3. **CLAUDE.md counts:** Claims "36 tables + 2 mods across 5 files" and
   "24 HTML files" / "24 JSX prototypes" in `docs/`. Actual: **95 live
   tables, 26 schema TS files, 25 HTML, 23 JSX in
   `docs/prototypes/`** plus 5 feature-module JSX files living under
   `docs/specs/`. Counts will stay wrong until CLAUDE.md is explicitly
   updated (universal stop-and-ask trigger).
4. **JSX prototypes misfiled under `docs/specs/`.** Now 13+ `.jsx`
   files and 3 `.html` files that belong under `docs/prototypes/` or
   `docs/design/`. Five of them (drawings, inspections, meetings,
   transmittals, closeout) are the Phase 4+ module prototypes.
5. **Contractor cross-project redirect shims:** `approvals`,
   `payment-tracking`, `retainage`, `budget`. Same status as April 20;
   verify each on next sweep.
6. **`.env.example` vs. `src/lib/env.ts`:** Still potentially out of
   sync — env shape now also includes Sentry DSN + Upstash rate-limit
   keys.
7. **Migration tracking** — **resolved** vs. April 20. Baseline
   collapse reset the journal; `db:generate` / `db:migrate` is the
   healthy path forward.

---

## K. Environment & config

**Config files (all in repo root):**

| File | Notes |
|---|---|
| `package.json` | See section B. |
| `package-lock.json` | Present. |
| `tsconfig.json` | Unchanged. |
| `tsconfig.tsbuildinfo` | **New root artifact** (buildinfo config commit). |
| `next.config.mjs` | Minimal. |
| `drizzle.config.ts` | Targets `./src/db/migrations`. |
| `tailwind.config.mjs` | **Renamed from `.ts`** (commit `c5ba908`). |
| `postcss.config.mjs` | Present. |
| `trigger.config.ts` | Present. |
| `vitest.config.ts` | Present. |
| `sentry.*.config.ts` / instrumentation | Added by Step 3. |
| `.env.example` | Present. |
| `.env.local` | Present. |
| `.env.test` / `.env.test.example` | Present. |

**Scripts (`package.json`):** unchanged from April 20.

**Tests (`tests/`):** `access.test.ts`, `draws.test.ts`,
`meetings.test.ts` (**new**), `transmittals.test.ts` (**new**),
`uploads.test.ts`, plus `fixtures/`, `helpers/`, `global-setup.ts`,
`setup.ts`. Coverage still lags the full Phase 4+ surface (no tests for
drawings, inspections, closeout).

**`scripts/`:** `apply-sql.ts`, `list-ids.ts`, `new-env-bootstrap.sql`.

**Other top-level folders:** `.claude/`, `.next/`, `.trigger/`,
`public/marketing.html`.

---

## Critical files to read when starting a new session

- [`CLAUDE.md`](../../CLAUDE.md) — tech stack + conventions + Phase 4+
  rules + FK-naming note (counts are stale — see drift #3).
- [`docs/specs/builtcrm_phase4_portfolio_scope.md`](builtcrm_phase4_portfolio_scope.md) —
  active Phase 4+ plan (source of truth).
- [`docs/specs/phase_4plus_build_guide.md`](phase_4plus_build_guide.md) —
  step-by-step execution guide (Steps 44–47 ✅, Step 48 ✅ marked but
  uncommitted, Step 49 drafted but not started).
- [`docs/specs/security_posture.md`](security_posture.md) +
  [`compliance_map.md`](compliance_map.md) — **new** portfolio artifacts.
- [`docs/specs/bootstrap_new_env.md`](bootstrap_new_env.md) — fresh-env
  bootstrap.
- [`docs/specs/production_grade_upgrades/README.md`](production_grade_upgrades/README.md) —
  production-grade upgrade catalog.
- `src/db/schema/index.ts` — live schema barrel (25 exports, ~95 tables).
- `src/db/migrations/meta/_journal.json` — journalled migration
  inventory (healthy again).
- `src/domain/context.ts` — authorization gate.
- `src/domain/permissions.ts` — policy map.
- `src/domain/policies/plan.ts` — plan-feature gating.
- `src/auth/config.ts` — Better Auth setup.
- `src/domain/loaders/reports.ts` — reports composition root.
