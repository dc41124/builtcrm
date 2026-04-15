# BuiltCRM — Phase 3 Build Guide
## A Step-by-Step Walkthrough for Building the Production Frontend

**Who this is for:** You. Same setup as Phase 1 — Claude Code in VS Code, following step-by-step prompts. You've already built the entire backend. Now you're replacing the minimal test UI with the real thing.

**What Phase 3 produces:** A fully polished, production-quality frontend for all 24 screens. Every page matches the JSX prototypes from Phase 2, wired to the real backend API from Phase 1. Real data, real auth, real file uploads — not mockups anymore.

**How to use this guide:** Same as Phase 1. Keep this file in your repo at `docs/specs/phase_3_build_guide.md`. Tell Claude Code "read docs/specs/phase_3_build_guide.md, we're on Step X" and it'll know exactly what to do.

**Important difference from Phase 1:** Phase 1 built things from scratch. Phase 3 has two reference sources for every page: (1) the JSX prototype that shows exactly what it should look like, and (2) the backend API that already serves the data. Your job is to connect them.

---

## Before You Start — Setup Checklist

### Things you should already have from Phase 1
- The `builtcrm` repo with all backend code working
- `npm run dev` starts successfully
- All seed data loaded (`npm run db:seed`)
- You can log in as any seed user and see the minimal test UI
- All 24 HTML mockups in `docs/design/`
- All spec docs in `docs/specs/`

### New files to add before starting Phase 3

**Add the JSX prototypes to your repo:**
1. Download all 24 JSX prototype files from the project folder
2. Create a new folder: `docs/prototypes/`
3. Put all 24 `.jsx` files in there

These are your pixel-level design reference. Claude Code will read them to know exactly what each page should look like.

```
docs/
├── design/          ← HTML mockups (feature spec — already there)
├── prototypes/      ← JSX prototypes (visual spec — add these now)
│   ├── builtcrm_design_system_shell.jsx
│   ├── builtcrm_contractor_dashboard.jsx
│   ├── builtcrm_login_auth_flow.jsx
│   ├── ... (all 24 files)
├── schema/          ← Drizzle schema files (already there)
└── specs/           ← Architecture specs (already there)
```

### Commit the prototypes:
```bash
git add .
git commit -m "Add Phase 2 JSX prototypes as visual reference for Phase 3 frontend build"
```

---

## Step 0 — Update CLAUDE.md for Phase 3

### What this does
Updates the project instructions so Claude Code knows we're in the frontend build phase and where to find the design references.

### Tell Claude Code:

> Read the current CLAUDE.md. We're starting Phase 3 — the frontend build. The backend is complete (Phase 1). We now have 24 JSX prototypes in docs/prototypes/ that show exactly what every screen should look like. Update CLAUDE.md to add:
>
> 1. Under "Reference Documents", add: `docs/prototypes/*.jsx` — 24 JSX prototypes showing exact visual design for every screen. These are the pixel-level reference. Match them exactly for layout, typography, spacing, and colors.
>
> 2. Add a new section "Phase 3 Frontend Rules" with these rules:
>    - Every page component must read its corresponding JSX prototype for visual reference
>    - Typography: DM Sans for display/headings/values/buttons/pills, Instrument Sans for body/descriptions/meta, JetBrains Mono ONLY for IDs, org names, file names, SKU codes, data table cells (NEVER currency values or KPI numbers)
>    - Weight floor: 520 minimum everywhere. KPI values: 820. Page titles: 820 at 26px (24px for client portals). Buttons: 620-650. Pills: 700. Card titles: 680-740.
>    - Portal accent colors: contractor `#5b4fc7`, subcontractor `#3d6b8e`, commercial `#3178b9`, residential `#2a7f6f`
>    - Logo: cascading rectangle SVG (three outlined/filled rectangles), never a "B" lettermark
>    - No emojis — all icons are inline SVGs
>    - Residential language: "Scope Changes" not "Change Orders", "Decisions" not "Approvals"
>    - All data fetching happens server-side in loaders. Client components are for interactivity only.
>    - The existing backend API routes and loaders from Phase 1 are the data source. Do not recreate them — connect to them.
>
> Don't change anything else in CLAUDE.md. Just add the new sections.

### Commit:
```bash
git add .
git commit -m "Step 0: Update CLAUDE.md for Phase 3 frontend build"
```

---

## Step 1 — Styling Infrastructure

### What this does
Sets up the CSS foundation that every component will use. The JSX prototypes use inline styles with CSS variables — we're turning those into a proper styling system.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_design_system_shell.jsx. This file defines the complete design system — all CSS variables, font stacks, colors, spacing, and component patterns.
>
> Set up the styling infrastructure:
>
> 1. Install Tailwind CSS v4 with the Next.js plugin. Configure it for our project.
>
> 2. Create `src/styles/tokens.css` — extract ALL CSS custom properties from the shell prototype's `:root` block. This includes:
>    - Color tokens: --bg, --s1, --s2, --s3, --b1, --b2, --b3, --t1, --t2, --t3, --accent, --accent-l, all the semantic colors (--green, --red, --amber, --blue, etc.)
>    - Font stacks: --font-display (DM Sans), --font-body (Instrument Sans), --font-mono (JetBrains Mono)
>    - Spacing, border-radius, shadow tokens
>    - Dark mode overrides (the shell has both light and dark CSS vars)
>
> 3. Create `src/styles/globals.css` that imports tokens.css and sets base styles:
>    - Import Google Fonts: DM Sans (weights 500-900), Instrument Sans (weights 500-700), JetBrains Mono (weights 500-700)
>    - Base font: Instrument Sans, weight 520, color var(--t1), background var(--bg)
>    - Reset styles
>
> 4. Extend `tailwind.config.ts` to reference our CSS tokens so we can use them in Tailwind classes (e.g., `text-[var(--t1)]`, `bg-[var(--s1)]`, `font-display`).
>
> 5. Make sure the app's root layout imports globals.css.
>
> Don't build any components yet. Just the token system and Tailwind config.

