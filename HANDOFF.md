# BuiltCRM — Handoff

## Status: Phase 3 Complete

Multi-portal construction PM SaaS. Four portals (contractor, subcontractor,
commercial client, residential client) sharing one data layer with role-scoped
views. Read `CLAUDE.md` at the repo root for tech stack + conventions.

---

## Phase 3 — All 18 Steps Complete

| Step | Description | Status |
|------|-------------|--------|
| 0 | Update CLAUDE.md for Phase 3 | Done |
| 1 | Styling infrastructure (tokens, Tailwind, fonts) | Done |
| 2 | Shared shell (sidebar, topbar, breadcrumbs) | Done |
| 3 | Core component library (KPI, table, pill, card, button, modal, empty) | Done |
| 4 | Portal route groups + themed layouts | Done |
| 5 | Auth pages (login, signup, forgot/reset password, portal selector) | Done |
| 6 | Client onboarding wizard | Done |
| 7 | Contractor dashboard | Done |
| 8 | Contractor project home | Done |
| 9a-g | Workflow pages (RFIs, COs, approvals, compliance, uploads, billing, selections) | Done |
| 10a-d | Shared pages (messages, documents, schedule, financials) | Done |
| 11 | Subcontractor portal (today board + project home) | Done |
| 12 | Client portals (commercial + residential) | Done |
| 13 | Contractor settings + integrations | Done |
| 14 | Marketing website with article overlays | Done |
| 15 | Dark mode (theme toggle, system preference, localStorage) | Done |
| 16 | Responsive layout (mobile, tablet, desktop breakpoints) | Done |
| 17 | Polish pass (loading/error states, focus rings, transitions, cleanup) | Done |

### Pre-audit cleanup (15/15 complete)
1. next/link migration
2. Style consolidation (invitations UI)
3. list-ids.ts — already clean
4. Inline create panels verified
5. Multi-file upload support
6. file_size_bytes tracking
7. Approvals loader enrichment (docs + activity trail)
8. RFIs loader enrichment (reference files + activity trail)
9. Compliance loader enrichment (doc metadata + activity trail)
10. rfi_type schema field and UI branching
11. `const now = Date.now()` hydration sweep — deferred (low risk, no visible bugs)
12. dangerouslySetInnerHTML sweep → **replaced**: all inline `<style>` blocks extracted to `components.css` + `workspaces.css`
13. Residential decisions nav link
14. Empty state audit — covered by Step 17 (EmptyState component + error/loading boundaries)
15. Realistic seed data for audit pass

---

## What was done in the final session

### Seed data expansion (pre-audit cleanup 15/15)
Expanded from minimal test data to audit-ready density across all 4 projects:
- **28 RFIs** with responses, varied statuses (draft/open/pending/answered/closed)
- **20 change orders** (draft/pending/approved/rejected) with schedule impact
- **12 draw requests** at 3 stages (paid/under_review/draft) + lien waivers
- **12 selection categories**, 16 items, 40 options, 10 decisions (residential)
- **67 messages** across 19 conversation threads (general/rfi/co/approval/direct)
- **110 documents** with varied types, visibility scopes, and supersession
- **105 activity feed items** spanning 30 days
- **15 upload requests** at varied statuses
- **20 compliance records** (active/expired/pending/rejected mix)

### CSS architecture cleanup
- Extracted all `dangerouslySetInnerHTML` style blocks (43 files) into proper CSS:
  - `src/styles/components.css` — 7 core component stylesheets
  - `src/styles/workspaces.css` — 36 workspace/page stylesheets
- Consolidated duplicated portal accent color maps into `src/lib/portal-colors.ts`
- Removed stray console.log from invitations route

### Step 16 — Responsive layout
- Shell already had 3-breakpoint responsive (desktop/tablet/mobile)
- All workspaces already had 85+ media queries for grid collapses
- Added: core component mobile rules (cards, KPIs, modals, buttons)
- Added: global mobile overrides (page titles, header stacking, KPI 1-col)
- Added: settings/invitations + financial view mobile rules
- **98 total `@media` rules** across the app

### Step 17 — Polish pass
- **7 loading.tsx** skeleton files at route group boundaries
- **7 error.tsx** boundaries + `global-error.tsx` + `not-found.tsx`
- **Focus states**: `:focus-visible` rules with accent-colored rings
- **Transitions**: audited and confirmed all already present
- **Console cleanup**: zero `console.log`, zero TS errors, build clean

---

## Deferred Items (Phase 4 candidates)

