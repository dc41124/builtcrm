# BuiltCRM audit — handoff to next chat

## Context

Multi-portal construction PM SaaS. Doing a line-by-line fidelity audit of every
page against its JSX prototype in `docs/prototypes/` and HTML specs in
`docs/specs/`. Rewriting pages to match the prototype exactly — icons, copy,
spacing, colors, section structure.

Read `CLAUDE.md` at the repo root for tech stack + conventions.

---

## What's done (19 prototypes / specs)

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
   - **Hydration fix**: `.dec>p` → `.dec p` in commercial approvals-review

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
   - Commit 2 schema change: `upload_requests.response_note text` column
   - Loader: `loadUploadRequestEnrichment()` helper
   - UI: real submittedFile metadata, activity trail, response note

9. **`builtcrm_billing_draw_workspace.jsx`** + **`builtcrm_billing_draw_client_review.jsx`** + **`docs/specs/residential_billing_draw_review.html`** — all three billing surfaces done

10. **`builtcrm_payment_financial_view_shared.jsx`** → `src/components/financial-view.tsx` — audited and brought to spec

11. **`builtcrm_subcontractor_today_board_project_home.jsx`** → sub today board + project home
    - Today board: `.stb-ss` 4-up summary strip, `.stb-bg` outer grid,
      Execution workspace card with 7 working tabs (My Work / RFIs / Uploads /
      Compliance / Documents / Messages / Payments), right rail (compliance
      state / quick access with counts / current project focus)
    - Project home: `.stb-ss-5` summary strip, Your workspace card with 7
      working tabs (same tab set, project-scoped data), milestones rail with
      day/month blocks + countdown, GC contacts rail, quick access with counts
    - Commit 2: `activityTrail[]`, `gcContacts[]`, `quickAccessCounts` on
      both loaders. Messages feed merged into today loader.

12. **`builtcrm_commercial_client_portal_pages.jsx`** — 4 pages:
    - **Progress & Updates**: phase grid, filter bar (All/Construction/
      Approvals/Financial/Conversations), update feed from merged
      `activityTrail` + `messages`, photo attachments per update with lightbox,
      rolling 7-day metrics strip on top card. Contractor purple avatar.
    - **Photos**: stat strip, 6 hardcoded filter chips (All/Site progress/
      Inspections/Electrical/Mechanical/Structural), photo sets grouped by
      day+uploader, real R2 presigned thumbnails with onError fallback to
      gradient placeholders, click-to-open lightbox.
    - **Documents**: shared `DocumentsWorkspace` with permanent upload zone
      (drag-drop), row-level download + "..." overflow menu (View/Download/
      Supersede/Archive), `canManageAnyDoc` flag for contractor-only actions.
      **Hydration fix**: `content:''` in CSS → `dangerouslySetInnerHTML`.
    - **Payments**: 4-card stats grid, contract payment progress bar, lien
      waiver status card (always shown), payment ledger table (10 cols
      including Review→/Receipt action), change order summary table with
      `decidedAt`/`submittedAt` dates.

13. **`commercial_client_project_home.html`** (spec) → full rewrite
    - Hero 2-col (main + 320px Project Snapshot card), status pills, meta
      chips, action buttons. Financial summary in hero left column below
      action buttons (white bg, compact). Contacts strip (white bg, no chip
      borders). 4-card KPI strip (phase/approvals/COs/billing). Main grid:
      "Awaiting your review" card with Review buttons + activity feed from
      `activityTrail`. Right rail: Quick access (4 structured icon cards) +
      Upcoming milestones (day/month blocks).
    - Loader: `gcContacts` added to `ClientProjectView` — queries ALL
      `project_user_memberships` (contractor + subs + client), not just
      contractor org.

