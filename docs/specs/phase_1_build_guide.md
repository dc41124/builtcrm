# BuiltCRM — Phase 1 Build Guide
## A Step-by-Step Walkthrough for Building the Full Backend

**Who this is for:** You. A non-technical builder using Claude Code in VS Code for the first time on a project this size. This guide assumes you've built small single-file web apps before but haven't scaffolded a full-stack app with multiple packages, migrations, auth, and background jobs.

**What Phase 1 produces:** A fully working backend with all 36 database tables, authentication, role-based access control, file storage, and every workflow from the design sprint — but with only minimal UI (enough to test that everything works). Phase 2 (the Figma UI revamp) gives it the polish.

**How to use this guide:** Keep this file in your repo at `docs/specs/phase_1_build_guide.md`. When working in Claude Code, you can tell it "read docs/specs/phase_1_build_guide.md, we're on Step X" and it'll know exactly what to do.

---

## Before You Start — Setup Checklist

### Things you need installed
- **Node.js 18+** — check with `node --version` in your terminal
- **Git** — check with `git --version`
- **VS Code** with the Claude Code extension installed
- **Docker Desktop** (for local Postgres if not using Neon cloud) — optional but recommended
- A **GitHub account** with a new empty repo created called `builtcrm`

### Accounts to create (all have free tiers)
- **Neon** (neon.tech) — cloud Postgres database. Create an account and one project. Copy the connection string.
- **Cloudflare** (cloudflare.com) — for R2 storage. Create an account, go to R2, create a bucket called `builtcrm-uploads`. Get your account ID, access key ID, and secret access key.
- **Trigger.dev** (trigger.dev) — for background jobs. Create an account and a project. Get your API key.
- **Better Auth** — this is an npm package, no account needed.
- **Upstash** (upstash.com) — for Redis cache. Create an account and a Redis database. Get the REST URL and token.

Don't stress about getting every account perfect right now. Claude Code can help you configure each one when we reach that step.

---

## Step 0 — Create the Repo and Organize Your Files

This happens BEFORE you open Claude Code.

### 0.1 Create the project folder

Open your terminal and run:
```bash
mkdir builtcrm
cd builtcrm
git init
```

### 0.2 Organize the design sprint output

Create the folder structure and drop in all the files you downloaded from the project:
```
builtcrm/
├── docs/
│   ├── design/          ← put all 24 HTML mockup files here
│   ├── schema/          ← put all 5 drizzle_schema_*.ts files here
│   └── specs/           ← put all PDFs + markdown specs here
```

### 0.3 Add the CLAUDE.md

Copy the `CLAUDE.md` file you downloaded into the project root (`builtcrm/CLAUDE.md`).

### 0.4 Create a .gitignore

Create a file called `.gitignore` in the project root with:
```
node_modules/
.env
.env.local
.next/
dist/
.turbo/
```

### 0.5 First commit

```bash
git add .
git commit -m "Initial commit: design sprint output + project docs"
```

Now open VS Code in this folder (`code .` from terminal) and open Claude Code (Cmd+Shift+P → "Claude Code: Open in New Tab").

---

## Step 1 — Project Scaffolding

### What this does
Creates the Next.js app, installs all dependencies, and sets up the folder structure.

### Tell Claude Code:

> Read the CLAUDE.md for project context. We're starting from scratch. Scaffold a new Next.js 14+ project with App Router and TypeScript in the root of this repo. Use `src/` directory. Install these dependencies:
>
> Core: next, react, react-dom, typescript, @types/react, @types/node
> Database: drizzle-orm, postgres (node-postgres driver), drizzle-kit
> Auth: better-auth
> Jobs: @trigger.dev/sdk
> Storage: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner (for R2 — it's S3-compatible)
> Cache: @upstash/redis
> Utilities: zod (validation), nanoid (ID generation)
>
> Create the folder structure from CLAUDE.md. Don't build any features yet — just the scaffolding and a working dev server.

### What to check before moving on
- `npm run dev` starts without errors
- You see the Next.js default page at localhost:3000
- The folder structure matches what's in CLAUDE.md

### Commit:
```bash
git add .
git commit -m "Step 1: Project scaffolding with all dependencies"
```

---

## Step 2 — Environment Setup

### What this does
Creates the .env file structure so the app can connect to your database, storage, and services.

### Tell Claude Code:

> Create a .env.local file with placeholder variables for:
> - DATABASE_URL (Neon Postgres connection string)
> - BETTER_AUTH_SECRET (generate a random 32-char string)
> - BETTER_AUTH_URL (http://localhost:3000 for dev)
> - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
> - TRIGGER_DEV_API_KEY
> - UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
>
> Also create a src/lib/env.ts that validates these exist at startup using zod. If any are missing, the app should fail with a clear error message saying which variable is missing.

### What you do
Fill in your actual values from the accounts you created. The DATABASE_URL from Neon looks like `postgresql://user:password@ep-something.us-east-2.aws.neon.tech/neondb?sslmode=require`.

### Commit:
```bash
git add .
git commit -m "Step 2: Environment configuration"
# Note: .env.local is gitignored, so your secrets stay local
```

---

## Step 3 — Database Schema (First Wave)

### What this does
Takes the Drizzle schema files from the design sprint and turns them into a real database.

### Tell Claude Code:

> Read all 5 schema files in docs/schema/. These are the production schema from our design sprint — 36 tables total. Copy them into src/db/schema/ and adapt them for our project:
>
> 1. Split into logical files: identity.ts (users, orgs, memberships), projects.ts, documents.ts, workflows.ts (rfis, change_orders, approvals, upload_requests, compliance), billing.ts (billing_packages, SOV, draws, lien waivers, retainage), messaging.ts (conversations, participants, messages), selections.ts, integrations.ts, audit.ts (activity_feed, audit_events)
> 2. Create a central src/db/schema/index.ts that re-exports everything
> 3. Set up drizzle.config.ts pointing to our Neon database
> 4. Create src/db/client.ts that initializes the Drizzle client
>
> Don't modify the table structures — they're already designed. Just organize them.

### Then tell Claude Code:

> Run the Drizzle migration to create all tables. Use `npx drizzle-kit push` for the initial push to Neon. Show me the output.

### What to check
- No migration errors
- You can see your tables in the Neon dashboard (neon.tech → your project → Tables)

### Commit:
```bash
git add .
git commit -m "Step 3: Full Drizzle schema — 36 tables migrated to Neon"
```

---

## Step 4 — Seed Data

### What this does
Creates fake but realistic data so you can actually test things. Without seed data, every page would be empty.

### Tell Claude Code:

> Create a seed script at src/db/seed.ts that populates the database with realistic construction project data. Include:
>
> - 1 contractor organization ("Summit Contracting") with 2 users (admin + project manager)
> - 2 subcontractor organizations ("Northline Electrical", "Pacific Plumbing") with 1 user each
> - 1 commercial client organization ("Meridian Properties") with 1 user
> - 1 residential client (individual user, no org)
> - 2 projects: one commercial ("Meridian Tower Renovation"), one residential ("Harper Residence Kitchen Remodel")
> - Project memberships linking all the above appropriately
> - Some sample data for each project: 3 RFIs, 2 change orders, 1 draw request with SOV line items, 5 documents, 2 milestones, 3 messages in a conversation, 1 upload request, compliance records for each sub
>
> Use realistic Canadian construction data (CAD currency, Canadian addresses). Make the seed idempotent — running it twice shouldn't create duplicates. Add a script to package.json: "db:seed": "npx tsx src/db/seed.ts"
>
> Read docs/specs/builtcrm_master_module_map.md for the full list of features that need backing data.

### What to check
- `npm run db:seed` runs without errors
- You can see data in Neon's SQL editor (run `SELECT * FROM projects` etc.)

### Commit:
```bash
git add .
git commit -m "Step 4: Seed data — realistic construction project data"
```

---

## Step 5 — Authentication (Better Auth)

### What this does
Sets up login, signup, and session management so users can actually sign in.

### Tell Claude Code:

> Set up Better Auth for this project. Read the Better Auth docs if needed (use a subagent to research current Better Auth setup patterns for Next.js App Router).
>
> Requirements:
> - Email + password login (no social auth for now, SSO is V2)
> - Database session storage (not JWT — we want revocable sessions)
> - Session includes: userId, organizationId, role
> - Create src/auth/config.ts with the Better Auth configuration
> - Create src/auth/client.ts for the client-side auth helpers
> - Create a basic login page at src/app/(auth)/login/page.tsx — just a form with email + password, no styling needed
> - Create a basic signup page at src/app/(auth)/signup/page.tsx
> - Protect all /app routes with auth middleware — redirect to /login if not authenticated
> - After login, resolve which portal the user should see based on their role/membership
>
> The seed users should be able to log in. Use these passwords for seed data: "password123" for all seed users (dev only).

### What to check
- You can go to localhost:3000/login and see a login form
- You can log in as a seed user
- You get redirected to the appropriate portal
- If you're not logged in and try to access /app/*, you get redirected to login

### Commit:
```bash
git add .
git commit -m "Step 5: Better Auth setup — login, signup, session management"
```

---

## Step 6 — Context Resolver (the Most Important Piece)

### What this does
This is the core architectural piece. When a logged-in user hits any page, the context resolver figures out: who are they, what organization are they in, what role do they have, what project are they looking at, and what are they allowed to see?

### Tell Claude Code:

> This is the most important architectural piece. Read docs/specs/engineering_architecture_layer.pdf, specifically the section on "effective context resolution."
>
> Build the context resolver at src/domain/context.ts. It should:
>
> 1. Take a session (from Better Auth) and a projectId (from the URL)
> 2. Look up the user's organization memberships
> 3. Look up the user's project memberships for the given project
> 4. Determine the user's effective role: contractor_admin, contractor_pm, subcontractor_user, commercial_client, residential_client
> 5. Return an EffectiveContext object with: user, organization, project, role, permissions
> 6. If the user doesn't have access to the requested project, throw a clear authorization error
>
> Create a shared helper getEffectiveContext(session, projectId) that every loader and action will call. This is the single gate that all authorization flows through.
>
> Also create a src/domain/permissions.ts that defines what each role can do (read/write access to each resource type). Base this on the portal access patterns from the design mockups.

### What to check
- You can write a quick test: given a contractor user and a project they belong to, the resolver returns the right role and permissions
- Given a user who doesn't belong to a project, it throws an error

### Commit:
```bash
git add .
git commit -m "Step 6: Context resolver — role-based access control foundation"
```

---

## Step 7 — Project Home Loaders (Three Portals, One Project)

### What this does
Proves the architecture works: the same project renders completely differently depending on who's looking at it.

### Tell Claude Code:

> Build the project home loaders. These are server-side functions that fetch and shape data for each portal's project view.
>
> Read docs/design/contractor_project_home.html for what the contractor sees.
> Read docs/design/subcontractor_today_board_project_home.html for what the sub sees.
> Read docs/design/commercial_client_portal_pages.html for what the commercial client sees.
>
> Create:
> 1. src/app/(portal)/contractor/project/[projectId]/page.tsx — calls getContractorProjectView(context)
> 2. src/app/(portal)/subcontractor/project/[projectId]/page.tsx — calls getSubcontractorProjectView(context)
> 3. src/app/(portal)/client/project/[projectId]/page.tsx — calls getClientProjectView(context)
>
> Each loader:
> - Calls getEffectiveContext() first to verify access
> - Fetches data scoped to that role (contractor sees everything, sub sees only their scope, client sees curated subset)
> - Returns a view model shaped for that portal
>
> The page components can be minimal — just render the data as a basic HTML table or list. No styling needed. We're proving the data layer works, not building the UI yet.
>
> Create src/domain/loaders/ folder for the shared loader functions.

### What to check
- Log in as contractor → navigate to project → see full project data (KPIs, RFIs, docs, etc.)
- Log in as subcontractor → same project URL → see only scoped data
- Log in as client → same project → see curated, client-friendly data
- Try accessing a project you don't belong to → get an error, not someone else's data

### Commit:
```bash
git add .
git commit -m "Step 7: Project home loaders — three portals, one data layer"
```

---

## Step 8 — File Infrastructure (R2 Storage)

### What this does
Sets up the ability to upload, store, and retrieve files using Cloudflare R2.

### Tell Claude Code:

> Build the file storage infrastructure using Cloudflare R2 (S3-compatible). Read docs/specs/technical_architecture_prep.pdf section on storage.
>
> Create:
> 1. src/lib/storage.ts — R2 client initialization, presigned URL generation
> 2. POST /api/upload/request — takes (projectId, filename, contentType), verifies context, returns a presigned upload URL. The frontend will upload directly to R2 using this URL.
> 3. POST /api/upload/finalize — after upload completes, creates a `documents` record in the DB, creates `document_links` to connect it to the project and any source object. Writes an audit event.
> 4. GET /api/files/[documentId] — verifies the user has access to the document via context resolver, then returns a short-lived presigned download URL. Never expose the raw R2 URL.
>
> Storage keys should follow: {orgId}/{projectId}/{documentType}/{filename}
>
> Build a minimal test page at /test/upload that has a file picker and upload button so we can verify the flow works end-to-end.

### What to check
- Upload a file via the test page → it appears in your R2 bucket
- The documents table has a record for it
- You can download it via the /api/files/ endpoint
- A user without access to the project cannot download it

### Commit:
```bash
git add .
git commit -m "Step 8: File infrastructure — R2 upload, storage, retrieval"
```

---

## Step 9 — Upload Request Workflow (First Real Workflow)

### What this does
The first complete business workflow: contractor creates a request, subcontractor sees it, uploads a file, contractor reviews the result.

### Tell Claude Code:

> Build the upload request workflow end-to-end. Read docs/design/upload_requests_workflow_paired.html for the full feature spec.
>
> Create:
> 1. Contractor action: POST /api/upload-requests — creates an upload request targeting a specific sub org. Fields: title, description, projectId, targetOrganizationId, expectedFileType, dueDate. Creates audit event + activity feed item.
> 2. Subcontractor loader: when sub views their project, include their pending upload requests (only ones targeting their org)
> 3. Subcontractor action: POST /api/upload-requests/[id]/submit — connects the uploaded file to the request, moves state from 'open' to 'submitted'. Creates audit event + activity feed item.
> 4. Contractor action: POST /api/upload-requests/[id]/complete — contractor reviews and marks as completed. Or POST /api/upload-requests/[id]/revise to request changes.
>
> State machine: open → submitted → completed (or open → submitted → revision_requested → submitted → completed)
>
> Build minimal UI pages for this:
> - Contractor: a "Create Upload Request" form on the project page
> - Subcontractor: a list of pending requests with an upload button
> - Contractor: a list of submitted requests with complete/revise buttons
>
> All actions go through getEffectiveContext() first.

### What to check
- Log in as contractor → create an upload request targeting Northline Electrical
- Log in as Northline Electrical user → see the request → upload a file → submit
- Log in as contractor → see the submitted file → mark as complete
- The whole flow from open → submitted → completed works
- Audit events exist for each state change

### Commit:
```bash
git add .
git commit -m "Step 9: Upload request workflow — first complete business workflow"
```

---

## Step 10 — Audit and Activity Helpers

### What this does
Standardizes how the app records "what happened" so every future workflow uses the same pattern.

### Tell Claude Code:

> Refactor the audit and activity patterns into shared helpers. We've been creating audit events ad-hoc — now standardize them.
>
> Create:
> 1. src/domain/audit.ts — writeAuditEvent(context, { action, resourceType, resourceId, details })
> 2. src/domain/activity.ts — writeActivityFeedItem(context, { activityType, projectId, summary, relatedObjectType, relatedObjectId })
>
> Audit events are the compliance/security log — who did what, when, from what IP.
> Activity feed items are the user-facing "Recent Activity" shown on project homes.
>
> Go back through the upload request workflow and refactor it to use these shared helpers instead of inline inserts. Then verify everything still works.

### Commit:
```bash
git add .
git commit -m "Step 10: Standardized audit and activity helpers"
```

---

## Step 11 — First Background Job (Trigger.dev)

### What this does
Sets up Trigger.dev and creates the first automated job: remind about overdue upload requests.

### Tell Claude Code:

> Set up Trigger.dev for this project. Read the current Trigger.dev v3 docs (use a subagent to research the latest setup for Next.js).
>
> Create:
> 1. Trigger.dev configuration connected to our project
> 2. src/jobs/upload-request-reminder.ts — a scheduled job that runs daily. It:
>    - Queries upload requests that are 'open' and past their due date
>    - For each overdue request, creates an activity feed item warning the contractor
>    - Tracks which requests have already been reminded to avoid duplicate notifications
>
> Test the job by running it manually via the Trigger.dev dashboard.

### What to check
- Job appears in the Trigger.dev dashboard
- Running it manually creates the expected activity feed items
- Running it again doesn't create duplicates

### Commit:
```bash
git add .
git commit -m "Step 11: Trigger.dev setup + upload request reminder job"
```

---

## Step 12 — First Slice Complete! Now Build the Remaining Workflows

At this point the architecture is proven. The remaining steps follow the exact same pattern: read the mockup for the feature spec, build the server-side actions and loaders, add minimal UI to test, write audit/activity events.

### Tell Claude Code for each workflow:

**RFIs (read docs/design/rfi_workflow_paired.html + docs/schema/drizzle_schema_v2_additions.ts):**

> Build the RFI workflow. Contractor creates RFIs, assigns to a sub. Sub responds. Contractor can close or escalate. State machine: draft → open → responded → closed. Include issue vs formal RFI branching. Build the CRUD actions, loaders scoped by role, and minimal test UI.

**Change Orders (read docs/design/change_orders_workflow.html):**

> Build the change order workflow. Contractor creates COs with cost/schedule impact. Commercial clients see them as "Change Orders", residential clients see "Scope Changes". State machine: draft → pending_review → approved/rejected/negotiating. Client approval actions. Role-scoped loaders.

**Approvals (read docs/design/approvals_workflow.html):**

> Build the cross-type approvals queue. Pulls from change orders, procurement, design, and general approvals. Contractor manages the queue. Commercial clients see "Approval Center", residential clients see "Decisions". Actions: approve, approve with note, return for revision, reject. Delegation support.

**Compliance (read docs/design/compliance_workflow_paired.html):**

> Build compliance tracking. Contractor manages org-level scorecard. Sub sees their compliance requirements and uploads docs. COI verification checklist. Restriction mechanics (non-compliant sub → payment hold). Link compliance status to billing.

**Billing / Draw Requests (read docs/design/phase_3_billing_draw_workspace.html + billing_draw_client_review.html):**

> Build the AIA G702/G703 billing engine. Schedule of Values with line items. Draw requests referencing SOV. Contractor creates draws, client reviews line-by-line. Retainage tracking. Lien waiver management. State machine: draft → submitted → under_review → approved/rejected.

**Selections (read docs/design/selections_management_contractor.html + residential_selections_flow.html):**

> Build the selections workflow. Contractor curates categories, items, and options with allowance-based pricing. Residential client browses, compares, provisionally selects, confirms. Track allowance vs upgrade pricing. Revision window.

**Messages (read docs/design/messages_conversations_shared.html):**

> Build the messaging system. Conversations with participants. Messages with attachments. Conversation type tagging (General/RFI/CO/Approval). Linked workflow jump references. Unread tracking. All 4 portal views with role-scoped participant lists.

**Documents (read docs/design/documents_file_management_shared.html):**

> Build the document browser. Category tree, version history, document_links for object references. Visibility scoped per audience (contractor sees all, sub sees their scope, client sees curated). Upload with type/visibility/linking. Superseded version tracking. Uses the R2 infrastructure from Step 8.

**Schedule / Timeline (read docs/design/schedule_timeline_shared.html):**

> Build the milestone-based timeline. Phase grouping. Client timelines show curated subset with appropriate tone. Countdown indicators. Status tracking per milestone.

**Payments / Financial View (read docs/design/payment_financial_view_shared.html):**

> Build the financial overview. Contract summary, billing progress, draw history, sub payment rollup, retainage tracking. Contractor and subcontractor views.

**Settings / Integrations (read docs/design/contractor_settings_integrations.html + docs/specs/integration_architecture_spec.md):**

> Build the contractor settings pages. Organization settings, integration connections UI (connect/disconnect). For Phase 1, implement email notifications (outbound via SendGrid/Postmark) and CSV export. Accounting integrations (QuickBooks/Xero) and Stripe Connect are Phase 1 stretch goals.

---

## Step 13 — Client Onboarding and Login Polish

### Tell Claude Code:

> Build the client onboarding flow. Read docs/design/client_onboarding_flow.html and docs/design/login_auth_flow.html.
>
> 1. Invitation system: contractor sends invite (creates invitation record), system sends email with token URL
> 2. Invite acceptance: new user lands on signup page pre-filled from invitation, creates account, gets linked to project with correct role
> 3. Login flow: 5 screens from the mockup (login, forgot password, email sent, reset password, portal selector for multi-portal users)
> 4. Portal routing: after login, if user has one portal → go directly. If multiple → show portal selector.

---

## Step 14 — Marketing Site (Can Ship As-Is)

### Tell Claude Code:

> The marketing site mockup (docs/design/marketing_website.html) is already polished enough to ship directly. Set up a route at /marketing (or a separate static export) that serves this HTML file. It needs to link to /login for the "Get Started" and "Login" CTAs.

---

## Step 15 — Testing and Hardening

### Tell Claude Code:

> Run through the full testing checklist:
>
> Access tests:
> - Each portal role can only access their own portal
> - Wrong project access is blocked
> - Unauthenticated users get redirected to login
>
> Workflow tests (per workflow):
> - Full state machine works (every valid transition)
> - Invalid transitions are rejected
> - Audit events created for every state change
>
> File tests:
> - Upload, download, and visibility scoping all work
> - Unauthorized file access is blocked
>
> Create any missing tests. Fix any issues found.

---

## How to Handle Getting Stuck

When Claude Code produces an error or something doesn't work:

1. **Copy the error message and paste it back to Claude Code.** Say "I got this error when running [command]: [error]. Fix it." Claude Code is good at debugging from error messages.

2. **If it's going in circles**, say "Stop. Let's take a step back. Explain what you're trying to do and what's failing, then propose 2 different approaches to fix it." This forces it to think instead of guessing.

3. **If the context gets too long**, type `/clear` to start a fresh conversation. Claude Code will re-read your CLAUDE.md and the files on disk, so you don't lose any work — just the conversation history.

4. **Commit frequently.** After every step that works, commit. If Claude Code breaks something, you can always `git checkout .` to go back to the last working state.

5. **Use plan mode for anything complex.** Before building a whole workflow, say "Plan how you'd implement the billing/draw workflow. Don't write code yet — just show me the plan." Review it, ask questions, then say "Go."

---

## Session Rhythm for Claude Code

Each coding session should follow this pattern:

1. **Start:** "We're working on [Step X]. Read [relevant files]."
2. **Plan:** "Plan how you'd implement this. Show me the approach before coding."
3. **Build:** "Go ahead and implement it."
4. **Test:** "Run the dev server and let's test this. [Describe what to check]."
5. **Fix:** Address any issues.
6. **Commit:** "Everything works. Let's commit with message: [message]"

Don't try to do more than 1-2 steps per session. Keeping sessions focused produces better results than marathon sessions where context degrades.

---

## After Phase 1 is Done

You'll have a fully working backend with minimal UI. Every workflow works, every role can log in and see their scoped data, files upload and download securely, and background jobs run.

Then:
- **Phase 2:** Figma UI redesign → build polished React components against the working backend
- **Phase 3:** V2 features (28 deferred items from the design sprint)

The backend doesn't change between phases. You're just upgrading what users see.
