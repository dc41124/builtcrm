# BuiltCRM — Construction Project Management Platform

## Overview
Multi-portal construction PM SaaS. Four portals (contractor, subcontractor, commercial client, residential client) sharing one data layer with role-scoped views. Resume/portfolio project built to market-ready quality.

## Tech Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript (strict mode)
- **ORM:** Drizzle (Postgres on Neon)
- **Auth:** Better Auth (identity + session entry; authorization lives in app policies)
- **Background jobs:** Trigger.dev
- **Storage:** Cloudflare R2 (S3-compatible, presigned URLs)
- **Cache/queues:** Upstash
- **Deployment:** Docker on Render

## Architecture Rules
- Backend-mediated: frontend never owns authorization
- Modular monolith: clear internal boundaries, not microservices
- Source objects are authoritative; derived pages are shaped reads, not separate systems
- All state-changing actions resolve back to source objects
- Core writes designed for transaction safety and idempotency
- Portal experience derived from context (role + membership), not manual toggle
- Project-level overrides live in project_user_memberships

## Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:generate  # Generate a migration from schema TS changes
npm run db:migrate   # Apply pending migrations
npm run db:seed      # Seed dev data
npm run test         # Run tests
npm run lint         # Lint check
```

## Project Structure
```
src/
  app/           # Next.js App Router pages and layouts
  components/    # Shared UI components
  lib/           # Business logic, utilities
  domain/        # Domain models and policies
  db/            # Drizzle schema, migrations, queries
  auth/          # Better Auth config, session helpers
  jobs/          # Trigger.dev background jobs
docs/            # Architecture specs and reference docs
  design/        # HTML mockups from design sprint (24 files)
  schema/        # Drizzle schema files (5 files)
  specs/         # Architecture and integration specs
```

## Schema (36 tables + 2 mods across 5 files)
- `drizzle_schema_first_pass.ts` — tables 1-15 (identity, projects, docs, workflows, billing, compliance, audit)
- `drizzle_schema_v2_additions.ts` — tables 16-22 (rfis, change_orders, milestones, conversations, messages)
- `drizzle_schema_phase3_billing.ts` — tables 23-28 (SOV, draw requests, lien waivers, retainage)
- `drizzle_schema_remaining_gaps.ts` — tables 29-32 + mods (invitations, selections)
- `drizzle_schema_phase4_integrations.ts` — tables 33-36 (integrations, sync, payments, webhooks)

## Portal Accent Colors
- Contractor: purple `#5b4fc7`
- Subcontractor: blue-steel `#3d6b8e`
- Commercial client: blue `#3178b9`
- Residential client: teal `#2a7f6f`

## Design System Fonts
- DM Sans (display/headings)
- Instrument Sans (body)
- JetBrains Mono (code/mono)
- NEVER use Inter, Roboto, or system defaults

## Key Conventions
- No emojis in UI — all icons are inline SVGs
- Residential language: "Scope Changes" not "Change Orders", "Decisions" not "Approvals"
- Paired workflow pattern: contractor + response side built together
- UUIDs for primary keys, created_at/updated_at on all mutable tables
- Soft-state fields where business history matters over hard deletion
- **FK constraint naming**: use drizzle-kit's auto-naming (`.references()`
  on the column) when the generated name
  `{srcTable}_{srcCol}_{refTable}_{refCol}_fk` fits in Postgres' 63-char
  limit. When it would exceed 63 chars, declare the FK explicitly via
  `foreignKey({ columns, foreignColumns, name: "{srcTable}_{srcCol}_fk" })`
  in the table callback and remove the `.references()` from the column.
  Rationale: the long auto-name gets silently truncated by Postgres on
  write, but drizzle-kit does NOT truncate on introspection — the mismatch
  surfaces as permanent drift that `db:push`/`db:generate` keep re-proposing.
  See the 8 tables in `projects.ts`, `workflows.ts`, `subscriptions.ts`,
  `billing.ts`, `integrations.ts`, `inspections.ts`, and `punchList.ts`
  that use this pattern today.

## Schema change workflow
1. Edit `src/db/schema/*.ts`
2. Run `npm run db:generate` — produces a new `NNNN_*.sql` migration + updated
   snapshot + journal entry under `src/db/migrations/meta/`
3. Run `npm run db:migrate` — applies the new migration
4. Commit the schema change + the new migration files together
5. For one-off SQL that isn't a schema change (backfills, DB role grants, etc.),
   write a SQL file and apply via `npx tsx --env-file=.env.local scripts/apply-sql.ts <path>`

