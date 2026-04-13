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
npm run db:migrate   # Run Drizzle migrations
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

## Reference Documents (read when relevant)
- **Architecture overview:** `@docs/specs/builtcrm_master_module_map.md` — full module inventory, design decisions, build strategy
- **Implementation plan:** `@docs/specs/first_implementation_slice_spec.pdf` — build order and slice definitions
- **Build checklist:** `@docs/specs/build_execution_checklist.pdf` — step-by-step task list
- **Engineering architecture:** `@docs/specs/engineering_architecture_layer.pdf` — module boundaries, loader/action patterns
- **Technical architecture:** `@docs/specs/technical_architecture_prep.pdf` — service boundaries, auth shape, storage model
- **Integration spec:** `@docs/specs/integration_architecture_spec.md` — accounting, Stripe, email, calendar, webhooks
- **Schema draft notes:** `@docs/specs/schema_draft_v1.pdf` — design rules and ID strategy
- **Design mockups:** `@docs/design/*.html` — 24 production HTML mockups (feature spec, not implementation target)

## Definition of Done
A feature is complete when:
1. The specified behavior works across all portal roles that interact with it
2. Authorization is enforced at the API/loader level, not just the UI
3. Audit events are written for state-changing actions
4. TypeScript compiles with zero errors
5. The feature handles the empty state gracefully
