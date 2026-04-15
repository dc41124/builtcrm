# BuiltCRM audit — handoff to next chat

## Context

Multi-portal construction PM SaaS. Doing a line-by-line fidelity audit of every
page against its JSX prototype in `docs/prototypes/`. Rewriting pages to match
the prototype exactly — icons, copy, spacing, colors, section structure.

Read `CLAUDE.md` at the repo root for tech stack + conventions.

---

## What's done (9 prototypes)

1. **`builtcrm_design_system_shell.jsx`** → `src/components/shell/AppShell.tsx`
   - Inline org name + slash + workspace switcher in sidebar header
   - Search field, folder icons on sections, active-item accent dot
   - Projects as toggleable module
   - Sign-out button in footer
   - Auto-derived breadcrumbs from `usePathname()` + portal type + projects list
   - Tree item stagger animation on section open
   - Settings section renders after Projects (via `placement: "after-projects"`
     on NavSection)

2. **`builtcrm_contractor_dashboard.jsx`** →
   `src/app/(portal)/contractor/dashboard/`
   - Loader extended with `financialHealth`, `approvalsWaiting`,
     `approvalsAsPriorities`, `recentMessages`
   - KPI icons, Financial Health strip with segmented bar, tabbed Priorities
     card, Approvals waiting, Recent activity, Quick health, Recent messages

3. **`builtcrm_contractor_project_home.jsx`** →
   `src/app/(portal)/contractor/project/[projectId]/`
   - Loader extended with `activity` feed + `unreadConversationCount`
   - New `project-home.css` file (extracted from inline style)
   - Hero 2-col (main + snapshot card), context pills, key contacts strip,
     summary strip, `workspace-card.tsx` client component with 9-tab workspace,
     right rail (blockers/milestones/quick access)

4. **`builtcrm_approvals_workflow.jsx`** (3 portals — contractor, commercial,
   residential) → full visual rewrite to match prototype
   - Rounded pill tabs, bordered queue cards, grey-header sections, detail
     header border, Commercial's "What it blocks" cell using `CATEGORY_BLOCKS`
     map, Commercial 3-button decision (Approve/Reject/Request clarification),
     residential simple `.sc` summary cards + Timing cell
   - Commit 2 (loader work for real supporting docs + activity trail) deferred

5. **`builtcrm_rfi_workflow_paired.jsx`** (contractor + subcontractor)
   - Loader extended with `assignedToOrganizationName` (join to `organizations`)
   - Rounded pill tabs, bordered queue cards with tag chips, detail 2×2 grid,
     grey-header sections, synthesized tracking activity
   - Contractor: inline create panel (replaces modal), right rail with
     Blocking work / Response summary / Trade breakdown, "All open / Formal
     RFIs / Issues / Closed" tab labels, `.rfd-btn` white-style buttons, Link
     drawing + Send reminder + Add clarification buttons
   - Subcontractor: Response composer with completeness dots, Response quality
     + Your response stats rail cards

6. **`builtcrm_change_orders_workflow.jsx`** (3 portals) — full visual rewrite
   - **Commit 2 done:** schema added `change_orders.schedule_impact_days`
     (integer default 0), loader `loadRows()` extended with
     `supportingDocuments[]` (via `document_links` + `documents` join) +
     `activityTrail[]` (via `activity_feed_items` + `users` join)
   - Contractor: Schedule impact cell wired to real data, Supporting documents
     list populated, Approval timeline prefers real activity trail and falls
     back to synthesized events
   - Commercial: Impact card schedule-risk row wired, Supporting documents
     list populated
   - Residential: Timing cell wired to `scheduleImpactDays`
   - Inline create panel on contractor (replaced modal)