## Reference Documents (read when relevant)
- **Architecture overview:** `@docs/specs/builtcrm_master_module_map.md` — full module inventory, design decisions, build strategy
- **Implementation plan:** `@docs/specs/first_implementation_slice_spec.pdf` — build order and slice definitions
- **Build checklist:** `@docs/specs/build_execution_checklist.pdf` — step-by-step task list
- **Engineering architecture:** `@docs/specs/engineering_architecture_layer.pdf` — module boundaries, loader/action patterns
- **Technical architecture:** `@docs/specs/technical_architecture_prep.pdf` — service boundaries, auth shape, storage model
- **Integration spec:** `@docs/specs/integration_architecture_spec.md` — accounting, Stripe, email, calendar, webhooks
- **Security posture:** `@docs/specs/security_posture.md` — threat model, data-at-rest mechanisms, master-key rotation impact, known gaps
- **Schema draft notes:** `@docs/specs/schema_draft_v1.pdf` — design rules and ID strategy
- **Design mockups:** `@docs/design/*.html` — 24 production HTML mockups (feature spec, not implementation target)
- **JSX prototypes:** `@docs/prototypes/*.jsx` — 24 JSX prototypes showing exact visual design for every screen. These are the pixel-level reference. Match them exactly for layout, typography, spacing, and colors.
- **Phase 4+ portfolio scope:** `@docs/specs/builtcrm_phase4_portfolio_scope.md` — **the active Phase 4+ plan, source of truth for what to build and in what order**
- **Phase 4+ full implementation plan:** `@docs/specs/builtcrm_phase4_plus_implementation_plan.md` — full enterprise plan (reference only; do not build from this)
- **2026 gap analysis:** `@docs/specs/builtcrm_2026_gap_analysis.md` — competitive research catalog (reference)
- **Phase 4+ build guide:** `@docs/specs/phase_4plus_build_guide.md` — step-by-step execution guide for Phase 4+ (this guide)

## Phase 4+ Execution Rules
- Every Claude Code session for Phase 4+ must begin by re-reading the portfolio scope doc and this build guide.
- Every item in the build guide is labeled either **Safe-to-autorun** or **Require-design-input**. For safe-to-autorun items, plan → implement → verify → report. For require-design-input items, draft 2–3 options and stop for decision.
- **Universal stop-and-ask triggers** (override any autorun permission): any change to `db/schema/*.ts`, any change to `auth/` or `domain/policies/`, any new dependency in `package.json`, any file deletion, any change to `CLAUDE.md` or `docs/specs/builtcrm_phase4_portfolio_scope.md`.
- After every item: run `npm run build && npm run lint`. Both must pass before moving to the next item. If an item adds a migration, also run `npm run db:migrate` on fresh seed.
- **Do not write handoff documents unless explicitly asked.** Handoffs happen at the end of a session or on the user's request, not automatically after each task.
- At approximately 50% context usage, warn the user. At wrap-up, produce: what to save, what to archive, and the next session's kickoff prompt.

## Phase 3 Frontend Rules
- Every page component must read its corresponding JSX prototype for visual reference
- Typography: DM Sans for display/headings/values/buttons/pills, Instrument Sans for body/descriptions/meta, JetBrains Mono ONLY for IDs, org names, file names, SKU codes, data table cells (NEVER currency values or KPI numbers)
- Weight floor: 520 minimum everywhere. KPI values: 820. Page titles: 820 at 26px (24px for client portals). Buttons: 620-650. Pills: 700. Card titles: 680-740.
- Portal accent colors: contractor `#5b4fc7`, subcontractor `#3d6b8e`, commercial `#3178b9`, residential `#2a7f6f`
- Logo: cascading rectangle SVG (three outlined/filled rectangles), never a "B" lettermark
- No emojis — all icons are inline SVGs
- Residential language: "Scope Changes" not "Change Orders", "Decisions" not "Approvals"
- All data fetching happens server-side in loaders. Client components are for interactivity only.
- The existing backend API routes and loaders from Phase 1 are the data source. Do not recreate them — connect to them.

## Definition of Done
A feature is complete when:
1. The specified behavior works across all portal roles that interact with it
2. Authorization is enforced at the API/loader level, not just the UI
3. Audit events are written for state-changing actions
4. TypeScript compiles with zero errors
5. The feature handles the empty state gracefully
6. The feature works on mobile browser (responsive baseline already established in Phase 3)
7. Any new table has a migration file checked in
8. Any new API route has basic authorization tests (role-based — deny the wrong portal, deny the wrong org)
9. Any new UI component has keyboard accessibility (Tab, Enter, Escape)
