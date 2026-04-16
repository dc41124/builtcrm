# BuiltCRM — handoff to next chat

## Context

Multi-portal construction PM SaaS. Four portals (contractor, subcontractor,
commercial client, residential client) sharing one data layer with role-scoped
views. Read `CLAUDE.md` at the repo root for tech stack + conventions.

---

## What was done this session

### Prototype audit (all 24 prototypes now audited)
- **Messages** (`builtcrm_messages_conversations_shared.jsx`): full visual
  rewrite + hydration fixes + file upload + lightbox + per-sender avatar
  colors + system message icon variety
- **Documents** (`builtcrm_documents_file_management_shared.jsx`): audited,
  already at spec — no changes needed
- **Schedule** (`builtcrm_schedule_timeline_shared.jsx`): audited, at spec
  — only switched style to `dangerouslySetInnerHTML`
- **Selections** (`builtcrm_selections_management_contractor.jsx`): full
  1500-line visual rewrite to prototype spec (gradient cards, swatch grids,
  options table, client decision timeline, activity trail, create view)
- **Login** (`builtcrm_login_auth_flow.jsx`): audited, at spec — fixed
  checkbox stuck-black bug (custom styled checkbox)
- **Onboarding** (`builtcrm_client_onboarding_flow.jsx`): audited, at spec
  — no changes needed

### Pre-audit cleanup items completed (from phase_3_build_guide.md)
1. **next/link migration** — replaced all internal `<a href>` with `<Link>`
   across AppShell, messages-workspace, marketing-page
2. **Style consolidation** — rewrote invitations-ui.tsx from inline styles
   to CSS classes via `dangerouslySetInnerHTML`
3. **list-ids.ts** — no fix needed, build was already clean
4. **Inline create panels** — verified all workflows use inline panels (not
   modals) for primary create actions
5. **Multi-file upload** — upload-requests submit endpoint now accepts
   `documentIds[]` array, sub UI has `multiple` file input
6. **file_size_bytes** — added column to documents table, `getObjectSize()`
   helper, finalize endpoint captures size, `formatFileSize()` utility created
7. **Approvals enrichment** — `supportingDocuments[]` + `activityTrail[]` on
   ApprovalRow, wired into contractor approvals detail panel
8. **RFIs enrichment** — `referenceFiles[]` + `activityTrail[]` on RfiRow,
   wired into contractor RFI detail panel
9. **Compliance enrichment** — document metadata (title/type) via join +
   `activityTrail[]` on compliance records, wired into contractor compliance
   workspace
10. **rfi_type** — added `rfi_type` enum ('formal'|'issue') to rfis table,
    API accepts it, tabs now filter by type, pills show real data (both
    contractor + sub workspaces)
12. **dangerouslySetInnerHTML sweep** — converted all 28 remaining
    `<style>{...}</style>` blocks across the codebase
13. **Residential decisions nav link** — added missing `/decisions` link to
    residential sidebar

### Infrastructure fixes
- **Route group restructuring** — contractor and subcontractor portals now
  use `(global)/` route group + `project/[projectId]/layout.tsx` pattern
  (matching client portals). Parent layouts are passthroughs. Sidebar nav
  properly swaps between cross-project and project-scoped views.
- **Middleware** — sets `x-pathname` request header for server components
- **Cross-project pages** — auto-redirect to first project's scoped URL
  (no more ComingSoon for workflow pages)
- **Dark mode toggle** — removed from topbar (broken, will be a settings
  item in the future). Code retained for later use.
- **Seed** — admin user added to conversation participants so contractor
  admin sees messages
- **DB push** — `rfi_type` enum + column, `file_size_bytes` column, and FK
  constraint renames all applied to Neon

### Page fixes
- **Residential confirmed-choices** — replaced ComingSoon with real page
  that loads selections data pre-filtered to "Confirmed" tab. Also wired
  the state tabs on the selections review to actually filter items.
- **Subcontractor payments** — redirects to `/financials` (real page)
- **Subcontractor today board** — Documents, Messages, Payments tabs now
  show real data (recent docs, conversation previews, project links) instead
  of placeholder text
- **Dashboard priorities card** — rewritten to use workspace-card-style
  rounded pill tab bar (matching project home workspace card)

---

## What's next

### Immediate: Seed the DB
The database needs a fresh seed run to populate all the new fields (rfi_type,
file_size_bytes, conversation participants for admin). Run:
```bash
npm run db:seed
```

### Then: Phase 3 Steps 16-17 (responsive + polish)
From `docs/specs/phase_3_build_guide.md`:
- **Step 16**: Responsive layout pass across all portal pages
- **Step 17**: Visual polish and final prototype fidelity audit

### Remaining pre-audit cleanup items not yet done
- Item 11: `const now = Date.now()` hydration sweep
- Item 14: Empty state audit (ensure all pages handle zero-data gracefully)
- Item 15: Update HANDOFF.md (this file) — done now

---

## Deferred follow-ups (still tracked)

### Financial view follow-ups
- Contractor Subcontractor Payment Status: `tradeScope` on row type
- Sub-scoped financials: `pendingFinancialsCents` hardcoded to 0

### Export/download endpoints (batch)
- Payment report PDF export, photo batch zip, receipt links

### Weekly reports table (deferred)
- True `weekly_reports` table for PM-authored narratives

### Nav badge counts (end of audit)
- Build `getPortalNavCounts()` per portal

### Messages real-time features (deferred — WebSocket/SSE)
- Typing indicator, online/offline presence dots

### Subcontractor org-admin pages (not built, no prototype)
- Team page, Settings page — build after Phase 3

### Contractor settings prototype
- `builtcrm_contractor_settings_integrations.jsx` — not yet audited
  (settings page exists and works, but hasn't been compared line-by-line
  to the prototype)

### Other tracked items
- Contractor approvals cross-project page (ComingSoon)
- Contractor cross-project payment-tracking page (ComingSoon)
- Billing workspace: Package Documents buttons (UI-only)

---

## DB state

- Neon has all schema changes applied via `drizzle-kit push --force`:
  - `rfi_type` enum + column on rfis table
  - `file_size_bytes` bigint on documents table
  - `schedule_impact_days` on change_orders
  - `response_note` on upload_requests
  - FK constraint renames (cosmetic, safe)
- Seed photos uploaded to R2 (SVG placeholders)
- Re-running `npm run db:seed` is safe (upsert pattern)

## Working conventions

1. Use `dangerouslySetInnerHTML={{ __html: css }}` for ALL `<style>` blocks
2. Font tokens: `var(--fd)` / `var(--fb)` / `var(--fm)`
3. Weight floor 520, KPI values 820, page titles 820/26px (24px clients)
4. Portal accent colors: contractor `#5b4fc7`, sub `#3d6b8e`, commercial
   `#3178b9`, residential `#2a7f6f`
5. No emojis — all icons are inline SVGs
6. Residential language: "Scope Changes" not "Change Orders", "Decisions"
   not "Approvals"
7. Client portals are project-scoped (no cross-project nav)
8. Contractor/sub use route groups: `(global)/` for cross-project,
   `project/[projectId]/` for project-scoped, parent layout is passthrough
9. Loader enrichment pattern: parallel queries for document_links +
   activity_feed_items, group into Maps by object ID
10. UTC-based date formatting to avoid hydration mismatches
11. `<Link>` from next/link for all internal navigation (not `<a href>`)

---

## Starting the next chat

> "Continuing the BuiltCRM build. Read HANDOFF.md at the repo root and
> CLAUDE.md, then continue with the seed + Phase 3 responsive/polish pass."