7. **`builtcrm_compliance_workflow_paired.jsx` — CONTRACTOR SIDE ONLY**
   - Full rewrite of
     `src/app/(portal)/contractor/project/[projectId]/compliance/compliance-workspace.tsx`
   - Header pills + action buttons, simple `.cmp-sc` summary cards with
     `.strong/.alert/.danger/.success` variants, rounded pill tabs, bordered
     queue cards with tag chips + hot state, detail 2×2 grid (Organization /
     Requirement / Accepted-until / State), synthesized verify checklist
     (via `verifyItemsFor()` keyed off `complianceType`), grey-header sections,
     review decision nested card, restriction control with consequence grid,
     right rail (Org scorecard, Payment holds with `.cmp-phb` banner + file
     rows, Recent activity placeholder, Compliance principle info card)
   - `canDecide` was restricted to `pending && documentId` initially; relaxed
     to "any non-active/non-waived record" with the Accept button disabled when
     no document is on file
   - **Subcontractor side NOT done** — see next section

---

## IMMEDIATE NEXT TASK: Subcontractor compliance workspace

**File:**
`src/app/(portal)/subcontractor/project/[projectId]/compliance/compliance-upload-workspace.tsx`

**Reference:** `docs/prototypes/builtcrm_compliance_workflow_paired.jsx` —
specifically the subcontractor branch (search for `portal === "sub"` around
line 657, and `subDetails` around line 133 for the data shape, and `.rq-row`
/ `.rp` / `.phb` / `.mblk` / `.uz` styles in the `<style>` block).

**Critical: the sub-side has a different layout from everything else we've
done.** It is NOT a master-detail split. The prototype uses a **vertical list
of all requirements** (`.rq-row` rows with colored dot + title/status + pill)
inside a single `.ws` card, and the **detail pane for the selected row
renders below the list**, not beside it. Current code uses master-detail
split with tabs — this needs to be ripped out.

### What to change

1. **Remove dup crumb line** (`{projectName} · Compliance`)
2. **Hydration fix** — `const now = Date.now()` → `useState(() => Date.now())`
3. **Drop tabs entirely.** Remove the `TabId` union, the `TABS` array, the
   `Card` import with tabs prop. Render ALL requirements vertically.
4. **Header**: add pills row (Submission + tracking / N missing — restriction
   risk / N expiring in 6 days) and actions (View accepted secondary + Upload
   document primary). Shape matches prototype lines 660–674.
5. **KPI strip**: drop `KpiCard`, use `.scmp-sc` simple bordered cards with
   `.danger/.alert/.strong/.success` border variants. 4 cards: Missing /
   Expiring / Submitted / Active. Each card is clickable and sets
   `subSelected` to the first requirement in that bucket. Shape matches
   prototype lines 676–681.
6. **Workspace card** (`.ws`):
   - Header: "Compliance requirements" + sub "All requirements for this
     project. Missing or expiring items need your action."
   - **Requirement list** (`.rq-row` style): colored dot (red/orange/green) +
     title + status line + pill on right. Each row is a button that sets
     `selectedId`. No tabs. Prototype lines 687–693.
   - **Detail pane rendered below the list** (not beside). Only shows when
     there's a selected record. Prototype lines 696–755.