14. **`builtcrm_residential_client_portal_pages.jsx`** — 3 pages:
    - **Progress & Photos**: 6-phase horizontal timeline hero (done/current/
      upcoming), update stream with week-range dates ("This week · April 7–11"
      / "March 24–28"), milestone cards with check icon, inline photos with
      lightbox, full photo gallery grouped by week with room-based filter chips.
    - **Documents**: dedicated residential view (NOT shared workspace) with
      permanent upload zone (gradient bg), 2-col layout (220px category sidebar
      + file list), "Shared by your builder" section with View buttons,
      "Uploaded by you" section with teal accent + Accepted pills, "Builder
      waiting for documents" callout. Real upload flow wired.
    - **Budget**: 2-col hero (total + quick numbers), segmented progress bar,
      "Your next payment" teal callout, payment history timeline with opacity
      fade for upcoming, selections & budget impact table with mini status
      pills, "How payments work" tip card.

15. **`residential_client_project_home.html`** (spec) → full rewrite
    - Hero 2-col with "At a glance" side card (all 4 items have grey bg +
      border per spec, highlight/alert variants override). Top cards 2-col
      (Budget overview + Coming up milestones). Contacts strip ("Your build
      team", white bg). 4-card KPI strip. Main grid: "Things that need you"
      with Choose/Review buttons + "What's been happening" activity feed.
      Right rail: itemized selections (swatches + Choose/Done pills) +
      Quick access (3 icon cards).

16. **`builtcrm_residential_selections_flow.jsx`** → selections review
    - Commit 1: state tabs (Overview/Exploring/Provisional/Confirmed/Revision),
      custom summary strip (teal/orange gradient cards), overview cards with
      swatch-derived gradient backgrounds.
    - Commit 2: "Helpful files" rail card (Exploring), "Questions?" rail card
      (all views), "Impact summary" rail card (Revision), file-row + comment-
      input CSS.

### Seed & storage improvements (this session)
- **Photo seeding**: `seed.ts` now generates SVG placeholder images per project
  (7-8 photos spread across 3 days) and uploads them to R2 via `PutObjectCommand`.
  Idempotent — re-running overwrites R2, skips existing DB rows.
- **Message timestamps**: project-general conversation messages now staggered
  across 10 days instead of all at `now()`.
- **Feed seeds**: expanded from 4→8 activity feed items per project with weekly
  reports, milestone completions, phase transitions, photo uploads.
- **Permissions**: `document:write` granted to commercial + residential clients
  (enables upload zone + own-doc archive). API endpoints enforce ownership.

---

## What's left in the audit (prototypes not yet touched)

**Shared (next):**
- `builtcrm_messages_conversations_shared.jsx` → messaging pages across all
  4 portals (share a loader via `src/components/messages-ui.tsx` /
  `messages-workspace.tsx`)
- `builtcrm_documents_file_management_shared.jsx` → documents pages across
  all 4 portals. NOTE: commercial uses the shared `DocumentsWorkspace`,
  residential now has a dedicated `documents-view.tsx`. Contractor + sub
  still use shared workspace. This prototype may only need audit for
  contractor/sub variants.
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
  `supportingDocuments[]` + `activityTrail[]`
- Pattern: identical to upload-requests / change-orders enrichment helpers

### RFIs Commit 2 (loader work)
- `activityTrail[]` + `referenceFiles[]` from `document_links`
- Schema question: `rfi_type` field (Formal RFI vs Issue)

### Compliance Commit 2 (loader work)
- `supportingFile` with real document metadata
- `activityTrail[]` for Recent activity rail card

### Financial view follow-ups
- Contractor Subcontractor Payment Status: `tradeScope` on row type
- Sub-scoped financials: `draw_requests` / `schedule_of_values` have no
  `organizationId` — sub payment tracking needs a dedicated table or
  purchase_orders schema. `pendingFinancialsCents` hardcoded to 0 in both
  sub loaders.

### Export/download endpoints (batch)
- Payment report PDF export (commercial payments)
- Photo "Download all" batch zip (commercial + residential photos)
- Payment ledger Receipt links
- All share the same infrastructure — batch after audit

### Weekly reports table (deferred)
- True `weekly_reports` table for PM-authored curated narratives vs the
  current on-the-fly activity trail synthesis. Scoped out of current audit.

### Nav badge counts (end of audit)
- Build `getPortalNavCounts()` per portal, wire through `loadPortalShell`

### Other tracked items
- `const now = Date.now()` hydration sweep (ongoing)
- `>` child combinator sweep (done for all known files)
- Use `dangerouslySetInnerHTML` for any `<style>` block with special CSS chars
- Residential nav `/decisions` link
- Contractor approvals cross-project page (ComingSoon)
- Contractor cross-project payment-tracking page (ComingSoon)
- Billing workspace: Package Documents buttons (UI-only)

---

## DB state

- Neon dev branch has been pushed through **change-orders Commit 2** schema
  addition (`schedule_impact_days`) via `npm run db:push`.
- **Upload requests `response_note` column** was added via raw SQL.
  Next `db:push` will still want to rename cosmetic FK constraints across 5
  tables — safe to accept when convenient.
- **Seed photos uploaded to R2** — 7-8 SVG placeholders per project via
  `seedUploadSvg()` in seed.ts. Re-running `npm run db:seed` is safe.

## Working conventions we've established

1. **Audit format**: read prototype + current code, produce a structural
   audit comparing them, propose Commit 1 (visual/structural with existing
   data) + Commit 2 (loader/schema work) split, get user approval, then
   execute.

2. **Tab style varies per prototype** — always check the specific prototype.

3. **Queue cards**: bordered rounded cards with gap, not divider rows.

4. **Detail pane sections**: grey header bar + bordered body container.

5. **Hydration-safe `now`**: `const [now] = useState(() => Date.now())`

6. **Style delivery**: use `dangerouslySetInnerHTML={{ __html: css }}` for
   any `<style>` block. Prevents `content:''` and `>` combinator hydration
   issues.

7. **Inline create panels, not modals** (except billing draw workspace).

8. **Remove duplicate breadcrumb lines** — shell handles it.

9. **Buttons default to white bg with grey border.**

10. **Font tokens**: `var(--fd)` / `var(--fb)` / `var(--fm)`. Weight floor
    520, KPI values 820, page titles 820/26px (24px on client portals).

11. **Client portals are project-scoped.** Don't add `AppShell` at the
    parent commercial/residential layout.

12. **Loader enrichment pattern**: copy `loadUploadRequestEnrichment` or
    `loadDrawRequestEnrichment` from `project-home.ts`.

13. **Photo presigning**: `presignDownloadUrl()` from `src/lib/storage.ts`,
    10-min TTL, parallel per photo. View uses `onError` fallback to gradient.

14. **Contacts query**: `getClientProjectView` now fetches ALL
    `project_user_memberships` for the project (contractor + subs + client),
    not just contractor org. Both commercial and residential share this.

15. **Permissions**: commercial + residential clients have `document:write`.
    API endpoints enforce per-doc ownership for non-contractor roles.

---

## Starting the next chat

Open the next chat with:
> "Continuing the BuiltCRM audit. Read HANDOFF.md at the repo root and
> CLAUDE.md, then start on the shared prototypes."

Recommended order for the shared audit:
1. `builtcrm_messages_conversations_shared.jsx` — messaging across all 4 portals
2. `builtcrm_documents_file_management_shared.jsx` — documents (contractor/sub variants; commercial already done, residential has dedicated view)
3. `builtcrm_schedule_timeline_shared.jsx` — schedule/timeline

Then contractor-only:
4. `builtcrm_selections_management_contractor.jsx`
5. `builtcrm_contractor_settings_integrations.jsx`

Then entry/standalone:
6. `builtcrm_login_auth_flow.jsx`
7. `builtcrm_client_onboarding_flow.jsx`