### What to check
- `npm run dev` still works
- Visiting any page shows the correct fonts loading (DM Sans, Instrument Sans)
- Background color and text color match the shell prototype

### Commit:
```bash
git add .
git commit -m "Step 1: Design system tokens + Tailwind CSS setup"
```

---

## Step 2 — Shared Shell Component

### What this does
Builds the app shell — sidebar, topbar, breadcrumbs — that wraps every portal page. This is the most reused component in the entire app.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_design_system_shell.jsx thoroughly. This is the shared shell that wraps every page in the app.
>
> Build the shared shell as a layout component at `src/components/shell/AppShell.tsx`. It needs:
>
> **Sidebar (260px, collapsible):**
> - Logo mark at top: the cascading rectangle SVG (three stacked outlined/filled rectangles in a gradient rounded square). Copy the exact SVG from the prototype. Next to it, "BuiltCRM" in DM Sans 16px/780.
> - Organization context: current org name in DM Sans 13px/700, member count below in Instrument Sans 12px/520 var(--t3)
> - Navigation sections with collapsible groups. Each nav item: icon (inline SVG) + label + optional badge count. Active state uses the portal accent color as background tint.
> - Project list at bottom: project names with colored status dots
> - User footer: avatar circle + name + role label
> - Collapse button that shrinks sidebar to icon-only mode (~68px)
>
> **Topbar (56px):**
> - Breadcrumbs on left: DM Sans 13px, segments linked, current segment 720 weight
> - Right side: bell icon (with notification dot), dark mode toggle (sun/moon), user avatar
>
> **Content area:**
> - Fills remaining space, scrollable, padding from shell prototype
>
> **Portal theming:**
> - Accept an `accentColor` prop that sets `--accent` and `--accent-l` CSS variables
> - Contractor: `#5b4fc7`, Sub: `#3d6b8e`, Commercial: `#3178b9`, Residential: `#2a7f6f`
>
> **Props the shell accepts:**
> - `portalType`: 'contractor' | 'subcontractor' | 'commercial' | 'residential'
> - `orgName`: string
> - `userName`: string
> - `userRole`: string
> - `navItems`: array of navigation items with icons, labels, badge counts, href
> - `projects`: array of projects with name, status color
> - `breadcrumbs`: array of breadcrumb segments
> - `children`: the page content
>
> Make the sidebar a client component (for collapse toggle state) and the content area a server component slot. Follow the Next.js App Router pattern for nested layouts.
>
> Match the prototype exactly for spacing, typography, colors, and hover states.

### What to check
- Create a test page that renders the shell with sample props
- Sidebar shows with all sections, collapse works
- Topbar renders breadcrumbs and icons
- Accent color changes when you swap portalType
- Typography matches the prototype exactly (fonts, weights, sizes)

### Commit:
```bash
git add .
git commit -m "Step 2: Shared app shell — sidebar, topbar, breadcrumbs"
```

---

## Step 3 — Component Library (Core Building Blocks)

### What this does
Extracts the reusable UI components that appear across multiple pages. Build them once, use them everywhere.

### Tell Claude Code:

> Read these prototypes to identify the shared patterns: builtcrm_contractor_dashboard.jsx, builtcrm_contractor_project_home.jsx, builtcrm_approvals_workflow.jsx, builtcrm_billing_draw_workspace.jsx.
>
> Build these shared components in `src/components/`:
>
> **KPI Card** (`src/components/kpi-card.tsx`):
> - Value: DM Sans 22px/820 var(--t1)
> - Label: Instrument Sans 12px/560 var(--t3)
> - Trend indicator: up/down arrow with green/red/amber color
> - Optional border accent (colored left border or top border for alerts)
> - Matches the KPI cards in contractor dashboard and project home prototypes
>
> **Data Table** (`src/components/data-table.tsx`):
> - Header row: DM Sans 11px/700 uppercase tracking .05em var(--t3)
> - Data cells: Instrument Sans 13px/520
> - ID columns: JetBrains Mono 12.5px/580 (for thread IDs, CO numbers, file names)
> - Currency columns: DM Sans 13px/680 (NEVER JetBrains Mono for money)
> - Sortable columns, row hover states, row click handler
> - Status pill in cells where needed
> - Matches the tables in RFI, change order, billing prototypes
>
> **Status Pill / Badge** (`src/components/pill.tsx`):
> - DM Sans 10-11px/700
> - Color variants: green, red, amber, blue, gray, purple (from CSS tokens)
> - Rounded-full with appropriate padding
>
> **Card** (`src/components/card.tsx`):
> - White background (var(--s1)), border var(--b1), rounded-lg, shadow-sm
> - Card header with title (DM Sans 15px/740) and optional subtitle (Instrument Sans 12.5px/540 var(--t2))
> - Card body slot
> - Optional tabs in header (Instrument Sans 13px/600, active: 720)
>
> **Button** (`src/components/button.tsx`):
> - Primary: accent color background, white text
> - Secondary: var(--s2) background, var(--t1) text
> - Ghost: transparent, var(--t2) text
> - All: DM Sans 13px/620-650, height 34px, rounded-md
> - Loading state with spinner
>
> **Modal / Slide Panel** (`src/components/modal.tsx`):
> - Full-screen overlay or right-side panel
> - Header with title + close X
> - Body slot, scrollable
> - Footer with action buttons
>
> **Empty State** (`src/components/empty-state.tsx`):
> - Centered icon + message + optional CTA button
> - Used when tables/lists have no data
>
> For each component, match the typography, spacing, and colors from the prototypes exactly. Use our CSS tokens (var(--t1), var(--s1), etc.) not hardcoded colors.

