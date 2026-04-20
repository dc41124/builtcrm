# BuiltCRM — Current Repo State

**Repo path:** `c:\Users\David Cardona\Desktop\builtcrm\`
**As of:** April 20, 2026
**Compiled from:** direct filesystem + live DB inspection. Supersedes
[`current_repo_state_2026-04-16.md`](current_repo_state_2026-04-16.md).

---

## Change summary since 2026-04-16

The repo is **mid-Phase 4+**, not post-Phase-3. Core additions since the
prior snapshot:

- **Daily Logs** (Step 9) — full crew-entry + reconciliation + photo +
  delay/issue flow, both portals.
- **Punch List** (Step 11) — punch items with photos, comments, state
  machine.
- **Submittals** (Step 12) — submittal + transmittal + reviewer token
  flow.
- **Weekly Reports** (Step 18/39) — generator, PDF renderer
  (`@react-pdf/renderer`), section authoring, dispatch.
- **Procurement** (Steps 20/41) — vendors, cost codes, POs + line items,
  receive/invoice/close state machine.
- **Settings wire-up** (2026-04-17 handoff) — all 4 portal settings shells
  wired end-to-end. Org profile, members, invitations, licenses,
  certifications, 2FA, SSO (SAML stubs), subscriptions (Stripe), data
  exports (R2-backed archives), user preferences, avatar flow.
- **Notifications** (Step 8-add) — in-app notification centre + user
  preferences.
- **Milestones → Gantt** (Step 17/7) — dependencies + Frappe Gantt.
- **Retainage scheduled-release hooks** (Step 43) — milestone or date
  triggered.
- **Reports wiring to live data** (Step 24.5 follow-up, 2026-04-20) —
  all 13 contractor reports now consume real loaders; zero SEED imports
  in the reports workspace; `saved_reports` table added (migration 0023).
- **Production-grade upgrade folder** —
  [`docs/specs/production_grade_upgrades/`](production_grade_upgrades/)
  seeded with a WIP cost-based spec + a running list of other gaps to be
  consolidated during the Phase-4+-exit audit.

Live DB now carries **72 public tables**, 23 migration files, 22 schema
files producing **70 `pgTable` declarations** plus 2 auth-duplicates
(accounted for below).

---

## A. Snapshot

- **Branch:** `main`
- **Git user:** `dc41124 <dc41124@gmail.com>`
- **Last 5 commits (oldest-first):**
  1. `727a83e` Step 41 (4D #41): Procurement / POs module
  2. `41dce66` tradeScope column on sub payment rollup
  3. `102598d` wired pendingFinancialsCents in sub-scoped loaders
  4. `0ec95b5` retainage scheduled-release hooks (hybrid date + milestone)
  5. `742f2e7` render retainage release panel with scheduled-release hooks on financials
  6. `a3991c6` pending financials card + retainage schedule hooks
  7. `b11fbb8` mid phase 4 cleanup
  8. `96332ba` deleted seed data and wired live data to reports ← most recent at snapshot time
- **Phase claim:** Repo is actively mid-**Phase 4+**. HANDOFF.md still
  says "Status: Phase 3 Complete" but content is stale; the
  authoritative working doc is
  [`docs/specs/builtcrm_phase4_portfolio_scope.md`](builtcrm_phase4_portfolio_scope.md)
  with step-by-step execution tracked in
  [`docs/specs/phase_4plus_build_guide.md`](phase_4plus_build_guide.md).

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
| `@trigger.dev/sdk` | ^3.3.0 |
| `@upstash/redis` | ^1.34.3 |
| `archiver` | ^7.0.1 |
| `better-auth` | ^1.0.0 |
| `drizzle-orm` | ^0.41.0 |
| `frappe-gantt` | ^1.2.2 |
| `nanoid` | ^5.0.7 |
| `next` | ^14.2.15 |
| `postgres` | ^3.4.5 |
| `react` | ^18.3.1 |
| `react-dom` | ^18.3.1 |
| `recharts` | ^3.8.1 |
| `samlify` | ^2.12.0 |
| `stripe` | ^22.0.2 |
| `zod` | ^3.23.8 |

### Dev dependencies

| Package | Version |
|---|---|
| `@tailwindcss/postcss` | ^4.2.2 |
| `@types/archiver` | ^7.0.0 |
| `@types/node` | ^22.7.5 |
| `@types/react` | ^18.3.12 |
| `@types/react-dom` | ^18.3.1 |
| `@vitest/ui` | ^4.1.4 |
| `dotenv` | ^17.4.2 |
| `drizzle-kit` | ^0.31.4 |
| `eslint` | ^8.57.1 |
| `eslint-config-next` | ^14.2.15 |
| `postcss` | ^8.5.9 |
| `tailwindcss` | ^4.2.2 |
| `tsx` | ^4.19.1 |
| `typescript` | ^5.6.3 |
| `vite-tsconfig-paths` | ^6.1.1 |
| `vitest` | ^4.1.4 |

### Delta vs. April 16

**Newly installed:** `@authenio/samlify-node-xmllint`, `@react-pdf/renderer`,
`archiver`, `frappe-gantt`, `recharts`, `samlify`, `stripe`.
`@types/archiver` added to dev deps. Everything else unchanged.

### Notable absences still in effect

- **No QuickBooks / Xero / Sage / Postmark / SendGrid / Google Calendar /
  Outlook SDKs.** Still catalog metadata only.
  `sendResetPassword` still logs URL to console (`src/auth/config.ts`).
- **No Playwright / testing-library UI.** Only Vitest.
- **Tailwind v4** installed but `tailwind.config.ts` still exists.
- **Next.js 14,** not 15.

---

## C. Database schema (actual)

### Schema files under `src/db/schema/`

22 schema source files (21 tables-bearing + `_shared.ts` + `index.ts`
barrel). New since April 16: `dailyLogs.ts`, `exports.ts`, `notifications.ts`,
`procurement.ts`, `punchList.ts`, `savedReports.ts`, `sso.ts`, `submittals.ts`,
`subscriptions.ts`, `weeklyReports.ts`.

```
_shared.ts        shared timestamps helper
index.ts          barrel — all exports
audit.ts          (2) activity_feed_items, audit_events
auth.ts           (5) Better Auth + 2fa tables
billing.ts        (7) billing_packages, SOV, draws, lien_waivers, retainage_releases, …
dailyLogs.ts      (6) daily_logs, crew_entries, amendments, photos, delays, issues
documents.ts      (2) documents, document_links
exports.ts        (1) data_exports
identity.ts       (8) users, organizations, memberships, roles, invitations, …
integrations.ts   (4) integration_connections, sync_events, payment_transactions, webhook_events
messaging.ts      (3) conversations, participants, messages
notifications.ts  (1) notifications
procurement.ts    (4) cost_codes, vendors, purchase_orders, purchase_order_lines
projects.ts       (5) projects + memberships + milestones + dependencies
punchList.ts      (3) punch_items, punch_item_photos, punch_item_comments
savedReports.ts   (1) saved_reports  ← migration 0023 (2026-04-20)
selections.ts     (4) selection_categories, items, options, decisions
sso.ts            (1) sso_providers
submittals.ts     (3) submittals, submittal_documents, submittal_transmittals
subscriptions.ts  (4) subscription_plans, organization_subscriptions, subscription_invoices, stripe_customers
weeklyReports.ts  (2) weekly_reports, weekly_report_sections
workflows.ts      (6) upload_requests, compliance_records, rfis, rfi_responses, change_orders, approvals
```

Sum of `pgTable` declarations across schema files: **70**. Plus
`two_factor` and `user_notification_preferences` tables = 72 total
matching live DB row count.

### Live DB table inventory (72 tables in `public`)

```
activity_feed_items            approvals                      audit_events
auth_account                   auth_session                   auth_user
auth_verification              billing_packages               change_orders
compliance_records             conversation_participants      conversations
cost_codes                     daily_log_amendments           daily_log_crew_entries
daily_log_delays               daily_log_issues               daily_log_photos
daily_logs                     data_exports                   document_links
documents                      draw_line_items                draw_requests
integration_connections        invitations                    lien_waivers
messages                       milestone_dependencies         milestones
notifications                  organization_certifications    organization_licenses
organization_subscriptions     organization_users             organizations
payment_transactions           project_organization_memberships project_user_memberships
projects                       punch_item_comments            punch_item_photos
punch_items                    purchase_order_lines           purchase_orders
retainage_releases             rfi_responses                  rfis
role_assignments               saved_reports                  schedule_of_values
selection_categories           selection_decisions            selection_items
selection_options              sov_line_items                 sso_providers
stripe_customers               submittal_documents            submittal_transmittals
submittals                     subscription_invoices          subscription_plans
sync_events                    two_factor                     upload_requests
user_notification_preferences  users                          vendors
webhook_events                 weekly_report_sections         weekly_reports
```

### Migrations

**23 migration files checked in** at `src/db/migrations/`:

```
0001_org_settings_fields.sql              0013_submittal_reviewer_invitations.sql
0002_org_security_and_compliance_metadata.sql  0014_document_categories.sql
0003_client_profile_fields.sql            0015_document_categories_backfill.sql
0004_stripe_billing.sql                   0016_document_versioning.sql
0005_require_2fa_org.sql                  0017_milestone_gantt.sql
0006_data_exports.sql                     0018_weekly_reports.sql
0007_sso_providers.sql                    0019_fk_naming_normalization.sql
0008_notifications.sql                    0020_procurement.sql
0009_daily_logs.sql                       0021_drop_stale_po_status_enum.sql
0010_project_coordinates.sql              0022_retainage_schedule.sql
0011_punch_list.sql                       0023_saved_reports.sql
0012_submittals.sql
```

**Migration tracking status:** `drizzle.__drizzle_migrations` journal has
zero rows; there is no `meta/_journal.json`. Live schema was applied via
`db:push` — these `.sql` files are a hand-written history, not a
journalled migration inventory. New tables in this repo's daily workflow
get applied either via `db:push` or by executing the `.sql` directly
against the DB (the approach used for `saved_reports` on 2026-04-20 to
avoid `db:push` proposing unrelated FK drop/re-adds on truncated-name
constraints — a known drizzle-kit quirk called out in
[`CLAUDE.md`](../../CLAUDE.md)).

### Schema-writing conventions

- FK constraint naming uses the long form
  `{srcTable}_{srcCol}_{refTable}_{refCol}_fk`
  (documented in [`CLAUDE.md`](../../CLAUDE.md) — `db:push` introspection
  fails if the short form is used).
- All tables with mutable state carry `created_at` + `updated_at` from
  `timestamps` in `_shared.ts`.
- UUID primary keys throughout.

---

## D. App routes (actual)

Four top-level groups: `(auth)`, `(portal)`, `api`, plus `reviewer/`,
`receipts/`, `no-portal/`, `test/`, root `page.tsx`.

### `(auth)` — 7 pages

`forgot-password`, `invite/[token]`, `login`, `reset-password`,
`select-portal`, `signup`, `signup/contractor`, `welcome`.

### `(portal)/contractor` — global routes

`approvals`, `billing`, `budget`, `change-orders`, `compliance`,
`cost-codes`, `dashboard`, `documents`, `messages`, `notifications`,
`payment-tracking`, `reports`, `retainage`, `rfis`,
`settings` (+ `integrations`, `invitations`, `payments`), `upload-requests`,
`vendors`.

Under `contractor/project/[projectId]`:
`approvals`, `billing`, `change-orders`, `compliance`, `daily-logs`
(incl. `[logId]`), `documents`, `financials`, `messages`, `payments`,
`procurement`, `punch-list`, `rfis`, `schedule`, `selections`,
`submittals`, `upload-requests`, `weekly-reports`.

### `(portal)/subcontractor`

Global: `compliance`, `daily-logs` (incl. `[logId]`), `documents`,
`messages`, `notifications`, `payments`, `rfis`, `schedule`, `settings`,
`today`, `upload-requests`.

Project-scoped: `compliance`, `daily-logs/[logId]`, `documents`,
`financials`, `messages`, `payments`, `punch-list`, `rfis`, `schedule`,
`submittals`, `upload-requests`.

### `(portal)/commercial`

Global: `notifications`, `settings`.
Project-scoped: `approvals`, `billing`, `change-orders`, `contracts`,
`daily-logs` (incl. `[logId]`), `documents`, `messages`, `payments`,
`photos`, `progress`, `schedule`, `weekly-reports`.

### `(portal)/residential`

Global: `notifications`, `settings`.
Project-scoped: `billing`, `budget`, `confirmed-choices`, `decisions`,
`documents`, `journal` (incl. `[logId]`), `messages`, `progress`,
`schedule`, `scope-changes`, `selections`, `walkthrough-items`,
`weekly-reports`.

### `(portal)/client` (shared)

`project/[projectId]` with `schedule` sub-route.

### `api/`

Route families below (each often has nested `[id]/{action}` subroutes):

`approvals`, `auth`, `avatar`, `change-orders`, `compliance`,
`contractor/stripe/connect`, `conversations`, `daily-log-amendments`,
`daily-log-crew-entries`, `daily-log-photos`, `daily-logs`, `documents`,
`draw-requests`, `export/{payment,photos,reports}`, `files`,
`integrations`, `invitations`, `lien-waivers`, `milestones`,
`notifications`, `oauth/[provider]`,
`org/{certifications,exports,imports,invitations,licenses,logo,members,profile,security,sso,subscription}`,
`payments/manual`, `procurement/{cost-codes,purchase-orders,vendors}`,
`punch-item-photos`, `punch-items`, `retainage-releases`,
`reviewer/[token]`, `rfis`, `search`, `selections`,
`signup/contractor-bootstrap`, `sov`, `submittal-documents`, `submittals`,
`upload-requests`, `upload/{request,finalize}`,
`user/{delete,notifications,preferences,profile,sessions}`,
`webhooks/[provider]`, `webhooks/stripe`,
`weekly-reports/{[reportId],generate}`.

### Public non-portal routes

- `reviewer/[token]` — external SSO-less reviewer entry (submittals).
- `receipts/[paymentTransactionId]` — public receipt page.
- `no-portal`, `test/upload`, `welcome` (auth layout).

---

## E. Domain layer

### `src/domain/loaders/*.ts` — 49 files

| File | Loads |
|---|---|
| `approvals.ts` | Contractor + client approvals with enrichment. |
| `ar-aging.ts` | AR aging by client org + days-past-due buckets + 8-week trend.  **[new 2026-04-20]** |
| `audit-log.ts` | Audit-event stream surface. |
| `billing.ts` | Shared billing loaders. |
| `cashflow.ts` | 12-week projection from draws + POs + waivers + retainage. **[new 2026-04-20]** |
| `change-order-format.ts` | Shared CO formatters. |
| `change-orders.ts` | Contractor + client CO lists. |
| `client-context.ts` | Client-portal auth/project context. |
| `commercial-daily-logs-page.ts` | Commercial daily-logs page data. |
| `commercial-photos.ts` | Commercial progress photo feed. |
| `compliance-report.ts` | Contractor compliance report (expiring + sub matrix). **[new 2026-04-20]** |
| `contractor-daily-logs-page.ts` | Contractor daily-logs page data. |
| `contractor-dashboard.ts` | Contractor dashboard KPIs + feed. |
| `cross-project-payments.ts` | Portfolio payment tracking (inbound + outbound). |
| `cross-project.ts` | Shared cross-project helpers. |
| `daily-logs.ts` | Per-log detail view. |
| `data-exports.ts` | Data-export queue + status. |
| `documents.ts` | Project documents view (list + supersession). |
| `financial.ts` | Sub/contractor financials view. |
| `integrations.ts` | Integration connections + provider catalog. |
| `invitations.ts` | Org invitations. |
| `job-cost.ts` | Per-project budget/committed/actual/projected. **[new 2026-04-20]** |
| `labor-report.ts` | Hours + crew days + per-project trade composition. **[new 2026-04-20]** |
| `lien-waiver-report.ts` | Waiver log by draw + sub. |
| `messages.ts` | Project messages view. |
| `notifications.ts` | Notification feed + preferences. |
| `org-owner-context.ts` | Org-owner settings context. |
| `organization-members.ts` | Org member roster. |
| `organization-profile.ts` | Org profile + security settings. |
| `payments.ts` | Payment transactions loader. |
| `portals.ts` | `loadUserPortalContext` + `portalHref`. |
| `procurement.ts` | POs + vendors + cost codes. |
| `project-home.ts` | Project home views per portal. |
| `punch-list.ts` | Punch item workspace. |
| `reports.ts` | Reports dashboard root — composes 13 child slices. |
| `residential-journal-page.ts` | Residential journal page (daily-logs analog). |
| `saved-reports.ts` | Saved reports library. **[new 2026-04-20]** |
| `schedule-performance.ts` | Schedule performance (SPI + planned/actual). **[new 2026-04-20]** |
| `schedule.shared.ts` | Pure schedule formatters. |
| `schedule.ts` | Schedule view loader. |
| `search.ts` | Global search. |
| `selections.ts` | Contractor + residential selections workspaces. |
| `subcontractor-compliance.ts` | Sub-portal compliance snapshot. |
| `subcontractor-daily-logs-page.ts` | Sub-portal daily logs. |
| `subcontractor-today.ts` | Today board data. |
| `submittals.ts` | Submittal workspace. |
| `user-settings.ts` | User profile + preferences + sessions. |
| `weekly-reports-residential.ts` | Residential weekly reports. |
| `weekly-reports.ts` | Contractor/commercial weekly reports. |
| `wip.ts` | WIP schedule. **[new 2026-04-20]** |

### Authorization

Still lives in:

- `src/domain/permissions.ts` — `POLICY` map + `buildPermissions`,
  `assertCan`, `AuthorizationError`.
- `src/domain/context.ts` — `getEffectiveContext(session, projectId)`
  single gate.
- `src/domain/policies/plan.ts` — **new since April 16:** plan-feature
  gating (reads `organization_subscriptions.plan_id`).

Plus `src/domain/audit.ts`, `src/domain/activity.ts`,
`src/domain/system-user.ts`.

### Side-effect modules

New folders under `src/domain/`:

- `domain/documents/` — document operations (supersession, auth-time
  gating).
- `domain/procurement/` — PO state machine.
- `domain/schedule/` — milestone + dependency mutations.

### Auth (`src/auth/`)

- `config.ts` — Better Auth + Drizzle adapter + `databaseHooks` for
  domain-user sync and session denormalization. Still email+password
  only; `sendResetPassword` still prints reset URL to console.
- `client.ts` — Better Auth React client.
- SAML SSO supported via `samlify` — schema table `sso_providers`,
  routes under `api/org/sso/providers`.

---

## F. Components and shell

Structure under `src/components/`:

```
button.tsx           card.tsx            charts/          coming-soon.tsx
data-table.tsx       documents-ui.tsx    documents-workspace.tsx
empty-state.tsx      financial-view.tsx  gantt/           kpi-card.tsx
marketing/           messages-ui.tsx     messages-workspace.tsx
modal.tsx            notifications/      pill.tsx
portfolio-filters.tsx schedule-ui.tsx    settings/        shell/
```

- **`charts/`** — `AgingBarChart.tsx` + index. Reports-specific charts
  still live inline in `reports-ui.tsx` (cashflow, cost tracks, SPI,
  labor, Gantt strip).
- **`gantt/`** — `FrappeGantt.tsx` + `ScheduleGanttPanel.tsx` wrapping
  `frappe-gantt`.
- **`notifications/notifications-page.tsx`** — shared notification
  workspace.
- **`settings/settings-shell.tsx`** — shared shell for all 4 portal
  settings experiences (gated by `view.portalType`).
- **`shell/`** — `AppShell.tsx`, `app-shell.css`, `coming-soon.tsx`.
- **`portfolio-filters.tsx`** — new since April 16, shared filter bar for
  cross-project workspaces (payment tracking, approvals, reports).

CSS architecture: `src/styles/components.css`, `src/styles/workspaces.css`,
`app-shell.css`. All inline `dangerouslySetInnerHTML` style blocks remain
extracted. No regression.

---

## G. Jobs, storage, integrations

### `src/jobs/` — 6 Trigger.dev v3 tasks (was 1)

- `integration-sync-event-cleanup.ts` — prune old `sync_events` rows.
- `integration-token-refresh.ts` — renew OAuth tokens before expiry.
- `integration-webhook-processor.ts` — process inbound webhook events.
- `stripe-payment-reconciliation.ts` — reconcile manual/Stripe payments
  against draw requests.
- `upload-request-reminder.ts` — daily overdue reminder (original).
- `weekly-report-generation.ts` — generate weekly reports on schedule.

`trigger.config.ts` at repo root.

### Storage (`src/lib/storage.ts`)

Unchanged — R2 via `@aws-sdk/client-s3` + presigner. Exports `r2`,
`R2_BUCKET`, `buildStorageKey`, `presignUploadUrl`, `presignDownloadUrl`,
`objectExists`, `getObjectSize`.

### `src/lib/` (expanded since April 16)

```
audit-categories.ts       daily-logs/          document-categories.ts
env.ts                    exports/             format/
format-file-size.ts       ganttAdapter.ts      geocoding/
imports/                  integrations/        notification-catalog.ts
notifications/            pdf/                 portal-colors.ts
portal-nav-counts.ts      portal-nav.ts        portal-shell.ts
punch-list/               redis.ts             reports/            saml/
storage.ts                stripe.ts            submittals/
weather/                  weekly-reports/
```

New since April 16: `daily-logs/`, `exports/`, `format/`,
`geocoding/`, `imports/`, `integrations/`, `notifications/`, `pdf/`,
`punch-list/`, `reports/`, `saml/`, `submittals/`, `weather/`,
`weekly-reports/`, plus `audit-categories.ts`, `document-categories.ts`,
`ganttAdapter.ts`, `notification-catalog.ts`, `portal-nav-counts.ts`,
`stripe.ts`.

### Integrations

- **Stripe is real now.** `stripe` SDK installed, `src/lib/stripe.ts`
  exists, Stripe Connect onboarding routes live under
  `/api/contractor/stripe/connect/*`, `/api/webhooks/stripe` processes
  real events, subscriptions + Connect payments + draw charges all wired.
  Schema additions: `stripe_customers`, `subscription_plans`,
  `organization_subscriptions`, `subscription_invoices`.
- **SAML SSO** via `samlify` + `samlify-node-xmllint`. Per-org SSO
  provider rows in `sso_providers`.
- **Other providers** (QuickBooks, Xero, Sage, Postmark, SendGrid,
  Google Calendar, Outlook) still catalog metadata only.
  `sendResetPassword` still logs to console — no email provider wired.

---

## H. Reports page state (2026-04-20)

All **13 reports** in the contractor Reports hub consume real data. Loader
composition lives in `src/domain/loaders/reports.ts` and each child slice
is `try/catch`-isolated so one failure doesn't black out the page.

| Report | Loader |
|---|---|
| Overview | `reports.ts` (composed directly) |
| WIP Schedule | `wip.ts` |
| AR Aging | `ar-aging.ts` |
| Job Cost | `job-cost.ts` |
| Cashflow Projection | `cashflow.ts` |
| Payment Tracking | `cross-project-payments.ts` |
| Schedule Performance | `schedule-performance.ts` |
| Compliance | `compliance-report.ts` |
| Labor & Productivity | `labor-report.ts` (hours-only) |
| Weekly Reports | `weekly-reports.ts` |
| Lien Waiver Log | `lien-waiver-report.ts` |
| Procurement / POs | `procurement.ts` |
| Saved Reports | `saved-reports.ts` |

Seed-data scaffolding for reports has been **fully removed** —
`reports-seed.ts` no longer exists.

Several reports ship with documented approximations (WIP %, Job Cost
budget, Labor cost, etc.). See
[`production_grade_upgrades/reports_wiring_running_list.md`](production_grade_upgrades/reports_wiring_running_list.md)
for the audit-phase catalog.

---

## I. Documentation inventory

### `docs/specs/` — all files

| File | Type |
|---|---|
| `Build_Execution_Checklist.pdf` | PDF |
| `Engineering_Architecture_Layer.pdf` | PDF |
| `First_Implementation_Slice_Spec.pdf` | PDF |
| `Phase_A_Architecture_Foundation.pdf` | PDF |
| `Residential_Selections_Mechanics_Spec.pdf` | PDF |
| `Schema_Draft_V1.pdf` | PDF |
| `Technical_Architecture_Prep.pdf` | PDF |
| `Tier_2_Construction_Portal_Deep_Research_Report.pdf` | PDF |
| `builtcrm_2026_gap_analysis.md` | MD — competitive research |
| `builtcrm_commercial_client_daily_logs.jsx` | JSX (misfiled) |
| `builtcrm_commercial_client_settings.jsx` | JSX (misfiled) |
| `builtcrm_contractor_daily_logs.jsx` | JSX (misfiled) |
| `builtcrm_contractor_reports_v4.jsx` | JSX (misfiled) |
| `builtcrm_contractor_settings.jsx` | JSX (misfiled) |
| `builtcrm_marketing_website.jsx` | JSX (misfiled) |
| `builtcrm_master_module_map.md` | MD — module inventory |
| `builtcrm_phase4_plus_implementation_plan.md` | MD — full enterprise plan (reference) |
| `builtcrm_phase4_portfolio_scope.md` | MD — **active Phase 4+ plan** |
| `builtcrm_procurement_workflow.jsx` | JSX (misfiled) |
| `builtcrm_punch_list_workflow_paired.jsx` | JSX (misfiled) |
| `builtcrm_residential_client_daily_logs.jsx` | JSX (misfiled) |
| `builtcrm_residential_client_settings.jsx` | JSX (misfiled) |
| `builtcrm_settings_shared_shell.jsx` | JSX (misfiled) |
| `builtcrm_subcontractor_daily_logs.jsx` | JSX (misfiled) |
| `builtcrm_subcontractor_settings.jsx` | JSX (misfiled) |
| `builtcrm_walkthrough_items_residential.jsx` | JSX (misfiled) |
| `builtcrm_weekly_reports_paired.jsx` | JSX (misfiled) |
| `commercial_client_project_home.html` | HTML (misfiled) |
| `current_repo_state_2026-04-16.md` | MD — prior snapshot |
| `current_repo_state_2026-04-20.md` | MD — this file |
| `handoff_2026-04-17_settings_wire-up.md` | MD — session handoff |
| `integration_architecture_spec.md` | MD |
| `phase_1_build_guide.md` | MD |
| `phase_3_build_guide.md` | MD |
| `phase_4plus_build_guide.md` | MD — Phase 4+ execution guide |
| `production_grade_upgrades/` | folder — see below |
| `project_status_tracking_updated.md` | MD |
| `residential_billing_draw_review.html` | HTML (misfiled) |
| `residential_client_project_home.html` | HTML (misfiled) |

### `docs/specs/production_grade_upgrades/` — new since April 20

Holding folder for architectural upgrades identified during Phase 4+
wiring as pragmatic approximations that need to be promoted into real
production-grade work after Phase 4+ wraps.

```
README.md                                  folder purpose + index
wip_cost_based_percent_complete.md         full spec for WIP cost-based % complete
reports_wiring_running_list.md             seed list of other gaps from reports pass
```

### `docs/design/` — 25 HTML mockups

Unchanged from April 16.

### `docs/prototypes/` — 23 JSX files

Unchanged from April 16.

### `docs/schema/` — 5 prototype schema TS files

Unchanged from April 16. Still reference only; canonical schema is
`src/db/schema/*.ts`.

### `docs/handoff_notes/` — 2 files

- `step17_messages.md`
- `step18_documents.md`

### `docs/archive/` — empty.

---

## J. Known drift between plans and reality

1. **HANDOFF.md is stale.** Still says "Phase 3 Complete" as the working
   state; should be rewritten or archived. The authoritative state lives
   in [`builtcrm_phase4_portfolio_scope.md`](builtcrm_phase4_portfolio_scope.md)
   and [`phase_4plus_build_guide.md`](phase_4plus_build_guide.md).
2. **Migration tracking:** `drizzle.__drizzle_migrations` is empty. The
   23 `.sql` files in `src/db/migrations/` are hand-written history, not
   a journalled inventory. Schema is applied via `db:push` or direct
   SQL execution. Reconciliation path still deferred.
3. **CLAUDE.md counts:** Claims "24 HTML files" in `docs/design/` and
   "24 JSX prototypes" in `docs/prototypes/`. Actual: **25 HTML, 23 JSX.**
   Plus the Project Structure section still lists schema as "5 files"
   (prototype layout), when the canonical live schema is 22 TS files in
   `src/db/schema/`.
4. **Contractor cross-project redirect shims:** `approvals`,
   `payment-tracking`, `retainage`, `budget`. Some now resolve to real
   pages (e.g., `payment-tracking` has a live workspace). Verify each on
   next sweep.
5. **Misfiled JSX + HTML in `docs/specs/`:** 12+ `.jsx` files and 3
   `.html` files belong in `docs/prototypes/` or `docs/design/`. Count
   has grown since April 16 as new feature prototypes were dropped into
   the specs folder.
6. **`.env.example` vs. `src/lib/env.ts`:** Still potentially out of
   sync — zod-validated env shape has grown with Stripe, SAML,
   integrations secrets.
7. **Orphan enums:** `purchase_order_status` legacy enum cleanup handled
   by migration 0021. No other orphans known at snapshot time.

---

## K. Environment & config

**Config files (all in repo root):**

| File | Notes |
|---|---|
| `package.json` | See section B. |
| `package-lock.json` | Present. |
| `tsconfig.json` | Unchanged. |
| `next.config.mjs` | Minimal. |
| `drizzle.config.ts` | Targets `./src/db/migrations` (present). |
| `tailwind.config.ts` | Tailwind v4. |
| `postcss.config.mjs` | Present. |
| `trigger.config.ts` | Present. |
| `vitest.config.ts` | Present. |
| `.env.example` | Present. |
| `.env.local` | Present. |
| `.env.test` / `.env.test.example` | Present. |

**Scripts (`package.json`):**

```
dev             next dev
build           next build
start           next start
lint            next lint
db:generate     drizzle-kit generate   (via node --env-file=.env.local)
db:migrate      drizzle-kit migrate    (no journal exists — see drift note)
db:push         drizzle-kit push       (primary workflow; interactive TTY required)
db:seed         tsx src/db/seed.ts
trigger:dev     npx trigger.dev@3 dev
trigger:deploy  npx trigger.dev@3 deploy
test            vitest run
test:watch      vitest
```

**Tests (`tests/`):** Unchanged — `access.test.ts`, `draws.test.ts`,
`uploads.test.ts`, plus helpers + fixtures. Coverage hasn't caught up
with the full Phase 4+ surface.

**Other top-level folders:** `.claude/`, `.next/`, `.trigger/`,
`scripts/list-ids.ts`, `public/marketing.html`.

---

## Critical files to read when starting a new session

- [`CLAUDE.md`](../../CLAUDE.md) — tech stack + conventions + Phase 4+
  rules + FK-naming note.
- [`docs/specs/builtcrm_phase4_portfolio_scope.md`](builtcrm_phase4_portfolio_scope.md) —
  active Phase 4+ plan (source of truth).
- [`docs/specs/phase_4plus_build_guide.md`](phase_4plus_build_guide.md) —
  step-by-step execution guide.
- [`docs/specs/production_grade_upgrades/README.md`](production_grade_upgrades/README.md) —
  production-grade upgrade catalog (seeded by reports-wiring pass).
- `src/db/schema/index.ts` — live schema barrel (22 files → 70+ tables).
- `src/domain/context.ts` — authorization gate.
- `src/domain/permissions.ts` — policy map.
- `src/domain/policies/plan.ts` — plan-feature gating.
- `src/auth/config.ts` — Better Auth setup.
- `src/domain/loaders/reports.ts` — reports composition root (13 slices).
