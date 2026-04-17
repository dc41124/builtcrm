# BuiltCRM — Current Repo State

**Repo path:** `c:\Users\David Cardona\Desktop\builtcrm\`
**As of:** April 16, 2026
**Compiled from:** direct filesystem inspection. No outside sources. This writeup is designed to be handed off to a separate Claude chat so it can align external project-folder documents with the actual repo state.

---

## A. Snapshot

- **Branch:** `main`
- **Git user:** `dc41124 <dc41124@gmail.com>`
- **Last 5 commits (oldest-first):**
  1. `3436128` Step 16: Responsive layout — mobile, tablet, desktop breakpoints
  2. `10999eb` Step 17: Polish pass — loading, error, empty states, transitions, typography audit
  3. `23bbfd0` Update HANDOFF.md — Phase 3 complete with all deferred items documented
  4. `8146203` Phase 4+ setup: add portfolio scope doc, gap analysis, full plan; archive Phase 2 session handoffs
  5. `87056c6` Step 0: Update CLAUDE.md for Phase 4+ execution rules ← HEAD
- **Phase claim:** `HANDOFF.md` header says **"Status: Phase 3 Complete"** with an 18-step checklist all marked Done plus a 15/15 pre-audit cleanup list. CLAUDE.md has been updated with Phase 4+ execution rules but **HANDOFF.md has not been re-written for Phase 4+** — it still describes Phase 3 as the current finish line. The repo is sitting at the inflection point between "Phase 3 shipped" and "Phase 4+ about to start."

---

## B. Tech stack as actually installed

From `package.json` (source of truth):

### Production dependencies

| Package | Version |
|---|---|
| `@aws-sdk/client-s3` | ^3.670.0 |
| `@aws-sdk/s3-request-presigner` | ^3.670.0 |
| `@trigger.dev/sdk` | ^3.3.0 |
| `@upstash/redis` | ^1.34.3 |
| `better-auth` | ^1.0.0 |
| `drizzle-orm` | ^0.41.0 |
| `nanoid` | ^5.0.7 |
| `next` | ^14.2.15 |
| `postgres` | ^3.4.5 |
| `react` | ^18.3.1 |
| `react-dom` | ^18.3.1 |
| `zod` | ^3.23.8 |

### Dev dependencies

| Package | Version |
|---|---|
| `@tailwindcss/postcss` | ^4.2.2 |
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

### Notable absences for claimed/implied features

- **No `stripe` SDK.** Integration catalog lists Stripe Connect as a provider; `payment_transactions` table has `stripe_payment_intent_id`/`stripe_charge_id`/`stripe_transfer_id` columns; nothing imports `stripe`.
- **No QuickBooks / Xero / Sage / Postmark / SendGrid / Google Calendar / Outlook / Microsoft Graph SDKs.** All eight providers in the `integration_provider` enum are catalog metadata only. Password-reset logs the reset link to server console (`src/auth/config.ts` line 36) because no email provider is wired.
- **No PDF generation library** (no `pdfkit`, `puppeteer`, `@react-pdf/renderer`). HANDOFF deferred list mentions payment-report PDF and photo-batch zip exports.
- **No WebSocket / SSE library.** Real-time typing indicators and presence dots deferred.
- **No Playwright / testing-library UI.** Only Vitest (unit-test oriented).
- **Tailwind v4** installed but `tailwind.config.ts` still exists (2609 bytes) — non-trivial config despite v4's config-less approach.
- **Next.js 14,** not Next 15.

---

## C. Database schema (actual)

### Schema files under `src/db/schema/`

```
_shared.ts        shared timestamp columns helper
index.ts          barrel re-export
identity.ts       users, orgs, memberships, role assignments, invitations
auth.ts           Better Auth tables (auth_user, auth_session, auth_account, auth_verification)
projects.ts       projects, project org + user memberships, milestones
documents.ts      documents, document_links
workflows.ts      upload_requests, compliance, RFIs + responses, change_orders, approvals
billing.ts        billing_packages, SOV, SOV line items, draw_requests, draw line items, lien_waivers, retainage_releases
messaging.ts      conversations, conversation_participants, messages
selections.ts     selection_categories, selection_items, selection_options, selection_decisions
integrations.ts   integration_connections, sync_events, payment_transactions, webhook_events
audit.ts          activity_feed_items, audit_events
```

### Table inventory by file

| File | Table | Purpose |
|---|---|---|
| identity.ts | `users` | Domain user (separate from auth_user; joined via `auth_user.app_user_id`). |
| identity.ts | `organizations` | Contractor / sub / client-company / household / internal-platform orgs. |
| identity.ts | `organization_users` | User ↔ org membership with status + job title. |
| identity.ts | `role_assignments` | Which portal + role a user has inside an org. |
| identity.ts | `invitations` | Email invitations with token, status, expiry, project scope. |
| auth.ts | `auth_user` | Better Auth user (links to domain user via `app_user_id`). |
| auth.ts | `auth_session` | Session; denormalizes `appUserId`, `organizationId`, `role`, `portalType`, `clientSubtype`. |
| auth.ts | `auth_account` | OAuth / password provider account. |
| auth.ts | `auth_verification` | Email-verification / password-reset tokens. |
| projects.ts | `projects` | Core project row (contract value, address, phase, status). |
| projects.ts | `project_organization_memberships` | Sub/consultant/client org attached to a project. |
| projects.ts | `project_user_memberships` | Per-user-per-project access with phase/work scope + access state. |
| projects.ts | `milestones` | Scheduled dates (inspection, delivery, walkthrough, custom). |
| documents.ts | `documents` | File metadata (storage key, visibility, audience, size, status). |
| documents.ts | `document_links` | Polymorphic link from document to any workflow object. |
| workflows.ts | `upload_requests` | Contractor request for a file. |
| workflows.ts | `compliance_records` | COI / WSIB entries per org with expiry. |
| workflows.ts | `rfis` | Request-for-information with `rfi_type` (formal/issue). |
| workflows.ts | `rfi_responses` | Response rows for an RFI. |
| workflows.ts | `change_orders` | CO with schedule + cost impact. |
| workflows.ts | `approvals` | Generic approval (design/procurement/change_order/other). |
| billing.ts | `billing_packages` | Grouping wrapper for draw + supporting docs. |
| billing.ts | `schedule_of_values` | Versioned SOV header. |
| billing.ts | `sov_line_items` | SOV line with scheduled value + retainage %. |
| billing.ts | `draw_requests` | Per-period draw with review state. |
| billing.ts | `draw_line_items` | Per-draw per-SOV-line progress + this-period amount. |
| billing.ts | `lien_waivers` | Waiver status per draw / sub. |
| billing.ts | `retainage_releases` | Partial/final retainage release request. |
| messaging.ts | `conversations` | Threaded project/RFI/CO/approval/direct threads. |
| messaging.ts | `conversation_participants` | Who's in the thread + last-read marker. |
| messaging.ts | `messages` | Individual message with optional attached document. |
| selections.ts | `selection_categories` | Residential selection categories per project. |
| selections.ts | `selection_items` | An item to decide within a category. |
| selections.ts | `selection_options` | Options per item with tier. |
| selections.ts | `selection_decisions` | Client's chosen option per item with confirmation state. |
| integrations.ts | `integration_connections` | Per-org connection to a catalog provider. |
| integrations.ts | `sync_events` | Push/pull/reconciliation log per connection. |
| integrations.ts | `payment_transactions` | Stripe-shaped transaction ledger (fields present, not populated). |
| integrations.ts | `webhook_events` | Inbound/outbound webhook delivery + retry state. |
| audit.ts | `activity_feed_items` | Project activity surface rows (feed/homepage/notification). |
| audit.ts | `audit_events` | Immutable audit log (actor, object, prev/next state JSON). |

**Total: 36 domain tables + 4 Better Auth tables = 40.**

### Migrations

**There is no migrations folder.** `drizzle.config.ts` points `out` at `./src/db/migrations`, but that directory does not exist. Schema is applied via `drizzle-kit push` (direct to Neon) rather than versioned SQL migration files. HANDOFF: "Neon has all schema changes applied (36 tables + 2 mods)." `db:generate` script defined but no generated `.sql` files are checked in.

### Tables referenced in plans but not in schema

`weekly_reports`, `drawings`, `inspections`, `meeting_minutes`, `transmittals`, `closeout_packages`, `bids`, `prequalifications`, `purchase_orders`, `time_tickets`, `daily_logs`, `punch_list_items`, `photos`. None exist. A `purchase_order_status` enum is declared in `billing.ts` at line 44 but no `purchase_orders` table — orphan enum.

---

## D. App routes (actual)

All under `src/app/`. Three top-level groups: `(auth)`, `(portal)`, `api`. Plus `no-portal/`, `test/`, root `page.tsx`.

```
src/app/
├── page.tsx                          root: marketing if signed-out, portal redirect if in
├── layout.tsx                        root layout
├── global-error.tsx                  global error boundary
├── not-found.tsx                     404
├── globals.css
├── test/upload/page.tsx              dev-only upload tester
├── no-portal/page.tsx                signed-in-but-no-role dead-end
│
├── (auth)/
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── signup/page.tsx + signup-form.tsx
│   ├── forgot-password/page.tsx      (console-logs reset link)
│   ├── reset-password/page.tsx
│   ├── welcome/page.tsx
│   ├── select-portal/page.tsx        (multi-portal user disambiguator)
│   └── invite/[token]/page.tsx       (invitation acceptance)
│
├── (portal)/
│   ├── contractor/
│   │   ├── layout.tsx + page.tsx (redirect shim, ComingSoon fallback)
│   │   ├── (global)/
│   │   │   ├── layout.tsx + loading.tsx + error.tsx
│   │   │   ├── dashboard/           real
│   │   │   ├── messages/            real (shared MessagesPanel)
│   │   │   ├── documents/           real (shared DocumentsPanel)
│   │   │   ├── compliance/          real
│   │   │   ├── rfis/                real
│   │   │   ├── change-orders/       real
│   │   │   ├── upload-requests/     real
│   │   │   ├── billing/             real
│   │   │   ├── approvals/           REDIRECT SHIM (→ first project)
│   │   │   ├── payment-tracking/    REDIRECT SHIM
│   │   │   ├── retainage/           REDIRECT SHIM
│   │   │   ├── budget/              REDIRECT SHIM
│   │   │   └── settings/
│   │   │       ├── page.tsx                 real
│   │   │       ├── organization/page.tsx    REDIRECT SHIM (→ /contractor/settings)
│   │   │       ├── team/page.tsx            ComingSoon stub
│   │   │       ├── invitations/page.tsx     real
│   │   │       └── integrations/            real (page.tsx + integrations-ui.tsx)
│   │   └── project/[projectId]/
│   │       ├── layout.tsx + page.tsx + workspace-card.tsx
│   │       ├── rfis, change-orders, approvals, compliance, upload-requests,
│   │       │   billing, selections, schedule, financials, documents, messages (all real)
│   │       └── payments/page.tsx            ComingSoon stub
│   │
│   ├── subcontractor/
│   │   ├── layout.tsx + page.tsx (ComingSoon fallback)
│   │   ├── (global)/
│   │   │   ├── layout.tsx + loading.tsx + error.tsx
│   │   │   ├── today, messages, documents, schedule, compliance,
│   │   │   │   rfis, upload-requests, payments (all real)
│   │   │   ├── team/page.tsx                ComingSoon stub
│   │   │   └── settings/page.tsx            ComingSoon stub
│   │   └── project/[projectId]/
│   │       ├── layout.tsx + page.tsx + project-home-workspace.tsx
│   │       ├── rfis, compliance, upload-requests, schedule, financials,
│   │       │   messages, documents (all real)
│   │       └── payments/page.tsx            ComingSoon stub
│   │
│   ├── commercial/
│   │   ├── layout.tsx + page.tsx (redirect to first project or ComingSoon)
│   │   └── project/[projectId]/
│   │       ├── layout.tsx + page.tsx
│   │       ├── approvals, change-orders, billing, payments, photos,
│   │       │   progress, documents, messages, schedule (all real)
│   │       └── contracts/page.tsx           ComingSoon stub
│   │
│   ├── residential/
│   │   ├── layout.tsx + page.tsx (redirect or ComingSoon)
│   │   └── project/[projectId]/
│   │       ├── layout.tsx + page.tsx
│   │       └── selections, decisions, scope-changes, billing, budget,
│   │           schedule, progress, documents, messages, confirmed-choices
│   │
│   └── client/project/[projectId]/
│       ├── page.tsx (shared client workspace)
│       ├── approvals-ui.tsx, draw-review-ui.tsx, retainage-releases-ui.tsx,
│       │   selections-ui.tsx
│       └── schedule/page.tsx
│
└── api/
    ├── auth/[...all]/route.ts              Better Auth catch-all
    ├── upload/request + upload/finalize
    ├── files/[documentId]                   presigned download
    ├── upload-requests/ (CRUD + submit/revise/complete)
    ├── rfis/ (create + respond/close/reopen)
    ├── change-orders/ (CRUD + submit/approve/reject/void)
    ├── approvals/ (CRUD + submit/approve/reject/revise)
    ├── compliance/ (CRUD + submit/accept/reject/waive)
    ├── sov/ (CRUD + activate/lock + line-items CRUD)
    ├── draw-requests/ (CRUD + submit/start-review/approve/approve-with-note/
    │                   return/mark-paid/revise/line-items)
    ├── lien-waivers/[id]/{submit,accept,reject,waive}
    ├── retainage-releases/ (CRUD + submit/approve/reject)
    ├── selections/ (categories, items, options, decisions — CRUD +
    │                items/publish + items/reopen + decisions/confirm)
    ├── conversations/ (list + messages + read-state)
    ├── documents/[id]/ (route + supersede)
    ├── milestones/ (list + per-id)
    ├── integrations/ (connect + [id] + [id]/disconnect + export)
    └── invitations/ (list + accept)