### What to check
- Create a test page `/test/components` that renders every component with sample data
- Typography matches prototypes (check font family, size, weight with dev tools)
- Colors use CSS tokens and respond to dark mode toggle
- Buttons have hover/active states
- Table sorts work, pills render all color variants

### Commit:
```bash
git add .
git commit -m "Step 3: Core component library — KPI cards, tables, pills, cards, buttons, modals"
```

---

## Step 4 — Portal Layout Groups + Routing

### What this does
Sets up the Next.js route structure so each portal has its own layout that wraps pages in the correct shell configuration.

### Tell Claude Code:

> Set up the route structure for all four portals using Next.js App Router layout groups. The existing Phase 1 routes had minimal UI — we're replacing them with proper portal layouts.
>
> Create this route structure:
> ```
> src/app/
> ├── (auth)/
> │   ├── login/page.tsx
> │   ├── signup/page.tsx
> │   ├── forgot-password/page.tsx
> │   └── layout.tsx              ← no shell, centered card layout
> ├── (portal)/
> │   ├── contractor/
> │   │   ├── layout.tsx          ← AppShell with contractor accent, contractor nav items
> │   │   ├── dashboard/page.tsx
> │   │   ├── project/[projectId]/
> │   │   │   ├── page.tsx        ← project home
> │   │   │   ├── rfis/page.tsx
> │   │   │   ├── change-orders/page.tsx
> │   │   │   ├── approvals/page.tsx
> │   │   │   ├── compliance/page.tsx
> │   │   │   ├── billing/page.tsx
> │   │   │   ├── selections/page.tsx
> │   │   │   ├── upload-requests/page.tsx
> │   │   │   ├── messages/page.tsx
> │   │   │   ├── documents/page.tsx
> │   │   │   ├── schedule/page.tsx
> │   │   │   └── payments/page.tsx
> │   │   └── settings/page.tsx
> │   ├── subcontractor/
> │   │   ├── layout.tsx          ← AppShell with sub accent, sub nav items
> │   │   ├── today/page.tsx      ← today board (standalone)
> │   │   └── project/[projectId]/
> │   │       ├── page.tsx        ← project home + today board combined
> │   │       ├── rfis/page.tsx
> │   │       ├── upload-requests/page.tsx
> │   │       ├── compliance/page.tsx
> │   │       ├── messages/page.tsx
> │   │       ├── documents/page.tsx
> │   │       └── schedule/page.tsx
> │   ├── commercial/
> │   │   ├── layout.tsx          ← AppShell with commercial accent
> │   │   └── project/[projectId]/
> │   │       ├── page.tsx
> │   │       ├── change-orders/page.tsx
> │   │       ├── approvals/page.tsx
> │   │       ├── billing/page.tsx
> │   │       ├── messages/page.tsx
> │   │       ├── documents/page.tsx
> │   │       ├── schedule/page.tsx
> │   │       └── payments/page.tsx
> │   └── residential/
> │       ├── layout.tsx          ← AppShell with residential accent
> │       └── project/[projectId]/
> │           ├── page.tsx
> │           ├── scope-changes/page.tsx   ← "Scope Changes" not "Change Orders"
> │           ├── decisions/page.tsx       ← "Decisions" not "Approvals"
> │           ├── selections/page.tsx
> │           ├── billing/page.tsx
> │           ├── messages/page.tsx
> │           ├── documents/page.tsx
> │           └── schedule/page.tsx
> ├── marketing/
> │   └── page.tsx                ← public marketing site, no shell
> └── layout.tsx                  ← root layout with fonts + globals.css
> ```
>
> Each portal layout.tsx should:
> 1. Call getEffectiveContext() to verify the user belongs to this portal
> 2. Fetch the user's org name, nav items, project list from the existing loaders
> 3. Render AppShell with the correct portalType and data
> 4. Redirect to login if not authenticated, redirect to correct portal if wrong portal
>
> The existing Phase 1 loaders (getContractorProjectView, getSubcontractorProjectView, getClientProjectView) already fetch the right data — wire them up.
>
> For now, each page.tsx can just render a placeholder "Coming soon" message. We'll build them one by one in later steps.

