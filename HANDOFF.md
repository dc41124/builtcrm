# BuiltCRM audit — handoff to next chat

## Context

Multi-portal construction PM SaaS. Doing a line-by-line fidelity audit of every
page against its JSX prototype in `docs/prototypes/`. Rewriting pages to match
the prototype exactly — icons, copy, spacing, colors, section structure.

Read `CLAUDE.md` at the repo root for tech stack + conventions.

---

## What's done (13 prototypes)

1. **`builtcrm_design_system_shell.jsx`** → `src/components/shell/AppShell.tsx`
   - Inline org name + slash + workspace switcher in sidebar header, search
     field, folder icons on sections, active-item accent dot, Projects as
     toggleable module, sign-out button in footer
   - Auto-derived breadcrumbs from `usePathname()` + portal type + projects
     list, tree item stagger animation on section open, Settings section
     renders after Projects (via `placement: "after-projects"` on NavSection)

2. **`builtcrm_contractor_dashboard.jsx`** →
   `src/app/(portal)/contractor/dashboard/`
   - Loader extended with `financialHealth`, `approvalsWaiting`,
     `approvalsAsPriorities`, `recentMessages`
   - KPI icons, Financial Health strip with segmented bar, tabbed Priorities
     card, Approvals waiting, Recent activity, Quick health, Recent messages

3. **`builtcrm_contractor_project_home.jsx`** →
   `src/app/(portal)/contractor/project/[projectId]/`
   - Loader extended with `activity` feed + `unreadConversationCount`
   - Hero 2-col (main + snapshot card), context pills, key contacts strip,
     summary strip, `workspace-card.tsx` client component with 9-tab workspace,
     right rail (blockers/milestones/quick access)

4. **`builtcrm_approvals_workflow.jsx`** (3 portals) — full visual rewrite
   - Rounded pill tabs, bordered queue cards, grey-header sections, detail
     header border, Commercial's "What it blocks" cell using `CATEGORY_BLOCKS`
     map, Commercial 3-button decision, residential simple `.sc` summary cards
   - Commit 2 (loader work for real supporting docs + activity trail) deferred

5. **`builtcrm_rfi_workflow_paired.jsx`** (contractor + subcontractor)
   - Loader extended with `assignedToOrganizationName` (join to `organizations`)
   - Rounded pill tabs, bordered queue cards with tag chips, detail 2×2 grid,
     grey-header sections, synthesized tracking activity, inline create panel,
     right rail variants per portal

6. **`builtcrm_change_orders_workflow.jsx`** (3 portals) — full visual rewrite
   - Commit 2 done: schema added `change_orders.schedule_impact_days`, loader
     extended with `supportingDocuments[]` + `activityTrail[]`. All three
     portals wired to real data.

7. **`builtcrm_compliance_workflow_paired.jsx`** (contractor + subcontractor)
   - Contractor side: full rewrite with `.cmp-sc` summary cards, pill tabs,
     bordered queue cards, detail 2×2 grid, synthesized verify checklist,
     review decision nested card, restriction control, right rail
   - Subcontractor side: single-column `.rq-row` requirements list with detail
     pane rendered below (no master-detail split), amount hero-less layout,
     upload zone, right rail (restriction risk + payment hold + how it works)

8. **`builtcrm_upload_requests_workflow_paired.jsx`** (contractor + sub)
   - **Commit 1 + Commit 2 both done**
   - Commit 1: inline create panel (contractor), `.urw-sc` KPI cards,
     segmented tabs, `.urw-qp` queue card with search, 2-col detail with
     right rail. Sub mirrors with Upload Files button in the header action
     slot + SVG upload zone + optional Response Note textarea
   - **Commit 2 schema change:** added `upload_requests.response_note text`
     column (was run via raw SQL in Neon dev, not via drizzle push — see
     "DB state" below)
   - Submit endpoint (`/api/upload-requests/[id]/submit`) accepts optional
     `responseNote`
   - Loader: new shared `UploadRequestRow` + `UploadRequestFile` +
     `UploadRequestActivityEvent` types, `loadUploadRequestEnrichment()`
     helper does batched uploader-name lookups + `activity_feed_items` join
     filtered to `related_object_type = 'upload_request'`
   - UI: real submittedFile metadata, activity trail with color-coded dots,
     response note renders below the file when present