```

**Stub / redirect summary:**
- **ComingSoon placeholders:** `contractor/settings/team`, `subcontractor/settings`, `subcontractor/team`, `commercial/project/[id]/contracts`, `contractor/project/[id]/payments`, `subcontractor/project/[id]/payments`, plus portal-index fallbacks.
- **Redirect shims (4 contractor globals):** `approvals`, `payment-tracking`, `retainage`, `budget` redirect to first-project pages. Plus `settings/organization` redirects to `/contractor/settings`.

---

## E. Domain layer

### `src/domain/loaders/*.ts`

| File | Loads |
|---|---|
| `approvals.ts` | Contractor + client approval lists with enrichment (doc links + activity trail). |
| `change-order-format.ts` | Shared formatters (status pill, date, signed cents). |
| `change-orders.ts` | Contractor + client CO lists. |
| `commercial-photos.ts` | Commercial project progress photo feed. |
| `contractor-dashboard.ts` | Cross-project contractor dashboard KPIs and feed. |
| `documents.ts` | Project documents view (list + supersession groups). |
| `financial.ts` | Contractor + sub financial view (currently hardcodes `pendingFinancialsCents: 0` for subs). |
| `integrations.ts` | Contractor integrations view + `PROVIDER_CATALOG` + CSV export builder. |
| `invitations.ts` | Org invitations list + token loader + acceptability check. |
| `messages.ts` | Project messages view. |
| `portals.ts` | `loadUserPortalContext` (drives `/select-portal` + root dispatch) + `portalHref` helper. |
| `project-home.ts` | Contractor / sub / client project-home views + helpers. |
| `schedule.shared.ts` | Pure formatters. |
| `schedule.ts` | Schedule/timeline view (milestones + computed countdowns). |
| `selections.ts` | Contractor + residential selections workspaces. |
| `subcontractor-today.ts` | Today board data for sub portal. |

### Authorization

**No `src/domain/policies/` directory.** Authorization lives in:
- `src/domain/permissions.ts` — `POLICY` map (16 resource types × read/write/approve × EffectiveRole set) + `buildPermissions`, `assertCan`, `AuthorizationError`.
- `src/domain/context.ts` — `getEffectiveContext(session, projectId)` is the single gate every loader/action calls. Resolves user + org + project + explicit project_user_membership (or contractor-org-staff fallback), collapses `role_key` into one of five `EffectiveRole` values, returns `{user, organization, project, role, permissions, membership}`.

Plus `src/domain/audit.ts` and `src/domain/activity.ts` (audit-event writer and activity-feed writer).

### Auth (`src/auth/`)

- **`config.ts`** — Better Auth setup. Drizzle adapter, email+password only (no OAuth), `autoSignIn: true`, minPassword 8, 7-day sessions, 5-min cookie cache. Custom `databaseHooks`: on user create, mint/link a domain `users` row by email; on session create, look up primary `role_assignment` and denormalize `organizationId`, `role`, `portalType`, `clientSubtype` onto session. `sendResetPassword` prints URL to server console (no email provider wired). Exports `resolvePortalPath(session)` mapping portalType+clientSubtype to `/contractor | /subcontractor | /commercial | /residential | /no-portal`.
- **`client.ts`** — 14-line Better Auth React client with `signIn`, `signUp`, `signOut`, `useSession` re-exports.

---

## F. Components and shell

**Shell:** `src/components/shell/AppShell.tsx` + `src/components/shell/app-shell.css` + `src/components/shell/coming-soon.tsx`.

`AppShell.tsx` is a `"use client"` component handling:
- Sidebar (NavSection[] with per-section collapse, before/after-projects placement)
- Project list with status dots (green/amber/red/gray) + active highlight
- Topbar with auto-derived breadcrumbs (via `SEGMENT_LABELS`)
- Theme toggle logic — toggle **removed from topbar** per HANDOFF, code retained for future settings item
- Sign-out wired to `signOut` from `@/auth/client`
- Responsive breakpoints (desktop / tablet / mobile collapsing sidebar)
- Imports `PORTAL_ACCENTS` + `PortalType` from `src/lib/portal-colors.ts`

**Other components in `src/components/`:**

| File | Purpose |
|---|---|
| `coming-soon.tsx` (top-level copy) | Legacy ComingSoon wrapper (shell/coming-soon.tsx is the active one). |
| `messages-ui.tsx` | Client-side messages panel. |
| `documents-ui.tsx` | Client-side documents panel. |
| `financial-view.tsx` | Shared financial view widget. |
| `documents-workspace.tsx` | Richer documents page workspace. |
| `messages-workspace.tsx` | Richer messages workspace. |
| `schedule-ui.tsx` | Timeline/schedule renderer. |
| `button.tsx`, `pill.tsx`, `empty-state.tsx`, `kpi-card.tsx`, `modal.tsx`, `card.tsx`, `data-table.tsx` | Primitives. |
| `marketing/marketing-page.tsx` | Marketing landing page (rendered by root `page.tsx` when signed out). |

**CSS architecture** per HANDOFF: `src/styles/components.css`, `src/styles/workspaces.css`, `app-shell.css`. All inline `dangerouslySetInnerHTML` style blocks extracted during pre-audit cleanup (43 files consolidated). 98 `@media` rules total. `src/lib/portal-colors.ts` is single source for the four portal accent hex codes.

---

## G. Jobs, storage, integrations

**`src/jobs/`** contains exactly one Trigger.dev v3 task:
- `upload-request-reminder.ts` — `schedules.task` running cron `0 13 * * *` (13:00 UTC = ~9am ET). Queries open upload_requests past due, de-dupes against Upstash Redis set `reminders:upload-requests:overdue-sent`, writes `activity_feed_items` rows with `surface_type: 'notification_source'` and `activity_type: 'project_update'`. **No outbound channel** (email/SMS/push) invoked — just activity feed. `trigger.config.ts` exists at root.

**Storage (`src/lib/storage.ts`):** Configured and functional. `@aws-sdk/client-s3` + `s3-request-presigner` pointed at Cloudflare R2 (`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, region `auto`). Exports: `r2` client, `R2_BUCKET`, `buildStorageKey` (layout: `{orgId}/{projectId}/{documentType}/{timestamp}_{filename}`), `presignUploadUrl` (5-min default), `presignDownloadUrl` (60-sec default), `objectExists`, `getObjectSize`. `src/lib/env.ts` requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` via zod; app throws at import time if missing. Seed photos uploaded as SVG placeholders.

**Other `src/lib/`:**

| File | Purpose |
|---|---|
| `env.ts` | zod-validated env shape (DATABASE_URL, BETTER_AUTH_*, R2_*, TRIGGER_DEV_API_KEY, UPSTASH_*). |
| `redis.ts` | Upstash Redis client. |
| `portal-shell.ts` | `loadPortalShell(portalType)` used by redirect-shim pages + layouts. |
| `portal-nav.ts` | Nav section definitions. |
| `portal-colors.ts` | Accent color hex codes per portal. |
| `format-file-size.ts` | Bytes → human string. |

**Integrations scaffolding:**
- **Enums:** `integration_provider` (8 providers), `integration_connection_status`, `sync_direction`, `sync_event_status`, `payment_method_type`, `payment_transaction_status`, `webhook_direction`, `webhook_delivery_status`.
- **Provider catalog:** 8 entries in `PROVIDER_CATALOG` (src/domain/loaders/integrations.ts line 120): Postmark, SendGrid, QuickBooks Online, Xero, Sage Business Cloud, Stripe Connect, Google Calendar, Outlook/Microsoft 365. Each has `phase1: boolean` — only `postmark` and `sendgrid` flagged `phase1: true`; the other six are catalog-only.
- **Wired state:** Every provider stubbed. `/api/integrations/connect` creates `integration_connections` row with `connection_status: 'connecting'` and writes audit event. **No OAuth flow, no token exchange, no sync.** `/api/integrations/export` produces CSV export for listed entity types (the only real data path).
- `sync_events`, `payment_transactions`, `webhook_events` tables exist but nothing in `src/` writes to them apart from the CSV export path.

---

## H. Phase completeness per HANDOFF.md

HANDOFF.md claims **Phase 3 complete, all 18 steps Done, 15/15 pre-audit cleanup items Done.**

**Done per HANDOFF (condensed):**
- Steps 0–5: CLAUDE.md update, styling infrastructure, shared shell, core component lib, portal route groups, auth pages.
- Step 6: Client onboarding wizard.
- Step 7: Contractor dashboard.
- Step 8: Contractor project home.
- Steps 9a–g: RFIs, change orders, approvals, compliance, uploads, billing, selections workflow pages.
- Steps 10a–d: Shared messages, documents, schedule, financials pages.
- Step 11: Subcontractor portal (today board + project home).
- Step 12: Client portals (commercial + residential).
- Step 13: Contractor settings + integrations.
- Step 14: Marketing website with article overlays.
- Step 15: Dark mode (theme toggle, system preference, localStorage). **Toggle removed from topbar; code retained for future settings item.**
- Step 16: Responsive layout. 98 `@media` rules total.
- Step 17: Polish pass. 7 `loading.tsx`, 7 `error.tsx`, `global-error.tsx`, `not-found.tsx`, focus-visible rings, transitions. Zero `console.log`, zero TS errors.

**Pre-audit cleanup 15/15:** next/link migration, style consolidation, inline create panels, multi-file upload, `file_size_bytes` tracking, approvals/RFIs/compliance loader enrichment, `rfi_type` schema+UI, `dangerouslySetInnerHTML` extraction to CSS, residential decisions nav link, empty-state audit, realistic seed data. **Item 11 (`const now = Date.now()` hydration sweep) explicitly DEFERRED** (low risk, no visible bugs).

**Seed density per HANDOFF:** 28 RFIs, 20 change orders, 12 draw requests + lien waivers, 12 selection categories + 16 items + 40 options + 10 decisions, 67 messages / 19 threads, 110 documents, 105 activity items, 15 upload requests, 20 compliance records.

**Deferred items flagged in HANDOFF:**
- `tradeScope` field on `SubPaymentRollupRow`
- Sub-scoped financials: `pendingFinancialsCents` hardcoded 0
- Nav badge counts: `getPortalNavCounts()` not built
- `weekly_reports` table for PM-authored narratives (not built)
- Hydration `Date.now()` sweep
- Payment-report PDF export, photo-batch zip, receipt-link export endpoints
- Billing workspace "Package Documents" buttons (UI-only placeholders)
- Contractor cross-project approvals + payment-tracking aggregate pages (currently redirect shims)
- Dark-mode toggle relocation into settings
- Subcontractor org-admin pages (Team, Settings) — ComingSoon stubs
- Contractor settings prototype line-by-line audit
- Real-time typing indicator + presence dots (needs WebSocket/SSE)

---

## I. Documentation inventory

### `docs/specs/` — all files

| File | Size | Type |
|---|---|---|
| `Build_Execution_Checklist.pdf` | 907 KB | PDF |
| `Engineering_Architecture_Layer.pdf` | 1.66 MB | PDF |
| `First_Implementation_Slice_Spec.pdf` | 1.06 MB | PDF |
| `Phase_A_Architecture_Foundation.pdf` | 1.39 MB | PDF |
| `Residential_Selections_Mechanics_Spec.pdf` | 864 KB | PDF |
| `Schema_Draft_V1.pdf` | 1.54 MB | PDF |
| `Technical_Architecture_Prep.pdf` | 1.74 MB | PDF |
| `Tier_2_Construction_Portal_Deep_Research_Report.pdf` | 2.89 MB | PDF |
| `builtcrm_2026_gap_analysis.md` | 32.6 KB | MD — competitive research catalog |
| `builtcrm_marketing_website.jsx` | 58.7 KB | JSX (misfiled — prototype sitting in specs/) |
| `builtcrm_master_module_map.md` | 21.6 KB | MD — full module inventory |
| `builtcrm_phase4_plus_implementation_plan.md` | 39.4 KB | MD — full enterprise plan (reference only) |
| `builtcrm_phase4_portfolio_scope.md` | 49.3 KB | MD — **active Phase 4+ plan, source of truth** |
| `commercial_client_project_home.html` | 38.2 KB | HTML (misfiled in specs/) |
| `integration_architecture_spec.md` | 27.6 KB | MD |
| `phase_1_build_guide.md` | 27.2 KB | MD |
| `phase_3_build_guide.md` | 44.7 KB | MD |
| `phase_4plus_build_guide.md` | 209 KB / 4624 lines | MD — Phase 4+ execution guide |
| `project_status_tracking_updated.md` | 18.9 KB | MD |
| `residential_billing_draw_review.html` | 29.5 KB | HTML (misfiled in specs/) |
| `residential_client_project_home.html` | 43.4 KB | HTML (misfiled in specs/) |

### `docs/design/` — 25 HTML mockups

`approvals_workflow`, `billing_draw_client_review`, `change_orders_workflow`, `client_onboarding_flow`, `commercial_client_portal_pages`, `compliance_workflow_paired`, `contractor_project_home`, `contractor_settings_integrations`, `documents_file_management_shared`, `login_auth_flow`, `marketing_website`, `messages_conversations_shared`, `payment_financial_view_shared`, `phase_1_design_system_shared_shell__1_`, `phase_2_contractor_dashboard`, `phase_3_billing_draw_workspace`, `residential_client_portal_pages`, `residential_selections_flow`, `rfi_workflow_paired`, `schedule_timeline_shared`, `selections_management_contractor`, `subcontractor_project_home`, `subcontractor_today_board`, `subcontractor_today_board_project_home`, `upload_requests_workflow_paired`.

### `docs/prototypes/` — 23 JSX files

Files named `builtcrm_<feature>.jsx`. Mirror design HTML one-for-one except: no `builtcrm_marketing_website.jsx` (misfiled in specs/), `phase_1_design_system_shared_shell` maps to `builtcrm_design_system_shell.jsx`, no JSX twin for `subcontractor_project_home.html` (only combined `subcontractor_today_board_project_home.jsx`).

### `docs/schema/` — 5 prototype schema TS files

| File | Size | Content |
|---|---|---|
| `drizzle_schema_first_pass.ts` | 21.2 KB | Tables 1–15 (identity, projects, docs, workflows, billing, compliance, audit) |
| `drizzle_schema_v2_additions.ts` | 18.3 KB | Tables 16–22 (RFIs, change orders, milestones, conversations, messages) |
| `drizzle_schema_phase3_billing.ts` | 24.8 KB | Tables 23–28 (SOV, draws, lien waivers, retainage) |
| `drizzle_schema_remaining_gaps.ts` | 18.7 KB | Tables 29–32 + mods (invitations, selections) |
| `drizzle_schema_phase4_integrations.ts` | 24.6 KB | Tables 33–36 (integrations, sync, payments, webhooks) |

These are **prototype/reference** schema files. Canonical live schema is `src/db/schema/*.ts`.

### `docs/handoff_notes/` — 2 files

- `step17_messages.md` (4.9 KB)
- `step18_documents.md` (7.2 KB)

### `docs/archive/` — empty directory.

---

## J. Known drift between plans and reality

1. **Schema docs vs. live schema:** CLAUDE.md "Project Structure" says schema lives in `docs/schema/` (5 files). True for prototypes. **Actual live schema** is `src/db/schema/*.ts` (12 files). HANDOFF phrasing "36 tables + 2 mods across 5 files" describes the prototype layout, not live code.
2. **No migrations folder:** `drizzle.config.ts` targets `./src/db/migrations` and `db:generate`/`db:migrate` scripts exist, but directory doesn't exist. Schema pushed directly to Neon via `db:push`. No versioned migration history.
3. **CLAUDE.md counts mismatch:** Claims "24 HTML files" in `docs/design/` and "24 JSX prototypes" in `docs/prototypes/`. Actual: 25 HTML, 23 JSX.
4. **Contractor cross-project redirect shims:** Payment-tracking, retainage, budget, approvals (cross-project) contractor pages exist in sidebar nav but resolve to redirect shims pointing at first project's project-scoped page. Plans/HANDOFF flag as deferred — matches reality, but routes are live and will surprise readers expecting ComingSoon.
5. **Subcontractor team + settings:** ComingSoon stubs. HANDOFF explicitly flags "Subcontractor org-admin pages (Team, Settings)" as not built.
6. **Stripe schema without SDK:** `payment_transactions` table has 3 `stripe_*` columns + `net_amount` check constraint suggesting Stripe integration path, but **no Stripe SDK installed** and no code writes to the table. Schema-first scaffolding only.
7. **Orphan `purchase_order_status` enum:** Declared in `billing.ts` at line 44, no `purchase_orders` table exists.
8. **`.env.example` out of sync with `src/lib/env.ts`:** Example lists `R2_BUCKET` and `TRIGGER_SECRET_KEY`; app requires `R2_BUCKET_NAME` and `TRIGGER_DEV_API_KEY`.
9. **Misfiled docs in `docs/specs/`:** `builtcrm_marketing_website.jsx` belongs in `docs/prototypes/`; three HTML files (`commercial_client_project_home`, `residential_billing_draw_review`, `residential_client_project_home`) belong in `docs/design/`.
10. **HANDOFF.md doesn't reflect Phase 4+ start:** Still describes Phase 3 as the current finish line. CLAUDE.md's Phase 4+ execution rules were added most recent commit without HANDOFF being updated.

---

## K. Environment & config

**Config files (all in repo root):**

| File | Size | Notes |
|---|---|---|
| `package.json` | 1.5 KB | See section B. |
| `package-lock.json` | 423 KB | Present. `node_modules` present. |
| `tsconfig.json` | 576 B | |
| `tsconfig.tsbuildinfo` | 559 KB | Incremental TS build cache. |
| `next.config.mjs` | 228 B | Minimal. |
| `drizzle.config.ts` | 494 B | Targets `./src/db/migrations` (dir does not exist). |
| `tailwind.config.ts` | 2.6 KB | Tailwind v4. |
| `postcss.config.mjs` | 70 B | |
| `trigger.config.ts` | 429 B | |
| `vitest.config.ts` | 418 B | |
| `.gitignore` | 68 B | |
| `.env.example` | 239 B | See below. |
| `.env.local` | 750 B | Present (secrets). |
| `.env.test` | 789 B | |
| `.env.test.example` | 668 B | |

**`.env.example` variable names:**

```
DATABASE_URL=postgres://user:pass@host/db
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TRIGGER_SECRET_KEY=
```

**Drift:** `src/lib/env.ts` zod schema requires `R2_BUCKET_NAME`, `TRIGGER_DEV_API_KEY`, and `BETTER_AUTH_SECRET` (min 32 chars). `.env.example` lists `R2_BUCKET` and `TRIGGER_SECRET_KEY`. Example is out of sync with app.

**Scripts (`package.json`):**

```
dev             next dev
build           next build
start           next start
lint            next lint
db:generate     drizzle-kit generate   (via node --env-file=.env.local)
db:migrate      drizzle-kit migrate
db:push         drizzle-kit push        (actually used)
db:seed         tsx src/db/seed.ts
trigger:dev     npx trigger.dev@3 dev
trigger:deploy  npx trigger.dev@3 deploy
test            vitest run
test:watch      vitest
```

**Tests (`tests/`):** `access.test.ts`, `draws.test.ts`, `uploads.test.ts`, plus `fixtures/seed.ts`, `helpers/{audit,request,session}.ts`, `global-setup.ts`, `setup.ts`. Three concrete test files covering access control, draws, and uploads.

**Other top-level folders:** `.claude/` (settings), `.next/` (build cache), `.trigger/` (Trigger.dev state), `scripts/list-ids.ts` (dev helper), `public/marketing.html` (static fallback).

---

## Critical files to read when starting Phase 4+ work

- `CLAUDE.md`
- `HANDOFF.md`
- `docs/specs/builtcrm_phase4_portfolio_scope.md` (active plan)
- `docs/specs/phase_4plus_build_guide.md` (execution guide)
- `src/db/schema/index.ts` (live schema barrel)
- `src/domain/context.ts` (authorization gate)
- `src/domain/permissions.ts` (policy map)
- `src/auth/config.ts` (Better Auth setup)