### What to check
- Log in as contractor → see contractor shell with purple accent, correct nav items
- Log in as sub → see sub shell with steel blue accent
- Log in as commercial client → see blue accent
- Log in as residential client → see teal accent
- Wrong portal access redirects correctly
- Sidebar shows the user's actual org name and project list from seed data

### Commit:
```bash
git add .
git commit -m "Step 4: Portal route structure with themed shell layouts"
```

---

## Step 5 — Auth Pages (Login, Signup, Forgot Password)

### What this does
Replaces the minimal Phase 1 login form with the polished auth flow from the prototype.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_login_auth_flow.jsx. This has the complete auth flow design.
>
> Replace the existing minimal login page with the full auth flow:
>
> 1. **Login page** (`/login`): centered card with BuiltCRM logo, email + password fields, "Sign In" button, "Forgot password?" link, "Don't have an account?" link to signup. Match the prototype's layout and typography exactly.
>
> 2. **Signup page** (`/signup`): same centered card style. Full name, email, password, confirm password. This connects to the existing Better Auth signup action.
>
> 3. **Forgot password page** (`/forgot-password`): email input + send reset link button.
>
> 4. **Email sent confirmation** page: "Check your inbox" message with icon.
>
> 5. **Reset password page** (`/reset-password`): new password + confirm, triggered from email token link.
>
> 6. **Portal selector** (shown after login if user has multiple portals): grid of portal cards — each shows portal name, icon, and org name. User clicks to enter that portal. This uses the existing portal eligibility loader from Phase 1.
>
> All auth pages use a minimal layout — no sidebar or topbar. Just a centered card on the page background. The BuiltCRM cascading rectangle logo at the top of every auth card.
>
> Wire everything to the existing Better Auth actions from Phase 1. Don't recreate the auth logic — just upgrade the UI.

### What to check
- Login page matches the prototype exactly
- You can log in with a seed user
- After login, if user has one portal → go straight to it
- After login, if user has multiple portals → show portal selector
- Forgot password flow works end to end
- All auth pages have the correct logo, fonts, spacing

### Commit:
```bash
git add .
git commit -m "Step 5: Polished auth flow — login, signup, forgot password, portal selector"
```

---

## Step 6 — Client Onboarding Flow

### What this does
The invitation → signup → project access flow for new clients.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_client_onboarding_flow.jsx. This is the multi-step onboarding wizard.
>
> Build the onboarding flow. The backend invitation system already works from Phase 1 — this step just builds the UI.
>
> 1. **Invitation landing page** (`/invite/[token]`): shows who invited them, what project, a welcome message. "Get Started" button.
>
> 2. **Account creation step**: name, email (pre-filled from invitation), password. Skip if user already has an account (show "Sign in instead" option).
>
> 3. **Welcome / project intro step**: shows project name, what they'll be able to do (view progress, approve items, etc.)
>
> 4. **Done step**: "You're all set" with a button to enter the project.
>
> Multi-step wizard with progress indicator. Centered layout like the auth pages. Match the prototype exactly.
>
> Wire to the existing Phase 1 invitation acceptance API. Token validation, user creation, membership linking — all already built.

### What to check
- Create an invitation via the backend (or seed data) with a token
- Visit `/invite/[token]` → see the onboarding flow
- Complete the flow → user is created and linked to the project
- Entering the project takes you to the correct client portal

### Commit:
```bash
git add .
git commit -m "Step 6: Client onboarding wizard"
```

---

## Step 7 — Contractor Dashboard

### What this does
The first real data-connected page. This is the contractor's home screen after login.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_contractor_dashboard.jsx. This is the contractor's main dashboard — the first thing they see after login.
>
> Build the contractor dashboard at `src/app/(portal)/contractor/dashboard/page.tsx`.
>
> **Page structure from the prototype:**
> - Page title: "Dashboard" — DM Sans 26px/820
> - KPI strip: row of 5 KPI cards (Active Projects, Open RFIs, Pending Approvals, Draws in Review, Compliance Alerts) — use the KPI Card component from Step 3
> - Two-column grid (main + 320px right rail):
>   - Main column: "What needs attention" card with action items list, "Project health" card with status per project
>   - Right rail: "Upcoming deadlines" card, "Recent activity" feed card
>
> **Data source:** Create a server-side loader `getContractorDashboardData(context)` in `src/domain/loaders/contractor-dashboard.ts`. This aggregates data across all the user's projects:
> - Count of active projects from the projects table
> - Count of open RFIs, pending approvals, draws in review from their respective tables
> - Compliance alerts from compliance records
> - Upcoming milestones from the schedule table
> - Recent activity feed items
>
> If the existing Phase 1 loaders already fetch some of this data, reuse them. Only create new queries for dashboard-level aggregations that don't exist yet.
>
> Match the prototype exactly: typography, spacing, card styles, KPI formatting, list item layouts. Use the shared components from Step 3 wherever they fit.

### What to check
- Log in as contractor → see the dashboard with real data from seed
- KPI cards show real counts (not zeros — seed data should populate them)
- Action items list shows real items from the database
- Project health card shows actual project statuses
- Upcoming deadlines pull from real milestones
- Activity feed shows real recent activity