9. **`builtcrm_billing_draw_workspace.jsx`** + **`builtcrm_billing_draw_client_review.jsx`** + **`docs/specs/residential_billing_draw_review.html`** — **all three billing surfaces done**

   **Contractor** (`billing-workspace.tsx`, 690-line file):
   - Header pills + action buttons (Export PDF / Save draft / Submit for review)
   - Queue: bordered cards with gap, thin scrollbar, accent ring selection
   - Bottom grid 2-col → 3-col with **Package Documents** card
   - AIA G702 9-item grid + G703 10-col table kept intact
   - Commit 2: Package Documents card wired to real `supportingFiles[]`

   **Commercial** (`billing-review.tsx`) — **fully re-spec'd to match prototype
   after initial pass missed the container structure**:
   - Full rewrite: `.bcr-workspace` single bordered card containing
     `.bcr-ws-head` + `.bcr-ws-tabs` (pill-style "Needs my review / Approved
     / Returned") + `.bcr-master-detail` (340px queue + detail) inside the
     same card
   - Queue: `.bcr-draw-card` with mono "Draw 06" ID + multi-line desc +
     4-tag row + footer; custom sort select in `.bcr-queue-toolbar`
   - G702 simplified to **4-item** strip (Contract sum / Work complete /
     Retainage / Current due highlighted — NOT the contractor's 9-item AIA)
   - G703 simplified to 5 cols (Description / Scheduled / This period /
     Total / %)
   - Detail sections use bordered `.bcr-ds` containers with grey
     `.bcr-ds-head` bars + body padding — G702, G703, Lien waivers,
     Supporting files, Your decision all wrapped the same way
   - Lien waivers: colored dot + org name (joined from
     `lien_waivers.organization_id` → `organizations.name`, added to
     `LienWaiverRow.organizationName`) + status-derived label + Received/
     Pending/Missing pill
   - Decision: wrapped in `.bcr-ds` with `Action required` header pill,
     intro copy, 3-option card grid with prototype's full option descriptions,
     nested `.bcr-decision-compose` box with title + conditional textarea
     + Submit/Cancel buttons
   - Right rail `.bcr-rail` with 4 cards: Decision needed (alert), Contract
     snapshot (5 `.bcr-file-row` rows label/sub/value), Recent activity
     (wired to `selected.activityTrail`), Review principle (info variant)
   - All custom CSS classes match prototype naming exactly — no leftover
     `.bcr-section` / `.bcr-kpis` / `.bcr-row` from the first pass
   - Hydration-safe: `const [now] = useState(() => Date.now())`, no `>`
     child combinators anywhere in inline styles

   **Residential** (`residential/.../billing/billing-review.tsx`, NEW file,
   built from `docs/specs/residential_billing_draw_review.html` since the
   client-review prototype doesn't cover residential):
   - Single-draw-focused layout (no tabs, no queue) — picks the first
     `under_review` / `submitted` draw as the "current" payment
   - `.rbr-hero` amount hero: big $ value + description + `.rbr-status-pill`
     (30px, clock SVG icon) on the right
   - 2-col `.rbr-layout` (main + 320px rail)
   - Main: "What this payment covers" (line-item rows filtered to
     `workCompletedThisPeriodCents > 0` + Total this payment footer),
     `.rbr-dec` teal-bordered decision card (Approve this payment primary
     with CheckIcon + Ask a question first secondary with MessageIcon +
     textarea + teal "What happens when you approve?" explainer callout),
     Supporting documents list with type-colored file icons (.pdf red,
     .img blue, .doc teal) + Download button per row
   - Rail: Budget context (progress bar + paid/this/after/remaining rows),
     Past payments (filtered to approved/paid draws), Questions? (PM
     contact placeholder)
   - Decision flow wired to `/api/draw-requests/[id]/approve` (or
     `approve-with-note` when note present) and `/return` for "Ask a
     question first". Approve button flips to `.done` green state after
     success, matching the prototype's state swap
   - All `.rbr-pl` + `.rbr-status-pill` custom pill classes defined
     (no Pill component used)
   - `/residential/project/[id]/billing/page.tsx` rewired from `ComingSoon`
     → `getClientProjectView` + `ResidentialBillingReview`

10. **`builtcrm_payment_financial_view_shared.jsx`** →
    `src/components/financial-view.tsx` (was already built before this
    session; audited and brought to spec)
    - Fonts already matched portal (`var(--fd)` / `var(--fb)` / `var(--fm)`)
    - Added contractor header action buttons (Export Report with DownloadIcon,
      New Draw Request with FileIcon)
    - Added `View all` mini-button to Draw History section head
    - Added `Request Release` mini-button to Retainage Summary section head
    - `SectionHead` component now accepts optional `action` slot
    - Subcontractor "Your Contract Summary" grid re-labelled to match
      prototype: Contract Value / Total Earned (accent) / Total Paid /
      Remaining (warn)
    - **Contractor `asOfLabel` now includes approval date**: walks both
      approved-unpaid AND paid draws, tracks `latestApprovedDrawAt` (prefers
      `reviewedAt`, falls back to `paidAt`), formats as
      `"As of Draw #N · Approved Mon D, YYYY"`. New private `formatAsOfDate`
      helper in the loader.
    - **Sub scope line**: `SubcontractorFinancialView` gained a top-level
      `scopeLabel: string | null` field. New query at the top of the sub
      loader fetches `project_organization_memberships.work_scope` for the
      current `{projectId, orgId}` pair. Sub card meta renders
      `{orgName} — {scopeLabel} scope` (omits the suffix when scope is
      null), matching the prototype's "Meridian MEP — Mechanical, Electrical
      & Plumbing scope" pattern.

---

## What's left in the audit (prototypes not yet touched)

**Client portals (likely next):**
- `builtcrm_commercial_client_portal_pages.jsx` — commercial client pages
  (progress, photos, schedule, documents, messages, etc.). **Large
  multi-page file.**
- `builtcrm_residential_client_portal_pages.jsx` — residential pages
  (progress & photos, schedule, budget, documents, messages). Also large.
- `builtcrm_residential_selections_flow.jsx` — residential selections
  (already has `selections-review.tsx` — audit needed)

**Subcontractor:**
- `builtcrm_subcontractor_today_board_project_home.jsx` — **user said: use
  THIS file for both the sub today board AND project home, not the older
  `builtcrm_subcontractor_today_board.jsx` file.**

**Shared:**
- `builtcrm_messages_conversations_shared.jsx` → messaging pages across all
  4 portals (share a loader via `src/components/messages-ui.tsx` /
  `messages-workspace.tsx`)
- `builtcrm_documents_file_management_shared.jsx` → documents pages across
  all 4 portals (`documents-ui.tsx` / `documents-workspace.tsx`)
- `builtcrm_schedule_timeline_shared.jsx` → schedule/timeline view across
  portals (`schedule-ui.tsx`)

**Contractor-only:**
- `builtcrm_selections_management_contractor.jsx` → contractor selections
  management (`selections-ui.tsx`)
- `builtcrm_contractor_settings_integrations.jsx` → contractor settings +
  integrations pages

**Entry / standalone:**
- `builtcrm_login_auth_flow.jsx` → login / signup / password reset flow
- `builtcrm_client_onboarding_flow.jsx` → client onboarding / invite
  acceptance flow

---

## Deferred follow-ups (tracked)

### Approvals Commit 2 (loader work)
- Extend `src/domain/loaders/approvals.ts` `ApprovalRow` with
  `supportingDocuments[]` (join `document_links` where `linked_object_type
  = 'approval'`) + `activityTrail[]` (join `activity_feed_items` where
  `related_object_type = 'approval'`)
- Wire into contractor `approvals-workspace.tsx` Tracking + Supporting
  documents sections, and commercial `approvals-review.tsx` Supporting
  documents section
- Pattern: identical to the upload-requests / change-orders / billing-draw
  enrichment helpers

### RFIs Commit 2 (loader work)
- `activityTrail[]` from `activity_feed_items` with `related_object_type =
  'rfi'`
- `referenceFiles[]` from `document_links` with `linked_object_type = 'rfi'`
- Move response-time stats (avg response time, first-reply resolution %)
  from client-side compute into loader
- **Schema question**: prototype distinguishes "Formal RFI" from "Issue".
  Schema has no `rfi_type` field. Decide whether to add it or keep
  everything as formal.

### Compliance Commit 2 (loader work)
- `supportingFile` with real document metadata (join `documents` via
  `documentId` to get file name, uploader, upload time instead of
  `documentId.slice(0, 8)`)
- `activityTrail[]` for the Recent activity right-rail card (both
  contractor and subcontractor sides)
- Verify checklist: currently synthesized via `verifyItemsFor()` keyed off
  `complianceType`. Real verification items would need a new
  `compliance_verification_items` table OR a JSON column on
  `compliance_records`. Low priority.

### Financial view follow-ups
- **Contractor Subcontractor Payment Status rows**: prototype shows a trade
  line per sub row ("Mechanical · Electrical · Plumbing"). Loader's
  `SubPaymentRollupRow` doesn't expose a scope/trade field. Pattern to
  follow: join `project_organization_memberships.work_scope` into the
  sub-payments query the same way we did for the sub view's top-level
  `scopeLabel`, expose as `tradeScope` on the row type, and render it
  under the org name in `.fv-sub-main`.
- Subcontractor view is using it via the top-level `view.scopeLabel` field.

### Nav badge counts (end of audit)
`NavItem` supports `badge` + `badgeType: "default" | "warn" | "danger"`,
CSS is fully styled, but `src/lib/portal-nav.ts` never passes any values.

**Plan:** at the very end of the audit, build one shared
`getPortalNavCounts(portalType, orgId, userId, projectId)` per portal that
returns all badge values in one round-trip (approvals pending, RFIs open,
unread messages, compliance issues, draws needing review, upload requests
open, etc.), then pass through `loadPortalShell` → `buildNavSections`. Do
NOT do this mid-audit.

### `const now = Date.now()` hydration sweep
We've fixed this in approvals, RFIs, compliance (both sides), upload
requests (both sides), billing (commercial), financial. Still watch for it
in any newly-touched file with a "use client" directive that computes
"days ago" / "overdue by N days". Fix pattern:
`const [now] = useState(() => Date.now())` so the value is frozen on first
render.

Also watch for `>` child combinators in inline `<style>` blocks — Next.js
serializes `>` to `&gt;` in some cases, causing hydration mismatches on
any selector like `.foo>span`. Always use descendant combinators
(`.foo span`) or add a class to the target (`.foo-p` on a `<p>` tag).

### Residential nav `/decisions` link
The residential sidebar's "Decisions" section labels are "Scope changes" +
"Confirmed choices" in `src/lib/portal-nav.ts`. The `/decisions` route
exists (`src/app/(portal)/residential/project/[projectId]/decisions/`) and
is used as the residential-language equivalent of approvals, but the
sidebar never links to it. Add a "Decisions needed" link to the Decisions
section pointing to `${base}/decisions`. Small change; do during
residential portal audit or as a cleanup pass.

### Contractor approvals cross-project page
`src/app/(portal)/contractor/approvals/page.tsx` is still a `ComingSoon`
placeholder. The approvals prototype doesn't cover the cross-project queue
— leave as ComingSoon until there's a spec.

### Contractor cross-project payment-tracking page
`src/app/(portal)/contractor/payment-tracking/page.tsx` + sub equivalent
are 5-line ComingSoon stubs. The real financial view lives at
`/{portal}/project/[projectId]/financials`. Decide later whether to wire
the cross-project aggregator or rename/remove.

### Billing workspace: contractor Package Documents buttons
The `Attach file` and `Submit for review` buttons in the contractor
billing workspace's Package Documents card are UI-only. There's no
matching API endpoint yet to attach a document to a draw or trigger
submission. Wire when draw submission workflow lands.

### Relative href bugs
Watch for any `<Link href="something">` without a leading slash in new
pages — resolves against the current URL and will 404 or feed a garbage
`projectId` to a dynamic route. Always use `${base}/...` where
`base = /${portal}/project/${projectId}`.

---

## DB state

- Neon dev branch has been pushed through **change-orders Commit 2** schema
  addition (`schedule_impact_days`) via `npm run db:push`.
- **Upload requests `response_note` column** was added via raw SQL in the
  Neon SQL editor, NOT via `drizzle-kit push`. `drizzle-kit push` tried to
  drop+recreate several unrelated FK constraints (cosmetic FK name drift
  across `project_org_memberships`, `project_user_memberships`,
  `retainage_releases`, `sync_events`, `upload_requests`'s org FK) — user
  opted to run `ALTER TABLE upload_requests ADD COLUMN response_note text;`
  directly instead. **Next `db:push` will still want to rename those FK
  constraints.** It's cosmetic and safe to run when convenient, but be
  aware the diff will look larger than just the new column.

## Working conventions we've established

1. **Audit format**: read prototype + current code, produce a structural
   audit comparing them, propose Commit 1 (visual/structural with existing
   data) + Commit 2 (loader/schema work) split, get user approval, then
   execute.

2. **Tab style varies per prototype**:
   - Approvals / RFIs / change orders / compliance / upload requests
     → rounded pill tabs (`.wtab`)
   - Dashboard → full-width underline strip
   - Upload requests → segmented grey-chip tabs (`.tabs`/`.tab`)
   - Commercial billing workspace → pill tabs (`.bcr-tab`) inside the
     workspace card
   - Always check the specific prototype before assuming.

3. **Queue cards**: workflow queues use bordered rounded cards with gap,
   not divider rows. Active state = accent border + tinted background +
   `0 0 0 3px color-mix(in srgb, var(--ac) 15%, transparent)` ring. Add
   a `.hot` variant with danger border for urgent rows.

4. **Detail pane sections**: wrap content in bordered containers with a
   **grey header bar** (`background: var(--s2)`, `border-bottom: 1px solid
   var(--s3)`) containing the h4 title + optional right-side action
   buttons/pills, and a separate body for padded content. Compliance
   `.cmd-section` / upload-requests `.urd-rhdr` / billing `.bcr-ds-head`
   all follow this pattern.

5. **Detail header**: bottom border separating from the grid
   (`padding-bottom: 14px; border-bottom: 1px solid var(--s2)`).

6. **2×2 detail grid**: `.{prefix}-cell` / `.k` / `.v` / `.m` pattern with
   `background: var(--s2)` / `border: 1px solid var(--s3)` /
   `border-radius: var(--r-m)`. Use `.v.warn` / `.v.ok` / `.v.danger` /
   `.v.accent` color variants for sensitive values.

7. **Thin scrollbar**: `::-webkit-scrollbar { width: 4px }` + transparent
   track + `var(--s4)` thumb on any vertically-scrolling queue or list.

8. **Hydration-safe `now`**: `const [now] = useState(() => Date.now())`
   in all "use client" workflow components that compute relative times.

9. **Inline create panels, not modals** — **EXCEPT for billing draw
   workspace** (user explicitly kept the contractor draw flow as a
   New Draw Request button in the header, no create modal built yet).

10. **Remove duplicate crumb lines** from every page header — the shell's
    auto-derived breadcrumbs handle it now.

11. **Buttons default to white background with grey border**, not grey
    background. Use `.{prefix}-btn` custom style when `Button` component's
    secondary variant looks grey in context.

12. **KPI icons**: pass inline SVG `icon` prop to `KpiCard` (hourglass,
    alert triangle, check circle, dollar, etc.) — OR use prototype's
    `.sc` simple bordered cards with `.strong/.alert/.danger/.success`
    variants for summary strips, which is the newer pattern used in
    compliance, billing, upload requests.

13. **Commit split**: always propose Commit 1 (visual, no schema/loader
    changes) + Commit 2 (loader work). Get user go-ahead on both. They
    commit on their end between each.

14. **Typecheck after each file**: `npx tsc --noEmit` must pass clean
    before reporting the file as done.

15. **Client portals are project-scoped.** Commercial + residential portals
    use nested layouts at `{portal}/project/[projectId]/layout.tsx` that
    render `AppShell` — the parent `{portal}/layout.tsx` is a passthrough.
    Contractor + subcontractor render the shell at the top-level portal
    layout because they have non-project pages. **Do not add `AppShell` at
    the parent commercial/residential layout** — it was broken that way
    originally (sidebar nav was empty).

16. **Loader enrichment pattern**: when Commit 2 needs
    `supportingDocuments[]` + `activityTrail[]` for a new object type, copy
    the helper pattern from `loadUploadRequestEnrichment` (in
    `src/domain/loaders/project-home.ts`) or `loadDrawRequestEnrichment`
    (same file, for draws). Both do batched `document_links` + `documents`
    + `activity_feed_items` + `users` joins filtered by
    `linked_object_type` / `related_object_type` strings and return
    `Map<objectId, rows>` for merging into the row shape.

17. **Font tokens**: always use `var(--fd)` (DM Sans display), `var(--fb)`
    (Instrument Sans body), `var(--fm)` (JetBrains Mono) — never hardcode
    Google font strings. Weight floor 520, KPI values 820, card titles
    720, page titles 820/26px (24px on client portals).

18. **Webpack cache ENOENT warning** (Windows-only): harmless warning in
    the terminal about renaming `.next/cache/webpack/client-development/*.pack.gz_`
    files — OneDrive/antivirus locking temp files. Fix: stop dev server,
    `rm -rf .next`, restart. Permanent fix (not yet applied) would be
    `config.cache = { type: "memory" }` in `next.config.ts` under `webpack
    (config, { dev })` — trades slower cold starts for no more warnings.

---

## Starting the next chat

Open the next chat with:
> "Continuing the BuiltCRM audit. Read HANDOFF.md at the repo root and
> CLAUDE.md, then start on {next prototype}."

The fresh chat should load `CLAUDE.md` + `HANDOFF.md` into context, pick
the next prototype off the "What's left" list (recommended order:
subcontractor today/project home → messages shared → documents shared →
schedule shared → commercial client pages → residential client pages →
selections → settings → login → onboarding), do the audit, propose
Commit 1 + Commit 2, and execute.