### Data / API
- Contractor financial view: `tradeScope` field on SubPaymentRollupRow
- Sub-scoped financials: `pendingFinancialsCents` hardcoded to 0
- Nav badge counts: build `getPortalNavCounts()` per portal
- Weekly reports: true `weekly_reports` table for PM-authored narratives
- `const now = Date.now()` hydration sweep (low risk — no visible bugs)

### UI / Feature
- Export/download endpoints: payment report PDF, photo batch zip, receipt links
- Billing workspace: Package Documents buttons (UI-only placeholders)
- Contractor cross-project approvals page (ComingSoon)
- Contractor cross-project payment-tracking page (ComingSoon)
- Dark mode toggle: removed from topbar (code retained, will be settings item)

### Not built (no prototype exists)
- Subcontractor org-admin pages (Team, Settings)
- Contractor settings prototype audit (page works, not compared line-by-line)

### Real-time features (deferred — WebSocket/SSE)
- Typing indicator, online/offline presence dots in messages

### Migration workflow reconciliation (deferred — repo-wide hygiene)
`src/db/migrations/` contains 17 SQL files (0001–0017), **none of which have ever been applied** (`drizzle.__drizzle_migrations` journal is empty). Live DB was built via `npm run db:push`. An orphan `payment_status` enum exists in the DB that isn't in `src/db/schema/integrations.ts` (so `db:push` isn't reconciling drift — it's additive-only, never drops). Surfaced during Step 25 (OAuth scaffolding) when checking whether a new `0018_*.sql` was needed; answer was no, because the four integration tables already exist via push. Decide before any production deploy touches this DB:

- **Option (i):** `drizzle-kit introspect` current DB → squash to a single baseline migration → delete `0001`–`0017` → commit to `db:migrate` workflow going forward. Cleanest for production.
- **Option (ii):** Delete `src/db/migrations/` entirely, update `drizzle.config.ts` to remove `out:` → commit to `db:push` as the intentional workflow. Simplest for current solo-dev cadence but blocks any future prod migration audit.

Either path also needs to drop the orphan `payment_status` enum (or add it back to schema if anything depends on it — grep says no).

**Schema changes parked behind this reconciliation (Step 26 additions):**
- `webhook_events.organization_id` should be **nullable** so the inbound webhook handler can log "received but unmatched" rows for forensics. Currently the column is NOT NULL, so unmatched payloads return 202 with an audit event only — the row-level diagnostic trail is lost. Common operational causes for unmatched: disconnected-but-provider-unaware, stored `external_account_id` mismatch from an OAuth bug, race at connection-creation time.
- Add `UNIQUE (source_provider, event_id) WHERE webhook_direction = 'inbound'` partial unique index on `webhook_events` so the inbound-event dedup path can use `INSERT … ON CONFLICT DO NOTHING` atomically. Today Step 26's handler does `SELECT`-then-`INSERT` with a narrow, operationally-zero race window; the partial unique index collapses that into a single atomic statement and removes the race.

---

## DB State

- Neon has all schema changes applied (36 tables + 2 mods; Phase 4 integration tables + enums also present via `db:push`)
- Seed data is fully populated — `npm run db:seed` is idempotent
- Seed photos uploaded to R2 (SVG placeholders)

## Working Conventions

1. CSS lives in proper stylesheets: `components.css`, `workspaces.css`, `app-shell.css`
2. Portal accent colors imported from `src/lib/portal-colors.ts` (single source)
3. Font tokens: `var(--fd)` / `var(--fb)` / `var(--fm)`
4. Weight floor 520, KPI values 820, page titles 820/26px (24px clients)
5. Portal accents: contractor `#5b4fc7`, sub `#3d6b8e`, commercial `#3178b9`, residential `#2a7f6f`
6. No emojis — all icons are inline SVGs
7. Residential language: "Scope Changes" not "Change Orders", "Decisions" not "Approvals"
8. Client portals are project-scoped (no cross-project nav)
9. Contractor/sub use route groups: `(global)/` for cross-project, `project/[projectId]/` for project-scoped
10. Loader enrichment pattern: parallel queries for document_links + activity_feed_items
11. `<Link>` from next/link for all internal navigation
12. Loading/error boundaries at route group level (not per-page)

---

## Starting the Next Phase

Phase 3 is complete. The next phase is **Phase 4: V2 features** (28 deferred items from the master module map). Each V2 feature gets its own design prototype session, then a build session.

> "Continuing the BuiltCRM build. Read HANDOFF.md and CLAUDE.md. Phase 3 is
> complete. We're starting Phase 4 — V2 features. Read
> `docs/specs/builtcrm_master_module_map.md` for the full feature list."