### Commit:
```bash
git add .
git commit -m "Step 7: Contractor dashboard — first production page with real data"
```

---

## Step 8 — Contractor Project Home

### What this does
The project-level overview page for contractors. Shows everything happening in one project.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_contractor_project_home.jsx. This is what the contractor sees when they click into a specific project.
>
> Build the contractor project home at `src/app/(portal)/contractor/project/[projectId]/page.tsx`.
>
> **Page structure from the prototype:**
> - Page title: project name — DM Sans 26px/820
> - Project meta bar: address, client name, project type, start/end dates
> - KPI strip: Active RFIs, Open COs, Pending Approvals, Next Draw, Budget Status
> - Two-column grid:
>   - Main: "Action items" card, "Recent workflow activity" card with type-filtered tabs (All/RFIs/COs/Billing/Compliance)
>   - Rail: "Project team" card (team members with roles), "Upcoming milestones" card, "Quick actions" card (create RFI, create CO, submit draw, etc.)
>
> **Data source:** The Phase 1 `getContractorProjectView(context)` loader already fetches most of this. Wire it up. If it's missing any data points the prototype shows, extend the loader.
>
> The "Quick actions" buttons should navigate to the correct workflow pages (e.g., "Create RFI" → `/contractor/project/[id]/rfis?action=create`).

### What to check
- Navigate to a project from the dashboard → see the project home with real data
- KPIs reflect actual counts from the database
- Team members show real project membership data
- Quick action buttons navigate to the right pages
- Typography and layout match the prototype exactly

### Commit:
```bash
git add .
git commit -m "Step 8: Contractor project home"
```

---

## Step 9 — Workflow Pages (Batch Build)

### What this does
Builds all the contractor workflow pages. These follow a very similar pattern — master-detail list with filters, detail panel, and action forms.

### Important pattern
Every workflow page follows this structure (from the prototypes):
1. **Summary strip**: 4-5 KPI cards across the top
2. **Filter bar**: status pills + search + date range
3. **Data table**: sortable columns with status pills, row click opens detail
4. **Detail panel**: slides in from right or shows as overlay, full item details + action buttons + history timeline
5. **Create form**: modal or panel for new items

You've already built the backend actions and state machines for all of these in Phase 1. The frontend just needs to call them.

### Tell Claude Code (do one at a time):

**RFIs:**
> Read docs/prototypes/builtcrm_rfi_workflow_paired.jsx. Build the RFI workflow page at `src/app/(portal)/contractor/project/[projectId]/rfis/page.tsx`.
>
> This page has two views — contractor's management view and subcontractor's response view. Build both. The existing Phase 1 RFI loaders and actions handle all the data — just build the UI.
>
> Summary strip: Total RFIs, Open, Awaiting Response, Overdue. Master-detail table: columns for RFI number (JetBrains Mono), title, assigned to, status (pill), age, priority. Detail panel: full RFI details, response thread, escalation controls, state transition buttons. Create form: new RFI modal.
>
> Also build the subcontractor's RFI response page at `src/app/(portal)/subcontractor/project/[projectId]/rfis/page.tsx` — shows only RFIs assigned to their org, with response form and file upload.

**Change Orders:**
> Read docs/prototypes/builtcrm_change_orders_workflow.jsx. Build the change order page for contractor at `src/app/(portal)/contractor/project/[projectId]/change-orders/page.tsx`.
>
> Summary strip, filterable table, detail panel with cost/schedule impact, approval flow buttons. Also build the commercial client view (`scope-changes` for residential) where clients review and approve/reject COs.

**Approvals:**
> Read docs/prototypes/builtcrm_approvals_workflow.jsx. Build the approvals queue page.
>
> Cross-type queue pulling from COs, procurement, design, general approvals. Contractor: full management view with delegation. Commercial client: "Approval Center". Residential client: "Decisions" with simplified language.

**Compliance:**
> Read docs/prototypes/builtcrm_compliance_workflow_paired.jsx. Build contractor compliance management and subcontractor compliance upload views.
>
> Org-level scorecard, requirement tracking, document upload areas, restriction warnings linked to billing.

**Upload Requests:**
> Read docs/prototypes/builtcrm_upload_requests_workflow_paired.jsx. Build contractor create/manage and subcontractor respond views.
>
> State machine UI: open → submitted → completed/revision_requested. File upload integration with the R2 infrastructure from Phase 1.

**Billing / Draw Workspace:**
> Read docs/prototypes/builtcrm_billing_draw_workspace.jsx. Build the contractor's billing management page.
>
> Schedule of Values table, draw request builder, G702/G703 math display, retainage tracking, lien waiver management. This is the most complex UI — take extra care matching the prototype.

**Billing / Draw Client Review:**
> Read docs/prototypes/builtcrm_billing_draw_client_review.jsx. Build the client's draw review page.
>
> Line-by-line review, approve/return with notes, lien waiver download links.

**Selections (Contractor Management):**
> Read docs/prototypes/builtcrm_selections_management_contractor.jsx. Build the contractor's selection category/item management page.
>
> Category tree, item/option CRUD, allowance pricing setup. Contractor curates what the residential client will choose from.

