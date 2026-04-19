# BuiltCRM — Phase 4+ Build Guide
## A Step-by-Step Walkthrough from Technical Debt Through Residential Depth

**Who this is for:** You. Same setup as Phase 1 and Phase 3 — Claude Code in VS Code, following step-by-step prompts. Phase 1 built the backend. Phase 3 built the polished frontend for 24 screens. Phase 4+ takes the product from "complete for its original scope" to "portfolio-grade SaaS with enterprise integration architecture, field workflows, a working AI agent, Canadian compliance surfaces, and residential depth."

**What Phase 4+ produces:** A single build plan covering **80–82 items across 10 sub-phases** (4A, 4B, 4C, 4D, 5, 6, 7.1, 8-lite, 9-lite, 10). When complete you'll have:

- A nav-tight, hydration-clean, export-complete daily driver (4A)
- Notification center, global search, daily logs, punch list, submittals, document versioning, reports dashboard, basic Gantt (4B)
- OAuth + webhook + sync infrastructure and a working Stripe test-mode flow (4C)
- Cross-project dashboards, weekly reports, lien-waiver fan-out, procurement module (4D)
- Drawings, inspections, meetings, transmittals, closeouts, subcontractor prequal (Phase 5 — commercial GC parity)
- PWA + offline daily logs + safety forms + time tracking + spatial photo pinning (Phase 6)
- Working Meeting Minutes AI agent with transcription and action-item extraction (Phase 7.1)
- Webhook catalog, public API docs, rate-limited API keys, CSV import, SSO stub, integration gallery (Phase 8-lite)
- Law 25 privacy-officer surface, RBQ license verification, T5018 slips, Ontario prompt-payment engine, CCQ/ARQ attestation, optional fr-CA i18n (Phase 9-lite)
- Warranty portal, specifications, allowance balance, homeowner punch, proposals with e-signature, photo journal, multi-stakeholder guest access, decision log, e-sign + payment flow, progress cards, architect/owner/tenant views (Phase 10)

**How to use this guide:** Same as Phase 3. Keep this file in your repo at `docs/specs/phase_4plus_build_guide.md`. Tell Claude Code "read docs/specs/phase_4plus_build_guide.md, we're on Step X" and it'll know exactly what to do.

**Important differences from Phase 3:**

1. **Phase 3 had a prototype for every page.** Phase 4+ has prototypes for *some* items (anything in `docs/prototypes/` that maps to one of the new items), HTML mockups for others (`docs/design/`), and zero visual reference for the rest. This guide flags which is which per step.

2. **Not every item is safe to batch.** Phase 3 could run Claude Code mostly autonomously because the prototypes were definitive. Phase 4+ has items that require design decisions (what does a subcontractor settings page even contain?) and items that touch production-risk surfaces (auth, schema, billing). Every step in this guide is labeled **Safe-to-autorun** or **Require-design-input** so you know up front which mode you're in.

3. **The plan is the portfolio artifact.** Reviewers will read `builtcrm_phase4_portfolio_scope.md` as evidence of product judgment. This build guide is the execution layer underneath it — the two are paired. If the scope doc changes, this guide should change too.

4. **Context window matters more than before.** Phase 4+ spans dozens of features. A single Claude chat will run out of room partway through most phases. Every item below is scoped so one Claude Code session can finish it; every phase has a recommended natural break for wrap-up.

---

## Before You Start — Setup Checklist

### Things you should already have from Phases 1–3

- The `builtcrm` repo with Phase 3 completed — every page built, real data flowing, dark mode working, responsive layouts in place
- `npm run dev`, `npm run build`, and `npm run lint` all pass clean
- All seed data loaded and verified across all four portals
- The 24 HTML mockups in `docs/design/`
- The 24 JSX prototypes in `docs/prototypes/`
- All spec docs in `docs/specs/` including the schema draft, integration architecture, engineering architecture layer, and technical architecture prep

### New files to add before starting Phase 4+

**Add the Phase 4+ planning docs to the repo:**

1. Download these three files from the project folder:
   - `builtcrm_phase4_portfolio_scope.md` — the active plan (source of truth)
   - `builtcrm_phase4_plus_implementation_plan.md` — the full enterprise plan (reference only)
   - `builtcrm_2026_gap_analysis.md` — competitive research
2. Place them in `docs/specs/`.

**Verify the schema files are all present:**

```
docs/schema/
├── drizzle_schema_first_pass.ts
├── drizzle_schema_v2_additions.ts
├── drizzle_schema_phase3_billing.ts
├── drizzle_schema_remaining_gaps.ts
└── drizzle_schema_phase4_integrations.ts
```

If `drizzle_schema_phase4_integrations.ts` isn't in place yet (it contains tables 33–36 for integrations, sync events, payments, and webhooks), add it now. The infrastructure items in 4C and 8-lite depend on it.

**Commit the setup:**

```bash
git add .
git commit -m "Phase 4+ setup: add portfolio scope doc, gap analysis, full plan"
```

### Directory shape going into Phase 4+

```
docs/
├── design/            ← HTML mockups (24 files)
├── prototypes/        ← JSX prototypes (24 files)
├── schema/            ← Drizzle schema (5 files)
└── specs/
    ├── builtcrm_master_module_map.md
    ├── builtcrm_phase4_portfolio_scope.md      ← THE active plan
    ├── builtcrm_phase4_plus_implementation_plan.md   ← reference
    ├── builtcrm_2026_gap_analysis.md           ← reference
    ├── integration_architecture_spec.md
    ├── phase_1_build_guide.md
    ├── phase_3_build_guide.md
    ├── phase_4plus_build_guide.md              ← THIS FILE
    ├── first_implementation_slice_spec.pdf
    ├── engineering_architecture_layer.pdf
    ├── technical_architecture_prep.pdf
    ├── schema_draft_v1.pdf
    └── build_execution_checklist.pdf
```

---

## Execution Mode: Safe-to-Autorun vs Require-Design-Input

Every step in this guide is tagged. Before starting, know which mode you're in.

### Safe-to-Autorun

**What it means:** Claude Code can plan, implement, test, and report done without stopping mid-stream. You review the diff when it finishes. These items are mechanical — the design is already settled (either by a prototype, an HTML mockup, or a clear spec).

**How to drive it:** Pass the item to Claude Code with the prompt in this guide. Let it run. Review the diff. Click through in the browser. Commit.

**Safe-to-autorun items in this guide include:**
- All of 4A.1 except item 5 (wiring fixes, redirects, hydration cleanup)
- 4A.2 dark mode consolidation
- 4A.4 exports (after the design is confirmed from the mockups)
- 4A.5 project nav dropdown
- 4B notification preferences, document categories, versioning
- 4C sync event audit log
- 4D items 40, 42, 42.5, 43 (small deferred fixes from handoff)
- 8-lite webhook catalog page and rate limiting
- Any Phase 10 item whose HTML mockup already exists

### Require-Design-Input

**What it means:** The item needs a decision that isn't written down yet. Claude Code must draft 2–3 options and stop. You pick one, then Claude Code implements.

**How to drive it:** Tell Claude Code to read the relevant context and draft options before writing code. When it asks a design question, answer it, then let it proceed.

**Require-design-input items in this guide include:**
- 4A.1 item 5 (contractor settings audit — scope judgment call)
- 4A.3 items 9, 10 (contractor Organization + Team pages — prototype exists but needs permission model decisions)
- 4A.3 items 11, 12 (subcontractor Team + Settings — **no prototype exists**, design from scratch)
- 4C items 30–33 (Stripe — real test money, wants your eyes)
- 4D items 37, 38, 39, 41 (cross-project pages, procurement — new UX patterns)
- All of Phase 5 (commercial modules — each is a major feature)
- All of Phase 6 (PWA architecture decisions)
- Phase 7.1 (AI agent — API key strategy, prompt design)
- 8-lite items 58, 60, 61, 62, 63, 64 (API keys, docs, custom fields, CSV import, SSO, integration gallery)
- All of Phase 9-lite (compliance — legally-sensitive even as portfolio)

### Universal Stop-and-Ask Triggers

These **override** the autorun bucket. If Claude Code hits any of these, it must stop and ask:

- **Any change to `db/schema/*.ts`** — schema changes get human eyes every time
- **Any change to `auth/` or `domain/policies/`** — auth changes get human eyes
- **Any new dependency in `package.json`** — review before install
- **Any file deletion** — confirm before delete
- **Any change to `CLAUDE.md`** or `docs/specs/builtcrm_phase4_portfolio_scope.md` — confirm before edit

### Recovery Patterns

Claude Code will occasionally over-reach. Here's how to recover without losing good work:

**"It changed files I didn't expect."**
`git diff` → `git checkout -- <file>` to revert specific files. Don't blow away the branch.

**"It added a dependency I didn't approve."**
`git checkout -- package.json package-lock.json` then re-run `npm install`.

**"It tried to do 5 items when I wanted 2."**
Stop it. Revert the extras. Re-prompt with explicit "items #N through #M ONLY, stop after #M."

**"It modified the schema without asking."**
Hard revert. Update the kickoff prompt to emphasize the schema stop-trigger.

**"It wrote a handoff document when I didn't ask."**
Delete it. Remind it: "no handoff docs unless I explicitly ask."

### Verification after every step

Two commands. Both must pass before moving on. No exceptions.

```bash
npm run build && npm run lint
```

If the step adds a migration:

```bash
npm run db:migrate
```

Then re-seed and sanity-check in the browser.

---

## Step 0 — Update CLAUDE.md for Phase 4+

### What this does

Updates the project instructions so Claude Code knows we're in Phase 4+ execution mode, knows where the scope doc and companion references live, and enforces the universal stop-and-ask triggers from the scope doc's §17.

### Tell Claude Code:

> Read the current CLAUDE.md. We're starting Phase 4+ — the post-MVP portfolio build. Phases 1–3 are complete (backend + full frontend + 24 screens). We're now adding technical-debt fixes, core feature gaps, integration infrastructure, commercial GC parity, PWA, one AI agent, compliance surfaces, and residential depth.
>
> Update CLAUDE.md to add the following, without changing anything already there:
>
> 1. Under "Reference Documents", add these three entries:
>    - `@docs/specs/builtcrm_phase4_portfolio_scope.md` — **the active Phase 4+ plan, source of truth for what to build and in what order**
>    - `@docs/specs/builtcrm_phase4_plus_implementation_plan.md` — full enterprise plan (reference only; do not build from this)
>    - `@docs/specs/builtcrm_2026_gap_analysis.md` — competitive research catalog (reference)
>    - `@docs/specs/phase_4plus_build_guide.md` — step-by-step execution guide for Phase 4+ (this guide)
>
> 2. Add a new section titled "Phase 4+ Execution Rules" with the following content:
>    - Every Claude Code session for Phase 4+ must begin by re-reading the portfolio scope doc and this build guide.
>    - Every item in the build guide is labeled either **Safe-to-autorun** or **Require-design-input**. For safe-to-autorun items, plan → implement → verify → report. For require-design-input items, draft 2–3 options and stop for decision.
>    - **Universal stop-and-ask triggers** (override any autorun permission): any change to `db/schema/*.ts`, any change to `auth/` or `domain/policies/`, any new dependency in `package.json`, any file deletion, any change to `CLAUDE.md` or `docs/specs/builtcrm_phase4_portfolio_scope.md`.
>    - After every item: run `npm run build && npm run lint`. Both must pass before moving to the next item. If an item adds a migration, also run `npm run db:migrate` on fresh seed.
>    - **Do not write handoff documents unless explicitly asked.** Handoffs happen at the end of a session or on the user's request, not automatically after each task.
>    - At approximately 50% context usage, warn the user. At wrap-up, produce: what to save, what to archive, and the next session's kickoff prompt.
>
> 3. Under "Definition of Done", add items 6–9:
>    6. The feature works on mobile browser (responsive baseline already established in Phase 3)
>    7. Any new table has a migration file checked in
>    8. Any new API route has basic authorization tests (role-based — deny the wrong portal, deny the wrong org)
>    9. Any new UI component has keyboard accessibility (Tab, Enter, Escape)
>
> Don't change anything else in CLAUDE.md.

### What to check

- Open `CLAUDE.md` and confirm the three new Reference Documents entries are present
- Confirm the new "Phase 4+ Execution Rules" section appears
- Confirm items 6–9 are appended to the Definition of Done
- Everything already in CLAUDE.md is untouched

### Commit:

```bash
git add CLAUDE.md
git commit -m "Step 0: Update CLAUDE.md for Phase 4+ execution rules"
```

---

# Phase 4A — Technical Debt & Polish

**Target:** Days 1–5 of Phase 4+ work. No feature work begins until 4A is done.

**Rule:** These items compound. Every one of them affects demo quality and daily-driver feel. Do not skip any to get to features faster.

**Total:** 13 items across 5 subgroups (4A.1 quick wiring, 4A.2 dark mode, 4A.3 settings pages, 4A.4 exports, 4A.5 nav).

**Acceptance for Phase 4A as a whole:** `npm run build` and `npm run lint` pass clean, no hydration warnings in browser console, every portal sidebar shows accurate badge counts and a working sign-out, all "Package Documents" buttons either work or show a proper Coming Soon state, dark mode is controlled by a single user-preference toggle, and exports for payment PDF, photo ZIP, and receipt links all resolve.

---

## Step 2 — Wire "Package Documents" Buttons in Billing Workspace

**Mode:** Safe-to-autorun
**Item:** 4A.1 #2
**Effort:** S
**Priority:** P1

> **Status: ✅ Done** — committed at `68212aa` ("Step 2 (commit 4/4): Polish — populate client-org + download icon").

### What this does

The billing workspace has "Package Documents" buttons next to draw requests. They're UI-only placeholders today — clicking does nothing. This step wires them to the real endpoint that bundles draw-related documents (G702, G703, lien waivers, backup) into a downloadable ZIP.

### Tell Claude Code:

> Read `src/app/(portal)/contractor/project/[projectId]/billing/` and grep for the string "Package Documents" across `src/`. Also read `docs/prototypes/builtcrm_billing_draw_workspace.jsx` for the intended behavior.
>
> There are (at least) two Package Documents buttons in the billing workspace — one on the draw request detail panel, one on the per-draw row actions menu. Wire them both:
>
> 1. Add a server action `packageDrawDocuments(drawRequestId, context)` in `src/domain/actions/billing.ts` (or the existing billing actions file). It should:
>    - Verify the caller has access to the draw request (authorization at the action level)
>    - Fetch all documents linked to the draw: G702 PDF (generated), G703 PDF (generated), lien waivers attached to the draw, any backup documents the contractor uploaded
>    - Use `archiver` (already available as a dep from Phase 3, but verify first — if it's not installed, stop and ask before adding)
>    - Stream a ZIP response with a sensible filename like `draw-{drawNumber}-{projectName}-{date}.zip`
>    - Write an audit event: `draw.package_downloaded` with drawRequestId, userId, and timestamp
>
> 2. Wire both buttons to trigger the action. Show a brief loading state on the button while the ZIP generates, then kick off the download via a blob URL or streaming response. If the action fails, show an inline error toast, not a silent failure.
>
> 3. If the draw has no documents yet (zero lien waivers, no backup, etc.), the button should still work — generate a ZIP containing just the G702/G703. If even those aren't generatable (draw is draft status), disable the button with a tooltip: "Package available after draw is submitted."
>
> If `archiver` is not already installed, stop and ask before adding.

### What to check

- Click Package Documents on a submitted draw → ZIP downloads with expected contents
- The ZIP opens cleanly and contains the G702, G703, any waivers, and any backup docs
- Unauthorized users (wrong org, wrong portal) get a 403 from the action (verify in DevTools Network tab)
- Button is disabled with tooltip on draft draws
- Audit event appears in the audit log table
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 2 (4A.1 #2): Wire Package Documents buttons to real ZIP endpoint"
```

---

## Step 3 — Nav Badge Counts per Portal

> **Status: ✅ Done** — committed at `eb6b507` ("Step 3 (4A.1 #3): Nav badge counts per portal").

**Mode:** Safe-to-autorun
**Item:** 4A.1 #3
**Effort:** S
**Priority:** P1

### What this does

Sidebar nav badges are currently hardcoded or empty. This wires them to a loader that returns real counts per portal context — open RFIs for contractor, upload requests awaiting response for sub, pending approvals for client, etc.

### Tell Claude Code:

> Read `src/components/shell/AppShell.tsx` and the four portal `layout.tsx` files under `src/app/(portal)/`. Each portal has its own nav items; each nav item has an optional badge count.
>
> Create a loader `getPortalNavCounts(context)` — the nav structure already lives in `src/lib/portal-nav.ts` (the `buildNavSections` function). Add the counts loader as a new file `src/lib/portal-nav-counts.ts` adjacent to it, or as an export from `portal-nav.ts` itself. It should return a keyed object: `{ rfis: 3, approvals: 2, messages: 5, ... }` where keys map to the nav item's `key` or `href`.
>
> What counts to include, per portal:
>
> - **Contractor**: open RFIs across all their projects, pending approvals (COs + general approvals awaiting the contractor's action), unread messages, compliance alerts (documents expiring in <30 days), draws awaiting client review, upload requests still open
> - **Subcontractor**: RFIs assigned to their org awaiting response, upload requests still open for their org, compliance items with requests to upload, unread messages
> - **Commercial client**: pending approvals, unread messages, draws awaiting their review
> - **Residential client**: pending decisions (approvals in residential language), pending selections (provisional items awaiting confirmation), unread messages, draws awaiting review
>
> All queries must be scoped to the caller's context — a contractor only sees their org's counts, not the whole database. Reuse existing Phase 1 loaders where they already exist; only add new queries for nav-specific aggregations.
>
> Call the loader from each portal's `layout.tsx` (these are server components), pass the result into `AppShell` as `navCounts`, and render the badge only when count > 0.

### What to check

- Every portal sidebar shows live counts on the nav items that should have them
- Counts match what you'd expect from the seed data (cross-check by opening the relevant module page)
- Unauthorized data never leaks — a contractor doesn't see another org's counts
- Badge hides when count is 0 (not "0" badge, no badge at all)
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 3 (4A.1 #3): Real-time nav badge counts per portal"
```

---

## Step 4 — `const now = Date.now()` Hydration Sweep

> **Status: ✅ Done** — committed at `4e8018e` ("Step 4 (4A.1 #4): Date.now() hydration sweep").

**Mode:** Safe-to-autorun
**Item:** 4A.1 #4
**Effort:** S
**Priority:** P2

### What this does

React hydration mismatches happen when server-rendered HTML disagrees with the first client render. `const now = Date.now()` at module top level or inside a component body is the classic cause — server captures one timestamp, client captures another. There's no visible bug today on fast networks, but on slow networks (where the client render happens noticeably later) you'll see hydration warnings and occasional flicker.

### Tell Claude Code:

> Grep the entire `src/` directory for `const now = Date.now()`, `Date.now()`, and `new Date()`. Report every match with the file path and surrounding context.
>
> For each match, classify it:
> - **Safe**: inside a `useEffect`, event handler, or server loader — stays.
> - **Hydration-unsafe**: at module top level, inside a client component body, or inside a render function — fix.
>
> For hydration-unsafe cases:
> - If the value is used for comparison (e.g., "is this date in the past?"), pass the timestamp in as a prop from a server loader.
> - If the value is used for display (e.g., "as of 3:42 PM"), either compute it server-side once and pass it as a prop, or move it into a `useEffect` and accept a brief "—" placeholder on first paint.
>
> Do not blanket-wrap everything in `useEffect` — that hurts server rendering unnecessarily. Only fix the genuine hydration-unsafe cases.
>
> After the sweep, verify zero hydration warnings in the browser console across all portal pages by doing a full clicked-through session.

### What to check

- Zero hydration warnings in browser dev tools across every portal
- Pages that display timestamps or "time ago" labels still show the right information
- Artificially slow the network (DevTools throttling) and verify no flicker on timestamps
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 4 (4A.1 #4): Hydration sweep — fix Date.now() at render time"
```

---

## Step 5 — Contractor Settings Prototype Audit

> **Status: ✅ Done** — committed at `6d84840` ("Step 5 (4A.1 #5): Contractor settings audit + small fixes, rest punted to Step 10/11"). Audit-flagged items subsequently shipped in the settings wire-up session (Steps 9/10/12 + new migrations 0001-0003).

**Mode:** Require-design-input
**Item:** 4A.1 #5
**Effort:** S (timebox: **4 hours**)
**Priority:** P2

### What this does

The contractor settings page was flagged as a known gap in earlier handoffs — some of the UI works, some is stubbed, some is broken. This step audits what's there, classifies each section, and either fixes cheaply, deletes, or punts to Step 10/11 in this guide (Organization + Team pages). **It does not redesign the Settings page from scratch.**

**Critical:** Timebox this to 4 hours. If you blow the box, stop and move on. Settings gets a proper treatment in Steps 10–12.

### Tell Claude Code:

> Read `src/app/(portal)/contractor/(global)/settings/**` — every file under that route. Also read `docs/prototypes/builtcrm_contractor_settings_integrations.jsx` for what the prototype says.
>
> Produce an audit table with one row per settings section. Columns:
> - Section name (e.g., "Profile", "Team", "Billing info", "API keys")
> - Current state: Works / Partially works / Stubbed / Broken
> - What's broken or missing
> - Recommended action: Fix now (small), Punt to Step 10 (Organization page), Punt to Step 11 (Team & Roles), Delete (not needed), or Wait for 8-lite (API keys)
>
> Do not write any code yet. I want the audit first.
>
> After I review the audit:
> - For "Fix now (small)" items: implement the minimal fix inline.
> - For "Punt" items: add a clear placeholder panel in that settings section that says "Managed in [Organization / Team & Roles / Integrations] — click to go there" with a working link, and stop.
> - For "Delete" items: confirm with me before deleting (universal stop-trigger).
>
> This is timeboxed to 4 hours total (audit + small fixes + placeholder insertions). If we're running long, stop at the end of the audit and flag the remaining work for Step 10+11.

### What to check

- The audit table is in the chat, readable, and honest about what's there
- Small fixes applied don't break the page
- Placeholders link to the correct future pages (even if those pages don't exist yet — they'll exist by Steps 10–12)
- `npm run build && npm run lint` clean
- You haven't spent more than 4 hours

### Commit:

```bash
git add .
git commit -m "Step 5 (4A.1 #5): Contractor settings audit + small fixes, rest punted to Step 10/11"
```

---

## Step 6 — Sign-Out Button in Sidebar Footer

> **Status: ✅ Done** — sign-out control shipped with the AppShell refactor prior to the settings wire-up session. Sidebar footer now carries the user avatar + name + sign-out affordance across all four portals.

**Mode:** Safe-to-autorun
**Item:** 4A.1 #6
**Effort:** S
**Priority:** P1

### What this does

Flagged in a Phase 3 handoff and then forgotten. The sidebar footer shows the user avatar and name but has no sign-out affordance — users have to go through Settings to log out. This is a 20-minute fix.

### Tell Claude Code:

> Read `src/components/shell/AppShell.tsx` — specifically the sidebar footer / user avatar area (lines ~391-409). Sign-out is already wired: `signOut` is imported from `@/auth/client` (defined at `src/auth/client.ts`, re-exported from Better Auth) and called in the footer button's `onClick`. **This step is a verification, not a rebuild.**
>
> Add a sign-out button to the sidebar footer. UX:
> - A small menu opens when the user clicks their avatar area (or a dedicated caret next to it). The menu has "Sign out" and optionally "Settings".
> - Alternatively, a small inline icon-only sign-out button next to the avatar, with an aria-label and a confirm dialog on click. Pick whichever matches the existing prototype's affordance — check `docs/prototypes/builtcrm_design_system_shell.jsx` to see if it's already drawn.
> - If the prototype doesn't show it, default to the avatar-menu pattern (cleaner, matches most SaaS).
>
> The button calls the existing sign-out action, which redirects to `/login` after session termination. No new auth work — just the UI.
>
> Make it visible in every portal's sidebar (contractor, subcontractor, commercial, residential) since `AppShell` is shared.

### What to check

- Every portal sidebar shows a sign-out affordance in the footer
- Clicking it terminates the session and redirects to `/login`
- After sign-out, visiting any portal URL redirects to `/login` (no zombie session)
- Keyboard-accessible (Tab reaches it, Enter activates it)
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 6 (4A.1 #6): Sidebar sign-out button"
```

---

## Step 7 — Root URL → Products Page Redirect

> **Status: ✅ Done** — root redirect wired prior to the settings wire-up session.

**Mode:** Safe-to-autorun
**Item:** 4A.1 #7
**Effort:** S
**Priority:** P1

### What this does

Hitting the bare domain currently lands on a placeholder or the login page. Until the marketing site is promoted to the bare domain, route `/` to `/products` (or whichever marketing sub-page makes most sense as the first impression).

### Tell Claude Code:

> Read `src/middleware.ts` (if it exists) and `src/app/page.tsx`.
>
> Add a redirect from `/` to `/products`. Use whichever pattern fits the existing codebase:
>
> - If there's a `middleware.ts` that already handles auth redirects, add the `/ → /products` case there, and make sure it runs *before* any auth middleware (anonymous users should still hit the marketing page, not login).
> - If there's no middleware, use `redirect('/products')` at the top of `src/app/page.tsx`.
>
> The redirect should be a 302 (temporary) so we can swap it easily later when the marketing site moves to the bare domain.
>
> Logged-in users should still be able to reach their portal via the explicit `/contractor`, `/subcontractor`, `/commercial`, `/residential` URLs. Do not intercept those.

### What to check

- Hitting `localhost:3000/` lands on `/products` (the marketing products page)
- Logged-in users going to `/contractor/dashboard` still land on the dashboard
- Logged-out users going to `/contractor/dashboard` still redirect to `/login`
- No redirect loops
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 7 (4A.1 #7): Root URL redirects to /products"
```

---

## Step 8 — Consolidate Dark Mode Toggle

> **Status: ✅ Done** — theme preference + topbar toggle shipped in the session that preceded the settings wire-up. `html.dark .bcrm` selector in `src/components/shell/app-shell.css` makes the shell follow the HTML-level dark class.

**Mode:** Safe-to-autorun
**Item:** 4A.2 #8
**Effort:** S
**Priority:** P1

### What this does

Phase 3 removed the topbar dark mode toggle; the theme logic is currently dead code in `src/components/shell/AppShell.tsx` (the `toggleTheme` helper at ~line 224, and a pre-hydration script in `src/app/layout.tsx` that reads `localStorage['builtcrm-theme']`). **No per-page toggles exist** — there is nothing to remove. This step adds a visible theme control in the user Settings page (Light/Dark/System radio), re-wires the topbar toggle, and persists the choice to the user record so it syncs across devices instead of living only in `localStorage`.

### Tell Claude Code:

> Read the current theme plumbing: the dead `toggleTheme` helper in `src/components/shell/AppShell.tsx` (~line 224) and the pre-hydration script in `src/app/layout.tsx` that reads `localStorage['builtcrm-theme']`. There is **no visible toggle UI** currently and **no per-page toggles exist** — don't waste time grepping for either.
>
> Consolidate to one source of truth:
>
> 1. Add a `theme` field to the user preferences table — values: `'light'`, `'dark'`, `'system'`. If the table doesn't exist, use the existing `users` table or the closest equivalent. **If this requires a schema change, stop and ask before proceeding** (universal stop-trigger).
>
> 2. In the user Settings page, add a Theme section with three radio buttons: Light, Dark, System. Selecting one persists to the user record via a server action and re-renders the shell.
>
> 3. Re-add a visible topbar sun/moon toggle. The existing `toggleTheme` helper in `AppShell.tsx:224` is the starting point (wired imperatively to avoid SSR/hydration issues) — surface it as a real button in the topbar. Click toggles between light and dark and writes to the same user preference so it syncs with the settings radio.
>
> 4. On page load, the shell reads the user's preference server-side and sets the `.dark` class on `<html>` before hydration, so there's no flash-of-wrong-theme. If preference is `'system'`, fall back to `prefers-color-scheme` on the client.
>
> 5. Final state: exactly two theme controls — the Settings radio and the topbar toggle. Both write to the same user-preference field and reflect its current value. No per-page toggles should be created.

### What to check

- User settings page shows Light/Dark/System radio
- Changing the setting persists after logout/login
- Topbar toggle and settings radio stay in sync
- No flash-of-wrong-theme on page load (try a hard reload in both modes)
- All four portals respect the theme; marketing site also respects it
- No per-page toggles were introduced
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 8 (4A.2 #8): Consolidate dark mode to user preference"
```

---

## Step 9 — Contractor Organization Settings Page

**Mode:** Require-design-input
**Item:** 4A.3 #9
**Effort:** S–M
**Priority:** P1

> **Status: ✅ Done** (2026-04-17) — shipped as the "Organization" tab inside the shared `SettingsShell` (not as a standalone route). Schema migration `0001_org_settings_fields.sql` added the fields; `getOrganizationProfile` loader + `PATCH /api/org/profile` + `/api/org/logo/*` + `/api/org/licenses*` routes drive live reads/writes. `tax_id` is redacted in audit events. Non-admin users see read-only fields. See the **Settings Wiring Backlog** section for what's still static in the broader settings area.

### What this does

The contractor portal needs a dedicated Organization page (distinct from user Profile). This is where contractors manage org-level settings: org name, address, logo, billing contact, default terms, company-wide defaults that cascade to projects.

The prototype lives in `docs/prototypes/builtcrm_contractor_settings_integrations.jsx` — the Integrations part is in a separate step (4C infrastructure). This step is the non-integration parts of that prototype, promoted to a dedicated `/settings/organization` route.

### Tell Claude Code:

> Read `docs/prototypes/builtcrm_contractor_settings_integrations.jsx`. The "Organization" section(s) of that prototype are the visual reference. The "Integrations" section(s) are a different step — ignore them here.
>
> Before writing code, tell me:
>
> 1. Which fields does the Organization section contain in the prototype? (Org name, address, logo, phone, billing email, default payment terms, default retainage %, etc. — enumerate.)
> 2. Of those fields, which already have columns in the `organizations` table? Which would need schema additions?
> 3. Propose a route structure: `/contractor/settings/organization` as a single scrollable page vs. a tabbed subpage. Pick based on what fits the prototype.
>
> **If the audit reveals any schema additions needed, stop and ask before proceeding** (universal stop-trigger). Prefer reusing existing columns — if a field isn't persisted today, we can start with client-side-only or defer to a future migration.
>
> After I confirm the field list:
>
> 4. Build the page at `src/app/(portal)/contractor/(global)/settings/organization/page.tsx` matching the prototype's typography and spacing.
> 5. Logo upload uses the existing R2 signed-URL infra from Phase 1 — reuse, do not rebuild.
> 6. Saving writes via a server action with authorization at the action level (only org admins can edit).
> 7. Audit events on every save: `organization.updated` with a diff of what changed.
> 8. Empty state for the logo: the cascading-rectangle placeholder.
>
> Also update the settings nav or placeholder you inserted in Step 5 to link here.

### What to check

- `/contractor/settings/organization` renders with the field set from the prototype
- Saving persists across reload
- A non-admin contractor user sees the page read-only (or gets 403 on the action)
- Logo upload works and the uploaded logo appears in the sidebar after save
- Audit event is written
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 9 (4A.3 #9): Contractor Organization settings page"
```

---

## Step 10 — Contractor Team & Roles Page

**Mode:** Require-design-input
**Item:** 4A.3 #10
**Effort:** M
**Priority:** P1

> **Status: ✅ Done** (2026-04-17) — shipped as the "Team & roles" tab inside the shared `SettingsShell`. Loader `listOrganizationMembers` joins `organizationUsers` + `users` + `roleAssignments` with last-active sub-query over `authSession`. Mutation routes `PATCH /api/org/members/[userId]/role`, `DELETE /api/org/members/[userId]`, `POST /api/invitations`, `DELETE /api/org/invitations/[id]`, `POST /api/org/invitations/[id]/resend` all live with audit events + last-admin guard. Commit 7 generalized the same routes to accept subcontractor + client (commercial/residential) owners too.

### What this does

Permissions have been flagged as a gap since Phase 2. Today the app has role constants and loaders enforce them, but there's no UI to see who's on the team, add/remove members, or adjust their role. This step is that UI — a real, functional permissions editor, not a display-only list.

### Tell Claude Code:

> There is no `src/domain/policies/` directory — authorization lives in `src/domain/permissions.ts` (the `POLICY` map + `EffectiveRole` set) and `src/domain/context.ts` (the `getEffectiveContext` gate every loader/action calls). Read both to understand the current role set for contractor orgs. Also read `docs/prototypes/builtcrm_contractor_settings_integrations.jsx` if the prototype includes a Team section; if not, we design from scratch.
>
> Before writing code:
>
> 1. List the current contractor roles (e.g., Admin, PM, Estimator, Viewer) and summarize what each can do based on the policies code.
> 2. Propose the Team page layout: table of members with columns (name, email, role, last active, actions). Edit via inline role dropdown or a slide-panel detail. Add-member via a modal with email invite.
> 3. Propose the permission-editing UX: role selection is enough, or do we need per-feature toggles? (Based on the existing policy model — don't add per-feature toggles if the policies are role-based. Don't invent a new permission surface.)
>
> **Stop and confirm with me** before implementing, especially on:
> - Whether "Delete member" is hard or soft delete (audit implications)
> - Whether role changes take effect immediately or require a confirmation step
> - Whether Admin can demote themselves (usually no — needs a second Admin to do it)
>
> After confirmation:
>
> 4. Build `src/app/(portal)/contractor/(global)/settings/team/page.tsx` matching the proposed layout. **A `ComingSoon` placeholder already exists at this path — replace it, don't rebuild from scratch.**
> 5. Member add uses the existing invitation system from Phase 1 — reuse, don't rebuild.
> 6. Role changes write via a server action with strict authorization (only Admins can change roles, Admin can't demote self unless another Admin exists).
> 7. Remove member is soft-remove (keeps audit trail) — membership record marked inactive, not deleted.
> 8. Audit events on every role change: `membership.role_changed` with before/after values and actor.
> 9. Update the Step 5 placeholder link to route here.

### What to check

- Team page lists all current members with correct roles
- Admin can invite a new member; invitation email goes out (reuses Phase 1 flow)
- Admin can change a member's role; effect is immediate (the member's next request enforces the new role)
- Admin can remove a member; the removed member loses access on next request
- Self-demotion is blocked if no other Admin exists (try it — should get a clear error)
- All role changes and removals appear in the audit log
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 10 (4A.3 #10): Contractor Team & Roles page with functional permission editor"
```

---

## Step 11 — Subcontractor Team Page

> **Status: ✅ Done** (2026-04-17) — subcontractor Team & roles functionality shipped as part of the shared `SettingsShell` wiring. Sub owners use the same `/api/org/members/*` and `/api/org/invitations/*` routes as contractor admins (generalized in commit 7 of the settings wire-up). The standalone `/subcontractor/team/` route is a follow-up if you want a dedicated page; the Team surface itself is functional from the settings tab.

**Mode:** Require-design-input (**no prototype exists**)
**Item:** 4A.3 #11
**Effort:** S–M
**Priority:** P1

### What this does

Subcontractor orgs also need a Team page. There is **no prototype** for this — design it from scratch, modeled on the contractor Team page built in Step 10 but simpler (subcontractor orgs tend to be smaller, with fewer role distinctions).

### Tell Claude Code:

> **No prototype exists for this page.** Do not invent one and proceed silently. Instead:
>
> 1. Read `src/domain/permissions.ts` and `src/domain/context.ts` (there is no `src/domain/policies/` directory) to understand the subcontractor role set (likely just Admin / Field / Viewer, but verify).
> 2. Propose a design that mirrors the contractor Team page from Step 10 but adapted for subcontractor needs:
>    - Same table-of-members pattern
>    - Role set specific to subcontractor (whatever the policies actually support)
>    - No feature parity with contractor Team if the permissions model doesn't support it
> 3. Show me the proposed field list and layout in plain English before coding.
>
> After confirmation:
>
> 4. Build `src/app/(portal)/subcontractor/(global)/team/page.tsx`. **A `ComingSoon` placeholder already exists at this path — replace it, don't rebuild from scratch.** Note: subcontractor team lives directly under `(global)/`, not under a `settings/` parent.
> 5. Reuse as much from the contractor Team page as possible — the table component, the invite modal, the server actions. Parameterize by org type.
> 6. All the same audit, authorization, and self-demotion rules apply.

### What to check

- Page renders for subcontractor users
- Contractor users don't see this route (routing + authorization both enforce)
- Invite flow works for subcontractor orgs
- Role changes and removes audit correctly
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 11 (4A.3 #11): Subcontractor Team page"
```

---

## Step 12 — Subcontractor Settings Page

> **Status: ✅ Done** (2026-04-17) — shipped as 2 sub-only tabs inside the shared `SettingsShell`: **Organization** and **Trade & compliance**. Organization shares the portal-agnostic `/api/org/profile` + logo + licenses routes with contractor (sub owners gated via `getSubcontractorOrgContext`). Trade & compliance reads `complianceRecords` + surfaces per-org certifications via new `/api/org/certifications*` routes. Sub-specific columns (`primary_trade`, `secondary_trades`, `years_in_business`, `crew_size`, `regions`) landed in migration `0001_org_settings_fields.sql`.

**Mode:** Require-design-input (**no prototype exists**)
**Item:** 4A.3 #12
**Effort:** S–M
**Priority:** P1

### What this does

The subcontractor portal has no dedicated Settings landing page. There's no prototype. Design it from scratch using the minimum useful surface: org profile (subcontractor company name, trade, license number, address), notification preferences (inherits from the Step 15 notification preferences work in Phase 4B), compliance document status summary with link to the detailed compliance workflow.

### Tell Claude Code:

> **No prototype exists for this page.** Design from scratch.
>
> Propose a minimal, useful Settings landing for subcontractor orgs. Suggested sections:
>
> 1. Organization profile — company name, trade (MEP / framing / electrical / etc.), primary license number, address, primary contact
> 2. Notification preferences — link or inline panel (depends on whether Step 16 has shipped yet; if not, placeholder)
> 3. Compliance summary — read-only at-a-glance: insurance expires on X, W-9 status, bonding status. Link to full compliance workflow
> 4. Team link — button to the Team page from Step 11
>
> Do not build a full Settings taxonomy. Subcontractor users need a landing, not a control panel.
>
> Show me the proposed section list and the rough layout before coding.
>
> After confirmation:
>
> 5. Build `src/app/(portal)/subcontractor/(global)/settings/page.tsx`. **A `ComingSoon` placeholder already exists at this path — replace it, don't rebuild from scratch.**
> 6. Reuse the existing subcontractor org record for the profile section.
> 7. Compliance summary reads from the existing compliance loader (role-scoped to this sub's org).

### What to check

- Page renders cleanly, no empty-data errors
- Profile save works, audit event logged
- Compliance summary matches what the Compliance workflow page shows
- Links to Team page and (future) Notification preferences resolve
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 12 (4A.3 #12): Subcontractor Settings landing page"
```

---

## Step 13 — Export Endpoints: Payment PDF, Photo ZIP, Receipt Links

> **Status: ✅ Done** (2026-04-18) — commit `0846922`. Payment PDF via `@react-pdf/renderer`, photo ZIP via streaming `archiver`, receipt links resolved with auth. See the detailed completion notes at the end of this step.

**Mode:** Safe-to-autorun (after design review)
**Item:** 4A.4 #13
**Effort:** M (**larger than it looks** — PDF + ZIP + auth across three surfaces)
**Priority:** P1

### What this does

Three related export endpoints, grouped because they share infrastructure (auth, signed URLs, streaming). Each one is a demo-critical affordance that's currently stubbed.

- **Payment PDF**: download a payment record (invoice / receipt) as a branded PDF
- **Photo ZIP**: download an album or project photo collection as a ZIP
- **Receipt links**: make receipt URLs resolve to the correct asset with correct auth

Plan for multiple days here. Do not rush — PDF generation and ZIP streaming are the kind of thing that look done until you hit the edge cases.

### Tell Claude Code:

> Read `src/app/api/export/**` if it exists, and `docs/prototypes/builtcrm_payment_financial_view_shared.jsx` for where the Download PDF buttons live. Grep for "Receipt" and "Photo ZIP" to find the current UI entry points.
>
> We're building three export endpoints. Plan before coding:
>
> 1. What library for PDF generation? Options: `@react-pdf/renderer` (component-based, matches our React stack), `pdfkit` (programmatic, more control, harder to match the design), or `puppeteer` (HTML → PDF, heavy). Recommend `@react-pdf/renderer` unless you have a reason to differ. If adding a new dependency, **stop and ask** first (universal stop-trigger).
> 2. What library for ZIP streaming? If `archiver` is already installed (from Step 2), reuse it.
> 3. What's the auth pattern? Each endpoint must:
>    - Require authentication
>    - Verify the caller has access to the specific record being exported
>    - Return 403 on unauthorized access, not 404 (to avoid enumeration)
>
> Confirm library choices with me before installing anything.
>
> Implementation:
>
> **Payment PDF endpoint** (`src/app/api/export/payment/[paymentId]/route.ts`):
> - Fetch the payment record + related data (contract, line items, org info for branding)
> - Render with `@react-pdf/renderer`: org logo, payment number, date, line items, total, signature block
> - Stream as PDF with filename `payment-{number}-{orgSlug}.pdf`
> - Audit event `payment.exported` with paymentId, userId, timestamp
>
> **Photo ZIP endpoint** (`src/app/api/export/photos/[albumId]/route.ts`):
> - Fetch all photos in the album (or a single project's photos if no album grouping)
> - For each photo, fetch from R2 via the existing signed-URL infra
> - Stream into a ZIP with original filenames + an index.txt listing photos with timestamps and uploaders
> - Filename `photos-{project}-{date}.zip`
> - Audit event `photos.exported`
>
> **Receipt links**:
> - Add (or fix) the `/receipts/[receiptId]` route so it resolves to the correct asset
> - If the receipt is stored in R2, generate a signed URL and redirect
> - If the receipt is generated on the fly (payment confirmation receipt), render as PDF via the same pattern as Payment PDF
> - Verify caller access before redirecting/streaming
>
> Wire the Download buttons in the billing and financial view pages to the new endpoints. Kill any placeholder handlers.

### What to check

- Click Download PDF on a payment → correct PDF downloads, opens in any reader, shows org branding and line items
- Click Download Photos on an album → ZIP streams with all photos intact, filenames preserved
- Click any receipt link → resolves to the correct asset
- Try all three endpoints as an unauthorized user (different org via DevTools) → 403
- No new dependencies added without you confirming
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 13 (4A.4 #13): Export endpoints — payment PDF, photo ZIP, receipt links"
```

### Status: Completed 2026-04-18 (commit `0846922`)

Notes on deviations from the spec above:

- **Path key changed** from `[paymentId]` to `[paymentTransactionId]`. The backing table is `payment_transactions` (polymorphic via `relatedEntityType` ∈ `draw_request | retainage_release | selection_decision | change_order`). Keying by transaction id means one URL + one template handles every flavor — Stripe draw payment, manual check on a selection upgrade, all of them.
- **Photo route keys by `projectId`, not `albumId`.** No `photo_albums` table exists; photos are `documents` rows with `documentType='photo_log'`. Route: `/api/export/photos/[projectId]` with optional `?from=YYYY-MM-DD&to=YYYY-MM-DD` filter and an `index.txt` manifest. When Step 21 introduces a `category='photos'` enum the WHERE clause swaps in one line, URL unchanged.
- **Receipts collapsed to a single dispatch route.** `/receipts/[paymentTransactionId]` 302s to `receiptUrl` when the row is Stripe-hosted, otherwise 302s to the canonical `/api/export/payment/[id]` which renders the PDF. One template covers both Stripe and manual flavors, branching on `stripePaymentIntentId != null`.
- **No new dependencies.** `@react-pdf/renderer` and `archiver` were already present (Step 2 + earlier draw-package work at `src/app/api/draw-requests/[id]/package/route.ts`, which is the pattern this step mirrors).
- **403 vs 404 behavior:** `getEffectiveContext` throws `AuthorizationError("forbidden")` when the caller has no project access, which maps to 403. 404 only fires when the UUID genuinely doesn't exist. Enumeration risk is nil because the id check happens before the access check leaks row existence.
- **Loader extension:** `loadDrawRequestEnrichment` in `src/domain/loaders/project-home.ts` now also returns `receiptPaymentIdByDrawId`, projected as `receiptPaymentTransactionId: string | null` on both `ContractorProjectView.drawRequests[]` and `ClientProjectView.drawRequests[]`. The Receipt link renders conditionally on this.
- **UI wiring:** Receipt span in `commercial/.../payments-view.tsx` → conditional `<a href="/receipts/{id}">`. Download-all buttons in `commercial/.../photos/photos-view.tsx` and `residential/.../progress/progress-view.tsx` → hit the photos ZIP route. `projectId` was threaded through `ResidentialProgressView` props to enable that.
- **Bonus in same commit:** scaffolded `.eslintrc.json` (`next/core-web-vitals` + `next/typescript`, with `^_`-prefix ignored for unused vars) and swept 57 preexisting lint errors across the repo. `npm run lint` + `npm run build` both clean.
- **Commit message** diverged from the template (covered both the feature and the lint sweep). If a consistent per-step tag matters later, this commit is `0846922` and can be referenced as "Step 13 (4A.4 #13)" retroactively.

---

## Step 14 — Project Navigation Dropdown in Top Bar

> **Status: ✅ Done** (2026-04-18) — project switcher shipped in the AppShell topbar, keyboard-navigable, search-filterable, portal-scoped via `loadUserPortalContext`. See the detailed completion notes at the end of this step.

**Mode:** Safe-to-autorun
**Item:** 4A.5 #14
**Effort:** S–M
**Priority:** P1

### What this does

Users currently have to go back to the dashboard or sidebar project list to switch projects. A top-bar project dropdown lets them switch from anywhere — major UX improvement, user-flagged need.

### Tell Claude Code:

> Read `src/components/shell/AppShell.tsx` — specifically the topbar. The user's accessible projects are built by `loadUserPortalContext` in `src/domain/loaders/portals.ts` (returns `projectShortcuts`); there is no standalone `getAccessibleProjects` helper. If this step needs one, extract from `loadUserPortalContext`.
>
> Add a project dropdown to the topbar, positioned between the breadcrumbs and the right-side icons. UX:
>
> 1. The dropdown button shows the current project name (from breadcrumbs or route params) in DM Sans 13px/720.
> 2. Clicking opens a dropdown listing all projects the user has access to, role-scoped.
> 3. Each row shows project name + status dot. Typography matches sidebar project list style.
> 4. Search input at the top of the dropdown for orgs with many projects.
> 5. Selecting a project navigates to the equivalent URL in the new project — if the user is currently on `/contractor/project/A/rfis`, switching to project B lands on `/contractor/project/B/rfis`.
> 6. If the current page doesn't map cleanly (cross-project pages, settings), land on the new project's home.
> 7. Dropdown is keyboard accessible: Arrow keys navigate, Enter selects, Escape closes.
>
> The dropdown renders in every portal, but:
> - Contractor: sees their org's projects
> - Subcontractor: sees projects they're on as a sub
> - Commercial / residential client: sees projects they have portal access to
>
> Reuse the existing `getAccessibleProjects` loader. Do not bypass the portal routing — if a client user switches to a project they shouldn't see, their loader still 403s.

### What to check

- Dropdown appears in the topbar in all four portals
- Current project name is correct
- Search filters the project list
- Selecting a project lands on the equivalent page in the new project context
- Projects you don't have access to never appear in the dropdown
- Keyboard navigation works end-to-end
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 14 (4A.5 #14): Project navigation dropdown in topbar"
```

### Status: Completed 2026-04-18

Notes on deviations from the spec above:

- **Pre-existing cap removed.** `loadUserPortalContext` in `src/domain/loaders/portals.ts` was capping project lists at 5 per portal option — which also silently hid projects 6+ from the sidebar, not just the dropdown. Extracted `getAccessibleProjects(appUserId, portalType)` as the spec suggested; `loadPortalShell` now uses it for the uncapped list, so the sidebar and dropdown share the same data. `projectShortcuts` in `loadUserPortalContext` stays capped at 5 for its original portal-selector/overview use case.
- **ShellProject gained an optional `id`.** Set by `loadPortalShell` so the switcher can match the current URL's project id without re-parsing href strings.
- **Switcher lives inline in `AppShell.tsx`.** Tight coupling to topbar CSS and single consumer, so a separate file would have added indirection for no benefit. Rendered between breadcrumbs and the right-side actions.
- **Topbar layout switched from `justify-content: space-between` to `gap + margin-left:auto` on `.b-tr`.** With 4 topbar children, space-between spread them awkwardly; the new rule clusters breadcrumbs + switcher on the left and actions on the right.
- **Subsection carry-over:** when switching from `/{portal}/project/A/billing/draw/5`, lands on `/{portal}/project/B/billing/draw/5`. If that deep URL doesn't exist in project B, project B's own loaders 403/404 as normal — no short-circuit in the switcher.
- **Cross-project pages** (`/{portal}/dashboard`, `/{portal}/settings`, etc.): button label shows "Select project" and switching navigates to the new project's home (empty subsection → `project.href` only).
- **Keyboard:** Arrow up/down, Home/End, Enter, Escape. Focused row `scrollIntoView({block: "nearest"})` so long lists stay usable. Search input auto-focuses on open.
- **Empty state:** switcher renders `null` when `projects.length === 0`, so sub users added to zero projects don't see a dead button.
- **Auth not bypassed.** The dropdown only surfaces what the loader returned (role-scoped). If a client somehow navigates to a forbidden project URL, the project page's loader still throws the usual 403.

---

## Phase 4A Wrap

Run the full suite before moving on:

```bash
npm run build && npm run lint && npm run test
```

All must pass clean. If so, Phase 4A is done.

Optional sanity clickthrough (30 minutes): log in as each of the four roles, click every sidebar nav item in every portal, verify badge counts, verify sign-out, toggle dark mode, use the project dropdown to switch projects, download a payment PDF, download a photo ZIP. If all of that feels polished, you're ready for 4B.

---

# Phase 4B — Core Feature Gaps

**Target:** Days 6–25 of Phase 4+ work. Resequenced by user-visible impact per unit of effort.

**Rule:** Notification UI ships first. Every module feels more alive once the bell works.

**Total:** 10 items across 6 subgroups.

**Acceptance for Phase 4B:** Bell icon shows unread count everywhere. Global cmd+K search works across projects and modules. Daily logs, punch list, submittals modules ship with full CRUD and portal-scoped visibility. Document versioning and categories in place. Gantt view renders for projects with scheduled tasks. Reports dashboard shows project health, financial rollup, and workflow aging at a glance.

---

## Step 15 — Notification Center UI

> **Status: ✅ Done** (2026-04-18) — commit `2a84e0d`. Bell + dropdown + persistent `/notifications` page across all four portals, with unread badge, mark-read/mark-all-read, and `emit.ts` helper wired into route handlers. See the detailed completion notes at the end of this step.

**Mode:** Require-design-input
**Item:** 4B.1 #15
**Effort:** S (in scope terms — UI only; data model is done)
**Priority:** P0

### What this does

The notification data already writes to the DB from Phase 1 — every audit event that should notify someone does. What's missing is the UI: the bell icon with unread count, the dropdown with recent notifications, and a persistent full-history page.

This is the highest-leverage item in the entire build plan. Every module feels more alive once the bell works.

### Tell Claude Code:

> Read the notifications-related schema file (search `db/schema/` for `notifications`) and any existing notifications loader. Also read the Phase 1 audit event writer — notifications are typically derived from audit events, but verify.
>
> Before writing code:
>
> 1. Confirm the notification row shape: recipient userId, type, title, body, linkUrl, createdAt, readAt (nullable).
> 2. Confirm how types map to portal-specific copy ("CO #4 approved" vs. "Scope Change #4 approved" for residential).
> 3. Propose the UI:
>    - Bell icon in topbar, with a red dot if any unread exist, count badge if 1–99, "99+" above that
>    - Dropdown on click: recent 10 notifications, each a row with type icon, title, body preview (1 line), time ago, unread highlight
>    - Row click navigates to `linkUrl` and marks read
>    - "Mark all read" button at dropdown top
>    - "See all" link at dropdown bottom → persistent notifications page
>    - Persistent page at `/notifications`: full history, filterable by project and by type, paginated
>
> Stop and confirm before implementing. Specifically:
> - Do we want real-time updates via SSE/WebSocket, or poll-on-focus (simpler)?
> - Do we show the bell in the marketing topbar too? (No — marketing is public.)
> - Does "mark read" update on dropdown open, on scroll, or on explicit click? (Default: explicit click or navigate-away; dropdown open does not mark read.)
>
> After confirmation:
>
> 4. Build the bell component at `src/components/shell/NotificationBell.tsx`.
> 5. Build the dropdown at `src/components/shell/NotificationDropdown.tsx`.
> 6. Build the persistent page at `src/app/(portal)/[portal]/notifications/page.tsx` — one file, routed by dynamic segment, scoped to whichever portal the user is in.
> 7. Loader `getNotifications(context, { limit, offset, filters })` in `src/domain/loaders/notifications.ts`.
> 8. Action `markNotificationRead(id, context)` with auth (only the recipient can mark their own).
> 9. Action `markAllNotificationsRead(context)` batch variant.
> 10. Wire the bell into `AppShell` topbar. It reads unread count from the loader.
> 11. Apply portal-specific copy transforms: residential sees "Decisions" and "Scope Changes", commercial sees "Change Orders" and "Approval Center", etc.

### What to check

- Bell icon appears in topbar in all four portals
- Unread count reflects reality (cross-check by querying the notifications table)
- Click a notification → navigates correctly and marks read
- "Mark all read" clears all unread
- Persistent page shows full history, filters work, pagination works
- Residential user sees residential language; commercial user sees commercial language
- Unauthorized read-marking (another user's notification) returns 403
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 15 (4B.1 #15): Notification center — bell, dropdown, persistent page"
```

### Status: Completed 2026-04-18 (commit `2a84e0d`)

Notes on deviations from the spec above:

- **Schema additions beyond the spec's minimal shape:** added `source_audit_event_id` FK (traceability), `project_id` (per-project filtering + future sidebar badges), and `related_object_type`/`related_object_id` (used by the routing helper to construct deep links). Dedup is tolerate-duplicates — a strict unique constraint would reject legitimate re-notifications (e.g. a CO resubmitted after revision should notify again) and a time-windowed partial index isn't supported in Postgres (index predicates must be immutable). TODO left in the schema file for a 90-day retention sweep via Trigger.dev.
- **Emission architecture:** built a shared `emitNotifications(...)` helper in `src/lib/notifications/emit.ts` that takes a payload + the actor, resolves recipients internally, and fans out. Callers never construct per-portal copy themselves — the helper looks up catalog entries and calls the per-(event, portal) copy renderer in `src/lib/notifications/routing.ts`. Residential gets "Scope Change" vocabulary; commercial gets "Change Order". Actor is always filtered out.
- **Recipient resolver:** `getEventRecipients()` in `src/lib/notifications/recipients.ts` owns the per-event audience rules (projectContractors / projectClients with subtype filter / projectSubs with org filter / conversationParticipantsFor). Keeping these rules in one file avoids drift across routes. Contractor staff use the project-membership fallback from `getEffectiveContext` (implicit project access without an explicit PUM row).
- **Poll-on-focus over SSE** — poll every 60s while visible, refetch on focus, suspended on hidden tabs. Confirmed with user per the stop-and-ask.
- **Mark-read: explicit click or navigate-away only.** Opening the dropdown does NOT mark rows read.
- **In-app preferences respected at emit time**, not at read time — if a user turns a pref back on later, they don't retroactively see a flood.
- **Per-project unread counts** — `getUnreadNotificationCountByProject` in the loader returns `Record<projectId, count>` including a synthetic `__org__` bucket for notifications without a project. Nothing consumes it yet; available for future sidebar badge work.
- **Event slice shipped (8 + dual-write):** `co_submitted`, `co_approved`, `co_needs_approval`, `scope_change`, `approval_needed`, `selection_confirmed`, `draw_submitted`, `draw_review`, `draw_approved`, `rfi_new`, `rfi_assigned`, `message_new`, `upload_request` (on create) — plus a dual-write in the overdue-upload-request reminder job. Covers contractor, subcontractor, commercial, and residential demo paths.
- **Four thin portal pages** delegate to a shared `NotificationsPage` component. Restructuring `(portal)` to use a single `[portal]` dynamic segment wasn't worth it for this.
- **Migration is hand-applied.** `npm run db:migrate` doesn't work in this repo (no drizzle journal — existing migrations use psql/Neon paste-in per the `0001_org_settings_fields.sql` header). User applied `0008_notifications.sql` by hand.
- **Commit message** diverged slightly from the template — uses "notification center" as shorthand instead of the full "bell, dropdown, persistent page".

---

## Step 16 — Notification Preferences

> **Status: ✅ Done** (2026-04-18) — commit `cb27453`. Per-channel (email/in-app) × per-event-type preferences live in the Settings "Notifications" tab; `emit.ts` respects `inApp === false` at emit time; audit writes are always preserved. Settings tabs now deep-link via `?tab=...`. See the detailed completion notes at the end of this step.

**Mode:** Safe-to-autorun
**Item:** 4B.1 #16
**Effort:** S
**Priority:** P1

### What this does

Pairs with Step 15. Users can now see notifications; this step lets them tune which ones they want and through which channel (email vs in-app, and optionally SMS if that channel exists). Standard SaaS expectation.

### Tell Claude Code:

> Read the notification schema and any existing email-sender. Confirm the event-type taxonomy (RFI assigned, RFI responded, CO submitted, CO approved, draw submitted, draw approved, compliance expiring, upload request created, etc. — full list).
>
> Add a `notification_preferences` table (or a JSON column on users, depending on what fits our schema style — **if schema change, stop and ask**). Schema: userId, eventType, emailEnabled, inAppEnabled, smsEnabled (for future; default false and disabled).
>
> Build the UI at `src/app/(portal)/[portal]/(global)/settings/notifications/page.tsx`:
> - A grouped list of event types by category (Workflows, Billing, Compliance, Messages, Projects)
> - For each event: checkbox for email, checkbox for in-app
> - Default all new users to all-in-app + critical-events-email (COs, draws, compliance expiring)
> - "Save" button at the bottom; inline save is nicer but batch-save is simpler — go with whichever fits the Phase 3 settings-page pattern
>
> Hook into the notification-writing path:
> - When an event fires, check the recipient's preferences. If emailEnabled is false for that event, skip the email send. If inAppEnabled is false, skip the notification row.
> - If both are false, still write the audit event but suppress any user-facing notification.
>
> Update the notification bell + dropdown from Step 15 to respect the in-app preference.

### What to check

- Preferences page shows all event types with toggles
- Turning off in-app for a type: that type no longer appears in the bell/dropdown
- Turning off email for a type: no email sent on that event (verify by triggering the event and checking the email log)
- Defaults match the spec (all in-app, critical-only email)
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 16 (4B.1 #16): Notification preferences — per-channel, per-event-type"
```

### Status: Completed 2026-04-18

Most of Step 16's scope was already shipped earlier as part of the settings wire-up and Step 15's emit helper. The audit at commit time confirmed the following were already in place:

- **Schema:** `user_notification_preferences` (userId, portalType, eventId, email, inApp) — no `smsEnabled` column. Spec calls for it as "default false and disabled" (placeholder for a channel that doesn't exist yet); adding the column now would be dead schema, so deferred until an SMS sender is scoped.
- **Catalog:** `NOTIFICATION_GROUPS` per portal with category groupings, plus `CRITICAL_EMAIL_EVENTS` + `defaultNotificationPrefs(portalType)` matching the spec's "all-in-app, critical-only-email" default.
- **Settings UI:** `NotificationsTab` in the shared `SettingsShell` (an entry in `BASE_TABS`, so it renders for all four portals). Grouped toggles for email + in-app per event, batch Save via `SaveBar`, Reset-to-defaults button. Matches the Phase 3 settings-page pattern the spec points to.
- **Save route:** `PUT /api/user/notifications` with `validEventIdsFor` gate + reset branch.
- **In-app preference respected at emit time:** Step 15's `emit.ts` queries the prefs table per recipient and skips rows where `inApp === false`, without touching audit writes. "Both channels off still writes the audit event but suppresses the user-facing notification" holds by construction because audit and emit are sibling calls in route handlers, not nested.
- **Bell + dropdown respect in-app:** implicit — the bell reads from the `notifications` table; rows blocked by the in-app pref were never written.

Remaining items finished in this mini-commit:

- **Deep-link support:** `SettingsShell` now reads `?tab=<id>` from the URL on mount and lands on that tab when it's a valid tab for the portal, falling back to Profile otherwise.
- **Fixed the persistent notifications page link:** the "Notification preferences →" link now targets `/{portal}/settings?tab=notifications` instead of landing on the Profile tab.

Not in scope (future work):

- **Email gate at emit.** No email sender exists in the codebase yet. When one lands (Postmark/SendGrid integration is scoped separately in Phase 4+), the gate pattern is `if (pref?.email !== false) sendEmail(...)` alongside the existing in-app check in `emit.ts`. Spec's "no email sent on that event" check is N/A until then.
- **SMS preference.** Deferred with the SMS channel itself.

---

## Step 17 — Global Command Palette (cmd+K Search)

> **Status: ✅ Done** (2026-04-18) — commits `409ffe2` + `aa11641`. Global cmd/ctrl+K palette with portal-scoped search across projects, RFIs, change orders, documents, messages, and people; keyboard navigation; follow-up fix removed a duplicate sidebar trigger and unbroke search.

**Mode:** Require-design-input
**Item:** 4B.2 #17
**Effort:** M
**Priority:** P1

### What this does

Standard SaaS primitive. A search palette opens from anywhere via cmd/ctrl+K, searches across projects, RFIs, COs, documents, messages, and people, and lets users navigate by keyboard. Role-scoped — subs don't see contractor-private data.

### Tell Claude Code:

> Before writing code, propose:
>
> 1. Library choice: `cmdk` (React library specifically for command palettes, widely used, matches our aesthetic) vs. hand-rolled (more control, more work). Recommend `cmdk` unless you have a reason to differ. **If new dep, stop and ask.**
> 2. Search scope per portal:
>    - Contractor: all their org's projects, all RFIs/COs/documents/messages, all people (team + subs + clients)
>    - Subcontractor: projects they're on, RFIs/uploads assigned to their org, their own messages, their team
>    - Commercial client: their projects, CO approval queue, their messages, project team contacts
>    - Residential client: same shape as commercial but with residential language
> 3. Scoring: simple substring match is fine for V1. Fuzzy matching (Fuse.js) is nicer but adds a dep.
> 4. Index strategy: query on every keystroke (simple, fine for dozens of records per user) vs. pre-built index (complex, worth it only at 1000s of records per user). Go simple.
>
> Confirm before installing `cmdk` or similar.
>
> After confirmation:
>
> 1. Build `src/components/shell/CommandPalette.tsx` — a portal-aware palette that listens for cmd+K, meta+K, and ctrl+K globally.
> 2. Loader `getGlobalSearchResults(context, query)` in `src/domain/loaders/search.ts`. Runs scoped queries in parallel across projects, RFIs, COs, documents, messages, people, and returns a typed, grouped result set.
> 3. Palette UI:
>    - Input at top with placeholder "Search projects, RFIs, people..."
>    - Results grouped by type (Projects, RFIs, Change Orders, Documents, People)
>    - Each result: icon, primary text, secondary text (project name, date, etc.)
>    - Keyboard navigation: ↑↓ through results, Enter to navigate, Esc to close
>    - Click a result → navigate to the record's detail page
>    - Empty input shows "Recent" (last 5 records the user touched) — optional V1.1
> 4. Mount the palette in `AppShell` so it's available from every page.
> 5. Add a subtle "⌘K" hint next to the topbar breadcrumbs (or integrated into the search icon if topbar has one).

### What to check

- cmd/ctrl+K opens the palette from any page in any portal
- Typing a query returns relevant results within ~100ms
- Keyboard navigation works (arrows, enter, escape)
- Clicking a result lands on the correct page
- A subcontractor search for a contractor-only document returns zero results (verify scope)
- Works with both cmd (Mac) and ctrl (Windows/Linux)
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 17 (4B.2 #17): Global command palette / cmd+K search"
```

---

## Step 18 — Daily Logs Module ✅ DONE

**Mode:** Require-design-input
**Item:** 4B.3 #18
**Effort:** M
**Priority:** P1
**Shipped:** commit `60eb92a` (Apr 18 2026)

### Completion notes

Delivered to spec across all four portals. Contractor creates + authors with weather autofill (Open-Meteo + lazy Nominatim geocoding), 24hr edit window, amendment workflow with approve/reject review, per-sub crew entries with reconciliation ack flow. Subs submit their own crew entries (cross-project view), acknowledge GC reconciliations. Commercial client sees redacted list + detail. Residential client gets the friendlier "Journal" feed with mood pills + team notes + progress bar. PDF export (role-aware, three templates via `@react-pdf/renderer`). Photo upload drawer reuses R2 presign flow; photos render via presigned URLs across all detail views. Seed populates ~24 logs across four projects.

Schema: 6 tables (`daily_logs`, `daily_log_crew_entries`, `daily_log_delays`, `daily_log_issues`, `daily_log_photos`, `daily_log_amendments`) + `projects.timezone` / `latitude` / `longitude` / `geocodedAt`. Migrations `0009_daily_logs.sql` + `0010_project_coordinates.sql`.

Deferred to later phases: offline capture (Phase 6, Step 51), client sign-off workflow (not shipping this product), drawing-coord location attach (Phase 6).

### What this does

Core commercial field module. Every GC expects daily logs. Each log captures: date, weather, crew present (per sub), work performed (notes), photos, delays (type + description + hours lost), issues/incidents. Daily logs are the primary record of what happened on-site and become critical evidence in disputes.

### Tell Claude Code:

> Before writing code, propose the schema:
>
> 1. `daily_logs` table: id, projectId, logDate (date, not datetime), reportedByUserId, weather (JSON or structured: conditions, high, low, precipitation), crewSummary (JSON: per-sub-org headcount and hours), notes (text), delays (JSON array: type, description, hours, impactedActivity), photos (relation to documents or inline blob refs), createdAt, updatedAt.
> 2. One log per project per day; if two users attempt to log the same day, the second opens the existing log for editing with an audit entry.
> 3. Author can edit for 24 hours after submission; after that, edits create an amendment linked to the original log.
>
> **Schema change — stop and ask before migrating.**
>
> After confirmation:
>
> 1. Migration: create `daily_logs` table with the agreed shape.
> 2. Loaders: `getDailyLogs(context, projectId, { from, to })` for list view, `getDailyLog(context, logId)` for detail.
> 3. Actions: `createDailyLog(input, context)`, `updateDailyLog(logId, input, context)`, `amendDailyLog(logId, amendment, context)`.
> 4. Authorization: contractor can see all logs in their projects, sub can see all logs for projects they're on, clients see redacted view (no crew hours, just activity summary).
> 5. UI pages:
>    - List view at `src/app/(portal)/contractor/project/[projectId]/daily-logs/page.tsx`: calendar grid showing logged days (green) vs. missing days (red/gray), list view toggle
>    - Detail view `[logId]/page.tsx`: full log with all sections
>    - Create/edit as a side panel or dedicated `/new` route
> 6. Weather autofill: if we have a weather API (we don't, but allow manual entry); if not, manual entry required on create.
> 7. Photo attach reuses document upload infra.
> 8. Audit events on create, update, amend.
> 9. Client portal view: simplified read-only daily log summary (no financials, no crew details, yes weather + work summary + photos).
>
> Mobile-friendly layout — field users create logs from job sites. Phase 6 will add offline; Phase 4B just needs responsive.

### What to check

- Contractor can create a daily log for today, with weather, crew, notes, a delay, and 2 photos
- Next day, cannot retroactively edit yesterday's log after 24hrs — amendment flow kicks in
- Sub can see logs for projects they're on
- Client sees redacted view
- Calendar grid shows which days are logged
- Photos render in the log detail view
- Audit events fire on every create/update/amend
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 18 (4B.3 #18): Daily logs module"
```

---

## Step 19 — Punch List Module ✅ DONE

**Mode:** Require-design-input
**Item:** 4B.3 #19
**Effort:** M
**Priority:** P1
**Shipped:** Apr 18 2026

### Completion notes

Delivered spec-exact to `builtcrm_punch_list_workflow_paired.jsx` (contractor + sub) and `builtcrm_walkthrough_items_residential.jsx` (residential). `clientFacingNote` column shipped as approved; commercial view deferred to Phase 5 per handoff doc; residential uses "Walkthrough Items" label and is phase-gated to `currentPhase === 'closeout'`. State machine enforced in the action layer with locked system-comment phrasing matching the handoff doc verbatim.

Schema: 3 tables (`punch_items`, `punch_item_photos`, `punch_item_comments`) + 2 enums (`punch_item_priority`, `punch_item_status`). Migration `0011_punch_list.sql`.

UIs: shared contractor/subcontractor workspace switches accent (purple ↔ warm orange `#c17a1a`) + summary-strip layout (6 cards ↔ 4 cards) + available transitions per role. Residential walkthrough-items page shows empty-state help card when not in closeout, otherwise groups items into Ready-to-check / Being-worked-on / All-done buckets with friendly labels (raw enum names never appear). Photo lightbox and R2 photo-upload drawer shared with daily-logs infra. Assignee dropdown filters to active subcontractor memberships only.

Notifications: 4 new events (`punch_item_assigned`, `punch_item_ready_to_verify`, `punch_item_verified`, `punch_item_rejected`) with per-portal copy. All four flagged as critical-email.

Seed: 6 items per commercial project spanning all statuses (incl. one rejected + one voided) + 4 items per residential project with `clientFacingNote` populated. Harper Residence Kitchen Remodel flipped to `closeout` phase so the residential UI has data; the other residential project (Harper ADU) stays in `phase_1` so the empty-state path is also demonstrable.

### What this does

Project closeout piece. A punch list captures items flagged during walkthrough that need correction before final acceptance. Each item has: location, description, assignee (often a sub), photo, priority, status (open / in-progress / ready-to-verify / verified / rejected), due date.

Phase 5 Step 45 (Inspections) will tie in here — failed inspection line items auto-generate punch items.

### Tell Claude Code:

> Propose schema:
>
> 1. `punch_items` table: id, projectId, number (sequential per project), title, description, location (free text + optional drawing coord for Phase 6), photoIds (array relation), assigneeUserId (nullable), assigneeOrgId (for sub orgs), priority enum (low/normal/high/urgent), status enum (open/in_progress/ready_to_verify/verified/rejected), dueDate (nullable), createdByUserId, verifiedByUserId (nullable), verifiedAt (nullable), createdAt, updatedAt.
> 2. State machine:
>    - open → in_progress (when assignee starts)
>    - in_progress → ready_to_verify (when assignee claims done)
>    - ready_to_verify → verified (when GC confirms) OR → rejected (with reason, back to in_progress)
>    - any state → void (cancelled with reason)
> 3. **Schema change — stop and ask before migrating.**
>
> After confirmation:
>
> 1. Migration + loaders + actions following the established Phase 1 pattern (create, update, transitionStatus with state-machine guards).
> 2. UI pages:
>    - List at `src/app/(portal)/contractor/project/[projectId]/punch-list/page.tsx`: table with columns (number, title, assignee, status pill, priority, due, age). Filter by status, assignee, priority. Summary strip at top.
>    - Detail panel (slide-in): full item with photo gallery, state transition buttons, comment thread.
>    - Create form: modal or side panel.
> 3. Subcontractor view at `src/app/(portal)/subcontractor/project/[projectId]/punch-list/page.tsx`: only items assigned to their org. Can transition to ready_to_verify, cannot verify.
> 4. Client view (optional, simpler): read-only list of items, no transitions. Only visible after substantial completion (configurable per project).
> 5. Audit events on every state change.
> 6. Mobile-friendly (field usage).
> 7. Residential language: "Walkthrough Items" or similar in residential portal (confirm copy with me before coding).

### What to check

- Contractor creates a punch item with a photo and assigns to a sub
- Sub sees it in their punch list, transitions to in_progress then ready_to_verify
- Contractor verifies; status flips to verified
- Rejected flow: contractor rejects with reason, sub sees reason, item back to in_progress
- Filters and summary counts work
- Client sees read-only view (if enabled for project)
- Residential uses "Walkthrough Items" copy
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 19 (4B.3 #19): Punch list module"
```

---

## Step 20 — Submittals Module ✅ DONE (2026-04-18)

**Mode:** Require-design-input
**Item:** 4B.3 #20
**Effort:** M
**Priority:** P1

### Completion notes
- 3 tables shipped (`submittals`, `submittal_documents`, `submittal_transmittals`) + 4 new enums. `document_category` enum added inline with `submittal` + `other`; Step 21 will extend with the full taxonomy.
- `portal_type` enum extended with `external_reviewer` — schema prep for Step 20.5. No rows use the value yet.
- Reviewer identity stored as text fields on `submittals` row (`reviewer_name`, `reviewer_org`, `reviewer_email`) — one reviewer per cycle; advisor-approved deviation from the original per-transmittal design.
- `submittal_transmittals.notes` (freeform cover-letter body) and nullable `document_id` are deliberate additions beyond the guide — called out explicitly in the migration and commit message.
- State machine enforced in the action layer per the locked transition table. Revise-and-resubmit spawns a new draft via a separate `POST /api/submittals` call with `revisionOfId` set; the original row stays in `revise_resubmit` until the GC forwards it + closes.
- Scope decision: Path C. GC logs reviewer activity end-to-end (no reviewer portal). Every `submittal_transmittals` row carries `transmitted_by_user_id` = the GC user → full audit trail. Step 20.5 (below) layers on the external reviewer portal later.
- 2 notification events wired: `submittal_submitted` (routes to GC), `submittal_returned` (routes to the submitting sub org). Both flagged critical-email.
- UI: shared workspace component across contractor + subcontractor pages; contractor gets the 6-card summary strip + full action set; sub gets the 4-card version with submit + start-revision only.
- Nav: Submittals wired into contractor + subcontractor project sidebars (between Punch List and RFIs).

---

## Step 20.5 — External Reviewer Portal ✅ DONE (2026-04-18)

**Mode:** Require-design-input
**Effort:** M
**Priority:** P2
**Depends on:** Step 20 (ships the `external_reviewer` portal_type enum value and the submittal_transmittals infrastructure this portal sits on top of).

### Completion notes
- Schema: migration `0013_submittal_reviewer_invitations.sql` extends the existing `invitations` table with `scope_object_type` + `scope_object_id` columns (generic design so future change-order / RFI reviewer invites plug in without bifurcating invitation logic).
- Reviewer identity: invite-creation upserts a `users` row by email. No Better Auth account — the token IS the session. That user id appears on `submittal_transmittals.transmitted_by_user_id` and `submittal_documents.attached_by_user_id` for the reviewer's actions → full audit trail anchored to a real user record.
- Single-use token, configurable expiry (default 14d, min 1d, max 180d). Pending → accepted on decision submission; hard-lock, no edit window. Re-invitation is the escape hatch.
- New API routes: `POST /api/submittals/[id]/invite-reviewer` (GC-only; creates user + invitation + transmittal + transitions submittal to under_review), `POST /api/reviewer/[token]/upload-request` + `/attach-document` + `/decision` (all token-authenticated via `lib/submittals/reviewer-auth.ts`).
- New route: `/reviewer/[token]` — unprotected by middleware (the token is auth). Renders the reviewer workspace (metadata header, sender context, package docs, decision radios, dropzones for stamp + comments, submit). Renders the dedicated expired-token screen for `not_found | expired | consumed | revoked | invalid_scope` with inviting-GC contact info.
- Dual-button ForwardReviewerModal: primary "Send invitation link" (20.5 flow), secondary underlined link "Record contact only (no portal)" (20 escape hatch). Primary renders a success state post-send with the invite URL + copy-to-clipboard for manual forwarding.
- One new notification: `submittal_reviewer_responded` fires to the GC when the reviewer submits, so the GC knows to come back and forward the result to the sub.
- Email stub: invite-reviewer logs the URL to console. Trigger.dev email job hook-up is a separate later step.

### What shipped (files)
- `src/db/migrations/0013_submittal_reviewer_invitations.sql`
- `src/db/schema/identity.ts` — `invitations.scopeObjectType` + `scopeObjectId`
- `src/lib/submittals/reviewer-auth.ts` — token validator
- `src/app/api/submittals/[id]/invite-reviewer/route.ts`
- `src/app/api/reviewer/[token]/{upload-request,attach-document,decision}/route.ts`
- `src/app/reviewer/[token]/{page.tsx,workspace.tsx,expired.tsx}`
- Updated `notification-catalog.ts`, `notifications/recipients.ts`, `notifications/routing.ts`
- Updated `src/app/(portal)/contractor/project/[projectId]/submittals/workspace.tsx` — dual-button ForwardReviewerModal

---

### What this does

Commercial GC table stakes. Submittals are the formal review workflow for product data and shop drawings: sub sends a submittal package, GC routes to architect/engineer for review, reviewer returns with a stamp (approved, approved as noted, revise & resubmit, rejected), GC forwards the result back to sub.

Distinct from RFIs (which are questions) and change orders (which are scope changes). Each submittal is tied to a spec section.

### Tell Claude Code:

> Propose schema:
>
> 1. `submittals` table: id, projectId, number (sequential), specSection (text — the CSI division/section), title, type enum (product_data, shop_drawing, sample, mock_up, calculations, schedule_of_values), submittedByOrgId (sub), routedToOrgId (architect/engineer; nullable if direct-review), status enum (draft, submitted, under_review, returned_approved, returned_as_noted, revise_resubmit, rejected, closed), submittedAt, returnedAt, revisionOfId (nullable, links to prior revision), dueDate (nullable), createdByUserId.
> 2. `submittal_documents` join table: submittalId, documentId, role enum (package, reviewer_comments, stamp_page).
> 3. `submittal_transmittals` table: submittalId, direction enum (outgoing_to_reviewer, incoming_from_reviewer, forwarded_to_sub), transmittedAt, transmittedByUserId, documentId (the cover letter or transmittal sheet).
> 4. State machine:
>    - draft → submitted (sub sends)
>    - submitted → under_review (GC forwards to reviewer)
>    - under_review → returned_approved / returned_as_noted / revise_resubmit / rejected (reviewer responds)
>    - revise_resubmit creates a new submittal with revisionOfId set; original closes
>    - any terminal state → closed
> 5. **Schema change — stop and ask before migrating.**
>
> After confirmation:
>
> 1. Migrations, loaders, actions.
> 2. Authorization: GC is the primary manager; sub submits and sees own submittals; reviewer (if external) is invited via a scoped link (reuse invitation system).
> 3. UI:
>    - Contractor list view: filterable table with spec section, number, title, status pill, due, age. Summary strip (total, in review, returned, overdue).
>    - Detail panel: document bundle, transmittal history, reviewer stamp page, state transition buttons.
>    - Sub view: only submittals from their org, can create and revise.
>    - Create form: new submittal wizard (upload package, specify spec section + type, route).
> 4. Audit events on every state change.
> 5. Document category: submittals documents are tagged with the new `submittal` category (which depends on Step 21 — ship category system first, or create category inline in this step).
> 6. Mobile-friendly read-only view for field access.

### What to check

- Sub creates and submits a submittal package
- GC sees it, routes to an external reviewer
- Reviewer receives and returns with "approved as noted"
- GC forwards result to sub, submittal closes
- Revise-resubmit creates a new submittal linked to the original
- Filters + summary counts correct
- Spec section field supports typical CSI format (e.g., "033000" or "03 30 00")
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 20 (4B.3 #20): Submittals module"
```

---

## Step 21 — Document Categories ✅ DONE (2026-04-18)

**Mode:** Safe-to-autorun
**Item:** 4B.4 #21
**Effort:** S–M
**Priority:** P1

### Completion notes
- Enum extended in place (not replaced). Step 20 had shipped `document_category` with `['submittal', 'other']` and a `category` column already on `documents`; Step 21 added the remaining 7 values and kept `submittal` singular.
- Migration split across two files: `0014_document_categories.sql` (ALTER TYPE ADD VALUE × 7, IF NOT EXISTS guards) and `0015_document_categories_backfill.sql` (UPDATE CASE). Split is mandatory — Postgres forbids using a freshly-added enum value in the same transaction, and Drizzle wraps each migration file in one transaction.
- Backfill went further than the guide's "default existing rows to `other`" — mapped `photo_log`, `daily_log_photo`, `punch_item_photo` → `photos`; `lien_waiver` → `billing_backup`; `compliance`, `insurance` → `compliance`; plus the UI-typed plurals (`drawings`, `submittals`, etc.). Empty Photos bucket on day one would have been bad UX; the obvious mappings are covered.
- Enum order is "misc at the bottom" (drawings, specifications, submittal, contracts, photos, permits, compliance, billing_backup, other) so iterating enum values into a dropdown produces the right UX.
- Residential portal rail collapsed to 5 entries: Plans & Specs (drawings + specifications flat-listed), Contracts, Photos, Permits, Other. Back-office categories (`submittal`, `compliance`, `billing_backup`) hidden entirely via `RESIDENTIAL_HIDDEN_CATEGORIES` — enforced as a second-line guard in the residential documents view in addition to the loader's audience filter.
- Category-based visibility defaults cascade only at upload-modal pre-fill time. The loader reads stored `visibilityScope`/`audienceScope` directly; category is never consulted for access decisions. Explicit user selections in the upload form win over cascaded defaults.
- Shared helper at `src/lib/document-categories.ts` is the single source of truth — keeps the enum list, labels, derivation fallback, residential rail, hidden categories, and upload defaults in one place for both server and client.
- Supersede route carries `prior.category` forward so version chains keep a stable category.

### What this does

The flat document list starts to break down past ~50 docs. This step adds typed folders: Drawings, Specifications, Submittals, Contracts, Photos, Permits, Compliance, Billing Backup, Other. Categories filter the document list and cascade sensible defaults (visibility, retention).

### Tell Claude Code:

> Read the documents schema (search `db/schema/` for `documents`). Check if there's already a category/folder column; if not, we need one.
>
> Propose:
> 1. Add `category` column to the documents table: enum or text (enum preferred — drawings, specifications, submittals, contracts, photos, permits, compliance, billing_backup, other).
> 2. Default for existing rows: `other` on migration.
> 3. **Schema change — stop and ask before migrating.**
>
> After confirmation:
>
> 1. Migration.
> 2. Update the documents loader to support filtering by category.
> 3. Update the documents UI at `src/app/(portal)/[portal]/project/[projectId]/documents/page.tsx`:
>    - Left rail: category tree with counts per category
>    - Main pane: filtered document list
>    - Upload modal: category selector, with smart default based on upload context (photos upload in daily logs default to `photos`, submittal uploads default to `submittals`)
> 4. Residential simplifies the list (collapses technical categories — "Plans & Specs" instead of separate Drawings/Specs).
> 5. Category defaults: photos are visible to clients by default; submittals and contracts are contractor-only by default; specs/drawings depend on project setting.

### What to check

- Categories appear in the left rail of Documents page
- Clicking a category filters the main list
- Uploading a new document allows picking a category
- Existing documents default to "Other" after migration
- Residential view collapses categories correctly
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 21 (4B.4 #21): Document categories"
```

---

## Step 22 — Document Versioning

**Mode:** Safe-to-autorun
**Item:** 4B.4 #22
**Effort:** M
**Priority:** P1

### What this does

Drawings and specs get revised constantly. Users need to upload a new version without losing the old one. This step adds version chains: uploading a "new version of" an existing doc marks the old one superseded but keeps it accessible, exposes version history, and adds diff metadata where possible (page count change, file size delta).

### Tell Claude Code:

> Read the documents schema. Propose the versioning model:
>
> 1. Option A: `supersedes_document_id` column pointing to the prior version; the oldest doc is the chain head.
> 2. Option B: separate `document_versions` table with ordered revisions.
>
> Recommend Option A (simpler, fewer joins, fine for portfolio scale). **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migration: add `supersedes_document_id` column (nullable, self-reference FK).
> 2. Update documents loader to surface version history: when fetching a document, include its full chain (older supersedes).
> 3. Add "Upload new version" action on the document detail panel:
>    - User uploads a new file
>    - System creates new document row with `supersedes_document_id` = the current doc
>    - Old doc's display state flips to "Superseded" (greyed in list, accessible via history)
> 4. UI on document detail panel: version history timeline showing all versions with uploader, date, file size.
> 5. Download the current version by default; any prior version downloadable from the history.
> 6. When documents are referenced from other modules (submittals, COs), the link always points to the chain head — so a CO attached "set of drawings" always gets the latest.
> 7. Audit event: `document.superseded` on each new version.

### What to check

- Upload a document, then upload a new version → old version marked superseded
- Documents list shows only the latest version by default, with a "vN" badge
- Detail panel shows full version history with download links
- Other modules linking to the doc resolve to the current version
- Audit events fire correctly
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 22 (4B.4 #22): Document versioning with supersedes chain"
```

---

## Step 23 — Basic Gantt View

**Mode:** Require-design-input
**Item:** 4B.5 #23
**Effort:** M–L
**Priority:** P2

### What this does

Schedule table already exists from Phase 1/2. Gantt is the visualization — timeline with tasks, duration bars, dependency arrows, critical path highlight. Commercial expectation. Users can drag to reschedule (permission-gated).

### Tell Claude Code:

> Read the schedule-related schema and the existing schedule/timeline UI at `src/app/(portal)/contractor/project/[projectId]/schedule/page.tsx`.
>
> Before coding, decide:
>
> 1. Library vs. hand-roll. Options:
>    - `gantt-task-react` — solid, small, MIT. Recommend this unless you find a blocker.
>    - `frappe-gantt` — plain JS, works but needs wrapper.
>    - Hand-roll with SVG — too much work for this scope.
>
>    **New dep — stop and ask before installing.**
>
> 2. Data shape: does the existing schedule table have startDate, endDate, dependencies? If not, what's missing? If schema changes are needed, flag.
>
> After confirmation:
>
> 1. Install `gantt-task-react`.
> 2. Adapter layer at `src/lib/ganttAdapter.ts`: converts schedule table rows to gantt-task-react's `Task[]` shape.
> 3. Mount Gantt in a new view tab on the schedule page: existing timeline view + new "Gantt" tab. Default view stays as-is; Gantt is a second tab.
> 4. Critical-path highlight: a simple forward-pass calculation based on dependency chains. Library may support it; if not, compute client-side.
> 5. Drag to reschedule: library supports this via `onDateChange`. Gate with authorization — only project PM / contractor Admin can reschedule. Others see the Gantt read-only.
> 6. Subs see Gantt too (read-only), scoped to tasks their org is assigned.
> 7. Saving a drag calls an existing schedule-update action; that action logs an audit event.
> 8. If the project has no schedule data, Gantt view shows empty state with "Add tasks in the Schedule tab" CTA.
> 9. Desktop-first; mobile renders a compact list view instead of Gantt (too narrow).

### What to check

- Gantt tab appears on the schedule page for all portals
- Tasks render with correct start/end/duration
- Dependencies show as arrows
- Critical path is visually distinct
- Admin drags a task → new date persists, audit event fires
- Non-admin user cannot drag (read-only)
- Sub sees only their scoped tasks
- Mobile falls back to list view
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 23 (4B.5 #23): Basic Gantt view with critical path + drag-to-reschedule"
```

---

## Step 24 — Reports Dashboard

**Mode:** Require-design-input
**Item:** 4B.6 #24
**Effort:** M
**Priority:** P1

### What this does

Executive surface for the contractor portal. At-a-glance KPIs across all projects — project health, financial rollup, schedule status, RFI/CO aging. Drilldown navigates to the underlying module. Exportable as PDF.

### Tell Claude Code:

> Before coding, propose the dashboard layout:
>
> 1. Top strip: portfolio-wide KPIs — active projects count, total contract value, total billed, total unpaid, total open RFIs, total open COs, compliance alerts, schedule-at-risk count.
> 2. Middle: per-project summary grid or table — project name, status color, % complete, contract value, billed, schedule variance (days ahead/behind), compliance pill, open items count (RFIs + COs + approvals + punch).
> 3. Bottom: aging charts — RFI age distribution (0–7, 8–14, 15–30, 30+), CO age distribution. Simple bar charts.
>
> Recommend charting library: `recharts` if not already installed, `chart.js` if we have it. **New dep if needed — stop and ask.**
>
> After confirmation:
>
> 1. Loader `getContractorReportsData(context)` in `src/domain/loaders/reports.ts` — aggregates across all user's projects.
> 2. Page `src/app/(portal)/contractor/(global)/reports/page.tsx`.
> 3. Add "Reports" nav item to contractor sidebar (adjust `AppShell` nav config).
> 4. Each KPI is clickable where possible — "Open RFIs" → RFIs page, "Projects at risk" → filtered project list.
> 5. Per-project row click → project home.
> 6. Export to PDF: reuse the PDF export pattern from Step 13. Button at top-right of page, renders the dashboard as a PDF with timestamp.
> 7. Scope: contractor only. Subs and clients don't see a portfolio view (subs don't have one; clients only ever see one project).
> 8. Mobile: simplified single-column layout, charts collapsed.

### What to check

- Reports page renders for contractor, populated with seed data
- KPIs match what you'd count manually across projects
- Charts render correctly
- Drilldown links navigate to correct module
- PDF export produces a readable dashboard snapshot
- Subs and clients don't see this nav item or page
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 24 (4B.6 #24): Reports dashboard — portfolio KPIs + aging charts + PDF export"
```

---

## Phase 4B Wrap

Run the full suite:

```bash
npm run build && npm run lint && npm run test
```

All pass. Phase 4B is done. Optional clickthrough: log in as contractor, ring the bell (notifications should have unread), cmd+K search for a record, open the daily log calendar, add a punch item, open the reports dashboard, export it as PDF. That's 10 items of user-visible lift.

---

# Phase 4C — Accounting Integrations

**Target:** Runs parallel to 4B tail and 4D, weeks 4–8 of Phase 4+.

**Rule:** Build the infrastructure for real, but leave the connectors stubbed if they require production app approval. Stripe is the one exception — test mode is unrestricted and we run it end-to-end.

**Total:** 12 items across 3 subgroups (4C.1 infra, 4C.2 Stripe, 4C.3 accounting connectors stubbed).

**Acceptance for Phase 4C:** OAuth flow works against at least one sandbox provider (QB or Xero). Webhook receiver verifies HMAC on inbound events and retries on 5xx failures. Sync events are logged with idempotency keys. Connection UI in settings shows connect/disconnect/health per provider. Stripe test mode runs end-to-end: client pays via ACH or card, BuiltCRM state updates via webhook.

---

## Step 25 — OAuth 2.0 Generic Connection Flow

**Mode:** Require-design-input
**Item:** 4C.1 #25
**Effort:** M
**Priority:** P0

### What this does

Foundation for every accounting and third-party integration. One OAuth handler that knows how to: redirect to a provider's authorize URL with the right scopes, handle the callback, exchange the code for tokens, encrypt and store them, refresh on expiry, revoke on disconnect. Provider configs are declarative — add a new provider = add one file in the registry.

### Tell Claude Code:

> Read `docs/specs/integration_architecture_spec.md` for the intended architecture. Read `drizzle_schema_phase4_integrations.ts` for the integration tables (connections, tokens, sync_events, webhook_endpoints).
>
> Before writing code, propose:
>
> 1. Directory layout:
>    - `src/lib/integrations/providers/` — one file per provider (quickbooks.ts, xero.ts, sage.ts, stripe.ts, google.ts, etc.). Each exports a `ProviderConfig` with authorizeUrl, tokenUrl, scopes, clientIdEnvVar, clientSecretEnvVar, revokeUrl.
>    - `src/lib/integrations/oauth.ts` — the generic OAuth handler: `startOAuth(providerKey, orgId, userId)`, `handleCallback(providerKey, code, state)`, `refreshToken(connectionId)`, `revokeConnection(connectionId)`.
>    - `src/lib/integrations/registry.ts` — the provider registry, exporting a `providers` object keyed by providerKey.
>    - `src/app/api/oauth/[provider]/start/route.ts` — initiates the flow.
>    - `src/app/api/oauth/[provider]/callback/route.ts` — receives the callback.
> 2. Token encryption: use the existing secret manager pattern (if Phase 1 has one) or AES-GCM with a key from env. **Never** store raw tokens in the DB. Encrypt at rest.
> 3. State parameter: signed JWT containing orgId, userId, providerKey, nonce. Verified on callback.
> 4. Refresh loop: a Trigger.dev job that runs every 30 minutes, finds connections with tokens expiring in <5 minutes, calls refreshToken.
> 5. Disconnect: revokes the provider-side token where supported, then deletes the local connection record (or marks inactive with tombstone — propose and decide).
>
> Confirm the design before implementing.
>
> After confirmation:
>
> 1. Migration: verify the `connections` and `connection_tokens` tables from `drizzle_schema_phase4_integrations.ts` exist; if not, migrate.
> 2. Implement the generic OAuth handler and the two API routes.
> 3. Provider files for the four accounting providers (QB, Xero, Sage, Stripe) — configs only, no scope-specific logic yet.
> 4. Trigger.dev refresh job.
> 5. Encryption key: document in README how to set `INTEGRATION_ENCRYPTION_KEY` in the env.
> 6. Audit events: `oauth.connect.started`, `oauth.connect.completed`, `oauth.connect.failed`, `oauth.refresh.succeeded`, `oauth.refresh.failed`, `oauth.revoked`.
> 7. Do **not** wire the UI yet — that's Step 28.

### What to check

- Hitting `/api/oauth/quickbooks/start` (as an authenticated contractor) redirects to Intuit's authorize URL with the right scopes and state
- Callback handles a successful code exchange and stores an encrypted token
- A token ~5 min from expiry gets refreshed by the Trigger job
- Disconnect revokes and clears
- Encryption works both ways (retrieved tokens usable)
- Audit events fire on each lifecycle event
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 25 (4C.1 #25): OAuth 2.0 generic connection flow + provider registry"
```

---

## Step 26 — Webhook Receiver with HMAC Verification + Retry Queue

**Mode:** Require-design-input
**Item:** 4C.1 #26
**Effort:** M
**Priority:** P0

### What this does

Inbound webhooks from every provider (Stripe, QB, Xero, calendar, email, future). One endpoint per provider, each verifying the provider's HMAC signature style, enqueuing the event into a retry queue, returning 200 fast. Processing happens async with idempotency and retries.

### Tell Claude Code:

> Before writing code, propose:
>
> 1. One endpoint per provider: `src/app/api/webhooks/[provider]/route.ts`. Each verifies the provider's specific signature scheme (Stripe: Stripe-Signature header; QB: Intuit-Signature; Xero: x-xero-signature; generic HMAC-SHA256 base64 for others).
> 2. Verification logic in `src/lib/integrations/webhookVerify.ts` with provider-specific adapters.
> 3. On verified signature: write a `webhook_events` row (providerKey, eventType, payload, receivedAt, status='pending') and return 200 immediately.
> 4. On invalid signature: 400, do not log the payload (avoid storing forged data).
> 5. Trigger.dev job `processWebhookEvents` runs every 30 seconds, picks up pending rows, dispatches to the provider-specific processor, marks processed or failed.
> 6. Idempotency: each event has a providerEventId (from the payload); the processor checks if that ID has been handled; if yes, mark as duplicate and skip.
> 7. Retry: failed events retry with exponential backoff up to 5 attempts, then dead-letter (status='failed', surface in the admin UI).
>
> **New tables? Check `drizzle_schema_phase4_integrations.ts`. If `webhook_events` isn't there, stop and ask before migrating.**
>
> After confirmation:
>
> 1. Migration if needed.
> 2. Endpoints + verification adapters.
> 3. Trigger.dev processor job.
> 4. Initial processors: Stripe (for Step 31–33 payments), QB/Xero/Sage (stub — receive and log but don't act).
> 5. Audit events: `webhook.received`, `webhook.processed`, `webhook.failed`, `webhook.duplicate`.
> 6. Admin view: Step 28's connection UI will surface webhook health.

### What to check

- Post a valid Stripe test-mode webhook to `/api/webhooks/stripe` → 200, event logged as pending
- Post an invalid signature → 400, no log row
- Trigger job picks up the pending event and processes it
- Duplicate event (same providerEventId) is marked duplicate, not processed twice
- Failed processing retries up to 5 times, then dead-letters
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 26 (4C.1 #26): Webhook receiver with HMAC verification + retry queue"
```

---

## Step 27 — Sync Event Audit Log

**Mode:** Safe-to-autorun
**Item:** 4C.1 #27
**Effort:** S
**Priority:** P1

### What this does

Every push to a third party and every pull from a third party gets logged with an idempotency key. Makes debugging integration issues possible and shows reviewers that you thought about observability.

### Tell Claude Code:

> Read `drizzle_schema_phase4_integrations.ts` for the `sync_events` table. If missing, **stop and ask before migrating**.
>
> Implement:
>
> 1. Helper `logSyncEvent({ orgId, providerKey, direction, entityType, entityId, idempotencyKey, status, payload, errorMessage })` in `src/lib/integrations/syncLog.ts`.
> 2. Every integration action (push/pull) must call `logSyncEvent` at start (status='in_progress'), and update on completion (status='succeeded' or 'failed').
> 3. Idempotency: the logger rejects duplicate (providerKey + idempotencyKey + orgId) combinations — second call with same key returns the prior result instead of re-executing. This requires a helper `withIdempotency(key, fn)` that wraps any sync op.
> 4. Retention: default keep all events; add a cleanup job (Trigger.dev) that prunes succeeded events older than 90 days, keeps failed events indefinitely.

### What to check

- Trigger any sync (once Stripe is wired in Step 30+, test there) → sync_events row appears
- Re-run the same operation with same idempotency key → returns cached result, no duplicate row
- Failed syncs persist for inspection
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 27 (4C.1 #27): Sync event audit log with idempotency"
```

---

## Step 28 — Integration Connection UI

**Mode:** Safe-to-autorun
**Item:** 4C.1 #28
**Effort:** S
**Priority:** P1

### What this does

The settings page where users see what's connected, click connect, complete OAuth, and see health status. The prototype already exists in `docs/prototypes/builtcrm_contractor_settings_integrations.jsx` — this step wires the prototype's visual layer to the real OAuth infrastructure from Steps 25–27.

### Tell Claude Code:

> Read `docs/prototypes/builtcrm_contractor_settings_integrations.jsx` — the Integrations section(s).
>
> Build `src/app/(portal)/contractor/(global)/settings/integrations/page.tsx`. **The file already exists with a working skeleton wired to `/api/integrations/connect|disconnect|export` — enhance it, don't rebuild from scratch. See `integrations-ui.tsx` in the same directory.**
>
> 1. List of integration cards matching the prototype. Each card: provider logo (styled SVG from prototype), name, description, connect/disconnect button, status pill (Not connected / Connected / Sync error / Token expiring soon).
> 2. Click Connect → kicks off `/api/oauth/[provider]/start` → user completes OAuth → returned to this page with a success banner.
> 3. Click Disconnect → confirmation modal → revokes.
> 4. Expandable card details: last sync at, next scheduled sync, recent sync events (last 5, linked to a detail view).
> 5. For stubbed providers (accounting — QB, Xero, Sage that don't have production app review): still show the card, the Connect button works against sandbox (OAuth flow completes), but a note says "Sandbox connection only — production sync requires provider app review."
> 6. Stripe card is separate because it's fully working.
> 7. Subcontractor portal: doesn't get integrations page. Clients: don't get integrations page. Only contractors.
> 8. Update the Step 5 settings placeholder to link here.

### What to check

- Integrations page renders with all provider cards per the prototype
- Click Connect on Stripe → OAuth flow completes → card flips to Connected with status pill
- Click Disconnect → card resets
- Stubbed providers show the sandbox note
- Health status reflects real sync events
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 28 (4C.1 #28): Integration connection UI"
```

---

## Step 29 — Provider Registry Pattern

**Mode:** Safe-to-autorun
**Item:** 4C.1 #29
**Effort:** S
**Priority:** P1

### What this does

This is the cleanup step that makes the integration system look like a system instead of a pile of one-offs. Formalize the `ProviderConfig` interface so adding a new provider is genuinely one file + one registry entry. Good portfolio signal.

### Tell Claude Code:

> Refactor the provider files from Step 25 into a formal registry:
>
> 1. Define the `ProviderConfig` TypeScript interface in `src/lib/integrations/types.ts`:
>    ```ts
>    type ProviderConfig = {
>      key: string;
>      displayName: string;
>      category: 'accounting' | 'payments' | 'calendar' | 'email' | 'storage' | 'other';
>      oauth: {
>        authorizeUrl: string;
>        tokenUrl: string;
>        scopes: string[];
>        revokeUrl?: string;
>      };
>      webhooks?: {
>        signatureScheme: 'stripe' | 'hmac-sha256' | 'intuit' | 'xero' | 'custom';
>        signatureHeader: string;
>      };
>      sync?: {
>        entities: string[];
>        pullScheduleCron?: string;
>      };
>      logoSvg?: string;
>    };
>    ```
> 2. One file per provider in `src/lib/integrations/providers/`, each exporting a default `ProviderConfig`.
> 3. Registry in `src/lib/integrations/registry.ts` that imports all provider files and exports a `providers` Map.
> 4. Integration connection UI from Step 28 reads the registry, so adding a new provider automatically adds a card.
> 5. Document in `docs/specs/integration_architecture_spec.md` (or append to it): "To add a new provider, create `src/lib/integrations/providers/{key}.ts` exporting a ProviderConfig, add to registry, add a webhook endpoint if applicable."

### What to check

- Registry lists all current providers
- Integration settings page renders the list dynamically
- Adding a fake test provider (in a test branch, don't commit) renders a new card without code changes outside the provider file
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 29 (4C.1 #29): Provider registry pattern"
```

---

## Step 30 — Stripe Connect Setup for Contractor Onboarding

> **Status: ✅ Done** (2026-04-17) — Session 1 of the Client Stripe Checkout phase. Standard Connect accounts via Stripe-hosted onboarding. Reuses `integration_connections` with `provider='stripe'`, storing `details_submitted` / `charges_enabled` / `payouts_enabled` in `syncPreferences`. `account.updated` webhook flips `connectionStatus` between `connecting` / `needs_reauth` / `connected`. Routes: `POST /api/contractor/stripe/connect/onboard`. UI: Payments tab's "Set up payments" button + "Resume onboarding" / "Resolve requirements" when not fully active.

**Mode:** Require-design-input
**Item:** 4C.2 #30
**Effort:** M
**Priority:** P1

### What this does

Stripe Connect lets contractor orgs receive payments directly. Contractor goes through Stripe's hosted onboarding, verifies identity and bank account, and a connected account ID is stored. Later, client payments route to the contractor's connected account with BuiltCRM taking a platform fee (0% for now, this is portfolio).

Test mode is free and unrestricted — full end-to-end flow works without any production approval.

### Tell Claude Code:

> Read the Stripe Connect docs: https://docs.stripe.com/connect — specifically "Standard accounts" (simpler than Express for our purposes) and account-linking flow.
>
> Before writing code, propose:
>
> 1. Connect account type: Standard (Stripe handles the entire UX, we just have an account ID). Recommend Standard for simplicity; Express if we want branded onboarding.
> 2. Schema addition: `stripe_connected_account_id` column on `organizations` table, plus `stripe_connected_account_status` (pending/active/restricted), `stripe_connected_account_details_submitted` (bool). **Schema change — stop and ask.**
> 3. Flow:
>    - Contractor admin goes to Settings → Billing → "Set up payments"
>    - Click triggers `createConnectedAccount` server action → creates Stripe account, returns an onboarding link
>    - Contractor completes Stripe's hosted onboarding
>    - Stripe webhook `account.updated` fires → our processor updates the org's connected account status
>    - Once `details_submitted` is true, the org can receive payments
> 4. Dependencies: `stripe` npm package. **New dep — stop and ask.**
> 5. Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`. Document in README.
>
> After confirmation:
>
> 1. Install `stripe`.
> 2. Migration for the new org columns.
> 3. Server actions: `createConnectedAccount(context)`, `refreshConnectedAccountLink(context)` (for expired onboarding links), `getConnectedAccountStatus(context)`.
> 4. Update the Stripe card in integrations UI from Step 28: instead of generic OAuth, show "Set up payments" → hosted Stripe onboarding.
> 5. Stripe webhook processor handles `account.updated`: updates org status, writes audit event.
> 6. Audit events: `stripe.onboarding.started`, `stripe.onboarding.completed`, `stripe.account.updated`.
>
> Test mode only — all of this must work against Stripe test keys without touching real money.

### What to check

- Contractor admin clicks Set up payments → Stripe hosted onboarding loads
- Complete the onboarding with test data → redirected back to BuiltCRM
- Webhook fires, status flips to active
- `stripe_connected_account_id` persisted on the org
- Non-admin cannot trigger onboarding
- Audit events fire
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 30 (4C.2 #30): Stripe Connect onboarding for contractor orgs"
```

---

## Step 31 — ACH Draw Payments (Client → Contractor)

> **Status: ✅ Done** (2026-04-17) — Session 2 of the Client Stripe Checkout phase. ACH + card (card gated Pro+) draw payments via Stripe Checkout, routed via Connect (`destination=acct_...`, `application_fee_amount=0`). `POST /api/draw-requests/[id]/pay` endpoint creates the Checkout session + pre-inserts a `payment_transactions` row; webhook handlers (`checkout.session.completed` payment-mode branch, `charge.succeeded`, `charge.failed`) advance the row through `processing`/`succeeded`/`failed` and flip the draw's status to `paid`. Pay button wired in both residential + commercial draw-review pages once the draw is approved.

**Mode:** Require-design-input
**Item:** 4C.2 #31
**Effort:** M
**Priority:** P1

### What this does

Residential clients can pay draws by ACH directly through the portal. Payment routes via Stripe Connect to the contractor's connected account. Webhook updates BuiltCRM draw status to paid.

### Tell Claude Code:

> Propose:
>
> 1. Integration point: the draw review page in residential client portal has an "Approve & Pay" button alongside the existing "Approve" button.
> 2. Flow:
>    - Client clicks "Pay via ACH"
>    - A Stripe Checkout session is created server-side with payment_method_types=['us_bank_account'], amount = draw.amount, destination = contractor's connected account ID, application_fee_amount = 0 (portfolio).
>    - Client completes the Stripe Checkout (on Stripe-hosted page)
>    - On success, redirected back to BuiltCRM; meanwhile Stripe fires `checkout.session.completed` → our processor marks draw as paid, writes a payment record, fires an audit event.
> 3. Schema: `payments` table should already exist from `drizzle_schema_phase4_integrations.ts`. If not, **stop and ask**. Required fields: drawRequestId, stripePaymentIntentId, amount, currency, status, paidAt.
> 4. Idempotency: Stripe's session ID is the idempotency key for the payment record.
> 5. ACH settlement delay: ACH is not instant. State the draw as "Payment initiated" during the 3–5 business day settlement window, flip to "Paid" on `charge.succeeded` webhook.
>
> After confirmation:
>
> 1. Migration check.
> 2. Server action `initiateDrawAchPayment(drawRequestId, context)` creates the Checkout session, returns the URL.
> 3. Webhook processor extension: `checkout.session.completed`, `charge.succeeded`, `charge.failed` → update draw status + payment record.
> 4. UI: new "Pay via ACH" button on draw review page in residential and commercial client portals. Shows as disabled if contractor hasn't completed Connect onboarding ("Contractor hasn't set up payments yet").
> 5. Confirmation page post-Stripe: "Payment initiated. Will settle in 3–5 business days. You'll receive a confirmation when it completes."
> 6. Email notifications to both parties on initiation, settlement, and failure.
> 7. Audit events.

### What to check

- Residential client on draw review sees "Pay via ACH" button (if contractor is Connect-onboarded)
- Click → Stripe Checkout loads
- Complete with Stripe test ACH credentials (`000123456789` routing, `000123456789` account, `FIRMA` firma name)
- Redirected back, see "Payment initiated"
- Webhook fires, draw status flips to "Payment initiated"
- Simulate settlement via Stripe CLI (`stripe trigger charge.succeeded`) → status flips to "Paid"
- Unauthorized payment initiation (wrong client, wrong portal) returns 403
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 31 (4C.2 #31): ACH draw payments via Stripe Connect"
```

---

## Step 32 — Card Payments for Selections

> **Status: ✅ Done** (2026-04-17) — Session 3 of the Client Stripe Checkout phase. Residential clients pay selection upgrade overage via Stripe Checkout (card only per original spec). `POST /api/selections/decisions/[id]/pay` endpoint, reuses the Connect destination + `payment_transactions` pattern from Step 31. Plan-gated via `requireFeature(ctx, "stripe.client_pays_selections")` — Pro+ contractors only. Pay-upgrade block rendered in residential `ConfirmedView` when `option.priceCents > item.allowanceCents`.

**Mode:** Require-design-input
**Item:** 4C.2 #32
**Effort:** S
**Priority:** P1

### What this does

Residential client pays for selection upgrades (above allowance) by card. Same Stripe Connect flow as Step 31 but with `payment_method_types=['card']` and typically smaller amounts.

### Tell Claude Code:

> Reuse most of Step 31's infrastructure. Differences:
>
> 1. Integration point: residential selections flow — when a client confirms a selection that exceeds allowance, the "Confirm" button becomes "Pay upgrade & confirm" with the overage amount surfaced.
> 2. Payment method types: `['card']`. No ACH for selections (settlement delay is a worse UX for smaller amounts).
> 3. Payment record linked to the selection, not a draw.
> 4. Webhook processor handles the same events but updates the selection record.
> 5. Receipts: email receipt with line item (category, option name, upgrade amount).
>
> Implement:
>
> 1. Server action `initiateSelectionCardPayment(selectionId, context)`.
> 2. Webhook processor extension for selection payments (branch on the metadata in the Checkout session).
> 3. UI: "Pay upgrade & confirm" button on selection confirmation modal in residential portal.
> 4. Confirmation and receipt handling.

### What to check

- Residential client confirms a selection that exceeds allowance → "Pay upgrade" button shows
- Click → Stripe Checkout with card option
- Test card `4242 4242 4242 4242` → payment succeeds
- Selection confirmed, payment record linked, receipt email sent
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 32 (4C.2 #32): Card payments for selection upgrades"
```

---

## Step 33 — Payment Transaction Recording + Reconciliation

> **Status: ✅ Partial — ready side live** (2026-04-17). `payment_transactions` table rows are created + advanced through status lifecycle by Sessions 1–3 of the Client Stripe Checkout phase. Contractor Payments tab (`PaymentsView`) reads them for the payout history display. **Deferred:** reconciliation cron job that periodically confirms Stripe's view matches BuiltCRM's — logged as a follow-up.

**Mode:** Safe-to-autorun
**Item:** 4C.2 #33
**Effort:** S
**Priority:** P1

### What this does

Closes the loop. Every Stripe payment writes a local payment record; the reconciliation job periodically confirms Stripe's view matches BuiltCRM's view and flags discrepancies.

### Tell Claude Code:

> Build:
>
> 1. Payment records UI at `src/app/(portal)/contractor/(global)/payments/page.tsx` (and nav item if not present): table of all inbound payments across the contractor's projects, columns (date, project, payer, amount, method, status, related draw/selection). Filterable.
> 2. Per-payment detail: link to draw/selection, Stripe transaction ID (linked to Stripe dashboard for contractor admins), status, timeline of status changes.
> 3. Reconciliation job (Trigger.dev, runs nightly):
>    - For each contractor org with a connected Stripe account, fetch Stripe's payment list for the last 7 days
>    - Match against local payment records by Stripe ID
>    - Flag any Stripe payments missing locally (data loss scenario) — write to an admin alert + log
>    - Flag any local payments stuck in non-terminal status > 7 days (webhook loss scenario)
> 4. Audit events on discrepancies.

### What to check

- Payments page lists seed + test payments
- Filters work
- Reconciliation job runs without error against test data
- Simulate a "missing webhook" by creating a Stripe payment with the CLI and not processing → reconciliation job flags it
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 33 (4C.2 #33): Payment recording + nightly reconciliation"
```

---

## Step 34 — QuickBooks Online Connector (Stubbed)

**Mode:** Require-design-input
**Item:** 4C.3 #34
**Effort:** S (stubbed)
**Priority:** P1

### What this does

Production QB sync requires Intuit app review, which requires a registered business entity and a published app. Portfolio scope: build the connector framework, wire the UI card, complete OAuth against Intuit's sandbox, and stub the actual data sync with a "Sync now" button that writes a plausible `sync_events` row without pushing real data.

### Tell Claude Code:

> Propose:
>
> 1. QB provider config in `src/lib/integrations/providers/quickbooks.ts`: authorize URL, scopes (`com.intuit.quickbooks.accounting`), token URL, revoke URL.
> 2. Env vars: `QB_CLIENT_ID`, `QB_CLIENT_SECRET`, `QB_REDIRECT_URI` — get sandbox credentials free at developer.intuit.com. Document in README.
> 3. Stub sync operation: `syncToQuickBooks(orgId, entityType, entityId)` — logs a sync event with status='stubbed', payload shows what *would* be sent, no actual API call.
> 4. UI adjustment in integrations page: QB card has a clear "Sandbox only — production sync requires app review" label.
> 5. README.md section documenting what production deployment would require: app review application, business entity verification, privacy policy + terms URLs, OAuth app published to Intuit's marketplace.
>
> Implement:
>
> 1. Provider file.
> 2. Stub sync function.
> 3. UI updates.
> 4. README section.
> 5. Audit events on connect, disconnect, stub-sync.

### What to check

- QB card on integrations page
- Click Connect → Intuit sandbox OAuth → returns successfully
- Card shows Connected with sandbox disclaimer
- Click Sync now → sync_events row with status='stubbed'
- README clearly documents production gap
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 34 (4C.3 #34): QuickBooks Online connector stub (sandbox OAuth + stubbed sync)"
```

---

## Step 35 — Xero Connector (Stubbed)

**Mode:** Safe-to-autorun (clone of Step 34)
**Item:** 4C.3 #35
**Effort:** S (stubbed)
**Priority:** P1

### What this does

Same treatment as QB. Xero has its own sandbox and app review.

### Tell Claude Code:

> Clone the pattern from Step 34 for Xero:
>
> 1. Provider config in `src/lib/integrations/providers/xero.ts` (scopes: `accounting.transactions accounting.contacts offline_access`).
> 2. Env vars: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`.
> 3. Stub sync function with the same shape as QB's.
> 4. UI card with sandbox disclaimer.
> 5. README section for production requirements.
>
> Reuse infrastructure. Don't duplicate the sync wrapper; extend the provider registry's hooks if possible.

### What to check

- Xero card appears, OAuth completes against Xero sandbox, stubbed sync logs cleanly.
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 35 (4C.3 #35): Xero connector stub"
```

---

## Step 36 — Sage Connector (Stubbed)

**Mode:** Safe-to-autorun (clone of Step 34)
**Item:** 4C.3 #36
**Effort:** S (stubbed)
**Priority:** P2

### What this does

Same pattern, for Sage Business Cloud Accounting.

### Tell Claude Code:

> Clone Step 34's pattern for Sage. Provider config, stub sync, UI card, README section.

### What to check

- Sage card connects and stub-syncs.
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 36 (4C.3 #36): Sage connector stub"
```

---

## Phase 4C Wrap

```bash
npm run build && npm run lint && npm run test
```

Phase 4C done. Clickthrough: go to Integrations settings → connect Stripe → complete Connect onboarding in test mode → connect QB/Xero/Sage sandboxes → run a test draw payment end-to-end from a residential client account. That's the integration story for a portfolio demo.

---

# Phase 4D — Schema + Cross-Project Pages

**Target:** Weeks 5–9 of Phase 4+. Runs alongside 4B tail and 4C.

**Rule:** Cross-project views respect role-based visibility, load in <1 second for projects <50, and link back to source records.

**Total:** 7 items.

---

## Step 37 — Contractor Cross-Project Approvals Page

**Mode:** Require-design-input
**Item:** 4D #37
**Effort:** M
**Priority:** P1

### What this does

The contractor portal has per-project approvals queues. This step adds a portfolio-wide approvals queue: one page that lists every pending approval across every project the contractor is on, with project-level filtering and drilldown back to the source record.

### Tell Claude Code:

> Before writing code, propose:
>
> 1. Data source: union of all current pending approvals loaders across projects. Use the existing Phase 1/2 approval loaders and union server-side.
> 2. Layout (follow contractor portfolio pattern from Step 24 Reports):
>    - Summary strip: total pending, oldest pending (age), by-type breakdown (COs, procurement, design, general)
>    - Filter bar: by project (multi-select), by type, by age, by priority
>    - Table: project name, item type, item number/title, submitted by, age, priority, action buttons
>    - Row click → navigate to the item's detail page in the correct project context
> 3. Nav: add "Approvals" to the contractor portal sidebar as a top-level item (distinct from per-project approvals).
>
> After confirmation:
>
> 1. Loader `getContractorCrossProjectApprovals(context, filters)` in `src/domain/loaders/cross-project.ts`.
> 2. Page `src/app/(portal)/contractor/(global)/approvals/page.tsx`.
> 3. Reuse filters and table component from the per-project approvals page from Phase 3.
> 4. Performance: loader should be <1s for orgs with <50 projects. If slower, propose indexes on the relevant tables and flag the schema change.
> 5. Authorization: only returns approvals for projects the caller has access to.

### What to check

- Contractor sees cross-project approvals queue with real data
- Filters work, drilldown navigates to the correct project
- Sub tries to hit the same URL → gets 403 or redirect
- Performance acceptable with seed data
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 37 (4D #37): Contractor cross-project approvals page"
```

---

## Step 38 — Contractor Cross-Project Payment Tracking Page

**Mode:** Require-design-input
**Item:** 4D #38
**Effort:** M
**Priority:** P1

### What this does

Like Step 37 but for payments (inbound and outbound). One page, all projects, filterable and drilldownable. Complements the per-project billing workspace.

### Tell Claude Code:

> Propose:
>
> 1. Two tabs on the page: "Inbound" (client → contractor) and "Outbound" (contractor → subs).
> 2. Inbound tab: every draw request across projects with status (draft, submitted, approved, paid, partially paid, delinquent), amount, aging, payment method.
> 3. Outbound tab: every sub payment across projects with status, amount, retainage held, lien waiver status.
> 4. Summary strip on each tab with totals.
> 5. Filter by project, status, date range.
>
> Mirror Step 37's pattern — shared components where possible.
>
> Nav: add "Payments" top-level item in contractor sidebar.

### What to check

- Inbound tab lists all draws, outbound tab lists all sub payments, across all projects
- Totals match per-project billing sums
- Filters work, drilldown navigates correctly
- Performance acceptable
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 38 (4D #38): Contractor cross-project payment tracking"
```

---

## Step 39 — Weekly Reports Table + Generation

**Mode:** Require-design-input
**Item:** 4D #39
**Effort:** M
**Priority:** P1

### What this does

Many GCs send clients a weekly progress report. This step adds the report primitive: auto-generated each week (Monday morning) from a project's activity (daily logs from the week, photos, milestones hit, RFIs opened/closed, COs submitted/approved, issues noted). Contractor reviews, edits, sends to client. Client sees in their portal.

### Tell Claude Code:

> Propose schema:
>
> 1. `weekly_reports` table: id, projectId, weekStart (date), weekEnd (date), status (auto_draft, editing, sent), summaryText (editable), generatedAt, sentAt, sentByUserId.
> 2. `weekly_report_sections` table: reportId, sectionType (dailyLogs/photos/milestones/rfis/cos/issues), content (JSON), orderIndex.
> 3. One report per project per week; auto-generated Monday morning from the prior week's data.
>
> **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Trigger.dev job: runs every Monday at 6am project-local time (or UTC default), generates draft report for every active project.
> 3. Loader + UI for contractor: list of weekly reports per project, detail view with editable sections.
> 4. Client view: read-only list of sent reports; unsent reports not visible.
> 5. Contractor can manually generate an off-cycle report (e.g., mid-week major milestone) via "Generate Report Now" button.
> 6. Send action: contractor reviews draft, edits, clicks Send → status flips to sent, client sees it, email notification fires.
> 7. Residential portal uses warmer copy: "This Week at Your Home" instead of "Weekly Report".

### What to check

- Monday morning (or via Trigger.dev manual fire), every project with activity has a draft weekly report
- Contractor opens a draft, edits, sends
- Client sees the report in their portal
- Residential client sees warmer copy
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 39 (4D #39): Weekly reports — auto-generated + editable + client-visible"
```

---

## Step 40 — Lien Waiver Sub Fan-Out (`createWaiverForDraw`)

**Mode:** Safe-to-autorun
**Item:** 4D #40
**Effort:** S
**Priority:** P1

### What this does

From the Phase 3 handoff deferred list. When a draw is created, the system should automatically generate lien waiver rows for every sub whose payment is included in that draw, pre-populated with amount and date. Saves the contractor from manually creating each one.

### Tell Claude Code:

> Read the lien waiver schema (in `drizzle_schema_phase3_billing.ts`) and the draw request actions.
>
> Implement:
>
> 1. Function `createWaiverForDraw(drawRequestId, context)` in `src/domain/actions/billing.ts`:
>    - Fetches the draw and its line items
>    - For each sub with a payment amount > $0 in this draw, creates a `lien_waivers` row with: drawRequestId, subOrgId, amount, status='pending', waiverType='conditional_progress' (default — configurable per project).
>    - Idempotent: if waivers already exist for this draw (e.g., the function ran before), does nothing.
> 2. Call `createWaiverForDraw` from the draw submit action, right after the draw moves to submitted status.
> 3. Audit event: `waivers.fanned_out` per draw.

### What to check

- Submit a draw with 3 subs on it → 3 lien waiver rows appear, correctly sized
- Re-submit (if that's possible) or re-run the action → no duplicate waivers created
- Audit event fires
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 40 (4D #40): Lien waiver sub fan-out on draw submit"
```

---

## Step 41 — Procurement / POs Module

**Mode:** Require-design-input
**Item:** 4D #41
**Effort:** M
**Priority:** P2

### What this does

Commercial expectation. Purchase orders for materials and equipment: PO number, vendor, project, line items with quantities and unit costs, total, status (draft, issued, received, invoiced, closed), linked documents (quote, PO PDF, vendor invoice, receiving doc).

### Tell Claude Code:

> Propose schema:
>
> 1. `vendors` table: id, orgId (contractor's org), name, address, contact, paymentTerms, notes.
> 2. `purchase_orders` table: id, orgId, projectId, poNumber (sequential per org), vendorId, status enum, orderedAt (nullable), deliveredAt (nullable), totalAmount, notes.
> 3. `purchase_order_lines` table: poId, description, quantity, unitCost, totalCost, receivedQuantity (nullable).
> 4. State machine:
>    - draft → issued (when PO sent to vendor)
>    - issued → partially_received → fully_received
>    - fully_received → invoiced → closed
>    - any state → cancelled
> 5. **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations, loaders, actions.
> 2. UI at `src/app/(portal)/contractor/project/[projectId]/procurement/page.tsx`:
>    - List view: filterable POs with vendor, amount, status, date
>    - Detail view: full PO with line items, receiving checklist, linked documents
>    - Create PO: wizard (vendor select/create, line items, send as PDF to vendor email optional)
> 3. Vendor management: simpler page at `/contractor/vendors` — CRUD vendors.
> 4. PO PDF generation reuses Step 13's PDF infra.
> 5. Audit events on state changes.

### What to check

- Create a vendor, create a PO with line items, issue it, partially receive, invoice, close
- PO PDF generates with correct branding
- List and filters work
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 41 (4D #41): Procurement / POs module"
```

---

## Step 42 — `tradeScope` Field on `SubPaymentRollupRow`

**Mode:** Safe-to-autorun
**Item:** 4D #42
**Effort:** S
**Priority:** P2

### What this does

From the Phase 3 handoff deferred items. The sub payment rollup shows payment amounts per sub but doesn't show what trade/scope they're being paid for. Adding `tradeScope` (from the sub's project-membership record) makes the rollup readable.

### Tell Claude Code:

> Read the sub payment rollup loader and schema (search `SubPaymentRollup` across `src/`).
>
> Add:
>
> 1. If the sub's project membership already has a trade/scope field, read it through to the rollup row. If not, **stop and ask** about a schema addition.
> 2. Update the UI on the payment / financial view to show the tradeScope column next to the sub name.
> 3. Residential copy: "Scope" instead of "Trade".
>
> Small change. Do not rebuild the rollup logic.

### What to check

- Sub payment rollup now shows tradeScope per row
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 42 (4D #42): tradeScope field on SubPaymentRollupRow"
```

---

## Step 42.5 — Wire `pendingFinancialsCents` for Sub-Scoped Views

**Mode:** Safe-to-autorun
**Item:** 4D #42.5
**Effort:** S
**Priority:** P2

### What this does

From HANDOFF.md's deferred list ("Sub-scoped financials: `pendingFinancialsCents` hardcoded to 0"). Three call sites in sub-facing loaders currently return a hardcoded `0` for pending financials, so the subcontractor today board and sub's project home show `$0` even when the sub has draws under review. This wires those three sites to a real query.

**Do not conflate this with Step 43.** Step 43 is a new *contractor* UI card. This step is a data-layer fix in *subcontractor* loaders. They share the substring "pendingFinancials" but are different features for different portals.

### Definition of "pending financials" (pinned — do not re-debate)

Pending financials for a sub = **sum of the sub's line-item amounts on draws currently in `submitted` or `under_review` status** (the `UNDER_REVIEW_STATUSES` constant in `src/domain/loaders/financial.ts:139`).

- **Excludes** `approvedUnpaidCents` — that's already its own bucket on `SubcontractorFinancialView`
- **Excludes** lien waivers — their status follows the parent draw, no separate counting
- **Excludes** retainage — held, not pending

### Tell Claude Code:

> Fix the three hardcoded `pendingFinancialsCents: 0` sites in sub-facing loaders:
>
> 1. `src/domain/loaders/subcontractor-today.ts:173` — cross-project sub today board aggregator
> 2. `src/domain/loaders/subcontractor-today.ts:433` — second call site in the same file (confirm it's the same semantic; if it's genuinely different, stop and ask)
> 3. `src/domain/loaders/project-home.ts:2001` — project-scoped sub view
>
> Definition is pinned: pending = sum of the sub's draw line-item amounts where the parent draw's status is in `UNDER_REVIEW_STATUSES` (`submitted` or `under_review`). See `financial.ts:137–139` for the canonical constant.
>
> Implementation:
>
> 1. Add a shared helper `getSubPendingFinancialsCents({ subOrgId, projectId? })` to `src/domain/loaders/financial.ts` (or wherever sub line-item aggregation already lives — grep first, do not duplicate). If `projectId` is passed, scope to that project; if omitted, sum across all projects where the sub has membership.
> 2. Replace the three hardcoded zeros with calls to the helper, passing the appropriate scope at each call site.
> 3. Do not modify the `SubcontractorFinancialView` type — the field already exists on the response shape, it's just being populated with 0 today.
> 4. If the two `subcontractor-today.ts` call sites turn out to need different aggregations (e.g., one wants project-scoped, the other cross-project), wire each to the right helper call — don't force them to share.
>
> Small data-layer fix. Do not touch any UI. The UI already renders the field; it will light up automatically once the loader returns real values.

### What to check

- Seed data has at least one sub with a submitted/under_review draw — confirm the value is non-zero on that sub's today board and project home
- Value goes back to 0 when that draw transitions to approved or rejected
- No new type changes; `SubcontractorFinancialView` is unchanged
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 42.5 (4D #42.5): wire pendingFinancialsCents in sub-scoped loaders"
```

---

## Step 43 — `pendingFinancialsCenter` for Contractor Financial View

**Mode:** Safe-to-autorun
**Item:** 4D #43
**Effort:** S
**Priority:** P2

### What this does

From the Phase 3 handoff deferred items. The contractor financial view has a gap where a summary card was planned — "pending financials" rollup of draws in review, unpaid invoices, expiring retainage, etc. Just wire this card to the existing loaders.

### Tell Claude Code:

> Read the contractor financial view page and the existing financial loaders.
>
> Implement a "Pending Financials" summary card:
>
> 1. Displays counts and totals for:
>    - Draws awaiting client review
>    - Invoices awaiting payment
>    - Retainage scheduled to release in <30 days
>    - COs with financial impact awaiting approval
> 2. Each metric is clickable — links to the filtered view.
> 3. Place the card prominently near the top of the financial view.
>
> Reuse existing loaders where possible.

### What to check

- Card renders with real counts
- Clicks drill down correctly
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 43 (4D #43): pendingFinancialsCenter summary card"
```

---

## Phase 4D Wrap

```bash
npm run build && npm run lint && npm run test
```

Phase 4D done. Clickthrough: open contractor cross-project approvals and payments, trigger a weekly report, submit a draw with subs (verify fan-out), create and receive a PO, check the trade scope column appears, view the contractor pending financials card, and confirm the subcontractor today board + sub project home now show non-zero pending financials when a draw is under review.

---

# Phase 5 — Commercial GC Parity

**Target:** Weeks 9–16 of Phase 4+. Two big modules (drawings, inspections) plus four smaller ones.

**Rule:** Drawings + inspections before anything else here. Without these the commercial pitch falls flat.

**Total:** 6 items.

---

## Step 44 — Drawings Module

**Mode:** Require-design-input (**the single biggest item in the whole plan — timebox ruthlessly**)
**Item:** 5.1 #44
**Effort:** L (~3 weeks focused work)
**Priority:** P0

### What this does

Sheet management, markup, version control, sheet index. The commercial differentiator — Procore, Bluebeam, and PlanGrid live here. Full native parity isn't the goal (that's years of work); shipping enough to demonstrate the architecture is.

**Risk flag:** This is the single largest item. If 3 weeks becomes 4, cut version-compare overlay and ship what you have.

### Tell Claude Code:

> **This is the biggest item in the plan. Before writing anything, propose:**
>
> 1. Scope ladder — what ships in v1 vs. what defers:
>    - **V1 must-have:** Upload PDF sheet set, auto-extract sheet numbers, view sheets (PDF-native viewer), basic markup (pen + text + rectangle/circle), mobile-friendly viewer, version tracking (new sheet set supersedes old).
>    - **V1 nice-to-have:** Sheet index navigation, compare overlay (v1 vs v2), layer management.
>    - **Defer to V2:** BIM integration, measurement tools, advanced annotation, multi-user real-time markup.
>
>    Confirm the ladder with me. **If I push to keep all of V1 must-have, we commit to timebox.**
>
> 2. Library and architecture:
>    - PDF viewer: `pdf.js` (Mozilla's) or `react-pdf` — recommend `react-pdf` (thin wrapper on pdf.js, React-friendly).
>    - Markup: overlay canvas on top of the PDF viewer, save markup as vector JSON in our DB (not baked into the PDF). This allows per-user markup, toggleable, versioned.
>    - Sheet number extraction: run pdf.js text extraction on upload, look for sheet-number patterns in the title block region. Fall back to manual entry.
>    - Storage: sheets in R2 as individual PDFs (split the multi-page set on upload) or as the original multi-page (defer per-sheet split to defer list).
>    - **New deps likely: react-pdf, possibly fabric.js for canvas markup. Stop and ask before installing.**
>
> 3. Schema:
>    - `drawing_sets` table: id, projectId, name, version, uploadedByUserId, uploadedAt, supersedesId (nullable).
>    - `drawing_sheets` table: id, setId, sheetNumber, sheetTitle, pageIndex, thumbnailUrl.
>    - `drawing_markups` table: id, sheetId, userId, markupData (JSON), createdAt, updatedAt. One markup doc per user per sheet (simple).
>    - `drawing_comments` table: id, sheetId, userId, x, y, text, createdAt. For pinned comments.
>    - **Schema change — stop and ask.**
>
> Confirm the scope ladder, library choices, and schema. After all three are locked:
>
> 1. Migrations.
> 2. Upload flow: multi-page PDF upload, split into per-sheet pages with thumbnails, auto-extract sheet numbers (if pdfjs text extract identifies them), manual edit for misses.
> 3. Viewer page: `src/app/(portal)/contractor/project/[projectId]/drawings/page.tsx` — sheet set list. Clicking opens the sheet index.
> 4. Sheet index: thumbnail grid with sheet numbers and titles, click to open a sheet.
> 5. Sheet detail viewer: PDF renders, markup toolbar (pen / text / shape / comment), saved markup overlays, version dropdown to switch between versions.
> 6. Version compare overlay: two sheets side-by-side with a difference highlight overlay (diff is visually computed from PDF render; simpler than actual vector diff).
> 7. Sub access: read-only, can add markup and comments on their scope.
> 8. Mobile: viewer works, pinch-zoom, markup simplified to pen + comment only.
> 9. Closeout integration: drawings flagged "As-built" flow to closeout packages (Step 48).

### What to check

- Upload a 20-page PDF sheet set → sheets split and thumbnailed in ~30 seconds
- Sheet numbers auto-detected on most sheets; manual edit fills misses
- Sheet viewer opens, markup tools work, save and reload preserves markup
- New version upload: old version remains accessible, new version is default
- Compare overlay highlights differences between versions
- Sub user can view and markup scope sheets
- Mobile viewer works
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 44 (5.1 #44): Drawings module — upload, viewer, markup, versioning"
```

---

## Step 45 — Inspections Module

**Mode:** Require-design-input
**Item:** 5.1 #45
**Effort:** M
**Priority:** P0

### What this does

QA/QC checklists distinct from milestones. Template library for common inspection types (framing, electrical rough-in, plumbing rough-in, insulation, drywall, final). Assign to a sub, sub completes in mobile, pass/fail/conditional outcomes per line item, photos per line, failed items auto-generate punch items (tying to Step 19).

### Tell Claude Code:

> Propose schema:
>
> 1. `inspection_templates` table: id, orgId, name, tradeCategory, lineItemsJson (array of line item definitions), createdAt.
> 2. `inspections` table: id, projectId, templateId, assignedOrgId (sub), assignedUserId (nullable), scheduledDate, status (scheduled/in_progress/completed), completedByUserId, completedAt.
> 3. `inspection_results` table: id, inspectionId, lineItemKey, outcome (pass/fail/conditional/na), notes, photoIds.
>
> **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Template library: seed with 8–10 common templates (framing rough, electrical rough, plumbing rough, HVAC rough, insulation, drywall, final electrical, final plumbing, final mechanical, final cleaning). Contractor can create custom templates.
> 3. Inspection list view at `src/app/(portal)/contractor/project/[projectId]/inspections/page.tsx`: filterable, columns (template, assignee, scheduled, status, pass rate).
> 4. Inspection detail: line items with pass/fail/conditional/NA radio, photo upload per item, notes.
> 5. Subcontractor mobile-first view: `src/app/(portal)/subcontractor/project/[projectId]/inspections/page.tsx` — only inspections assigned to their org. Optimized for phone/tablet. Walk-through UX with clear check-off.
> 6. On completion with any fail or conditional: auto-create punch items (Step 19) linked to the inspection.
> 7. Pass rate KPI on the list: percentage of line items passed across all completed inspections.
> 8. Template management at `/contractor/settings/inspection-templates` — CRUD.

### What to check

- Contractor creates inspection from template, assigns to sub
- Sub completes inspection on mobile, marks some items fail → punch items auto-generate
- Pass rate KPI updates
- Template CRUD works
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 45 (5.1 #45): Inspections module with template library + punch integration"
```

---

## Step 46 — Meetings Module

**Mode:** Require-design-input
**Item:** 5.2 #46
**Effort:** S–M
**Priority:** P1

### What this does

Agendas, minutes, attendees, action items. Pairs with Phase 7.1 AI agent (the AI does the minutes transcription). This step ships the module; the AI plugs in at Step 56.

### Tell Claude Code:

> Propose schema:
>
> 1. `meetings` table: id, projectId, title, scheduledAt, durationMinutes, status (scheduled/in_progress/completed/cancelled), createdByUserId.
> 2. `meeting_agenda_items` table: id, meetingId, orderIndex, title, description, assignedUserId (presenter), estimatedMinutes.
> 3. `meeting_attendees` table: id, meetingId, userId (or orgId if external), attendedStatus (invited/accepted/declined/attended/absent).
> 4. `meeting_minutes` table: id, meetingId, content (text), draftedByUserId, finalizedAt.
> 5. `meeting_action_items` table: id, meetingId, description, assignedUserId, dueDate, status (open/in_progress/done), createdAt.
>
> Action items sync to the main task list — this requires a top-level tasks system if one doesn't exist. **If no tasks table exists, stop and ask** — either build one here or add action items as a separate list for now and integrate later.
>
> After confirmation:
>
> 1. Migrations.
> 2. UI pages: meetings list, meeting detail (with agenda editor, minutes editor, action items), scheduled meetings calendar mini-view.
> 3. Carry-forward: when a meeting completes with open action items, the next meeting on that project auto-gets those items on its agenda (implemented at creation time of the next meeting).
> 4. Attendee notifications: invited users get a notification and email.
> 5. Placeholder for AI: a "Generate minutes from audio" button present but non-functional until Step 56.

### What to check

- Create meeting, set agenda, invite attendees, complete with minutes + action items
- Action items appear in assigned users' task lists
- Next meeting on same project carries forward open items
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 46 (5.2 #46): Meetings module — agendas, minutes, attendees, action items"
```

---

## Step 47 — Transmittals Module

**Mode:** Safe-to-autorun
**Item:** 5.2 #47
**Effort:** S
**Priority:** P1

### What this does

Transmittals are formal cover-letter records for sending document bundles (typically drawings or specs) to other parties. Create transmittal with bundle + recipients, email is sent with audit trail, receipt log captures when recipients downloaded.

### Tell Claude Code:

> Propose schema:
>
> 1. `transmittals` table: id, projectId, transmittalNumber, subject, message, sentByUserId, sentAt, status (draft/sent).
> 2. `transmittal_recipients` table: id, transmittalId, email, name, accessToken (for the download link), firstDownloadedAt (nullable), totalDownloads.
> 3. `transmittal_documents` table: transmittalId, documentId.
>
> **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. UI: list view, detail view, create form (select project, add recipients, attach documents, compose message, send).
> 3. Sent transmittal: email to each recipient with a unique access token URL. Clicking downloads a ZIP of the documents.
> 4. Access log: detail view shows who downloaded and when.
> 5. Audit events.

### What to check

- Create and send a transmittal to a test email
- Email arrives with download link; click downloads ZIP
- Detail view shows the download event
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 47 (5.2 #47): Transmittals module"
```

---

## Step 48 — Closeout Packages

**Mode:** Require-design-input
**Item:** 5.3 #48
**Effort:** M
**Priority:** P1

### What this does

White-space feature. At project closeout, contractors bundle O&M manuals, warranties, as-builts, and final sign-offs into a single deliverable for the owner. BuiltCRM auto-categorizes and assembles the package; owner receives and signs off.

### Tell Claude Code:

> Propose schema:
>
> 1. `closeout_packages` table: id, projectId, status (building/review/delivered/accepted), preparedByUserId, deliveredAt, acceptedAt, acceptedByUserId.
> 2. `closeout_package_sections` table: id, packageId, sectionType (om_manuals/warranties/as_builts/permits_final/testing_certificates/cad_files/other), orderIndex.
> 3. `closeout_package_items` table: id, sectionId, documentId, notes.
>
> **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. UI: contractor creates package, drags documents from the documents module into sections, adds notes.
> 3. Export as indexed ZIP + PDF cover letter (reuses PDF and ZIP infra from Step 13).
> 4. Client portal: receives package notification, opens a review view, accepts or comments.
> 5. On acceptance: project can be marked closed; audit trail captures the sign-off.

### What to check

- Contractor builds a closeout package with 3 sections, 10 documents
- Export produces a clean ZIP with index
- Client opens, reviews, accepts
- Project closeout state reflects acceptance
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 48 (5.3 #48): Closeout packages"
```

---

## Step 49 — Subcontractor Prequalification

**Mode:** Require-design-input
**Item:** 5.3 #49
**Effort:** M
**Priority:** P1

### What this does

White-space feature. Contractors require prequalification before awarding work. Intake form, scoring, bond/insurance capture, outcome on sub profile. Subs below threshold are blocked from assignment.

### Tell Claude Code:

> Propose schema:
>
> 1. `prequal_templates` table: orgId, name, questionsJson, scoringRules.
> 2. `prequal_submissions` table: id, templateId, submittedByOrgId (sub), answersJson, scoreTotal, status (submitted/under_review/approved/rejected/expired), expiresAt, reviewedByUserId, reviewedAt.
> 3. `prequal_documents` table: submissionId, documentType (bond/insurance/safety_manual/references/financial_statements), documentId.
>
> **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Template management: contractor defines one prequal form per trade or one general form.
> 3. Sub intake: sub fills prequal form once per contractor they work with, uploads supporting docs.
> 4. Contractor review: scoring, approval/rejection with notes.
> 5. Sub profile badge: prequal status visible on sub profile (approved/pending/rejected/expired).
> 6. Assignment block: if a sub's prequal status is rejected or below threshold, trying to assign them to a project surfaces a warning or block (configurable per contractor org).

### What to check

- Contractor creates a prequal template
- Sub fills and submits
- Contractor reviews, scores, approves
- Sub profile shows approved badge
- Sub with failed prequal can't be assigned (warning or block)
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 49 (5.3 #49): Subcontractor prequalification"
```

---

## Phase 5 Wrap

```bash
npm run build && npm run lint && npm run test
```

Phase 5 done. Commercial GC parity landed. Clickthrough: drawings viewer with markup, inspection mobile workflow, meeting with action items, transmittal with audit, closeout package, prequal submission.

---

# Phase 6 — PWA + Field Workflows

**Target:** Weeks 16–22 of Phase 4+.

**Rule:** Progressive Web App, not native. No Apple/Google developer accounts.

**Total:** 6 items.

---

## Step 50 — PWA Scaffolding

**Mode:** Require-design-input
**Item:** 6 #50
**Effort:** M
**Priority:** P0

### What this does

Makes the web app installable on mobile (add to home screen), ship a service worker for offline shell, manifest with icons, install prompt. Baseline for everything field-related that follows.

### Tell Claude Code:

> Propose:
>
> 1. Service worker strategy: `next-pwa` plugin or hand-rolled. Recommend `next-pwa` for rapid integration unless we have specific Next.js App Router caveats. **New dep — stop and ask.**
> 2. Caching strategy:
>    - App shell: cache-first with network fallback
>    - API calls: network-first with cache fallback (so users get fresh data when online but offline-accessible when not)
>    - Documents/photos: cache-on-demand when viewed
> 3. Manifest: icons (192, 512), short_name "BuiltCRM", theme color matching portal accent, display "standalone".
> 4. Install prompt: show a custom install card on specific pages (daily logs, subcontractor today) after 2nd visit, dismissible.
> 5. Offline indicator: persistent toast when offline, specifying what features are limited.
>
> Confirm.
>
> After confirmation:
>
> 1. Install next-pwa, configure.
> 2. Manifest.
> 3. Generate icon set (the cascading-rectangle logo at all required sizes).
> 4. Custom install prompt component.
> 5. Offline indicator.
> 6. Test on iOS Safari (Add to Home Screen) and Android Chrome (Install app prompt).

### What to check

- Visit the app in Safari on iPhone → Add to Home Screen produces an installable icon
- Visit in Android Chrome → Install prompt shows; installed app opens standalone
- Turn off network → app shell still loads; data pages show offline indicator
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 50 (6 #50): PWA scaffolding — service worker, manifest, install prompt"
```

---

## Step 51 — Offline-First Daily Logs + Photo Capture

**Mode:** Require-design-input
**Item:** 6 #51
**Effort:** M
**Priority:** P1

### What this does

The highest-value offline workflow. Field users on job sites (often poor cell) create daily logs with photos. This step makes daily logs (Step 18) offline-capable — drafts save locally, sync when connectivity returns, no data loss.

### Tell Claude Code:

> Propose:
>
> 1. Storage: IndexedDB via `idb` library (wrapper around IndexedDB with Promise API).
> 2. Queue pattern: when offline, writes go to a local queue (pending syncs). When online, a background sync worker uploads pending entries. If a sync fails, retry with backoff. If conflicts (unlikely — daily logs are one-per-day), last-write-wins with a visible warning.
> 3. Photos: stored as blobs in IndexedDB until synced. Thumbnail generated locally for in-app display.
> 4. UI affordances:
>    - "Draft saved locally" indicator when offline
>    - Queue page (`/subcontractor/settings/offline-queue` or similar) showing pending syncs
>    - On reconnection, auto-sync with progress toast
>
> **New dep (`idb`) — stop and ask.**
>
> After confirmation:
>
> 1. Install idb.
> 2. Offline queue infrastructure: `src/lib/offline/queue.ts` with `enqueueWrite`, `drainQueue`, `listPending`.
> 3. Daily log create/update actions wrap with offline detection: if offline, write to queue; if online, direct API call.
> 4. Photo capture: camera input → local blob → IndexedDB → background sync to R2 when online.
> 5. Reconnection listener: `window.addEventListener('online', drainQueue)`.
> 6. Visible state: draft indicator, queue page, sync progress.
> 7. Test scenarios: create log offline → go online → verify sync.

### What to check

- Turn off network, create a daily log with a photo → save succeeds locally, draft indicator shown
- Turn on network → background sync fires, log appears in DB, indicator clears
- Queue page lists pending syncs (when any exist)
- No data loss across multiple offline sessions
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 51 (6 #51): Offline-first daily logs + photo capture"
```

---

## Step 52 — Safety Forms

**Mode:** Require-design-input
**Item:** 6 #52
**Effort:** M
**Priority:** P1

### What this does

Toolbox talks, Job Hazard Analyses (JHA), incident reports. Standard field expectation. Templates per form type, mobile-first completion, offline-capable (leverages Step 51 queue infrastructure).

### Tell Claude Code:

> Propose schema:
>
> 1. `safety_form_templates` table: id, orgId, formType (toolbox_talk/jha/incident_report/near_miss), name, fieldsJson.
> 2. `safety_forms` table: id, projectId, templateId, submittedByUserId, submittedAt, dataJson, status.
> 3. `incident_reports` subtype — additional columns for severity, injured parties, root cause, corrective actions.
>
> **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Seed templates: a standard toolbox talk, a JHA template, an incident report form.
> 3. Mobile UI: templated form completion, photo attach, signature field (canvas).
> 4. Incident reports trigger notifications to project admins immediately.
> 5. Offline-capable via Step 51 queue.
> 6. Report export: safety form history per project as PDF.

### What to check

- Complete a toolbox talk on mobile with signatures, offline
- Go online, form syncs
- Incident report notifies project admin
- PDF export produces readable report history
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 52 (6 #52): Safety forms — toolbox talks, JHAs, incident reports"
```

---

## Step 53 — Subcontractor Time Tracking

**Mode:** Require-design-input
**Item:** 6 #53
**Effort:** M
**Priority:** P1

### What this does

Sub field workers clock in/out per task or project. Time entries roll up to their company admin for payroll. Not full payroll — just the time capture primitive.

### Tell Claude Code:

> Propose schema:
>
> 1. `time_entries` table: id, userId, orgId (the sub's org), projectId, taskId (nullable), clockIn, clockOut, durationMinutes (computed), locationLat/Lng (optional — GPS on clock in), notes.
> 2. Rules: can't have overlapping entries per user. Can edit unsubmitted entries; submitted entries are read-only to the worker (admin can amend with audit).
>
> **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Mobile UI: big "Clock In" button on sub today board, shows current running entry. Stop button ends the entry.
> 3. Optional task selector before clock-in.
> 4. Optional GPS capture (asks permission; not required).
> 5. Weekly timesheet view: all entries for the week, submit for approval.
> 6. Sub admin view: all entries across workers, approve or edit.
> 7. Offline-capable.

### What to check

- Sub worker clocks in, works, clocks out → entry recorded
- Admin sees entries in timesheet
- Submitted entries aren't editable by the worker
- Overlap attempts blocked
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 53 (6 #53): Subcontractor time tracking"
```

---

## Step 54 — Photo Spatial Pinning

**Mode:** Require-design-input
**Item:** 6 #54
**Effort:** M
**Priority:** P2

### What this does

Differentiator. Photos can be pinned to a specific location on a drawing — e.g., "progress photo of wall 3A" literally anchored to the spot on the plan. Requires drawings module (Step 44).

### Tell Claude Code:

> Propose schema:
>
> 1. `photo_pins` table: id, photoId (refs documents), sheetId (refs drawing_sheets), x, y (fractional coords 0–1 relative to sheet), createdByUserId, createdAt.
>
> **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migration.
> 2. UX: on drawing sheet viewer, user can drag a photo onto the sheet (or click "Pin here" then select photo).
> 3. Pinned photos render as small markers on the sheet; click expands photo.
> 4. Photo detail view shows which sheet(s) it's pinned on with clickable link.
> 5. Mobile: pin current camera capture directly to a selected sheet.

### What to check

- Pin a photo to a sheet → marker shows on the sheet viewer
- Click marker → photo opens
- Photo detail shows the back-reference
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 54 (6 #54): Photo spatial pinning on drawings"
```

---

## Step 55 — Field RFI Quick-Capture

**Mode:** Require-design-input
**Item:** 6 #55
**Effort:** S
**Priority:** P1

### What this does

One-handed RFI creation from the field. Voice (dictation) + photo + GPS location, minimal typing. Pairs with the Meeting Minutes AI (Step 56) — same transcription infrastructure.

### Tell Claude Code:

> Propose:
>
> 1. UI: giant "Quick RFI" FAB on sub today board and contractor project home on mobile.
> 2. Flow: tap FAB → camera opens → take photo → voice-record description (browser's Web Speech API for simple dictation; fall back to manual text if not supported) → GPS captured silently → submit.
> 3. Created RFI is in "draft" status, assigned to the default RFI recipient for the project. Routes through normal RFI workflow.
> 4. Photo + transcribed text + GPS attached.
>
> Web Speech API is browser-native; no new dep needed. If we later want server-side transcription (more accurate), that plugs in at Step 56.
>
> Implement:
>
> 1. Quick RFI component, mobile-first.
> 2. Integration with existing RFI create action.
> 3. Offline-capable (enqueues via Step 51 queue).

### What to check

- On mobile, tap Quick RFI → camera → record voice → submit
- RFI appears in project RFI list with photo and transcription
- Offline creation works
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 55 (6 #55): Field RFI quick-capture — voice + photo + location"
```

---

## Phase 6 Wrap

```bash
npm run build && npm run lint && npm run test
```

Phase 6 done. Field workflows land. Clickthrough on mobile (or emulator): install PWA, go offline, log a daily log with photo, clock in/out, complete a toolbox talk, pin a photo on a drawing, quick-capture an RFI. Go online and watch it all sync.

---

# Phase 7.1 — Meeting Minutes AI Agent

**Target:** Weeks 14–17 of Phase 4+ (overlaps Phase 5).

**Rule:** Ship ONE AI agent well. Meeting Minutes only.

**Total:** 1 item.

---

## Step 56 — Meeting Minutes AI

**Mode:** Require-design-input
**Item:** 7.1 #56
**Effort:** M
**Priority:** P0

### What this does

Upload meeting audio (or record live), Whisper transcribes, Claude extracts action items with assignees, action items auto-populate the meeting's action items list and the main task list, and the next meeting's agenda auto-includes unresolved action items.

One well-built AI agent is worth more in a portfolio than ten half-built ones.

### Tell Claude Code:

> Read docs for both APIs:
> - Anthropic Claude API (you already use this stack)
> - Transcription: OpenAI Whisper (cheap, good enough) or Deepgram (faster, similar cost)
>
> Before writing code, propose:
>
> 1. Transcription provider. Recommend OpenAI Whisper unless latency matters (then Deepgram). Free tier sufficient for portfolio demos.
> 2. API key strategy: `OPENAI_API_KEY` (or `DEEPGRAM_API_KEY`) in env. **New env var; document in README.**
> 3. Audio flow:
>    - Upload audio file (WAV, MP3, M4A) → store in R2 temporarily → Whisper API → transcript → Claude extract → discard audio (user opts in to keep)
>    - Or record live in browser (MediaRecorder API) → blob → upload → same pipeline
> 4. Claude prompt: structured output asking for action items with `{ description, assignee (matching user or unassigned), dueDate (nullable), context (quote from transcript) }`. Use function calling / tool use for reliable JSON structure.
> 5. Assignee matching: fuzzy match extracted names against meeting attendees. If no confident match, leave unassigned with a flag.
> 6. Cost guardrail: limit Whisper to audio <1 hour per meeting; hard stop at 2 hours with user warning. Track usage per org.
> 7. **Does the cost guardrail need a paid tier gate? For portfolio, no — all free. Confirm.**
>
> After confirmation:
>
> 1. New dep: `openai` (if using Whisper). Stop and confirm.
> 2. Server action `transcribeAndExtract(meetingId, audioFileId, context)`:
>    - Pull audio from R2
>    - Call Whisper for transcription
>    - Call Claude with a structured prompt referencing the meeting's attendees as candidate assignees
>    - Parse JSON response into action items
>    - Write action items to `meeting_action_items` (from Step 46)
>    - Write transcript to `meeting_minutes.content`
>    - Audit event `meeting.minutes.ai_generated`
> 3. UI integration on meeting detail (Step 46): the "Generate minutes from audio" button becomes functional. Upload or record → progress indicator → minutes + action items appear.
> 4. User can edit the generated minutes and action items before finalizing.
> 5. Carry-forward (already built in Step 46) now has real action items to carry.
> 6. Usage tracking: simple counter table `ai_usage` with orgId, provider, operation, tokensUsed (approximation), createdAt.

### What to check

- Upload a 5-minute test audio of a pretend meeting → transcript appears → action items extracted with correct assignees where names match
- Edit generated minutes and action items → save persists
- Next meeting carries forward unresolved action items
- Cost tracking increments
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 56 (7.1 #56): Meeting Minutes AI agent — transcription + action item extraction"
```

---

## Phase 7.1 Wrap

```bash
npm run build && npm run lint && npm run test
```

Phase 7.1 done. One AI agent, shipped. In the demo this is the "wow" moment.

---

# Phase 8-lite — Integration Infrastructure + Platform Enablers

**Target:** Runs parallel throughout. Infrastructure items first, platform polish later.

**Rule:** Build the infrastructure so real integrations could be added. Stub anything that requires partnership.

**Total:** 8 items across 3 subgroups.

---

## Step 57 — Webhook Event Catalog Page

**Mode:** Safe-to-autorun
**Item:** 8-lite.1 #57
**Effort:** S
**Priority:** P1

### What this does

A public-facing (within-product) documentation page listing every webhook event BuiltCRM emits, with payload schemas and a live example for each. This is an integrator-facing artifact — when a reviewer opens this page, they should immediately understand what BuiltCRM's outbound API looks like. Strong portfolio signal.

### Tell Claude Code:

> Grep `src/` for every place an outbound webhook is (or would be) fired. From Step 26 we have the receiver; this step is about the emission catalog — the events BuiltCRM itself publishes to external systems via outbound webhooks.
>
> If outbound webhook emission isn't wired yet, that's fine — this catalog documents the *intended* event surface and drives the emission code. Most event types already exist as audit events; the catalog is the subset of audit events that are externally observable.
>
> Implement:
>
> 1. A registry file at `src/lib/integrations/webhookEventCatalog.ts` with one entry per event:
>    ```ts
>    type WebhookEventDefinition = {
>      key: string;              // e.g., "rfi.created"
>      category: 'workflows' | 'billing' | 'compliance' | 'documents' | 'projects';
>      description: string;
>      examplePayload: Record<string, unknown>;
>      deliveryGuarantee: 'at-least-once' | 'best-effort';
>    };
>    ```
> 2. Seed with ~25 real event types drawn from existing audit events: `project.created`, `rfi.created`, `rfi.responded`, `rfi.closed`, `co.submitted`, `co.approved`, `co.rejected`, `draw.submitted`, `draw.approved`, `draw.paid`, `compliance.expiring`, `document.uploaded`, `document.superseded`, `meeting.scheduled`, `meeting.completed`, `punch.item_created`, `inspection.completed`, `transmittal.sent`, plus a handful more drawn from what your audit log actually logs.
> 3. Page at `src/app/(portal)/contractor/(global)/settings/webhooks/catalog/page.tsx`:
>    - Grouped list by category
>    - Each event: key in mono, human description, expandable JSON payload with syntax highlighting
>    - Copy-to-clipboard on the example payload
> 4. Also render an OpenAPI-style table of contents at the top.
> 5. The page is contractor-scoped (subs and clients don't see it).
> 6. Add a sidebar link under Settings → Webhooks.

### What to check

- Page renders with all catalog entries, grouped by category
- Example payloads are valid JSON, copy button works
- Subs/clients cannot see this route (404 or redirect)
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 57 (8-lite.1 #57): Webhook event catalog page"
```

---

## Step 58 — Per-Org API Key Management

**Mode:** Require-design-input
**Item:** 8-lite.1 #58
**Effort:** M
**Priority:** P1

### What this does

Generate, rotate, and revoke API keys scoped to an org. Keys authenticate programmatic access to BuiltCRM's REST API (which Step 60 documents). This is the authentication primitive underneath every "programmatic integration" story.

### Tell Claude Code:

> Propose:
>
> 1. Schema: `api_keys` table — id, orgId, keyPrefix (first 8 chars of the full key, for display), keyHash (bcrypt hash of the full key), name, createdByUserId, createdAt, lastUsedAt (nullable), revokedAt (nullable), scopes (JSON array).
> 2. Key format: `bcrm_live_` + 32 random base62 chars. Prefix `bcrm_test_` for sandbox (future — for now only live).
> 3. Key surfaces on the user one time on creation. After that, only the prefix is visible. Rotation = revoke + create new.
> 4. Scopes: start with coarse scopes (read, write, admin) — reviewer signal that you thought about granularity without over-engineering.
> 5. Rate limiting (Step 59) identifies by key.
> 6. **Schema change — stop and ask.**
>
> API authentication middleware:
> - Check `Authorization: Bearer bcrm_live_xxx` header
> - Hash, look up, verify not revoked
> - Attach orgId + scopes to request context
> - Update lastUsedAt (async, non-blocking)
>
> After confirmation:
>
> 1. Migration.
> 2. Middleware at `src/middleware.ts` (or wherever middleware is composed) for routes matching `/api/v1/*`.
> 3. Key generation action with a one-time-reveal UX: after creation, the full key appears in a modal with "Copy & Close — this is the only time you'll see it."
> 4. UI page at `src/app/(portal)/contractor/(global)/settings/api-keys/page.tsx`: list with prefix, name, created by, last used, status; create/revoke actions.
> 5. Audit events: `api_key.created`, `api_key.revoked`, `api_key.used` (sampled — not every request, rate-limited log).
> 6. Contractor-scoped; only org admins can manage keys.

### What to check

- Admin creates a key → full key shown once, rehashed on save
- Revoked keys fail auth on subsequent use
- `lastUsedAt` updates on successful auth
- Non-admin can't create or revoke
- Wrong key → 401
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 58 (8-lite.1 #58): Per-org API key management"
```

---

## Step 59 — Rate Limiting per API Key

**Mode:** Safe-to-autorun
**Item:** 8-lite.1 #59
**Effort:** S
**Priority:** P1

### What this does

Standard. Keys get a request budget (default: 60 requests/minute, 1000/hour). Over the limit → 429 with `Retry-After`. Uses the existing Upstash Redis infrastructure.

### Tell Claude Code:

> Read how Upstash is wired into the project (from Phase 1). We'll reuse it for rate limit counters.
>
> Implement:
>
> 1. Helper `rateLimit({ key, limit, windowSec })` in `src/lib/rateLimit.ts` using Upstash's sliding-window or fixed-window counter.
> 2. In the API auth middleware (Step 58), after validating the key, call `rateLimit({ key: apiKey.id, limit: 60, windowSec: 60 })`. If over, return 429 with `X-RateLimit-Remaining: 0` and `Retry-After: <seconds>`.
> 3. Add per-hour limit as a second check (1000/hour).
> 4. On every API response, set headers `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
> 5. Make the limits configurable per key (future-proofing, even if we only support defaults today): `apiKeys.rateLimitPerMinute`, `apiKeys.rateLimitPerHour`, nullable to use defaults.
> 6. Document the limits on the API keys settings page.

### What to check

- Hammer an endpoint with a key past 60/min → get 429 with Retry-After
- Headers present on normal responses
- Different keys have independent counters
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 59 (8-lite.1 #59): Rate limiting per API key"
```

---

## Step 60 — Public API Docs Page

**Mode:** Require-design-input
**Item:** 8-lite.1 #60
**Effort:** M
**Priority:** P1

### What this does

Auto-generated API documentation from an OpenAPI 3 spec checked into the repo. Renders with a familiar docs UI. Portfolio signal — reviewers expect this from any serious SaaS.

### Tell Claude Code:

> Propose:
>
> 1. Where to keep the OpenAPI spec: `docs/specs/openapi.yaml`. Hand-authored (we don't have enough API breadth yet for spec-from-code generation to pay off).
> 2. Renderer: `redoc` (lightweight, readable, widely used) vs. `swagger-ui` (familiar, heavier). Recommend `redoc`. **New dep — stop and ask.**
> 3. What endpoints to document: start with a realistic subset — auth, projects (list/get), RFIs (list/get/create), change orders (list/get), documents (list/get), webhooks (subscribe/unsubscribe). Don't document every route on first pass.
> 4. Public vs. authenticated docs: make the docs page public (no login required) so reviewers can see it; include "Try it" only for authenticated keys.
>
> After confirmation:
>
> 1. Hand-author `docs/specs/openapi.yaml` with ~15 endpoints across core modules.
> 2. Install redoc (or redocly's bundler).
> 3. Page at `src/app/api-docs/page.tsx` (public route, no portal) that renders redoc against the spec.
> 4. Link from marketing footer "Developers" and from Settings → API Keys → "View API docs".
> 5. Include auth docs (how Bearer tokens work, how to get a key), rate limits, webhooks, errors.

### What to check

- `/api-docs` renders the redoc UI with all documented endpoints
- Spec file validates (use a YAML linter or redocly CLI)
- Navigation between endpoints works
- No auth required to read the docs
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 60 (8-lite.1 #60): Public API docs page via OpenAPI + redoc"
```

---

## Step 61 — Custom Fields on Entities

**Mode:** Require-design-input
**Item:** 8-lite.2 #61
**Effort:** M
**Priority:** P1

### What this does

JobTread markets this aggressively. Admins can define custom fields per entity type (projects, subs, documents, RFIs, etc.). Fields render in create/edit forms and show as columns or details on list views.

### Tell Claude Code:

> Propose schema:
>
> 1. `custom_field_definitions` table: id, orgId, entityType ('project' | 'subcontractor' | 'document' | 'rfi' | ...), key (slug, unique per orgId+entityType), label, fieldType ('text' | 'number' | 'date' | 'select' | 'multi_select' | 'boolean'), options (JSON array for select types), required (bool), orderIndex.
> 2. `custom_field_values` table: id, definitionId, entityId (polymorphic — combined with entityType on the definition), value (JSON to accommodate all types), createdAt, updatedAt.
> 3. **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Admin UI at `src/app/(portal)/contractor/(global)/settings/custom-fields/page.tsx`: list per entity type, create/edit/reorder/delete definitions.
> 3. Integration with entity forms: after core fields in create/edit forms, render custom fields from the definitions for that entity type and org. Save writes to `custom_field_values`.
> 4. List view integration: add optional "custom field" columns; admins pick which to show.
> 5. Deletion rules: deleting a definition soft-deletes (marks inactive); values persist for audit.
> 6. Authorization: only org admins can manage definitions; all users see the fields that are defined.

### What to check

- Admin defines a "Project Color" custom select field on projects
- Creating a new project shows the field in the form
- Value persists, visible on project detail and list views
- Non-admin can't access the custom fields admin page
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 61 (8-lite.2 #61): Custom fields on entities"
```

---

## Step 62 — Bulk CSV Import / Export Wizard

> **Status: ✅ Done** (2026-04-17) — Data Exports phase Sessions 1–5. Export side: Projects CSV, Documents ZIP, Audit log CSV (Enterprise), full archive (orchestrator). All Pro+ gated via `data_exports.full_archive` feature key (Enterprise-only for audit log). Import side: Projects CSV with column-mapping wizard, transactional batch insert. `data_exports` tracking table + `Recent exports` panel in the Data tab. Schema: migration `0006_data_exports.sql`. Helpers: `src/lib/exports/csv.ts`, `src/lib/exports/builders.ts`, `src/lib/imports/csv-parser.ts`, `src/lib/imports/projects-import.ts`.

**Mode:** Require-design-input
**Item:** 8-lite.2 #62
**Effort:** S
**Priority:** P1

### What this does

Onboarding-critical. Import existing projects, subcontractors, vendors, or selection catalogs from a CSV. Export the same. Demo flag for "we support onboarding from your old tools."

### Tell Claude Code:

> Propose:
>
> 1. Supported entities (V1): projects, subcontractors (as org + primary contact), vendors, selection catalog items.
> 2. Library: `papaparse` for client-side parsing (already on the frontend-design skill's recommended list), write on the server.
> 3. Wizard steps: (1) choose entity type, (2) upload CSV, (3) column mapping UI (their CSV columns → our fields; auto-detect with fuzzy match, user can adjust), (4) validation preview (show first 10 rows with validation errors highlighted), (5) import progress, (6) done with summary (imported X, skipped Y with reasons).
> 4. Validation rules per entity defined declaratively in `src/lib/importers/<entity>.ts`.
> 5. Errors: per-row, exportable as a "failed rows" CSV for correction and re-import.
> 6. Idempotency: dedupe by a chosen key column (user picks which column is the unique identifier).
>
> **New dep (papaparse) — stop and ask.**
>
> After confirmation:
>
> 1. Install papaparse.
> 2. Wizard UI at `src/app/(portal)/contractor/(global)/settings/import/page.tsx`.
> 3. Per-entity importer modules.
> 4. Server action `bulkImport(entityType, mappedRows, context)` — returns per-row results.
> 5. Export: "Export all projects" / "Export all subs" etc. buttons at Settings → Data → Export. Reuses the CSV write with consistent columns.
> 6. Audit events on import runs: `import.run` with counts.

### What to check

- Import 20 projects from a CSV with mis-named columns → mapping UI resolves → 18 imported, 2 failed with clear errors
- Export all projects → CSV downloads with expected columns
- Re-import exported CSV → dedupes correctly
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 62 (8-lite.2 #62): Bulk CSV import / export wizard"
```

---

## Step 63 — SSO Stub

> **Status: ✅ Done — real, not stubbed** (2026-04-17). Shipped across 3 sessions as full SAML 2.0 handshake via `samlify` + `@authenio/samlify-node-xmllint` (WASM schema validator). Schema: migration `0007_sso_providers.sql` (one provider per contractor org). Routes: `/api/auth/sso/initiate` + `/api/auth/sso/acs` via a Better Auth plugin (`src/auth/sso-plugin.ts`); provider CRUD at `/api/org/sso/providers` (Enterprise-gated). UI: Org security tab's Configure drawer now live with paste-IdP-metadata form + "Test sign-in" button. Auto-provisioning on first SSO login is deliberately deferred (UX decision needed); users must be invited first.

**Mode:** Require-design-input
**Item:** 8-lite.2 #63
**Effort:** S (stubbed)
**Priority:** P2

### What this does

SAML 2.0 endpoint that works against a test IdP. Shows you understand enterprise auth without requiring real customer IdP config (every production deployment needs its own).

### Tell Claude Code:

> Propose:
>
> 1. Library: `@node-saml/node-saml` or similar. **New dep — stop and ask.**
> 2. Scope: one SAML entry point at `/api/auth/saml/[idpSlug]/acs` (assertion consumer service) + `/api/auth/saml/[idpSlug]/metadata` (SP metadata). Configurable per-org; for the stub, we hardcode one "demo IdP" (SAMLtest.id or Auth0's SAML test). Real deployment would have per-customer config.
> 3. Better Auth integration: accept a SAML assertion, resolve to an existing user (by email claim) or create one, establish a session via Better Auth.
> 4. Settings page: `src/app/(portal)/contractor/(global)/settings/sso/page.tsx` — shows SAML metadata download, ACS URL, and instructions. "SSO enforcement is a production feature; for portfolio the SSO flow works against the demo IdP." Documents what production would require: per-org IdP config table, just-in-time provisioning rules, IdP-initiated and SP-initiated flow configs.
>
> After confirmation:
>
> 1. Install saml lib.
> 2. ACS + metadata routes.
> 3. Hookup to Better Auth session creation.
> 4. Settings page with docs.
> 5. README section documenting production requirements (per-customer IdP config is the main gap).

### What to check

- Configure SAMLtest.id with our ACS URL and metadata
- Initiate SSO from SAMLtest.id → assertion flows to our ACS → session created → user logged in
- Settings page renders metadata download and SP config
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 63 (8-lite.2 #63): SSO stub — SAML 2.0 endpoint against test IdP"
```

---

## Step 64 — Integration Gallery Page

**Mode:** Require-design-input
**Item:** 8-lite.3 #64
**Effort:** S
**Priority:** P1

### What this does

Marketing-shaped page listing ~20 known integrations with logos, scope descriptions, and status: Connected, Available, or "Coming soon — requires partner application." Shows you know the landscape even for providers you can't actually integrate with today.

### Tell Claude Code:

> Before writing code, propose the list of integrations to include:
>
> - **Working today** (from Phase 4C): Stripe, QuickBooks (sandbox), Xero (sandbox), Sage (sandbox).
> - **Gated, show as "Coming soon — requires partner application":** Procore, Autodesk Construction Cloud, Bluebeam Studio Prime, DocuSign, Microsoft 365, Google Workspace, Slack, Gmail (for better email), TrustLayer, myCOI, Siteline, GCPay, Trimble Pay, Ceridian Dayforce, Agave, Workato, Built Technologies.
>
> Each entry needs: logo SVG (use provider's public logos for a portfolio — cite fair-use for reviewer-facing artifacts), category badge, one-sentence scope description, status pill.
>
> Layout: grid of cards, filterable by category (Accounting, Payments, Documents, Communication, Project Management, Compliance, Field Tools, Payroll, Lending).
>
> Click a "Coming soon" card → modal with a realistic "consent mockup": the provider's name, the scopes we'd request, an explanation that production integration requires partner application.
>
> After confirmation:
>
> 1. Data file `src/lib/integrations/galleryCatalog.ts` with all entries.
> 2. Page at `src/app/(portal)/contractor/(global)/integrations/page.tsx` (this is the gallery — the Settings → Integrations page from Step 28 is separate and shows only what's actually wired).
> 3. Card component.
> 4. Consent-mockup modal for coming-soon providers.
> 5. Public (non-auth) version at `/integrations` for marketing.

### What to check

- Gallery renders all ~20 integrations with correct logos
- Filter by category works
- Clicking a coming-soon card opens the mockup modal
- Public marketing version accessible without login
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 64 (8-lite.3 #64): Integration gallery page"
```

---

## Phase 8-lite Wrap

```bash
npm run build && npm run lint && npm run test
```

Phase 8-lite done. Programmatic access surface + gallery shipped. Clickthrough: open the webhook catalog, create and revoke an API key, hit the API docs page, import a CSV of subs, test SSO against SAMLtest, browse the gallery.

---

# Phase 9-lite — Canadian Compliance

**Target:** Weeks 18–22 of Phase 4+. Optional based on your appetite.

**Rule:** Only build items that are free to implement. Skip anything requiring paid regulators, translation services, or CA-specific hosting costs.

**Total:** 5 required + 2 optional = up to 7 items.

---

## Step 65 — Law 25 Privacy Officer Surface

**Mode:** Require-design-input
**Item:** 9-lite.1 #65
**Effort:** M
**Priority:** P1

### What this does

Quebec's Law 25 (privacy) requires organizations to have a Privacy Officer, handle DSARs (Data Subject Access Requests) within 30 days, maintain a consent register, and log breaches. None of this requires paying a regulator — it's all product surface. Strong portfolio signal for privacy engineering.

### Tell Claude Code:

> Propose schema:
>
> 1. `privacy_officers` table: orgId, userId, designatedAt. One per org.
> 2. `dsar_requests` table: id, orgId, requesterEmail, requesterName, requestType ('access' | 'deletion' | 'rectification' | 'portability'), status ('received' | 'in_progress' | 'completed' | 'rejected'), receivedAt, slaDueAt (30 days), completedAt, notes.
> 3. `consent_records` table: id, orgId, subjectUserId (or subjectEmail for non-users), consentType (e.g., 'marketing_email', 'data_processing'), granted (bool), grantedAt, revokedAt.
> 4. `breach_register` table: id, orgId, discoveredAt, occurredAt (estimated), severity, affectedSubjects (count + description), dataTypesAffected (JSON), containmentActions (text), notifiedUsersAt (nullable), reportedToCAIAt (nullable — informational, not actually sent), closedAt, closedByUserId.
> 5. **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Public DSAR intake at `/privacy/dsar` (no login required; CAPTCHA): form with requester identity, type of request, description. Submission writes a `dsar_requests` row and emails the org's Privacy Officer.
> 3. Privacy Officer admin surface at `src/app/(portal)/contractor/(global)/settings/privacy/page.tsx`:
>    - Current Privacy Officer (designate/change)
>    - DSAR queue with 30-day SLA countdown on each
>    - Consent register — view per user/subject
>    - Breach register — view and log new breaches
> 4. Consent manager UI: users can view and manage their consents at `/settings/privacy`. Also surfaces on signup as a consent checklist.
> 5. Breach notification to users: when a breach is logged and marked to notify, generates email drafts to affected users. Does NOT auto-send; Privacy Officer reviews and sends.
> 6. CAI (Commission d'accès à l'information) notification: logged in the breach register as a flag ("reported to CAI on X date") — **we do not actually send to CAI**, since that requires a regulator account. Document in the README that real CAI notification is a manual step outside the product.
> 7. Audit events throughout.
>
> **Important boundary:** This is the surface of Law 25 compliance. Real compliance involves organizational processes, not just product features. The README should make this clear.

### What to check

- Public DSAR form submits; officer receives email
- Officer dashboard shows DSAR with 30-day countdown
- Consent manager lets users view and revoke
- Breach register logs incidents with all required fields
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 65 (9-lite.1 #65): Law 25 Privacy Officer surface — DSAR, consent, breach register"
```

---

## Step 66 — RBQ License Verification

**Mode:** Require-design-input
**Item:** 9-lite.1 #66
**Effort:** S
**Priority:** P1

### What this does

Quebec's Régie du bâtiment (RBQ) publishes open data of licensed contractors. Hit that feed with a sub's RBQ number → get back their license status, subclass (categories they're licensed for), and validity. Surface as a badge on the sub profile. No competitor ships this. Half day of work.

### Tell Claude Code:

> Research first: confirm the RBQ open data endpoint URL, rate limits, and format. The RBQ publishes a searchable registry — we'll need to find the exact programmatic endpoint (it may be an Open Data catalog CSV download vs. a search API).
>
> Propose:
>
> 1. If there's a real API: live lookup, cache results for 24 hours.
> 2. If it's a CSV download only: nightly Trigger.dev job refreshes the cache; lookups go against our cached copy.
> 3. Schema: `rbq_license_cache` table — rbqNumber (primary), legalName, subclasses (JSON), status, expiryDate, lastCheckedAt.
> 4. **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migration.
> 2. Fetcher at `src/lib/integrations/rbq.ts` — `lookupRbqLicense(rbqNumber)` returns cached or fresh record.
> 3. Nightly refresh job if CSV path.
> 4. Sub profile UI: if the sub's profile has an `rbqNumber` field (add if missing — another small schema change, flag it), look up on page load and render a badge:
>    - Green pill with legalName + subclasses + expiry, if valid
>    - Amber pill if expiring in <30 days
>    - Red pill with "License expired" or "Not found" otherwise
> 5. Admin action on sub profile: "Refresh RBQ lookup" button.
> 6. Province-gated: only Quebec projects surface this widget; others hide it.

### What to check

- Enter a known-valid RBQ number → green badge with correct info
- Enter a fake number → red badge
- Expired-soon license → amber
- Refresh button forces a fresh lookup
- Non-Quebec projects don't show the widget
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 66 (9-lite.1 #66): RBQ license verification"
```

---

## Step 67 — T5018 Contractor Payment Slip Generator

**Mode:** Require-design-input
**Item:** 9-lite.1 #67
**Effort:** S
**Priority:** P1

### What this does

Canadian tax form. Contractors in the construction industry must issue T5018 slips to subs paid >$500 in a calendar year, and file the summary with CRA. Generate the slips (XML for CRA + PDF for each sub). No competitor ships native T5018.

### Tell Claude Code:

> Research first: CRA's T5018 XML schema (available on cra-arc.gc.ca). Confirm the current year's version.
>
> Propose:
>
> 1. Input: fiscal year, contractor org.
> 2. Aggregation: sum payments per sub for the year (from the `payments` table joined with draws joined with sub org).
> 3. Filter: only subs with total > $500 CAD.
> 4. Output A: XML file conforming to CRA's T5018 schema (one XML with all slips).
> 5. Output B: one PDF per sub with their slip info + YTD totals.
> 6. UI: admin page `src/app/(portal)/contractor/(global)/settings/tax-forms/t5018/page.tsx` — select year, preview slips, generate.
> 7. Canadian-only: the Tax Forms section only appears for contractor orgs with a Canadian tax jurisdiction setting (add this if missing — small schema nudge, flag).
>
> After confirmation:
>
> 1. Schema additions if needed (stop and ask).
> 2. Aggregation query.
> 3. XML generator.
> 4. PDF generator (reuses Step 13's PDF infra).
> 5. UI page.
> 6. Download button generates both outputs as a ZIP.
> 7. Audit event: `tax.t5018.generated` with year and count.

### What to check

- Select 2025 → preview shows all qualifying subs with accurate totals
- Generate → ZIP downloads with XML + per-sub PDFs
- XML validates against CRA schema
- Non-Canadian orgs don't see this page
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 67 (9-lite.1 #67): T5018 contractor payment slip generator"
```

---

## Step 68 — Ontario 2026 Construction Act Prompt-Payment Engine

**Mode:** Require-design-input
**Item:** 9-lite.1 #68
**Effort:** M
**Priority:** P1

### What this does

Ontario's Construction Act (2017, expanded 2018+) mandates prompt payment timelines: an owner who receives a "proper invoice" must pay the GC within 28 days; the GC must cascade payment to subs within 7 days of receiving. Missed deadlines trigger notice-of-non-payment requirements. Holdback (10%) accumulates per project and releases annually on January 1.

This step builds the full timer + form engine. Demo-worthy — it's a real, enforceable regulatory surface.

### Tell Claude Code:

> Propose schema:
>
> 1. Project has a `jurisdiction` field (already flagged in Step 67). Ontario-jurisdiction projects opt into the prompt-payment engine.
> 2. `proper_invoices` table: id, projectId, drawRequestId (our internal link), ownerName, gcName, invoiceDate, amount, properInvoiceFields (JSON checklist), receivedAt.
> 3. `payment_timers` table: id, invoiceId (or drawId for GC→sub cascade), timerType ('owner_to_gc_28day' | 'gc_to_sub_7day'), startedAt, dueAt, completedAt (nullable), status ('running' | 'met' | 'missed').
> 4. `notices_of_non_payment` table: id, timerId, noticeType ('owner_to_gc' | 'gc_to_sub'), generatedAt, sentAt (nullable), content (text).
> 5. `holdback_ledger` table: id, projectId, amount, accruedFromDrawId, accruedAt, releasedAt (nullable), releaseYear (the year it's eligible for release).
> 6. **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Proper Invoice template: when a GC submits a draw on an Ontario project, the draw flow adds a "Proper Invoice" subform with the mandatory fields from the Construction Act (identifying the parties, specifying the amount, signed, bearing the invoice date, etc.). Validation enforces completeness.
> 3. Timer creation: when the proper invoice is received by the owner, `owner_to_gc_28day` timer starts. When the GC issues payment, timer completes with "met".
> 4. Missed deadline: Trigger.dev daily job identifies timers that passed `dueAt` without completion. Generates draft notice-of-non-payment; notifies Privacy Officer / project admin.
> 5. Cascade: when GC receives payment, the GC→sub 7-day timers start for each sub in the invoice.
> 6. Holdback ledger: on every payment to a sub, 10% is accrued to the holdback ledger; the rest is paid. Release calc: on Jan 1 each year, accrued holdback from the prior year becomes eligible for release (flagged in the ledger). GC manually confirms release.
> 7. UI page at `src/app/(portal)/contractor/project/[projectId]/construction-act/page.tsx`: active timers, overdue timers, notices generated, holdback ledger.
> 8. Audit events throughout.

### What to check

- Ontario project: GC submits a proper invoice → owner's 28-day timer starts
- Owner pays day 20 → timer completes "met"
- Different project: owner doesn't pay by day 28 → timer goes "missed", draft notice generated, admin notified
- GC receives payment → sub timers start
- Holdback accrues 10% per sub payment
- Jan 1 release eligibility flags correctly
- Non-Ontario projects don't have this page
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 68 (9-lite.1 #68): Ontario 2026 Construction Act prompt-payment engine"
```

---

## Step 69 — CCQ / ARQ Attestation Capture

**Mode:** Require-design-input
**Item:** 9-lite.1 #69
**Effort:** S
**Priority:** P1

### What this does

Quebec-specific compliance. CCQ (Commission de la construction du Québec) attestations and ARQ (Agence du revenu du Québec) certificates are required before subs can be paid on Quebec projects. Capture the attestation number + expiry, show status on sub profile, remind before expiry.

### Tell Claude Code:

> Propose schema:
>
> 1. `qc_attestations` table: id, subOrgId, attestationType ('ccq' | 'arq'), attestationNumber, issuedDate, expiryDate, documentId (optional — the PDF of the attestation), capturedAt, capturedByUserId.
> 2. **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migration.
> 2. Sub profile: Quebec-project subs see a CCQ/ARQ section where they can enter attestation numbers + upload the PDF.
> 3. Expiry reminders: Trigger.dev daily job identifies attestations expiring in <30 days; sends notification to sub + project admin.
> 4. Sub profile badge: green if both valid, amber if either expiring <30 days, red if expired or missing.
> 5. Compliance workflow integration: on a Quebec project, sub can't be paid without valid attestations (block at the billing action with a clear error).
> 6. Non-Quebec: section hidden.

### What to check

- Quebec project sub enters CCQ attestation → status flips to valid
- Expiry in 25 days → amber badge, notification sent
- Expired → red, payment blocked with clear error
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 69 (9-lite.1 #69): CCQ / ARQ attestation capture"
```

---

## Step 70 — i18n Plumbing (Optional Track)

**Mode:** Require-design-input
**Item:** 9-lite.2 #70 (optional)
**Effort:** M
**Priority:** P1 (if pursuing i18n track)

### What this does

Wraps the app in an i18n framework so every user-facing string goes through a translation key lookup. Plumbing is portfolio-worthy even if the only language is English — shows you thought about internationalization. ~6–10 hours.

### Tell Claude Code:

> Propose:
>
> 1. Library: `next-intl` (App Router-native) vs. `react-intl`. Recommend `next-intl` for our stack. **New dep — stop and ask.**
> 2. Folder layout: `src/messages/en.json`, `src/messages/fr.json` (seeded empty until Step 71). Keys organized by feature area: `common.buttons.save`, `contractor.dashboard.title`, etc.
> 3. Locale routing: subpath (`/en/...`, `/fr/...`) vs. domain. Subpath is simplest. Default to `/en`.
> 4. Locale switcher in user settings + topbar.
> 5. Date, number, currency formatting: `next-intl` handles this with locale-aware Intl APIs.
>
> After confirmation:
>
> 1. Install next-intl.
> 2. Configure middleware for locale routing.
> 3. Root layout wraps app in `NextIntlClientProvider`.
> 4. Create en.json as a flat seed — migrate as we go.
> 5. Run a grep-based extractor pass: find every hardcoded user-facing string (not in Phase 3 prototypes — in actual `src/`), replace with `t('key')` calls, add to en.json. This is mechanical but tedious; take it feature by feature.
> 6. Locale switcher component in user settings → persists to `user.preferredLocale`.
>
> Rule for all Phase 4+ work from this step forward: **every new user-facing string uses `t()`**. Don't backslide into hardcoded strings mid-sprint.

### What to check

- Toggle locale in settings → switch to `/fr`, but most strings fall back to English since fr.json is empty
- All hardcoded strings from at least one feature area (e.g., dashboard) are migrated to keys
- Dates/numbers format per locale
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 70 (9-lite.2 #70): i18n plumbing with next-intl"
```

---

## Step 71 — fr-CA Translation (Optional)

**Mode:** Require-design-input
**Item:** 9-lite.2 #71 (optional)
**Effort:** M
**Priority:** P2

### What this does

Fills out `fr.json` with Quebec French translations of every key in `en.json`. Only worth doing if you're willing to self-polish the translations — Claude or DeepL can draft, but Quebec terminology matters (fr-CA not fr-FR).

### Tell Claude Code:

> Process:
>
> 1. Draft: feed `src/messages/en.json` to a translation pass (Claude or DeepL). Request Quebec French specifically — Quebec terminology in construction differs from France French.
> 2. Terminology anchors to get right:
>    - "Contractor" → "Entrepreneur général" (not "Contracteur")
>    - "Subcontractor" → "Sous-traitant"
>    - "Change order" → "Ordre de changement" or "Avenant"
>    - "Draw request" → "Demande de décaissement"
>    - "Proper invoice" → "Facture conforme" (Ontario terminology may not translate cleanly to Quebec; flag)
>    - "Punch list" → "Liste des déficiences"
> 3. After draft, walk through the 10 most-visited pages in French and polish. Flag anything uncertain.
> 4. Keep en.json as the canonical source; fr.json is never ahead of en.json.
>
> After I confirm the terminology list:
>
> 1. Draft fr.json.
> 2. Manual polish pass on 10 pages.
> 3. Add a CI check (lint rule or script): fr.json must have all keys that en.json has. Missing keys fail the build.

### What to check

- Toggle locale → French renders across the polished pages correctly
- Missing-keys check blocks bad commits
- Quebec terminology matches what a Quebec construction user would expect
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 71 (9-lite.2 #71): fr-CA translation with missing-key CI check"
```

---

## Phase 9-lite Wrap

```bash
npm run build && npm run lint && npm run test
```

Phase 9-lite done. Canadian compliance surfaces land. Clickthrough: submit a DSAR, verify an RBQ license, generate a T5018, fire a Construction Act timer to miss, capture CCQ attestation, switch locale to French.

---

# Phase 10 — Residential Depth + Client Portal Polish

**Target:** Weeks 22–28 of Phase 4+. After the moat is built.

**Rule:** Residential language everywhere: "Scope Changes" not "Change Orders", "Decisions" not "Approvals", "Walkthrough Items" for punch list.

**Total:** 11 items.

---

## Step 72 — Client-Initiated Warranty Request Portal

**Mode:** Require-design-input
**Item:** 10.1 #72
**Effort:** M
**Priority:** P1

### What this does

Post-handover, homeowners lose portal access in most products today. BuiltCRM keeps them in with a warranty request portal — they can submit warranty claims for issues that arise after move-in (within the warranty period), contractor triages, and resolution is tracked.

### Tell Claude Code:

> Propose schema:
>
> 1. `project_warranty_periods` table: id, projectId, warrantyType ('workmanship' | 'materials' | 'structural' | 'custom'), startsAt (usually handover date), endsAt, description.
> 2. `warranty_requests` table: id, projectId, submittedByUserId (homeowner), submittedAt, title, description, photoIds, category ('plumbing' | 'electrical' | 'finishes' | 'structural' | 'other'), urgency ('low' | 'normal' | 'urgent' | 'emergency'), status ('submitted' | 'triaged' | 'scheduled' | 'in_progress' | 'resolved' | 'rejected' | 'out_of_warranty'), assignedToUserId (nullable), scheduledAt (nullable), resolvedAt (nullable), resolutionNotes.
> 3. **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Post-handover state: when a project is closed out (Step 48 closeout acceptance), it transitions to a "warranty" state. Homeowner keeps portal access but most modules go read-only. Warranty request is the primary new surface.
> 3. Homeowner submission UI at `/residential/project/[id]/warranty/page.tsx`: list of their open and resolved requests, "New request" button opens a form.
> 4. Contractor triage UI at `/contractor/project/[id]/warranty/page.tsx`: all requests, filter by status, triage actions.
> 5. Automatic out-of-warranty detection: if the warranty period has ended and a request is submitted, default status is `out_of_warranty` with a clear explanation to the homeowner.
> 6. Notifications on every state change.
> 7. Photos, activity log, resolution notes — standard workflow surface.

### What to check

- Homeowner on a closed-out project submits a warranty request
- Contractor triages, schedules, resolves
- Homeowner sees updates
- Post-warranty submission flagged out-of-warranty
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 72 (10.1 #72): Client-initiated warranty request portal"
```

---

## Step 73 — Specifications / Scope-of-Work Documents

**Mode:** Require-design-input
**Item:** 10.1 #73
**Effort:** M
**Priority:** P2

### What this does

Custom-home scope-of-work documents are distinct from selections. Selections are user-facing choices (finishes, fixtures); specifications are the structural/technical doc of what's being built. #1 driver of late-project disputes when the client expects something the spec doesn't cover. Surface specifications as a first-class document type.

### Tell Claude Code:

> Propose:
>
> 1. Leverage document categories (Step 21) — add "specifications" as a first-class category.
> 2. Add a dedicated "Specifications" surface at `/residential/project/[id]/specifications/page.tsx` for homeowners and `/contractor/project/[id]/specifications/page.tsx` for contractors. Not just the general documents page filtered — a proper dedicated view with section navigation, TOC, comment threading.
> 3. Version control via Step 22's supersedes chain.
> 4. Acceptance: when specs are "final", homeowner acknowledges in-product (clickwrap).
> 5. Changes to specs after acceptance trigger a scope change notification (ties to Scope Changes / Change Orders).
>
> After confirmation:
>
> 1. Dedicated UI.
> 2. Acceptance flow with audit.
> 3. Post-acceptance change detection.

### What to check

- Contractor uploads specs, publishes to client
- Homeowner reviews, accepts
- Post-acceptance edit triggers scope-change flow
- Version history preserved
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 73 (10.1 #73): Specifications / scope-of-work surface"
```

---

## Step 74 — Allowance Running-Balance Widget

**Mode:** Safe-to-autorun
**Item:** 10.1 #74
**Effort:** S
**Priority:** P1

### What this does

#1 late-stage residential dispute is allowance overruns. Homeowner picks a faucet $200 over the plumbing allowance and doesn't realize they're $1400 over across three categories until billing day. This widget is pure aggregation on existing data: running balance per allowance category, overall allowance status, total under/over.

### Tell Claude Code:

> Leverage existing selections data. For each allowance category:
>
> 1. Sum allocated amount from project allowances.
> 2. Sum committed amount from confirmed selections.
> 3. Show progress bar: green (under), amber (within 10% of limit), red (over).
> 4. Overall rollup at top: "You're $850 under allowance overall" or "$240 over — let's talk about this."
>
> Widget placement:
> - Prominent card on residential project home
> - Standalone page at `/residential/project/[id]/budget/page.tsx`
> - Mini version in contractor's residential project view
>
> Implement:
> 1. Loader `getAllowanceBalance(context, projectId)` returning per-category + overall.
> 2. Widget component with friendly language.
> 3. Clickable categories drilldown to selections.
> 4. No schema additions needed (pure aggregation).

### What to check

- Residential client sees allowance status card on project home
- Over-allowance categories highlighted
- Drilldown opens the relevant selections category
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 74 (10.1 #74): Allowance running-balance widget"
```

---

## Step 75 — Homeowner Walkthrough / Punch Capture

**Mode:** Require-design-input
**Item:** 10.1 #75
**Effort:** M
**Priority:** P2

### What this does

Differentiator. No vendor ships this natively — the homeowner walks their house with their phone, flags items, and the system adds them as walkthrough items (same as punch, just residential language). Contractor works through them.

### Tell Claude Code:

> Leverage the punch list module from Step 19 with residential transforms:
>
> 1. Residential client portal surfaces punch items as "Walkthrough Items".
> 2. Add a homeowner-initiated creation flow: `/residential/project/[id]/walkthrough/new` — mobile-first, camera-forward UX. Take photo → describe issue → optionally tag room/location → submit.
> 3. Submitted items default to "open" assigned to the project GC.
> 4. GC triages and assigns to the right sub (or handles directly).
> 5. Mobile-optimized capture flow similar to Step 55's Quick RFI.
> 6. Homeowner sees all their items and progress; can add comments or mark resolved from their side (with GC verification).
>
> Implement:
> 1. Residential UI transforms applied.
> 2. Homeowner capture flow.
> 3. Integration with existing punch workflow.

### What to check

- Homeowner walks house on mobile, captures 5 items with photos
- Items appear in GC's punch list tagged as homeowner-initiated
- GC assigns, sub works, verifies
- Homeowner sees progress in their portal
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 75 (10.1 #75): Homeowner-initiated walkthrough / punch capture"
```

---

## Step 76 — Proposal / Estimate Generation with E-Signature

**Mode:** Require-design-input
**Item:** 10.1 #76
**Effort:** M
**Priority:** P1

### What this does

Table-stakes residential. Buildertrend, JobTread, UDA, and BuildBook all ship proposal + native e-signature. GC builds a proposal with line items, sends to prospective homeowner, homeowner signs electronically. Proposal becomes the basis for the contract.

### Tell Claude Code:

> Propose schema:
>
> 1. `proposals` table: id, orgId (GC), prospectName, prospectEmail, projectAddress, status ('draft' | 'sent' | 'viewed' | 'signed' | 'rejected' | 'expired'), lineItemsJson, totalAmount, validUntil, sentAt, signedAt.
> 2. `proposal_signatures` table: id, proposalId, signerEmail, signerName, signatureBlob (base64 PNG from canvas), signedAt, ipAddress, userAgent.
> 3. `proposal_access_tokens` table: id, proposalId, token (UUID), expiresAt, firstViewedAt.
> 4. **Schema change — stop and ask.**
>
> After confirmation:
>
> 1. Migrations.
> 2. Proposal builder at `/contractor/proposals/new`: line items, totals, cover letter, terms, attach prior work examples.
> 3. Send: generates unique token, emails prospect with link to the proposal review page.
> 4. Prospect view at `/proposals/[token]` (no login required, token-auth): reads proposal, signs via canvas-captured signature, optionally adds notes.
> 5. Post-signature: proposal becomes immutable, PDF generated and emailed to both parties, and the system offers to convert proposal to project (turning the prospect into a client with portal access).
> 6. Rejection path: prospect can reject with reason.
> 7. Rate-limit the public proposal route aggressively (brute-force guess against the token).
> 8. Audit events throughout.
>
> E-signature approach: canvas-drawn signature captured as PNG, stored with hashed audit trail (IP + UA + timestamp + content hash). Meets most US residential contract norms; for legally-rigorous cases, DocuSign integration is the answer but partner-gated.

### What to check

- GC builds and sends proposal
- Prospect clicks email link, reviews, signs on mobile and desktop
- Signature captured, PDF generated
- Convert-to-project flow creates the client account with portal access
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 76 (10.1 #76): Proposal generation with native e-signature"
```

---

## Step 77 — Photo Journal

**Mode:** Safe-to-autorun
**Item:** 10.1 #77
**Effort:** S
**Priority:** P2

### What this does

Small effort. A chronological photo journal of the project for the homeowner — every progress photo organized by date, with optional captions from the contractor. Emotional UX for residential. Not timelapse (that's hardware).

### Tell Claude Code:

> Leverage existing photos (uploaded via daily logs, documents, and phase 6 capture).
>
> Implement:
>
> 1. Page at `/residential/project/[id]/journal/page.tsx`: chronological grid of all photos visible to the client, grouped by date.
> 2. Click a photo → lightbox with caption, date, uploader.
> 3. Contractor can hide specific photos from the client journal (some internal photos aren't for client eyes) — a toggle on the photo detail.
> 4. Optional contractor caption for context.
> 5. Download-album button (reuses photo ZIP from Step 13) for the client.
> 6. No schema additions — uses existing document/photo infrastructure with a "client-visible" flag.

### What to check

- Homeowner sees all client-visible photos in chronological order
- Hiding a photo contractor-side removes it from client view
- Download album works
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 77 (10.1 #77): Photo journal for residential client"
```

---

## Step 78 — Multi-Stakeholder Guest Access

**Mode:** Require-design-input
**Item:** 10.2 #78
**Effort:** M
**Priority:** P1

### What this does

Most portals collapse "client" into one login. Real residential/commercial projects have multiple stakeholders: homeowner + spouse + architect + lender + co-signer. Each has distinct visibility needs. This step gives them distinct scoped logins.

### Tell Claude Code:

> Propose:
>
> 1. Role additions for client-side: `homeowner_primary`, `homeowner_spouse`, `architect`, `lender`, `co_signer`, `consultant`, `custom`.
> 2. Each role has a default scope definition (what modules they can see):
>    - Homeowner: everything in the residential portal
>    - Spouse: same as homeowner
>    - Architect: documents, drawings, specs, RFIs, change orders, schedule; not billing
>    - Lender: billing + schedule + progress photos; not change orders or RFIs
>    - Co-signer: billing only
>    - Consultant: custom per invitation
> 3. Invitation flow: GC invites each stakeholder with a role, scope is enforced at the loader/action level (already a Phase 1 convention).
> 4. Audit: every cross-stakeholder action logged.
>
> **Role additions likely require schema touch — stop and ask.**
>
> After confirmation:
>
> 1. Migrations if needed (membership role set).
> 2. Extended invitation UI for GCs.
> 3. Scope-aware loaders enforcing role visibility.
> 4. Optional: stakeholder-aware messaging (send a message to "lender only" or "all stakeholders").

### What to check

- GC invites an architect and a lender
- Each logs in, sees different portal content
- Architect can't access billing; lender can't access RFIs
- Authorization enforced at loader level (not just UI)
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 78 (10.2 #78): Multi-stakeholder guest access with scoped roles"
```

---

## Step 79 — Consolidated Decision Log

**Mode:** Safe-to-autorun
**Item:** 10.2 #79
**Effort:** S
**Priority:** P1

### What this does

Immutable timeline across selections, change orders, specifications, and allowance choices. Every client decision that ever affected scope, cost, or schedule, in one place. Differentiator. Scope-dispute defense.

### Tell Claude Code:

> Pure aggregation over existing data:
>
> 1. Loader `getDecisionLog(context, projectId)` unions:
>    - Selection confirmations (selection ID, option chosen, date, amount impact)
>    - Change order approvals / rejections (CO ID, outcome, amount impact)
>    - Specification acceptances (Step 73)
>    - Allowance waiver events (client consciously going over allowance)
>    - Proposal signatures (Step 76)
>    - Walkthrough item approvals
>    - Any other client-approval touchpoint
> 2. Ordered chronologically. Each entry has: type, what was decided, amount impact, who decided, date, link to source record.
> 3. Residential copy: "Your Decisions" page.
> 4. Commercial: "Decision Log" page.
> 5. Export as PDF for records.
> 6. Immutable — no edit affordance; corrections require a new decision entry referencing the prior.

### What to check

- All decision events appear in the log
- Chronological order
- Each entry links to source
- PDF export works
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 79 (10.2 #79): Consolidated decision log"
```

---

## Step 80 — Self-Serve E-Sign + Payment in One Flow

**Mode:** Require-design-input
**Item:** 10.2 #80
**Effort:** M
**Priority:** P1

### What this does

Table-stakes. Change order approval + payment together in a single flow with saved payment methods. No "approve in one place, then go pay separately." Unified.

### Tell Claude Code:

> Combines Step 76 (e-signature) + Step 32 (card payment for selections) into a single workflow for any approval that has financial impact.
>
> 1. For a CO with a cost impact, the approval modal has two CTAs: "Approve" (if no immediate payment needed — just signs off on the scope change; billed in next draw) and "Approve & Pay Now" (sign + pay the CO amount immediately via saved card).
> 2. Stripe's saved-methods: once a client has paid once, their payment method is on file (attached to their Stripe customer ID, stored scoped to the contractor org). Future approvals can re-use it with one tap.
> 3. Signature + payment in one action (atomic): signature captured → payment authorized → both committed or both rolled back.
> 4. Audit: both signature and payment events with the unified transaction ID.
>
> Implement:
> 1. Shared approval modal component used by COs, scope changes, and other financial approvals.
> 2. Stripe saved-methods integration.
> 3. Atomic commit path.

### What to check

- Residential client on a scope change with cost: "Approve & Pay Now" flow completes in one step
- Saved methods reappear on the next approval
- Failure in either step rolls back the other
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 80 (10.2 #80): Unified e-sign + payment flow with saved methods"
```

---

## Step 81 — Milestone Celebration / Shareable Progress Cards

**Mode:** Safe-to-autorun
**Item:** 10.2 #81
**Effort:** S
**Priority:** P2

### What this does

Residential emotional UX. When a major milestone is hit ("Foundation complete!", "Framing up!", "Drywall finished!"), generate a shareable visual card the homeowner can post on social or send to family. Small feature; disproportionate user delight.

### Tell Claude Code:

> Leverage existing milestones data:
>
> 1. When a milestone flagged as `celebratable` completes, generate a visual progress card server-side:
>    - Project name + address (optional, client controls)
>    - Milestone name
>    - Hero photo (most recent relevant photo or admin-selected)
>    - Stats ("75% complete · Est. move-in: August 2026")
>    - BuiltCRM subtle branding
> 2. Image is a PNG rendered server-side (could be a headless render via `@vercel/og` or similar — check what's installed).
> 3. Homeowner sees the card on the residential project home when triggered; downloadable, shareable (copy link for social).
> 4. Celebratable milestones are flagged by the GC in milestone setup.
>
> No hard schema change — uses existing milestone table with a boolean flag.
>
> Implement:
> 1. Flag field (nudge schema — flag if adding).
> 2. Card generation route.
> 3. UI reveal on milestone completion.
> 4. Share affordances.

### What to check

- Mark a milestone celebratable, complete it → card appears in residential portal
- Download produces a shareable PNG
- Card shows correct project info and photo
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 81 (10.2 #81): Milestone celebration progress cards"
```

---

## Step 82 — Separate Architect / Owner / Tenant Views on Commercial

**Mode:** Require-design-input
**Item:** 10.2 #82
**Effort:** M
**Priority:** P1

### What this does

Standard commercial. Procore and Northspyre ship this. Distinct views for architect (design-focused), owner (financial + milestone-focused), and tenant (schedule + impact-focused) on commercial projects. Parallel to Step 78 but with commercial-specific role scopes.

### Tell Claude Code:

> Reuses the multi-stakeholder framework from Step 78 but adds commercial-specific roles:
>
> 1. `architect_of_record`, `owner_principal`, `owner_rep`, `tenant`, `tenant_rep` roles.
> 2. Each has a commercial-appropriate scope:
>    - Architect: drawings, specs, RFIs, submittals; contract budget but not payment ops
>    - Owner principal: everything financial + contract level
>    - Owner rep: similar to owner but without contract execution auth
>    - Tenant: schedule visibility into their space, impact on operations
>    - Tenant rep: same scope as tenant with additional notification rights
> 3. Distinct portal landing pages per role emphasizing what matters to them.
>
> After confirmation:
>
> 1. Role additions (schema nudge — flag).
> 2. Role-specific portal dashboards at `/commercial/project/[id]` that conditionally render based on role.
> 3. Scope enforcement at loaders.

### What to check

- Invite an architect on a commercial project → they see a drawings-and-specs-forward landing
- Invite a tenant → they see schedule-and-impact-forward landing
- Scope enforcement holds at loader level
- `npm run build && npm run lint` clean

### Commit:

```bash
git add .
git commit -m "Step 82 (10.2 #82): Separate architect / owner / tenant views on commercial"
```

---

## Phase 10 Wrap

```bash
npm run build && npm run lint && npm run test
```

Phase 10 done. Residential depth shipped. Clickthrough: submit a warranty request post-handover, view specs, see allowance balance go amber, capture a walkthrough item on mobile, sign a proposal, flip through the photo journal, view the decision log, do a combined sign-and-pay, unlock a milestone card, invite an architect to a commercial project.

Phase 4+ is complete. All 80–82 items shipped.

---

## How to Handle Getting Stuck

Phase 4+ introduces surfaces Phase 3 didn't — schema changes, new integrations, AI tooling, PWA service workers. Stuck points are different in shape. The rules below extend (not replace) Phase 3's stuck-handling.

### The universal first moves

1. **Paste the actual error, not your paraphrase.** Long stack trace, full page. Claude Code can parse a 300-line trace; a three-word summary loses the signal.
2. **Name the step.** "I'm on Step 44 (Drawings). The markup save is failing with a 500." — much easier to contextualize than "drawings broken."
3. **If it's going in circles, stop.** "Stop. Explain what you're trying to do, what's failing, and propose two different approaches."
4. **Commit what works before debugging what doesn't.** Even a half-done step usually has chunks worth preserving. Commit the clean parts, then iterate on the broken parts.

### Phase 4+ specific tips

**Schema changes that went sideways.**
- If a migration failed mid-way and left the DB in an inconsistent state: `npm run db:seed` usually resets (destructive — fine in dev). In production that would be different; in dev reset and re-migrate.
- If Claude Code tried to modify `db/schema/*.ts` without asking, **hard revert**. That's a universal stop-trigger violation. Remind it in the next prompt.

**Integration OAuth failures.**
- Check env vars first. `OPENAI_API_KEY` missing is the most common "AI agent broken" cause.
- Check redirect URIs — the OAuth dance fails silently when the redirect URI registered with the provider doesn't match what your app sends.
- Check token encryption key. If `INTEGRATION_ENCRYPTION_KEY` changed between sessions, old stored tokens can't be decrypted; you'll see mysterious "invalid token" errors.

**PWA service worker caching problems.**
- If you change code but the browser keeps serving the old version, the service worker cache is stale. DevTools → Application → Service Workers → Unregister. Then hard reload.
- Service workers only install on HTTPS (or localhost). If you're testing on a LAN IP, it won't work.

**Autorun items that turned into design-input items.**
- This happens. A "safe-to-autorun" item trips over a missing prototype or an unexpected schema gap. When it does, **stop the autorun and drop into design-input mode.** Don't let Claude Code keep going "best-effort" — the cost of a wrong autoguess is worse than the pause.

**When the item is bigger than the timebox.**
- Drawings (Step 44) is the big one. If you blow the 3-week box: cut version-compare overlay and ship what you have. Document the cut in the step's commit message.
- For any Require-design-input step that runs long: stop, commit partial, ask Claude for a rollback plan or a split plan, and pick up next session.

### When to use plain chat instead of Claude Code

Phase 4+ has more strategic moments than Phase 3 did. Use chat (not Claude Code) for:

- **Deciding scope on a Phase 5 / Phase 10 item.** What should the drawings V1 ladder actually include? Chat that out in plain chat first. Then Claude Code builds from the decided ladder.
- **Debugging webhook signatures or OAuth handshakes.** These are often a single-file / single-request problem. Paste the request, paste the logs, paste the signature computation — ask chat what's wrong. Much cheaper than running Claude Code against it.
- **Compliance readings.** Law 25, Ontario Construction Act, CCQ — read the actual regulation or a lawyer-written summary in plain chat before asking Claude Code to build the UI. Product surfaces built from summarized summaries drift from the real thing.
- **Writing the README sections about production gaps.** README prose reads better when you dictate it in chat rather than auto-generate through Claude Code.

Use Claude Code for the building. Use chat for the thinking.

---

## Session Rhythm for Claude Code

Phase 4+ sessions are longer than Phase 3 sessions because each item is heavier. One rhythm across the entire plan:

1. **Start.** "We're working on Step X. Read `docs/specs/phase_4plus_build_guide.md` and `docs/specs/builtcrm_phase4_portfolio_scope.md`. Confirm: is this Safe-to-autorun or Require-design-input? What's the universal stop-trigger exposure?"

2. **Plan.** For Require-design-input: "Propose the approach. 2–3 options for the hard decisions. No code yet." For Safe-to-autorun: "Plan the work. List the files you'll change."

3. **Confirm.** Explicitly answer design questions before any code is written. Silence at this stage = green light for Claude Code to guess, which is usually the wrong move.

4. **Build.** "Go ahead and implement." Let Claude Code work. Don't interrupt unless a universal stop-trigger fires.

5. **Verify.** `npm run build && npm run lint`. Then click through the feature in the browser. Empty states, wrong-role access, the happy path, one error path.

6. **Commit.** One commit per step. The provided commit messages format as `Step N (phase.sub #item): description` — keeps git log readable.

7. **Wrap or continue.** If context is <50% used and the next step is short, continue. If >50%, wrap.

### Wrap format (when context runs out or you're done for the day)

Ask Claude Code:

> Give me the wrap-up. What do I save to the project folder, what do I archive, what's the kickoff prompt for next session, and what state is the current step in?

The response should cover:
- **State of current step:** Committed clean / Committed dirty / Not committed / Paused mid-implementation
- **What to save:** any files moved from scratchpad to `docs/specs/` or elsewhere in the repo
- **What to delete:** scratchpad files, obsolete notes, or stale drafts from the project folder that are no longer needed
- **Next kickoff prompt:** exact copy-paste for the next chat

If the state is "paused mid-implementation," the kickoff prompt must include the pointer to the last working commit so the next session can restart from a known good state.

### Don't do handoffs unless you ask

This is the one rule Claude Code violates most often. If it writes a `handoff.md` when you didn't ask, delete it. Remind it in the next prompt that handoffs are explicit-request only.

---

## Estimated Session Count

Phase 4+ totals roughly 35–50 focused Claude Code sessions across the full 80–82 items. Not every item is its own session — small items batch, big items span multiple.

| Phase / Steps | Sessions | Notes |
|---|---|---|
| Step 0 (CLAUDE.md update) | 0.25 | Very quick |
| Phase 4A — Steps 1–14 | 4–6 | Wiring work batches well; settings pages (Steps 9–12) each need their own sub-session |
| Phase 4B — Steps 15–24 | 6–8 | Notification center is 1 session; workflow modules are 1 each; Gantt and reports each 1 |
| Phase 4C — Steps 25–36 | 5–6 | OAuth infra 1–2 sessions, Stripe end-to-end 2, accounting stubs 1–2 |
| Phase 4D — Steps 37–43 | 3–4 | Cross-project pages 2, weekly reports 1, small items batch into 1 |
| Phase 5 — Steps 44–49 | 6–8 | Drawings (Step 44) is 3–4 sessions alone; inspections 1–2; meetings/transmittals/closeout/prequal 1 each |
| Phase 6 — Steps 50–55 | 4–5 | PWA scaffolding 1, offline-first infra 1, safety/time/photo-pinning/quick-RFI 1–2 |
| Phase 7.1 — Step 56 | 1–2 | AI agent needs attention but the scope is tight |
| Phase 8-lite — Steps 57–64 | 3–4 | Catalog + rate limiting fast; API keys + API docs + custom fields each 1; gallery 0.5 |
| Phase 9-lite — Steps 65–71 | 3–5 | Law 25 surface 1–2, RBQ 0.5, T5018 0.5, Ontario engine 1–2, CCQ 0.5, i18n plumbing 1, fr-CA translation 1 |
| Phase 10 — Steps 72–82 | 4–6 | Warranty 1, specs 0.5, balance widget 0.25, walkthrough 0.5, proposal 1, journal 0.25, multi-stakeholder 1, decision log 0.5, unified flow 1, celebration 0.25, commercial views 0.5 |
| **Total** | **~35–50** | At observed velocity: 6–10 working weeks spread across calendar |

Some of these sessions will be light (30 minutes), some heavy (3+ hours). Don't treat the count as a commitment; treat it as a pacing sanity check.

---

## After Phase 4+ is Done

When all 82 items are shipped, you have:

- A multi-tenant, multi-portal SaaS with contractor + sub + commercial + residential portals (Phase 1–3) ✅
- Zero known tech debt from the handoff list; polished daily-driver feel (4A) ✅
- Notification center, global search, daily logs, punch list, submittals, Gantt, reports dashboard (4B) ✅
- OAuth + webhook + sync infrastructure with working Stripe test-mode flow and stubbed accounting connectors (4C) ✅
- Cross-project dashboards, weekly reports, lien waiver fan-out, procurement (4D) ✅
- Drawings with markup + versioning, inspections with templates, meetings, transmittals, closeouts, subcontractor prequal (Phase 5) ✅
- PWA with offline daily logs, safety forms, time tracking, spatial photo pinning, field RFI quick-capture (Phase 6) ✅
- Working Meeting Minutes AI agent (Phase 7.1) ✅
- Webhook event catalog, API keys with rate limiting, public API docs, custom fields, CSV import/export, SSO stub, integration gallery (Phase 8-lite) ✅
- Law 25 privacy surface, RBQ license verification, T5018 generator, Ontario Construction Act engine, CCQ attestation, optional fr-CA (Phase 9-lite) ✅
- Warranty portal, specifications, allowance widget, homeowner walkthrough, proposals with e-sign, photo journal, multi-stakeholder access, decision log, unified sign+pay, milestone cards, architect/owner/tenant views (Phase 10) ✅

### What this becomes as a portfolio artifact

A reviewer opening the repo should walk through this sequence:

1. **README** — start here. Pitches the product, names the scope cuts, links to the plan doc.
2. **`docs/specs/builtcrm_phase4_portfolio_scope.md`** — the scope doc. Shows what was built, what wasn't, and why. The cuts are the signal.
3. **`docs/specs/phase_4plus_build_guide.md`** — this guide. Shows the execution discipline.
4. **The running product** — demo URL. Log in as each role. See the portals, the AI agent, the offline PWA, the compliance surfaces.
5. **The code** — schema files, integration architecture, OAuth registry, audit event logs.

Reviewers from engineering leadership will read the plan doc and the scope doc and come away convinced you can ship. Reviewers from product will read the cuts list and come away convinced you have judgment. Reviewers from compliance or security will read the Law 25 and Ontario surfaces and come away convinced you take compliance seriously.

### What V2+ could look like

Phase 4+ ships everything that fits a portfolio scope. Things that landed in the cut list are V2+:

- **Real production integrations** (Procore, Autodesk, Bluebeam, DocuSign, QuickBooks prod, etc.) — require partnership applications and real business relationships. Earliest post-revenue.
- **SOC 2 Type II** — $30–80K and 6–9 months procedural. Earliest post-revenue.
- **Native mobile apps** — PWA covers 95% of field use cases. Native is a V2 investment if a customer demands it.
- **Additional AI agents** — RFI draft agent, daily log summarizer, drawing reconciliation AI, PPE detection, contract compliance AI, takeoff AI. Each is a Phase 7.x if you revisit the AI track.
- **Multi-currency (USD/CAD)** — V2+. Domestic-only for now.
- **Real-time collaboration** — WebSocket presence, typing indicators, Google-Docs-style editing. V2+.
- **Construction loan draw integrations** (Built, Northspyre) and homeowner financing programs — partnership-gated.
- **Predictive dashboards** (delay scoring, cost forecasting) — requires real customer historical data. Post-revenue.
- **Quebec hypothec denunciation, Bill 96 formal fr-CA legal notices, CA-central data residency hosting** — legally-adjacent features that each need either a legal review or paid infra. Post-revenue.

### One-line close

If you got here, you took a portfolio project from "working demo" to "shippable SaaS with integration architecture, field workflows, AI, compliance, and residential depth" across 82 items. That's the artifact. Make the README loud about the cuts list; reviewers who matter will read it as product judgment.

---

## Settings Wiring Backlog

**Added:** 2026-04-17
**Last updated:** 2026-04-17 (commit 5 of the wire-up landed — domain lock, session timeout preference, compliance detail metadata now live).
**Purpose:** Track every settings tab that renders on static sample data, what infra unblocks each one, and which existing build-guide step(s) the wiring work slots into.

### Background

After Session 17 (contractor settings audit, Step 5) and the Apr 17 drop of per-portal settings JSX specs (`docs/specs/builtcrm_{contractor,subcontractor,commercial_client,residential_client}_settings.jsx` + `builtcrm_settings_shared_shell.jsx`), the settings area consolidated into a single shared `SettingsShell` (`src/components/settings/settings-shell.tsx`) that renders:

- **4 shared tabs** for every portal — profile, security, notifications, appearance
- **7 contractor-only tabs** gated on `portalType === "contractor"` — organization, team & roles, plan & billing, data, org security, integrations, payments
- **2 subcontractor-only tabs** gated on `portalType === "subcontractor"` — organization, trade & compliance

Commercial and residential portal-specific tabs haven't been built yet — their JSX specs exist but no tabs have been added to the shell for them.

### Legend

- ✅ **Live** — wired to real loaders + APIs + audit events; persists to the DB
- 🟢 **Wireable now** — data lives in existing schema + loaders; just needs loader call + API route
- 🟡 **Partial** — some fields are in-schema, some need migration (stop-trigger)
- 🔴 **Blocked** — needs significant new infra (schema, service integration, job system)
- ⏳ **Not started** — UI and/or wiring not yet built

### Migrations applied

| # | Date | File | What it added |
|---|---|---|---|
| 1 | 2026-04-17 | `0001_org_settings_fields.sql` | 22 nullable cols on `organizations` (legal_name, tax_id, address, contacts, logo, trade/regions/crew) + `organization_licenses` + `organization_certifications` |
| 2 | 2026-04-17 | `0002_org_security_and_compliance_metadata.sql` | `organizations.allowed_email_domains`, `organizations.session_timeout_minutes`, `compliance_records.metadata_json` |

### Contractor: Organization ✅

**File:** [settings-shell.tsx](../../src/components/settings/settings-shell.tsx) → `ContractorOrganizationTab` (dispatcher) → `ContractorOrganizationLiveTab`
**Loader:** `getOrganizationProfile(orgId)` + `listOrganizationLicenses(orgId)` ([organization-profile.ts](../../src/domain/loaders/organization-profile.ts))
**API routes:** `PATCH /api/org/profile`, `POST/DELETE /api/org/logo/finalize`, `POST /api/org/logo/presign`, `POST/PATCH/DELETE /api/org/licenses[/id]`

What's live: all 14 form fields (display/legal name, tax_id, website, phone, address, contacts, billing) + logo upload to R2 + licenses add/remove. Save bar with discard + error states. Audit event `organization.updated` with `tax_id` redacted in both previousState and nextState JSON. Non-admin users see read-only form + no manage buttons.

**Follow-ups:** license edit (route exists, UI button not wired yet — small add).

### Contractor: Team & roles ✅

**File:** [settings-shell.tsx](../../src/components/settings/settings-shell.tsx) → `ContractorTeamRolesTab` (dispatcher) → `ContractorTeamRolesLiveTab`
**Loader:** `listOrganizationMembers(orgId)` ([organization-members.ts](../../src/domain/loaders/organization-members.ts)) + `listInvitationsForOrganization` (existing)
**API routes:** `PATCH /api/org/members/[userId]/role`, `DELETE /api/org/members/[userId]`, `POST /api/invitations`, `DELETE /api/org/invitations/[id]`, `POST /api/org/invitations/[id]/resend`

What's live: members list (joins `organizationUsers` + `users` + `roleAssignments` with last-active sub-query over `authSession`), inline role change with last-admin guard, soft-remove (flips `membershipStatus` to `removed`), invite send/cancel/resend. Audit events on every mutation. Banner surface for errors + successes.

### Contractor: Plan & billing ✅

**File:** [settings-shell.tsx](../../src/components/settings/settings-shell.tsx) → `ContractorPlanBillingTab` (dispatcher) → `ContractorPlanBillingLiveTab`
**Loader:** `getContractorBillingSummary(orgId)` ([billing.ts](../../src/domain/loaders/billing.ts))
**API routes:** `POST /api/org/subscription/change-plan`, `POST /api/org/subscription/portal`, `POST /api/webhooks/stripe`
**Schema:** `subscription_plans` / `stripe_customers` / `organization_subscriptions` / `subscription_invoices` + `organizations.current_plan_slug` / `usage_project_count` / `usage_team_count` / `usage_storage_bytes` + `organizations.require_2fa_org` (migrations `0004`, `0005`).
**Policy:** `src/domain/policies/plan.ts` — `PLAN_FEATURES` registry, `PlanContext`, `requireTier` / `requireFeature` / `hasFeature`, `PlanGateError` → 402.

Live across all three tiers (Starter / Professional / Enterprise). Path A for plans without an existing Stripe subscription (creates Checkout session); path B for existing subscriptions (direct Stripe API swap). Stripe Customer Portal linked for card updates + invoice PDFs + cancellation. Self-serve signup routes through the plan picker at `/signup/contractor` (14-day trial, card required). Billing tab auto-refreshes every 30s via polling hook so webhook-delivered invoice rows appear without reload. Plan-gated features enforced server-side via `requireFeature`; UI affordances derived from `contractor.planContext`.

### Contractor: Data ✅

**File:** [settings-shell.tsx](../../src/components/settings/settings-shell.tsx) → `ContractorDataTab`
**Loader:** `listRecentDataExports(orgId)` ([data-exports.ts](../../src/domain/loaders/data-exports.ts))
**API routes:** `POST /api/org/exports/{projects-csv, documents-zip, audit-log-csv, full-archive}`, `POST /api/org/imports/projects/{preview, commit}`
**Schema:** `data_exports` (migration `0006`).
**Builders / parser:** [src/lib/exports/builders.ts](../../src/lib/exports/builders.ts), [src/lib/exports/csv.ts](../../src/lib/exports/csv.ts), [src/lib/imports/csv-parser.ts](../../src/lib/imports/csv-parser.ts), [src/lib/imports/projects-import.ts](../../src/lib/imports/projects-import.ts)

Status per card:

| Card | Status | Notes |
|---|---|---|
| Complete archive | ✅ Live | Pro+ gate. ZIP with `_manifest.json`, `projects.csv`, `financial/{draws,sov,lien_waivers}.csv`, `documents/<project>/<type>/<file>…`, and `audit-log.csv` when Enterprise. Synchronous via `archiver`; buffers to memory. |
| Projects (CSV) | ✅ Live | Pro+ gate. Synchronous, streams CSV direct in response. |
| Financial records (CSV) | 🟡 Honest minimum | Card disabled with footer pointing at Complete archive (which contains draws/SOV/lien_waivers CSVs). Standalone card deferred. |
| Documents (ZIP) | ✅ Live | Pro+ gate. Uses shared `appendOrgDocumentsToArchive` helper — fetches each R2 object, emits `<project>/<type>/<file>` + manifest. Skips missing objects rather than failing. |
| Audit log (CSV) | ✅ Live | Enterprise gate (`audit.csv_export`). Reuses `listOrganizationAuditEvents` with `unbounded:true`. |
| CSV / spreadsheet import | ✅ Live | Pro+ gate. Inline wizard: upload or paste, auto-mapping with per-field dropdowns, preview + invalid-row report, transactional batched insert (all-or-nothing). Projects only — clients/subs/docs import deferred. |
| Procore / Buildertrend | ⏳ Not started | V2+ per portfolio scope (requires OAuth partnerships). |
| Assisted migration | ✅ Live | `Schedule a call` button wired to `mailto:sales@builtcrm.dev?subject=Assisted%20migration%20inquiry`. |
| Recent exports list | ✅ Live | Panel between Export and Import showing date / kind / actor / status for the last 20 exports. |

**Known scaling note:** synchronous ZIP generation is correct for portfolio scope (<100 docs). Real-world orgs with thousands of documents would need the Trigger.dev-v3 async pattern — deferred.

### Contractor: Org security ✅

**File:** [settings-shell.tsx](../../src/components/settings/settings-shell.tsx) → `ContractorOrgSecurityTab`
**Loaders:** `listOrganizationAuditEvents` ([audit-log.ts](../../src/domain/loaders/audit-log.ts)) + `getSsoProviderByOrg` ([sso.ts](../../src/domain/loaders/sso.ts)) + org cols via `getOrganizationProfile`
**API routes:** `PATCH /api/org/security` (domain lock + session timeout + require-2FA), `POST/DELETE /api/org/sso/providers`, `/api/auth/sso/initiate` + `/api/auth/sso/acs` (Better Auth plugin endpoints).

Status per row:

| Item | Status | Notes |
|---|---|---|
| Audit log (filtered table) | ✅ Live | Reads `auditEvents` joined with actor name; category derived via regex on `objectType` + `actionName`; 200-row limit (UI) / unbounded (export), client-side filters. Webhook-originated events now audited too via the `system` user (`SYSTEM_USER_ID`). |
| Domain lock toggle | ✅ Live | Saves to `organizations.allowed_email_domains`. Enforcement lives in the invitation-create route; existing members with other domains are unaffected. |
| Session timeout select | ✅ Live | Saves to `organizations.session_timeout_minutes`. **Enforced:** `session.create.before` hook in `src/auth/config.ts` shortens `session.expiresAt` to `min(Better Auth default, now + orgMinutes)`. Better Auth's native expiry check kicks the user out when the session ages past the cap. |
| Require 2FA (org-wide) | ✅ Live | Professional+ gate (`require_2fa_org` feature key). Saves to `organizations.require_2fa_org`. **Enforced:** `session.create.before` throws `TWO_FACTOR_REQUIRED` if the user hasn't enrolled. Schema: migration `0005`. |
| SSO / SAML | ✅ Live | Enterprise-only. Full SAML 2.0 via `samlify` + `@authenio/samlify-node-xmllint`. Schema: migration `0007_sso_providers`. Configure drawer collects IdP entity ID / SSO URL / PEM cert / allowed domain; **Test sign-in** link initiates the handshake. SSO only logs in users who already have a contractor role in the provider's org (auto-provisioning deferred). |
| Audit log CSV export | ✅ Live | Enterprise-only gate. Shipped as a card in Settings → Data, not Org security (cleaner taxonomy). `POST /api/org/exports/audit-log-csv`. |

### Contractor: Integrations ✅

**File:** [settings-shell.tsx](../../src/components/settings/settings-shell.tsx) → `ContractorIntegrationsTab` (embeds the orphan `IntegrationsView` when the bundle is present)
**Loader:** `getContractorIntegrationsView` ([integrations.ts](../../src/domain/loaders/integrations.ts))

What's live: the salvage pass embeds the existing `IntegrationsView` from `src/app/(portal)/contractor/(global)/settings/integrations/integrations-ui.tsx` when `contractor.integrations` is populated. Connections, sync event history, per-project mappings, and QB detail panel all run on real data.

### Contractor: Payments ✅

**File:** [settings-shell.tsx](../../src/components/settings/settings-shell.tsx) → `ContractorPaymentsTab` (embeds the orphan `PaymentsView` when the bundle is present)
**Loader:** `getContractorPaymentsView` ([payments.ts](../../src/domain/loaders/payments.ts))
**API route:** `POST /api/contractor/stripe/connect/onboard` (creates Stripe Standard account if needed + returns fresh hosted onboarding link)
**Webhook:** `account.updated` handler in `/api/webhooks/stripe` mirrors `details_submitted` / `charges_enabled` / `payouts_enabled` into `integration_connections.syncPreferences` + flips status.

What's live: `PaymentsView` now wires real Stripe Connect onboarding. "Set up payments" button creates a Standard account + redirects to Stripe-hosted onboarding; "Resume onboarding" / "Resolve requirements" re-issue the link while account is `connecting` / `needs_reauth`. Audit events on status transitions via the system user.

### Subcontractor: Organization ✅

**File:** [settings-shell.tsx](../../src/components/settings/settings-shell.tsx) → `SubcontractorOrganizationTab` (dispatcher) → `SubcontractorOrganizationLiveTab`
**Shares:** `getOrganizationProfile` + `listOrganizationLicenses` with contractor
**API routes:** same portal-agnostic routes as contractor (`/api/org/profile`, `/api/org/logo/*`, `/api/org/licenses*`). Sub-owner auth resolved via `getSubcontractorOrgContext`.

What's live: all company-info fields + sub-specific additions (primary trade select, secondary-trades chip list from `TRADE_OPTIONS`, years-in-business, crew-size select, service-regions chip list from `REGION_OPTIONS`) + 4-field primary contact + licenses + logo upload (blue-steel gradient per portal accent).

### Subcontractor: Trade & compliance ✅

**File:** [settings-shell.tsx](../../src/components/settings/settings-shell.tsx) → `SubcontractorComplianceTab`
**Loader:** `listSubOrgComplianceRecords` + `listOrganizationCertifications`
**API routes:** `POST /api/org/certifications`, `DELETE /api/org/certifications/[id]`

Status per panel:

| Panel | Status | Notes |
|---|---|---|
| Trade summary cards | ✅ Live | Reads `primaryTrade`, `secondaryTrades`, `crewSize`, `regions` from `orgProfile` with "Not set"/"None" fallbacks |
| Compliance snapshot | ✅ Live | Reads `complianceRecords` grouped by type; `metadata_json.carrier` / `.coverage` / `.detail` render when populated; falls back to `documents.title` |
| Certifications add/remove | ✅ Live | Add form → POST; per-row remove → DELETE; both with audit events |
| Compliance workspace deep-link | ⏳ Not started | "Open Compliance" button doesn't route anywhere yet — wire when the sub compliance workspace is built |

### Commercial / Residential portals 🟡

**Files:** [commercial/(global)/settings/page.tsx](../../src/app/(portal)/commercial/(global)/settings/page.tsx) + [residential/(global)/settings/page.tsx](../../src/app/(portal)/residential/(global)/settings/page.tsx)

Status per client-portal tab:

| Tab | Status | Notes |
|---|---|---|
| Profile / Security / Notifications / Appearance (shared) | ✅ Live | Same as contractor. |
| Company profile (commercial) / Household profile (residential) | ✅ Live | `CommercialCompanyLiveTab` + `ResidentialHouseholdLiveTab`. Share `/api/org/profile` + logo routes. Schema: migration `0003`. |
| Team members (commercial) / Co-owner access (residential) | ✅ Live | Shared `ClientTeamLiveTab`. Same `/api/org/members/*` + `/api/invitations` routes as contractor. |
| Payment methods | 🟡 Honest minimum | Static mock replaced with "Secured by Stripe" + 5-step "how payments work" explainer + "Coming soon: saved methods" note. Payment method entry happens at Stripe Checkout time per draw. **Saved methods** (SetupIntent flow, per-client Stripe customer, schema table) are deferred to a future phase. |

**Pay-draw wiring live in both client portals:** [residential/billing-review.tsx](../../src/app/(portal)/residential/project/[projectId]/billing/billing-review.tsx) and [commercial/billing-review.tsx](../../src/app/(portal)/commercial/project/[projectId]/billing/billing-review.tsx) render a Pay button once the draw is approved + has a balance due. Residential selections page also has a Pay-upgrade button (Pro+ gated).

### Remaining architectural blockers — RESOLVED (2026-04-17)

All four previously-blocked surfaces shipped across four dedicated multi-session phases. See the **Completed Phases — Settings Wiring Follow-Up** section below for the full ledger with migration numbers, endpoints, and per-session deliverables.

| Surface | Status | Phase |
|---|---|---|
| Plan & billing | ✅ | Billing phase (5 sessions) |
| Data exports / imports | ✅ | Data Exports phase (5 sessions) |
| SSO / SAML | ✅ | SSO/SAML phase (3 sessions) |
| Require-2FA org-wide | ✅ | Billing phase Session 4 (plan-gate) + Cleanup session (login enforcement) |
| Client Stripe Checkout (Pay draws + selection upgrades) | ✅ | Client Stripe Checkout phase (3 sessions) |

---

## Completed Phases — Settings Wiring Follow-Up (2026-04-17)

Between the settings wire-up (Steps 9–12) and this update, **~18 sessions across 5 phases** shipped. All of it lands on top of the shared `SettingsShell` and reuses the policy/schema patterns established in Phase 4A–4C.

### Billing phase (5 sessions)

Platform subscription billing for contractors (contractors pay us). Distinct from Stripe Connect (contractors receive money from clients — that's the Client Stripe Checkout phase).

- **S1 — Schema + Stripe SDK + policy scaffold.** Migration `0004_stripe_billing`: 4 tables (`subscription_plans` seeded with Starter / Professional / Enterprise at final prices, `stripe_customers`, `organization_subscriptions`, `subscription_invoices`) + 4 org cols (`current_plan_slug`, `usage_project_count`, `usage_team_count`, `usage_storage_bytes`). Backfilled every existing contractor org to Professional/active. New dep: `stripe`. New policy file: [src/domain/policies/plan.ts](../../src/domain/policies/plan.ts) — `PLAN_FEATURES` registry, `PlanContext`, `requireTier` / `requireFeature` / `hasFeature`, `PlanGateError`.
- **S2 — Stripe Checkout + portal + webhooks + Plan & billing live data.** Endpoints: `POST /api/org/subscription/change-plan` (Path A: Checkout for new subs; Path B: direct Stripe update for existing), `POST /api/org/subscription/portal`, `POST /api/webhooks/stripe` (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.paid/payment_failed`). Loader: [billing.ts](../../src/domain/loaders/billing.ts). Plan & billing tab refactored to dispatcher + `ContractorPlanBillingLiveTab`.
- **S3 — Self-serve contractor signup.** New routes `/signup/contractor` (2-step form: account → plan picker) + `POST /api/signup/contractor-bootstrap` (creates org + role + membership, promotes session row so portal routing works immediately). Login page footer adds "Create a contractor account" link.
- **S4 — Plan-gate wiring + Require-2FA toggle.** Migration `0005_require_2fa_org` (one column). Loader: `getOrgPlanContext(orgId)`. `PATCH /api/org/security` gains `requireTwoFactorOrg` field with `requireFeature(ctx, "require_2fa_org")`. Org security tab's Require-2FA row goes from 🔴 to ✅ live toggle.
- **Setup required for testing:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` in `.env.local`; 4 Stripe prices in dashboard (Starter/Professional × monthly/annual); populate `stripe_price_id_*` in `subscription_plans` via SQL; `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### Data Exports phase (5 sessions)

See Step 62 (Bulk CSV Import/Export) + Settings Wiring Backlog's Data card table.

- **S1 — Schema + first export.** Migration `0006_data_exports` (1 table). `POST /api/org/exports/projects-csv` (Pro+ gated, synchronous).
- **S2 — Documents ZIP + Audit log CSV.** `POST /api/org/exports/documents-zip` (Pro+ via `archiver`), `POST /api/org/exports/audit-log-csv` (Enterprise). Loader unbounded option.
- **S3 — Full archive + financial CSVs.** `POST /api/org/exports/full-archive` (Pro+; orchestrator ZIP with `projects.csv`, `financial/{draws,sov,lien_waivers}.csv`, `documents/…`, optional `audit-log.csv` for Enterprise). Helpers: [builders.ts](../../src/lib/exports/builders.ts) (`buildProjectsCsv`, `buildAuditLogCsv`, `buildFinancialCsvs`, `appendOrgDocumentsToArchive`).
- **S4 — CSV import.** Inline wizard in Data tab. `POST /api/org/imports/projects/{preview, commit}`. Transactional all-or-nothing insert. Minimal RFC 4180 parser ([csv-parser.ts](../../src/lib/imports/csv-parser.ts)) + field catalog/validator ([projects-import.ts](../../src/lib/imports/projects-import.ts)).
- **S5 — Polish.** `listRecentDataExports` loader + Recent exports panel in Data tab. Migration CTA wired to `mailto:sales@builtcrm.dev`. `documents-zip` route refactored to use `appendOrgDocumentsToArchive`.

### SSO/SAML phase (3 sessions)

- **S1 — Schema.** Migration `0007_sso_providers` (one provider per org). Columns: entity_id, sso_url, certificate_pem, allowed_email_domain, status, last_login_at.
- **S2 — Better Auth plugin + CRUD.** New deps: `samlify`, `@authenio/samlify-node-xmllint`. New plugin: [src/auth/sso-plugin.ts](../../src/auth/sso-plugin.ts) registers `/sso/initiate` + `/sso/acs` endpoints. One-line change to [src/auth/config.ts](../../src/auth/config.ts) adds `ssoPlugin()` to plugins array. Session minted via `internalAdapter.createSession` + `setSessionCookie` (proper signed cookies, not direct row writes). Provider CRUD at `POST/DELETE /api/org/sso/providers` (Enterprise-gated).
- **S3 — UI wire-up.** Org security drawer now live with SP Entity ID + ACS URL (read-only, paste into IdP) + IdP details form (entity ID, SSO URL, PEM cert, allowed domain). Save / Remove / Test sign-in buttons.
- **Design call made:** no auto-provisioning. SSO only logs in users who already have a contractor role in the provider's org (invite first, then SSO). Auto-provisioning deferred pending UX decision.
- **Testing:** point samltest.id at the SP metadata; use the Test sign-in button.

### Client Stripe Checkout phase (3 sessions)

Parallel to Billing — contractor receives money from clients.

- **S1 — Contractor Stripe Connect onboarding.** Standard accounts via hosted onboarding. `POST /api/contractor/stripe/connect/onboard` creates account + returns fresh link. `account.updated` webhook flips `connectionStatus` based on `details_submitted` / `charges_enabled` / `payouts_enabled`. Payments tab "Set up payments" button wired.
- **S2 — Client "Pay this draw" flow.** `POST /api/draw-requests/[id]/pay` creates Checkout session in payment mode, routed via Connect (`destination=acct_...`). Plan-gated payment methods on contractor's plan (Starter=ACH, Pro+=ACH+card). Webhook handlers: `checkout.session.completed` (payment-mode branch), `charge.succeeded` (updates `payment_transactions` + flips draw to paid), `charge.failed`. Pay button on residential + commercial draw review pages.
- **S3 — Selection upgrades + honest Payment methods tab.** `POST /api/selections/decisions/[id]/pay` (Pro+ gate `stripe.client_pays_selections`, card only). Pay-upgrade block in residential `ConfirmedView`. Client Payment methods tab replaced with honest "entered at checkout time" messaging + 5-step explainer. Static mock kept as `ClientPaymentMethodsStaticMock` for removal when saved-methods phase ships.

### Cleanup session — small follow-ups (1 session, 5 items)

- **Session-timeout enforcement** — `session.create.before` in auth config shortens `expiresAt` to `min(default, now + orgMinutes)`; Better Auth's native expiry check does the rest.
- **Require-2FA login enforcement** — same hook throws `TWO_FACTOR_REQUIRED` if org requires 2FA and user hasn't enrolled.
- **Webhook audit events via system-user** — new [src/domain/system-user.ts](../../src/domain/system-user.ts) module with `SYSTEM_USER_ID = 00000000-0000-0000-0000-000000000001`, idempotent `ensureSystemUser()` seed. All 5 Stripe webhook paths now write audit events (no schema change needed — the FK just points at the system row).
- **License edit UI** — inline edit mode on license rows (contractor + subcontractor). `PATCH /api/org/licenses/[id]` route was already there; UI wired now.
- **Real-time billing refresh** — 30-second `useEffect` polling hook on Plan & billing tab; paused when tab is backgrounded.

### Migrations landed (0004 → 0007)

| # | Date | File | What it added |
|---|---|---|---|
| 4 | 2026-04-17 | `0004_stripe_billing.sql` | 4 subscription tables + 4 org cols + seeded plan rows + backfilled existing contractors to Professional/active |
| 5 | 2026-04-17 | `0005_require_2fa_org.sql` | `organizations.require_2fa_org` boolean |
| 6 | 2026-04-17 | `0006_data_exports.sql` | `data_exports` tracking table |
| 7 | 2026-04-17 | `0007_sso_providers.sql` | `sso_providers` (one per contractor org) |

### Open follow-ups carried forward

These are deliberately deferred — each needs its own scope decision.

- **Saved client payment methods** (SetupIntent + per-client Stripe customer). Needs schema (`client_stripe_customers` table) since the existing `stripe_customers` is semantically for contractor subscription customers.
- **SSO auto-provisioning** on first login. Needs UX decision: default role? `contractor_pm`? Prompt the admin?
- **IdP metadata XML upload parser** (samlify has the parser; UI only). Nice-to-have polish.
- **Signed AuthnRequest** in SSO (currently unsigned; some IdPs require signing).
- **Trigger.dev v3 async pattern** for 10k+ document exports.
- **Abandoned-org cleanup cron** for users who bail on signup Checkout.
- **SSO-enforced login** — if an org has both SSO and a password-enabled user, disable password login for SSO-domain users.
- **Payment reconciliation cron** — Step 33's second half.
- **"Open Compliance" deep-link** from sub Trade & compliance tab.
- **Orphan route cleanup** — `src/app/(portal)/contractor/(global)/settings/{integrations,payments,organization,team,invitations}/` are reachable by direct URL but not linked.
- **Trigger.dev email job for invitations** — currently logs invite URL.
- **Drizzle migration journal rebuild** — migrations today are applied via throwaway tsx runners (see `src/db/_migrate-000X.ts` pattern used + deleted per migration). Not blocking but worth tidying if we pick up more schema work.

### Next-session kickoff

When picking up fresh:

1. Re-read [`builtcrm_phase4_portfolio_scope.md`](builtcrm_phase4_portfolio_scope.md) and this build guide per the Phase 4+ execution rules.
2. Scan the **Completed Phases** section above to orient.
3. Pick the next target. Likely candidates, in rough priority:
   - **Notification Center** (Step 15) — highest leverage per hour per the scope doc; data already writes to DB.
   - **Global command palette** (Step 17).
   - **Drawings module** (Step 44) — biggest single commercial-GC feature, timebox carefully.
   - One of the open follow-ups above (saved methods, auto-provisioning, etc.) if you want to close out loose ends from the settings work.
4. Universal stop-triggers still apply (schema, auth, new deps, file deletions, CLAUDE.md / scope doc edits).
5. Build verifies clean as of 2026-04-17 at 93/93 routes with no lint/type errors.

*End of guide.*