7. **Detail pane structure** (matches contractor compliance style we just did):
   - Header: title + org line ("Required by {project}") + description + pill
     stack, bottom border separator
   - 2×2 `.dg` grid: Requirement / Status / Expires / Document (or similar
     4-cell; match prototype's sub-detail grid)
   - If needsUpload: grey-header **Upload record** section wrapping the
     existing `UploadZone` component. Prototype's `.uz` has "Upload file"
     primary + "Use project file" secondary. Current `UploadZone` handles the
     presign/put/finalize flow — keep that logic but restyle the wrapper to
     match the prototype's dashed-border `.uz` block.
   - If submitted: grey-header **Submitted record** section with file row
     + "Waiting on GC" pill. File name from `record.documentId.slice(0, 8)`
     until Commit 2 loader adds real document metadata.
   - **"Why this matters now" section** with red-tinted grey header (like the
     contractor side's `.cmd-section.restrict` pattern). Inside: a red `.rp`
     card with heading "Missing X may trigger restricted access" + explanation
     + tag chips row ("Restriction in N days" / "Payments held" / "Clear by
     submitting"). Prototype lines 738–753.
8. **Right rail** — 4 cards:
   - **Restriction risk** (danger-bordered): `.mblk` (inner muted-grey block)
     with heading "X — N days" + paragraph. Only render when there are missing
     records. Prototype lines 761–766.
   - **Payment hold** (alert-bordered): `.phb` banner (orange-tinted box with
     ! icon + "Payment hold active on your account" + subtext). Only when
     hasHold. Prototype lines 767–772.
   - **Recent activity** (plain): placeholder copy. Real data comes in
     Commit 2. Match prototype's `.al` / `.ai` / `.a-dot` styles.
   - **How compliance works** (info-bordered): static explanation paragraph.
     Current copy is correct.
9. **Thin scrollbar** on any vertically-scrolling container
10. **All buttons should follow the `white-background not grey` convention** —
    use `cmd-btn` style or equivalent. See the RFI contractor detail
    (`.rfd-btn`) or compliance contractor detail (`.cmd-btn`) for the pattern.

### Pattern to copy from

You just finished the contractor compliance workspace — use it as a near-exact
style reference for colors, section structure, tag chips, phb banner, dots
scorecard. The sub side has fewer distinct sections but reuses the same
visual vocabulary.

### What NOT to change

- `UploadZone` component logic (the presign → PUT → finalize → submit flow).
  Only restyle its wrapper.
- The `/api/compliance/{id}/submit` endpoint call.
- The loader shape — sub loader already provides what's needed from
  `SubcontractorProjectView["complianceRecords"]`.

---

## Deferred follow-ups (tracked)

Across the whole audit, there's a running list of things we've punted:

### Approvals Commit 2 (loader work)
- Extend `src/domain/loaders/approvals.ts` `ApprovalRow` with:
  - `supportingDocuments[]` (join `document_links` where `linkedObjectType =
    'approval'`)
  - `activityTrail[]` (join `activity_feed_items` where `relatedObjectType =
    'approval'`)
- Wire into contractor `approvals-workspace.tsx` Tracking + Supporting
  documents sections, and commercial `approvals-review.tsx` Supporting
  documents section.
- Pattern is identical to what we just did for change orders in
  `src/domain/loaders/change-orders.ts` `loadRows()`.

### RFIs Commit 2 (loader work)
- Add `activityTrail[]` to `RfiRow` (from `activity_feed_items` with
  `relatedObjectType = 'rfi'`)
- Add `referenceFiles[]` to `RfiRow` (from `document_links` with
  `linkedObjectType = 'rfi'`) — currently we show `drawingReference` /
  `specificationReference` strings as file rows, but real attached files would
  populate a proper list
- Add response-time stats (avg response time, first-reply resolution %) to
  the loader result, wire into the subcontractor right rail. Currently
  computed client-side from `rfi.responses[]` which works but is naive.
- **Schema question**: prototype distinguishes "Formal RFI" from "Issue".
  Schema has no type field — decide whether to add `rfi_type` column or
  continue treating everything as formal.

### Compliance Commit 2 (loader work)
- Extend compliance loader with:
  - `supportingFile` (join `documents` via `documentId` to get real file name,
    uploader, upload time, size instead of `documentId.slice(0, 8)`)
  - `activityTrail[]` for the Recent activity right-rail card (both
    contractor and subcontractor sides)
- Verify checklist: currently synthesized via `verifyItemsFor()` keyed off
  `complianceType`. Real verification items would need a new
  `compliance_verification_items` table OR a JSON column on
  `compliance_records`. Low priority.

### Nav badge counts (end of audit)
`NavItem` supports `badge` + `badgeType: "default" | "warn" | "danger"`, CSS
is fully styled, but `src/lib/portal-nav.ts` never passes any values.

**Plan:** at the very end of the audit, build one shared
`getPortalNavCounts(portalType, orgId, userId, projectId)` per portal that
returns all badge values in one round-trip (approvals pending, RFIs open,
unread messages, compliance issues, etc.), then pass through
`loadPortalShell` → `buildNavSections`. Do NOT do this mid-audit — every
workflow we build adds a new count source, so doing it at the end hits the
whole surface at once.

### `const now = Date.now()` hydration sweep
We've fixed this in approvals + RFIs + compliance (contractor). Still
present in these workflow pages:
- `src/app/(portal)/subcontractor/project/[projectId]/upload-requests/upload-response-workspace.tsx`
  (lines 39 and 200 at last check)
- `src/app/(portal)/subcontractor/project/[projectId]/compliance/compliance-upload-workspace.tsx`
  (will be fixed when you rewrite this file — it's part of the task above)
- `src/app/(portal)/contractor/project/[projectId]/compliance/compliance-workspace.tsx`
  — **already fixed** in the just-finished contractor rewrite
- `src/app/(portal)/contractor/project/[projectId]/upload-requests/upload-request-workspace.tsx`
  (lines 45 and 214)

Fix pattern: `const now = Date.now()` → `const [now] = useState(() => Date.now())`
so the value is frozen on first render and doesn't drift between SSR and
client hydration. The symptom when broken is a "hydration mismatch" error on
pages where pill labels or relative-time strings depend on `now` at the
3-day boundary.

### Residential nav `/decisions` link
The residential sidebar's "Decisions" section labels are "Scope changes" +
"Confirmed choices" in `src/lib/portal-nav.ts`. The `/decisions` route exists
(`src/app/(portal)/residential/project/[projectId]/decisions/`) and is used
as the residential-language equivalent of approvals, but the sidebar never
links to it. Add a "Decisions needed" link to the Decisions section pointing
to `${base}/decisions`. Small change; do during residential portal audit or
as a cleanup pass.

### Contractor approvals cross-project page
`src/app/(portal)/contractor/approvals/page.tsx` is still a `ComingSoon`
placeholder. The approvals prototype doesn't cover the cross-project queue —
leave as ComingSoon until there's a spec.

### Relative href bugs
We fixed these in residential and commercial project-home. Watch for more as
new pages get audited: any `<Link href="something">` without a leading slash
resolves against the current URL and will 404 or feed a garbage projectId to
a dynamic route. Always use `${base}/...` where `base =
/${portal}/project/${projectId}`.

---

## What's left in the audit (prototypes not yet touched)

**Workflows (paired):**
- `builtcrm_upload_requests_workflow_paired.jsx` — next after compliance sub.
  Same paired-workflow shape. Files:
  `contractor/project/[projectId]/upload-requests/upload-request-workspace.tsx`
  + `subcontractor/project/[projectId]/upload-requests/upload-response-workspace.tsx`
- `builtcrm_billing_draw_workspace.jsx` + `builtcrm_billing_draw_client_review.jsx`
  — contractor billing + client review. **Billing is the one workflow where
  the user explicitly said "keep the create flow as a modal"** — all other
  workflows use inline create panels.
- `builtcrm_payment_financial_view_shared.jsx` — shared payments/financials
  view across portals

**Client portals:**
- `builtcrm_commercial_client_portal_pages.jsx` — commercial client pages
  (progress, photos, schedule, billing, documents, messages, payments, etc.)
- `builtcrm_residential_client_portal_pages.jsx` — residential pages (progress
  & photos, schedule, budget, documents, messages)
- `builtcrm_residential_selections_flow.jsx` — residential selections flow
  (already has `selections-review.tsx` but needs audit)

**Subcontractor:**
- `builtcrm_subcontractor_today_board_project_home.jsx` — **user said: for
  subcontractor today board AND project home, use THIS file, not the older
  `builtcrm_subcontractor_today_board.jsx` file.** That's the current spec
  for both pages.

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

## Working conventions we've established

1. **Audit format**: read prototype + current code, produce a structural
   audit comparing them (KPI labels, detail grid cells, missing sections,
   right-rail cards, etc.), propose a Commit 1 (visual/structural with
   existing data) + Commit 2 (loader/schema work) split, get user approval,
   then execute.

2. **Tab style**: the approvals/RFIs/change-orders/compliance prototypes all
   use **rounded pill tabs** (`.wtab`), not the dashboard's full-width
   underline strip. When rewriting a workflow page, drop `<Card tabs>` and
   render a custom `.{prefix}-wtab` pill row. The dashboard is the ONLY page
   that uses the underline-strip style.

3. **Queue cards**: workflow queues use **bordered rounded cards with gap**
   between them, not divider rows. Active state uses accent border + tinted
   background + color-mix box-shadow. Add a `.hot` variant with danger border
   for urgent rows (overdue, missing, restricted).

4. **Detail pane sections**: wrap content in bordered `.{prefix}-section`
   containers with a **grey header bar** (`background: var(--s2)`,
   `border-bottom: 1px solid var(--s3)`) containing the h4 title + optional
   right-side action buttons, and a separate `.{prefix}-section-body` for
   padded content.

5. **Detail header**: bottom border separating from the grid
   (`padding-bottom: 14px; border-bottom: 1px solid var(--s2)`).

6. **Detail grid**: 2×2 = 4 cells using `.{prefix}-cell` / `.k` / `.v` / `.m`
   pattern with `background: var(--s2)` / `border: 1px solid var(--s3)` /
   `border-radius: var(--r-m)`. Use `.v.warn` / `.v.ok` / `.v.danger` /
   `.v.accent` color variants for sensitive values.

7. **Thin scrollbar**: `::-webkit-scrollbar { width: 4px }` + transparent
   track + `var(--s4)` thumb. Apply to ANY vertically-scrolling queue or
   list.

8. **Hydration-safe `now`**: `const [now] = useState(() => Date.now())` in
   all "use client" workflow components.

9. **Inline create panels, not modals** — EXCEPT for billing draw workspace
   (user explicitly chose modal for that one).

10. **Remove duplicate crumb lines** from every page header — the shell's
    auto-derived breadcrumbs handle it now.

11. **Buttons default to white background with grey border**, not grey
    background. Use `.{prefix}-btn` custom style when `Button` component's
    secondary variant looks grey in context.

12. **KPI icons**: pass inline SVG `icon` prop to `KpiCard` (hourglass, alert
    triangle, check circle, dollar, etc.). Dashboard audit established the
    icon vocabulary.

13. **Commit split**: always propose Commit 1 (visual, no schema/loader
    changes) + Commit 2 (loader work). Get user go-ahead on both. They
    commit on their end between each.

14. **Typecheck after each file**: `npx tsc --noEmit` must pass clean before
    reporting the file as done.

15. **Client portals are project-scoped.** Commercial + residential portals
    use nested layouts at `{portal}/project/[projectId]/layout.tsx` that
    render `AppShell` — the parent `{portal}/layout.tsx` is a passthrough.
    Contractor + subcontractor render the shell at the top-level portal
    layout because they have non-project pages. **Do not add `AppShell` at
    the parent commercial/residential layout** — it was broken that way
    originally (sidebar nav was empty).

---

## Known state at handoff

- Context: ~25% remaining when writing this (handoff generated in the chat
  that just finished compliance contractor)
- Last commit made on the user's end: compliance contractor workspace Commit 1
  (pending — user was going to commit after reading this handoff)
- `npm run db:push` has been run against the Neon dev branch through the
  change-orders Commit 2 schema addition. No migrations after that.
- `npx tsc --noEmit` passes clean as of the last file write
- Residential scope-changes title was bumped from 24px to 26px to match
  prototype — confirmed looks right

---

## Starting the next chat

Open the next chat with:
> "Continuing the BuiltCRM audit. Read HANDOFF.md at the repo root, then
> start with the subcontractor compliance workspace rewrite. Then move to
> upload requests paired workflow."

The fresh chat should load `CLAUDE.md` and `HANDOFF.md` into context, then
dive into the sub-compliance rewrite using the contractor compliance
workspace as a style reference.