**Selections (Residential Client Flow):**
> Read docs/prototypes/builtcrm_residential_selections_flow.jsx. Build the residential client's browse/compare/select flow.
>
> Category browsing, option comparison, provisional selection, confirmation. Allowance vs upgrade pricing display.

### Per-workflow check pattern:
For each workflow page:
1. Real data from seed shows up in the table
2. Filters and search work
3. Detail panel opens with full item data
4. State transition buttons call the existing Phase 1 API actions
5. Create form submits successfully and new item appears in table
6. Audit events are created (check the database)
7. Typography and layout match the prototype

### Commit each workflow separately:
```bash
git add . && git commit -m "Step 9a: RFI workflow pages (contractor + sub)"
git add . && git commit -m "Step 9b: Change order workflow pages"
git add . && git commit -m "Step 9c: Approvals workflow pages"
git add . && git commit -m "Step 9d: Compliance workflow pages"
git add . && git commit -m "Step 9e: Upload request workflow pages"
git add . && git commit -m "Step 9f: Billing/draw workspace + client review"
git add . && git commit -m "Step 9g: Selections management + residential flow"
```

---

## Step 10 — Shared Pages

### What this does
Builds the cross-portal pages: messages, documents, schedule, payments.

### Tell Claude Code (one at a time):

**Messages:**
> Read docs/prototypes/builtcrm_messages_conversations_shared.jsx. Build the messaging system.
>
> Master-detail inbox: conversation list on left, message thread on right. Conversation type pills, linked workflow jump chips, compose with attachments. Four portal variations (contractor sees all, sub sees scoped, clients see their conversations). Use the existing Phase 1 messaging loaders and actions.

**Documents:**
> Read docs/prototypes/builtcrm_documents_file_management_shared.jsx. Build the document browser.
>
> Category tree sidebar, file list with metadata, upload modal with type/visibility/linking. Version history via supersede chain. Download uses the signed URL system from Phase 1.

**Schedule / Timeline:**
> Read docs/prototypes/builtcrm_schedule_timeline_shared.jsx. Build the milestone timeline.
>
> Phase-grouped milestone list with status indicators and countdown. Contractor sees full edit view, clients see curated subset. Residential language transforms applied.

**Payments / Financial View:**
> Read docs/prototypes/builtcrm_payment_financial_view_shared.jsx. Build the financial overview.
>
> Contract summary → billing progress → draw history → sub payment rollup → retainage. Contractor and sub views. Currency values in DM Sans (never JetBrains Mono).

### Commit each separately:
```bash
git add . && git commit -m "Step 10a: Messages — cross-portal inbox"
git add . && git commit -m "Step 10b: Documents — file browser with R2 integration"
git add . && git commit -m "Step 10c: Schedule / timeline — milestone views"
git add . && git commit -m "Step 10d: Payments / financial overview"
```

---

## Step 11 — Subcontractor Portal Pages

### What this does
Builds the subcontractor-specific pages that aren't covered by the shared workflow pages.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_subcontractor_today_board_project_home.jsx (the combined view) and docs/prototypes/builtcrm_subcontractor_today_board.jsx (the standalone view).
>
> Build:
> 1. **Today Board (standalone)** at `src/app/(portal)/subcontractor/today/page.tsx` — cross-project summary. KPI strip, "What needs your attention" with project filter tabs, compliance warnings, payment status, GC contacts.
> 2. **Project Home + Today Board (combined)** at `src/app/(portal)/subcontractor/project/[projectId]/page.tsx` — project-scoped version with task lists, project-specific KPIs.
>
> Both use the subcontractor steel blue accent. Subcontractor sidebar has different nav items than contractor (Work, Money, Compliance, Projects, Messages, Company sections).
>
> Wire to existing Phase 1 subcontractor loaders. The sub sees only their org's scope — tasks assigned to them, RFIs they need to respond to, their compliance status, their payment information.

### Commit:
```bash
git add .
git commit -m "Step 11: Subcontractor portal — today board + project home"
```

---

## Step 12 — Client Portal Pages

### What this does
Builds the commercial and residential client portal pages.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_commercial_client_portal_pages.jsx and docs/prototypes/builtcrm_residential_client_portal_pages.jsx.
>
> Build:
> 1. **Commercial client project home** at `src/app/(portal)/commercial/project/[projectId]/page.tsx` — project overview with budget tracking, milestone timeline, recent activity, project team. Blue accent.
> 2. **Residential client project home** at `src/app/(portal)/residential/project/[projectId]/page.tsx` — friendly tone, progress visualization, upcoming decisions, selections summary, budget overview. Teal accent.
>
> Key differences between the two:
> - Commercial: business language, detailed financials, "Change Orders", "Approval Center"
> - Residential: friendly language, simplified financials, "Scope Changes", "Decisions", "Your Selections"
> - Both use 24px/820 page titles (slightly smaller than contractor's 26px)
>
> Wire to the existing Phase 1 client project view loaders. Clients see curated data — not everything the contractor sees.

### Commit:
```bash
git add .
git commit -m "Step 12: Client portal pages — commercial + residential"
```

---

## Step 13 — Settings & Integrations

### What this does
Builds the contractor settings page with integration management.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_contractor_settings_integrations.jsx. Build the settings page at `src/app/(portal)/contractor/settings/page.tsx`.
>
> Sections: Organization settings (name, address, logo upload), Team management, Integration cards (QuickBooks, Stripe, Xero, Sage, Calendar, Email, CSV Export, Webhooks). Each integration card has a connect/disconnect toggle, status indicator, and configuration panel that slides out.
>
> The integration card logos are styled SVGs (already in the prototype) — QuickBooks green ledger, Stripe purple lines, etc. Copy these SVGs exactly.
>
> Wire to existing Phase 1 settings and integration connection APIs.

### Commit:
```bash
git add .
git commit -m "Step 13: Contractor settings + integration management"
```

---

## Step 14 — Marketing Website

### What this does
Builds the public marketing site. This exists outside the portal shell — no sidebar or auth required.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_marketing_website.jsx. This is a full marketing website with multiple pages and article overlays.
>
> Build at `src/app/marketing/page.tsx` (or as a separate route group with its own layout):
>
> - **Nav bar**: BuiltCRM logo + nav links (Product, Solutions, Pricing, Resources, Company) + Login/Get Started buttons
> - **Home page**: hero section, feature highlights, social proof, CTA
> - **Product page**: feature deep-dives with screenshots
> - **Solutions page**: per-industry use cases
> - **Pricing page**: tier comparison table (Starter, Professional, Enterprise)
> - **Resources page**: blog posts, guides, case studies as cards
> - **6 article overlays**: full-screen article reader triggered by clicking resource cards. Each has sticky back nav, category badge, author/date, h2 sections, blockquotes, callout boxes, stat highlights, bottom CTA.
> - **Footer**: full footer with link columns, social links, legal links
>
> This page is public (no auth). CTAs link to `/login` or `/signup`. The article overlay system uses client-side state — clicking a resource card shows the article, back button returns to resources.
>
> The marketing site was already polished in Phase 2 — match the prototype exactly including the article content.

### What to check
- Visit `/marketing` without being logged in → see the full marketing site
- Navigate between all pages
- Click any resource card → article overlay opens with full content
- "Get Started" and "Login" buttons link to auth pages
- Mobile-responsive layout (this is the public face — it needs to work on phones)

### Commit:
```bash
git add .
git commit -m "Step 14: Marketing website with article overlays"
```

---

## Step 15 — Dark Mode

### What this does
Enables the dark mode toggle in the topbar to actually switch themes.

### Tell Claude Code:

> Read docs/prototypes/builtcrm_design_system_shell.jsx — it has both light and dark CSS variable sets.
>
> Implement dark mode:
> 1. The tokens.css from Step 1 should already have dark mode variables. If not, add them now — they override the light theme values when a `.dark` class is on the `<html>` element.
> 2. The dark mode toggle in the topbar (sun/moon icon) should toggle the `.dark` class and persist the preference in localStorage.
> 3. Respect system preference (`prefers-color-scheme: dark`) as the default if no localStorage value exists.
> 4. All components should already work in dark mode because they use CSS variables. Verify and fix any components that hardcoded colors.
>
> Go through every page and verify dark mode looks good. Fix any contrast issues, hardcoded colors, or elements that don't respond to the theme switch.

### What to check
- Toggle dark mode → entire app switches themes
- Refresh the page → preference is remembered
- All portal accent colors look good on dark backgrounds
- Tables, cards, pills, buttons all readable in dark mode
- Marketing site also supports dark mode

### Commit:
```bash
git add .
git commit -m "Step 15: Dark mode with system preference detection"
```

---

## Step 16 — Responsive Layout

### What this does
Makes the app work on tablets and mobile devices. The prototypes are desktop-only — this step adapts them.

### Tell Claude Code:

> Make the entire app responsive. Key breakpoints:
>
> - **Desktop** (1280px+): full layout as prototypes show
> - **Tablet** (768px–1279px): sidebar collapsed by default (icon-only), single-column content where two-column was used, data tables scroll horizontally
> - **Mobile** (below 768px): sidebar becomes a hamburger menu overlay, topbar simplified, full single-column layout, cards stack vertically, tables become card-based list views for small screens
>
> Start with the shell (sidebar collapse + hamburger), then apply responsive rules to all page components.
>
> Priority pages for mobile:
> - Marketing website (public — must work perfectly on mobile)
> - Client portals (clients will check on their phone)
> - Login / onboarding flow
> - Subcontractor today board (subs are on job sites with phones)
>
> Lower priority for mobile (mostly used on desktop):
> - Contractor dashboard and workflow pages
> - Settings page
>
> Use Tailwind responsive utilities. Test at 375px (iPhone SE), 768px (iPad), and 1440px (desktop).

### Commit:
```bash
git add .
git commit -m "Step 16: Responsive layout — mobile, tablet, desktop breakpoints"
```

---

## Step 17 — Polish Pass

### What this does
Final quality sweep before Phase 3 is complete.

### Tell Claude Code:

> Do a full quality pass across the app:
>
> 1. **Loading states**: every page should show a skeleton/loading state while data loads. Use Next.js loading.tsx files or Suspense boundaries. No blank pages while data fetches.
>
> 2. **Error states**: every page should handle errors gracefully with an error.tsx boundary. Show a clear error message with a retry button, not a blank page or raw error.
>
> 3. **Empty states**: every table and list should handle zero items with the Empty State component from Step 3 (icon + message + CTA to create the first item).
>
> 4. **Transitions**: add subtle transitions to sidebar collapse, modal open/close, panel slide, tab switches. Keep them fast (150-200ms) and use ease-out.
>
> 5. **Focus states**: all interactive elements should have visible focus rings for keyboard navigation.
>
> 6. **Typography audit**: scan every page and verify fonts, weights, and sizes match the prototypes. Common things to check:
>    - Page titles are DM Sans 26px/820 (24px for client portals)
>    - KPI values are DM Sans 820
>    - KPI labels are Instrument Sans 12px/560
>    - No JetBrains Mono on currency values
>    - No font weight below 520
>
> 7. **Console cleanup**: remove any console.log statements, fix any React warnings, resolve any TypeScript errors.

### Commit:
```bash
git add .
git commit -m "Step 17: Polish pass — loading, error, empty states, transitions, typography audit"
```

---

## How to Handle Getting Stuck

Same rules as Phase 1:

1. **Copy the error message and paste it back to Claude Code.** Say "I got this error: [error]. Fix it."

2. **If it's going in circles**, say "Stop. Explain what you're trying to do and what's failing, then propose 2 different approaches."

3. **If the context gets too long**, type `/clear`. Claude Code will re-read CLAUDE.md and the files on disk.

4. **Commit after every step that works.** If Claude Code breaks something: `git checkout .`

5. **Use plan mode for complex pages.** Before building the billing workspace (the most complex UI), say "Plan how you'd implement the billing/draw workspace. Show me the approach before coding."

### Phase 3 specific tips:

6. **Always reference the prototype.** If a page doesn't look right, say "Read docs/prototypes/builtcrm_billing_draw_workspace.jsx. The current page doesn't match — specifically [describe what's wrong]. Fix it to match the prototype."

7. **Component reuse.** If you see Claude Code building the same UI pattern twice, say "This looks like the KPI card / data table / pill component we already built. Use the shared component from src/components/ instead of duplicating."

8. **Backend connection issues.** If a page isn't showing data, check: (a) the loader is being called, (b) the context resolver has access, (c) seed data exists for what you're testing. Say "Check that the loader is returning data. Log the loader output."

9. **Styling drift.** If fonts look wrong, say "Open the prototype in the artifact preview and compare it side-by-side with the running page. The [specific element] doesn't match — fix the font family/size/weight."

---

## Session Rhythm for Claude Code

Same as Phase 1:

1. **Start:** "We're working on Step X. Read docs/specs/phase_3_build_guide.md and docs/prototypes/[relevant file].jsx."
2. **Plan:** "Plan how you'd build this page. Show me the component structure and data flow before coding."
3. **Build:** "Go ahead and implement it."
4. **Compare:** "Does this match the prototype? Open docs/prototypes/[file].jsx and compare."
5. **Test:** "Run the dev server. Log in as [role] and navigate to [page]. Does the data show up correctly?"
6. **Fix:** Address any visual or data issues.
7. **Commit:** "Everything works. Let's commit."

Don't try to do more than 1-2 pages per session. The workflow pages (Step 9) should each be their own session.

---

## Estimated Session Count

| Step | Sessions | Notes |
|------|----------|-------|
| Steps 0-1 (setup + tokens) | 1 | Quick setup work |
| Step 2 (shell) | 1 | Most important component |
| Step 3 (component library) | 1-2 | Build all shared components |
| Step 4 (routing) | 1 | Structural, not much UI |
| Steps 5-6 (auth + onboarding) | 1 | Simpler pages |
| Steps 7-8 (dashboard + project home) | 1-2 | First real pages |
| Step 9a-b (RFIs + COs) | 2 | One workflow per session |
| Step 9c-d (approvals + compliance) | 2 | One workflow per session |
| Step 9e (upload requests) | 1 | Simpler workflow |
| Step 9f (billing) | 2 | Most complex UI in the app |
| Step 9g (selections) | 1-2 | Two related pages |
| Step 10a-d (shared pages) | 2-3 | Messages is the most complex |
| Step 11 (sub portal) | 1 | Two pages, similar pattern |
| Step 12 (client portals) | 1 | Two portals, simpler views |
| Step 13 (settings) | 1 | Single page |
| Step 14 (marketing) | 1-2 | Lots of content, articles |
| Steps 15-17 (dark mode + responsive + polish) | 2-3 | Sweep work |
| **Total** | **~20-25 sessions** | |

---

## After Phase 3 is Done

You'll have a complete, production-quality web application:
- Working backend (Phase 1) ✅
- Polished design system applied everywhere (Phase 2 → 3) ✅
- All 24 screens built with real data, real auth, real file uploads ✅
- Dark mode ✅
- Responsive for mobile/tablet ✅

Then:
- **Phase 4:** V2 features (28 deferred items — daily logs, punch list, notification center, Gantt scheduling, global search, predictive dashboard, etc.)
- Each V2 feature gets its own design prototype session here in Claude, then a Claude Code build session — same rhythm as Phases 2+3.
