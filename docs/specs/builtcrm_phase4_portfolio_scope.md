# BuiltCRM — Phase 4+ Portfolio-Scoped Implementation Plan

**Date:** April 16, 2026
**Status:** Active build plan — portfolio scope, US-primary with Canadian compliance overlay
**Supersedes:** `builtcrm_phase4_plus_implementation_plan.md` (the full enterprise plan remains a reference document)
**Companion:** `builtcrm_2026_gap_analysis.md` (competitive research, 85+ gaps catalogued)

---

## How to use this document

This is the source of truth for what gets built, in what order, and why. Every time you start a new Claude chat for BuiltCRM work, point Claude at this file first.

The plan is organized so each phase has:
1. **Target + rule** — when it ships and the one non-negotiable constraint
2. **Item table** — every task with effort, priority, and why-it-matters
3. **Acceptance criteria** — how you know each item is done
4. **Workflow for the session** — how to actually start, what to ask Claude to do first

If you get stuck, search this doc for "hand-hold" — those sections explain the process end-to-end for someone new to full-stack building.

---

## Table of contents

1. [Strategic frame (why this plan differs from the enterprise plan)](#1-strategic-frame)
2. [Context-window and chat-hygiene rules](#2-context-window-and-chat-hygiene-rules)
3. [Phase 4A — Technical debt & polish](#3-phase-4a--technical-debt--polish)
4. [Phase 4B — Core feature gaps](#4-phase-4b--core-feature-gaps)
5. [Phase 4C — Accounting integrations (infra + stubbed connectors)](#5-phase-4c--accounting-integrations)
6. [Phase 4D — Schema + cross-project pages](#6-phase-4d--schema--cross-project-pages)
7. [Phase 5 — Commercial GC parity](#7-phase-5--commercial-gc-parity)
8. [Phase 6 — PWA + field workflows](#8-phase-6--pwa--field-workflows)
9. [Phase 7.1 — Meeting Minutes AI agent (only)](#9-phase-71--meeting-minutes-ai-agent)
10. [Phase 8-lite — Integration infrastructure + platform enablers](#10-phase-8-lite--integration-infrastructure--platform-enablers)
11. [Phase 9-lite — Canadian compliance (free surfaces only)](#11-phase-9-lite--canadian-compliance)
12. [Phase 10 — Residential depth + client portal polish](#12-phase-10--residential-depth--client-portal-polish)
13. [What we cut and why](#13-what-we-cut-and-why)
14. [Per-item workflow (hand-hold section)](#14-per-item-workflow-hand-hold-section)
15. [Definition of Done — inherited from CLAUDE.md](#15-definition-of-done)
16. [Risks, open questions, and parking lot](#16-risks-open-questions-and-parking-lot)
17. [Claude Code execution rules](#17-claude-code-execution-rules)

---

## 1. Strategic frame

### Why this plan differs from the enterprise plan

The original `builtcrm_phase4_plus_implementation_plan.md` assumes you are building BuiltCRM as a real commercial product competing with Procore, Buildertrend, and JobTread. That plan has 148 items across 7 phases and roughly 12 months of work at 1 FTE.

**This plan assumes BuiltCRM is a portfolio project** — the goal is demonstrable architectural depth and feature surface area, not passing a SOC 2 audit or landing enterprise deals. That changes three things:

1. **No items that require money.** Audits, partner-program fees, paid translations, paid API subscriptions are cut.
2. **No items that require partnership applications.** Procore App Marketplace, Autodesk Platform Services production approval, Bluebeam Studio Prime partnership, Intuit production app review are cut — we build the *infrastructure* so the integration could slot in later, but we don't get the keys.
3. **Quebec compliance is kept only where it's free.** You're in Canada, so you get credit for building Canadian-aware features, but we skip anything that requires paying regulators or translation services.

### The positioning (what you're showing reviewers)

A reviewer looking at this repo should walk away saying:
- "This person built a real multi-tenant, multi-portal SaaS — not a CRUD toy."
- "They understand enterprise integration architecture — webhook catalogs, OAuth flows, idempotent sync, tiered features."
- "They thought about compliance as a first-class concern, not an afterthought."
- "They can actually ship — 148 items on the full plan, and they made principled cuts to fit a portfolio scope."

That last point matters: **the cuts themselves are a portfolio signal.** Keep this document visible in the repo. A reviewer who reads it sees product judgment, not just code.

### Scope geography

- **Primary:** US market (commercial + residential GC, mid-market)
- **Secondary:** Canada (Quebec-specific compliance surfaces as optional overlay)
- **Explicitly out of scope:** International, EU (GDPR), Australia, UK

### Target velocity

Phase 1 → Phase 3 completion took ~50 hours over 6 days. This plan is sized at roughly **80-120 focused hours** to full portfolio completion. At your observed pace that's 10-15 working days spread across 4-6 calendar weeks (realistic — features get harder than polish). Don't treat these numbers as commitments; treat them as sanity checks.

---

## 2. Context-window and chat-hygiene rules

Every BuiltCRM chat runs out of context eventually. To avoid losing work:

**Claude's responsibilities:**
- Warn you at approximately 50% context usage so you can start thinking about natural stopping points
- Give a wrap-up signal when approaching the limit, with:
  - What to save to the project folder
  - What files to delete or archive (to keep the project folder lean)
  - The exact kickoff prompt for the next chat
- **Do not** auto-write a handoff/status document every time a task finishes. Only write handoff docs when you ask, or at wrap-up.

**Your responsibilities:**
- Start each new chat with: *"Continuing BuiltCRM. Read `docs/specs/builtcrm_phase4_portfolio_scope.md` first. We're on [phase/item]. Context-window preferences: warn at 50%, wrap-up signal at limit, no auto status dumps."*
- At wrap-up, move files Claude produces into `docs/handoffs/` or `docs/specs/` as appropriate
- Delete any superseded handoff docs (see [§16 parking lot](#16-risks-open-questions-and-parking-lot) for what's superseded)

**Files that accumulate and should be pruned:**
- `phase2_session{N}_handoff.md` — these are all superseded by `phase1_completion_handoff.md` being the only Phase 1-2 reference needed going forward. Keep the last two sessions only.
- Per-session handoffs from Phase 3 onward — keep only the most recent unless one contains irreplaceable design decisions

---

## 3. Phase 4A — Technical debt & polish

**Target:** Days 1-5 of Phase 4 work. No feature work begins until 4A is done.
**Rule:** These items compound. Every one of them affects demo quality and daily-driver feel. Do not skip any to get to features faster.
**Total:** 14 items.

### 4A.1 — Quick wiring fixes

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 1 | `portalHref()` stale paths | S | P1 | Handoff-confirmed broken. Nav links resolve to wrong portal in some conditions. |
| 2 | "Package Documents" buttons in billing workspace — wire to real endpoints | S | P1 | UI-only placeholder today; clicking does nothing. |
| 3 | Nav badge counts: `getPortalNavCounts()` per portal | S | P1 | Badges currently hardcoded or empty. Needs real counts per portal context. |
| 4 | `const now = Date.now()` hydration sweep | S | P2 | No visible bug but will cause React hydration mismatches on slow networks. Low-risk cleanup. |
| 5 | Contractor settings prototype audit — **timebox to 4 hours** | S | P2 | Known gap. Do not let it balloon into a full Settings redesign. |
| 6 | Sign-out button in sidebar footer (user avatar area) | S | P1 | Flagged in Phase 3 handoff, forgotten. 20-minute fix. |
| 7 | Root URL → products page redirect | S | P1 | Temporary home while marketing site is separate. |

**Acceptance criteria (4A.1):**
- Clicking any portal nav link in any portal resolves correctly
- All "Package Documents" buttons either work or show a proper "Coming soon" state
- Nav badges display accurate real-time counts pulled from live data
- No hydration warnings in browser console
- Settings prototype is audited and any dead/broken UI is either fixed or deleted
- Sign-out button visible in every portal sidebar, actually signs out
- Hitting the bare domain redirects to `/products`

### 4A.2 — Dark mode wiring

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 8 | Wire dark mode toggle through user settings page globally — remove per-page toggles | S | P1 | Per-page toggles were a Phase 3 shortcut. Consolidate to one user-preference setting. |

**Acceptance criteria:** One toggle in user settings controls dark mode everywhere. Preference persists across sessions. No per-page toggles remain.

### 4A.3 — Admin/settings page builds

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 9 | Contractor portal: Organization page | S–M | P1 | Prototype exists in `settings_integrations.html`. |
| 10 | Contractor portal: Team & Roles page (functional permission editor, not display-only) | M | P1 | Permissions were flagged as a gap. This is where they get real. |
| 11 | Subcontractor portal: Team page | S–M | P1 | No prototype exists. Needs design pass first. |
| 12 | Subcontractor portal: Settings page | S–M | P1 | No prototype exists. Needs design pass first. |

**Acceptance criteria:** All four pages render, are navigable from the portal sidebar, persist changes to the DB, and enforce authorization at the loader/action level.

### 4A.4 — Export wiring

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 13 | Export/download endpoints batch: payment PDF, photo zip, receipt links | M | P1 | **Larger than it looks** — PDF generation and ZIP streaming are multi-day per endpoint. Plan accordingly. |

**Acceptance criteria:** Payment invoices can be downloaded as PDFs with correct branding. Photo albums can be downloaded as ZIP files. Receipt links resolve to the correct asset. All exports are authorization-checked.

### 4A.5 — Navigation improvement

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 14 | Project navigation dropdown in top bar (cross-project switch) | S–M | P1 | User-flagged need. Major UX improvement. |

**Acceptance criteria:** Top bar shows current project name + dropdown. Dropdown lists all projects the user has access to, respects role filtering, and switches the workspace context on selection.

### What moved out of 4A (into 4D)
- Contractor cross-project approvals page
- Contractor cross-project payment-tracking page
- Weekly reports table
- Lien waiver sub fan-out (`createWaiverForDraw`)

These were miscategorized as "polish." They're real features and belong in 4D.

### Phase 4A session workflow
1. Start the chat. Point Claude at this doc.
2. Go item-by-item. Claude reads the relevant code, proposes the change, you approve, Claude implements, you test locally.
3. After each item, check it off (in your head or in a scratch file — no formal handoff yet).
4. When all 14 are done, run `npm run build` and `npm run lint`. If both pass with zero errors, Phase 4A is complete.

---

## 4. Phase 4B — Core feature gaps

**Target:** Days 6-25 of Phase 4 work. Resequenced by user-visible impact per unit of effort.
**Rule:** Notification UI ships first. Every module feels more alive once the bell works.

### 4B.1 — Notification UI (ship this first)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 15 | Notification center — bell icon, dropdown, persistent page | S | P0 | Data already writes to DB. UI is ~1 week of work. Highest leverage per hour in the entire plan. |
| 16 | Notification preferences — per-channel, per-event-type | S | P1 | Pairs with 15. Standard UX expectation. |

**Acceptance criteria:** Bell icon shows unread count. Clicking opens a dropdown with last 10 notifications. Persistent page shows full history, filterable by type and project. User settings include per-event-type toggles for email vs in-app.

### 4B.2 — Global search

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 17 | Global command palette / search — cmd+K style | M | P1 | Standard SaaS primitive. Searches across projects, RFIs, COs, documents, people. |

**Acceptance criteria:** Cmd/Ctrl+K opens a search palette from anywhere. Results are role-scoped (subs don't see contractor-private data). Navigation by keyboard works.

### 4B.3 — Field workflow primitives

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 18 | Daily logs — weather, crew, notes, photos, delays | M | P1 | Core commercial field module. Every GC expects this. |
| 19 | Punch list — project-level punch items with assignee, status, photos | M | P1 | Missing closeout piece. |
| 20 | Submittals — workflow primitive (product-data + shop-drawing review) | M | P1 | Commercial GC table stakes. |

**Acceptance criteria for each:** Dedicated module with list view, detail view, create/edit flows. Portal-scoped visibility. Audit events on state changes. Mobile-friendly layouts (full responsive already established).

### 4B.4 — Documents — categories and versioning

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 21 | Document categories — typed folders (drawings, specs, submittals, contracts, photos) | S–M | P1 | Flat document list doesn't scale past 50 docs. |
| 22 | Document versioning — supersession, version history, diff metadata | M | P1 | Required for drawings and specs. |

**Acceptance criteria:** Categories appear in the document UI and filter the list. Uploading a new version preserves the old one but marks it superseded. Users can view version history and download prior versions.

### 4B.5 — Schedule

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 23 | Basic Gantt view — tasks, dependencies, critical path | M–L | P2 | Commercial expectation. Schedule table already exists; Gantt is the visualization. |

**Acceptance criteria:** Timeline view renders tasks with correct duration, shows dependencies as arrows, highlights critical path. Users can drag to reschedule (permission-gated).

### 4B.6 — Reporting

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 24 | Reports dashboard — project health, financial rollup, schedule status, RFI/CO aging | M | P1 | Executive surface for contractor portal. |

**Acceptance criteria:** Dashboard shows at-a-glance KPIs across all projects. Drilldown navigates to the underlying module. Exportable as PDF.

### Phase 4B total: 10 items.

---

## 5. Phase 4C — Accounting integrations

**Target:** Runs parallel to 4B/4D, weeks 4-8.
**Rule:** Build the infrastructure for real, but leave the connectors stubbed if they require production app approval. Stripe is the one exception — test mode is unrestricted.

### 4C.1 — Integration infrastructure (required for all connectors)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 25 | OAuth 2.0 generic connection flow — per-provider config, token encryption, refresh loop | M | P0 | Required for every integration. Build once, reuse. |
| 26 | Webhook receiver with HMAC verification + retry queue | M | P0 | Inbound events from every provider. Build once. |
| 27 | Sync event audit log — every push/pull logged with idempotency key | S | P1 | Debuggable and auditable. |
| 28 | Integration connection UI — list, connect, disconnect, health status | S | P1 | Page partially exists in `contractor_settings_integrations.html`. Wire it up. |
| 29 | Provider registry pattern — add new provider = add one file + config | S | P1 | Architectural cleanliness. Portfolio signal. |

**Acceptance criteria:** User can click "Connect [Provider]" in settings, complete OAuth, see connection status, and disconnect. Webhook endpoint verifies signatures correctly. Every sync operation is logged.

### 4C.2 — Stripe (fully working in test mode)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 30 | Stripe Connect setup for contractor onboarding | M | P1 | Free in test mode. No approval required. |
| 31 | ACH draw payments — client → contractor | M | P1 | Residential portal payment flow. |
| 32 | Card payments for selections | S | P1 | Residential upsell flow. |
| 33 | Payment transaction recording + reconciliation | S | P1 | Completes the loop. |

**Acceptance criteria:** Full end-to-end payment flow works in Stripe test mode. Test card/ACH credentials produce real transactions visible in a test Stripe dashboard. Webhooks update BuiltCRM state correctly.

### 4C.3 — Accounting connectors (stubbed)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 34 | QuickBooks Online — OAuth + connection UI + sync stub | S (stubbed) | P1 | Production requires Intuit app review. Build the connector framework + UI + mock sync. |
| 35 | Xero — same treatment | S (stubbed) | P1 | Same reason. |
| 36 | Sage — same treatment | S (stubbed) | P2 | Same reason. |

**Acceptance criteria:** Settings page lists each provider with a "Connect" button. Clicking shows a realistic OAuth consent mockup (real OAuth UI for QB/Xero sandbox works; production review is the stub boundary). Connection status persists. A "Sync now" button triggers a mock sync that writes a `sync_events` row. Document in a README that production requires app review.

### Phase 4C total: 12 items.

---

## 6. Phase 4D — Schema + cross-project pages

**Target:** Weeks 5-9. Runs alongside 4B tail and 4C.

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 37 | Contractor cross-project approvals page | M | P1 | Moved from 4A — real feature, not polish. |
| 38 | Contractor cross-project payment-tracking page | M | P1 | Moved from 4A. |
| 39 | Weekly reports table + generation | M | P1 | From HANDOFF.md deferred list. |
| 40 | Lien waiver sub fan-out — `createWaiverForDraw` | S | P1 | From HANDOFF.md deferred list. |
| 41 | Procurement / POs module | M | P2 | Schema addition. Commercial expectation. |
| 42 | `tradeScope` field on `SubPaymentRollupRow` + related | S | P2 | From handoff deferred items. |
| 43 | `pendingFinancialsCenter` for contractor financial view | S | P2 | From handoff deferred items. |

**Acceptance criteria per page:** Cross-project views respect role-based visibility, load in <1 second for <50 projects, and link back to source records. Schema additions migrate cleanly.

### Phase 4D total: 7 items.

---

## 7. Phase 5 — Commercial GC parity

**Target:** Weeks 9-16. Two big modules (drawings, inspections) plus four smaller ones.
**Rule:** Drawings + inspections before anything else here. Without these the commercial pitch falls flat.

### 5.1 — Drawings + inspections (the big two)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 44 | Drawings module — sheet management, markup, version control, sheet index | L | P0 | Single biggest commercial gap. ~3 weeks focused work. |
| 45 | Inspections module — QA/QC checklists distinct from milestones | M | P0 | Separate from milestones. Per-trade templates. |

**Acceptance criteria (drawings):** Upload PDF sheet set. Auto-extract sheet numbers. Markup with pen/text/shapes saved per user. Version compare overlay. Mobile-friendly viewer.

**Acceptance criteria (inspections):** Template library (framing, electrical, plumbing, etc.). Assign inspection to sub. Sub completes in mobile. Pass/fail/conditional outcomes. Photos per line item. Fail → generates a punch item (ties to 19).

### 5.2 — Quick wins

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 46 | Meetings module — agendas, minutes, attendees, action items | S–M | P1 | Pairs with Phase 7.1 AI agent. Quick win. |
| 47 | Transmittals module | S | P1 | Tiny effort. Standard commercial expectation. |

**Acceptance criteria (meetings):** Create meeting with agenda. Mark attendees. Record minutes. Generate action items that sync to main task list. Attach to project.

**Acceptance criteria (transmittals):** Create transmittal with document bundle and recipients. Email sent with audit trail. Receipt log.

### 5.3 — Differentiators

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 48 | Closeout packages — O&M manuals, warranties, as-builts bundled per project | M | P1 | White-space feature — Procore add-on market. |
| 49 | Subcontractor prequalification — intake form, scoring, bond/insurance capture | M | P1 | White-space feature. |

**Acceptance criteria (closeout):** Project can have a closeout package. Documents auto-categorize. Final package exports as indexed ZIP + PDF cover. Client portal can receive and sign off.

**Acceptance criteria (prequal):** Prequal form template per contractor. Sub fills out once, contractor reviews + scores. Prequal status surfaces on sub profile and blocks assignment below threshold.

### Phase 5 total: 6 items.

---

## 8. Phase 6 — PWA + field workflows

**Target:** Weeks 16-22.
**Rule:** Progressive Web App, not native. No Apple/Google developer accounts.

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 50 | PWA scaffolding — service worker, manifest, install prompt, offline shell | M | P0 | Field access without native apps. |
| 51 | Offline-first daily logs + photo capture | M | P1 | The field workflow most worth offlining. |
| 52 | Safety forms — toolbox talks, JHAs, incident reports | M | P1 | Standard field expectation. |
| 53 | Subcontractor time tracking — clock in/out per task or project | M | P1 | Sub portal field feature. |
| 54 | Photo spatial pinning — photos pinned to drawing coords | M | P2 | Differentiator. Requires drawings module. |
| 55 | Field RFI quick-capture — voice + photo + location | S | P1 | Pairs with AI agent item 77 later. |

**Acceptance criteria (PWA):** App installs on iOS and Android via browser. Works offline for read-only views. Photo capture works offline, syncs when back online.

**Acceptance criteria per item:** Module works end-to-end on mobile browser. Role-scoped. Syncs offline changes on reconnect without data loss.

### Phase 6 total: 6 items.

---

## 9. Phase 7.1 — Meeting Minutes AI agent

**Target:** Weeks 14-17 (overlaps Phase 5).
**Rule:** Ship ONE AI agent well. Meeting Minutes only.

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 56 | Meeting Minutes AI — transcription + action-item extraction + auto-assign + carry-forward | M | P0 | Category-wide gap. Highest differentiation per hour in the AI category. |

**Tech:** Use the Claude API (your existing stack). Audio-in → Whisper or similar for transcription (OpenAI or Deepgram API key — this is one API key worth getting, free tier sufficient for portfolio demos) → Claude for action-item extraction.

**Acceptance criteria:** Upload or record meeting audio. System transcribes. Claude extracts action items with assignees from the transcript. Action items appear in meeting minutes and in main task list. Next meeting's agenda auto-includes unresolved action items.

**RFI Draft agent (original item 77):** Deferred to V2. Ship Meeting Minutes first. If that ships well and there's time, revisit.

### Phase 7.1 total: 1 item.

---

## 10. Phase 8-lite — Integration infrastructure + platform enablers

**Target:** Runs parallel throughout. Infrastructure items first, platform polish later.
**Rule:** Build the infrastructure so real integrations could be added. Stub anything that requires partnership.

### 8-lite.1 — Integration infra (builds on 4C.1)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 57 | Webhook event catalog page — all emitted events with payload schemas | S | P1 | Integrator-facing documentation. Strong portfolio signal. |
| 58 | Per-org API key management — generate, rotate, revoke | M | P1 | Required for any programmatic access. |
| 59 | Rate limiting per API key | S | P1 | Standard. |
| 60 | Public API docs page — auto-generated from OpenAPI spec | M | P1 | Portfolio signal. |

**Acceptance criteria:** Webhook catalog documents every event type with a live-updating example payload. Users can generate API keys scoped to their org. Rate limits enforced. OpenAPI spec is checked into repo, docs page renders from it.

### 8-lite.2 — Platform enablers

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 61 | Custom fields on entities (projects, subs, documents) | M | P1 | JobTread markets this aggressively. Standard. |
| 62 | Bulk CSV import / export wizard | S | P1 | Onboarding-critical. Demo flag. |
| 63 | SSO stub — SAML 2.0 endpoint that works against test IdP | S (stubbed) | P2 | Shows you understand enterprise auth. Real production would require each customer's IdP config. |

**Acceptance criteria:** Admins can define custom fields per entity type; they render in forms and show in list views. CSV import supports all major entities with preview + validation. SSO page documents what production deployment would require.

### 8-lite.3 — Stubbed connectors (build UI shell, don't get keys)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 64 | Integration gallery page — every gated provider (Procore, ACC, Bluebeam, DocuSign, M365, Slack, etc.) | S | P1 | Demonstrates you know the landscape. Each card says "Coming soon — requires partner application." |

**Acceptance criteria:** Gallery page lists ~20 known integrations with logos (use vendor logos under fair-use for a portfolio), scope descriptions, and clear "Connect / Coming soon" state. Connecting shows a realistic consent mockup.

### Phase 8-lite total: 8 items.

### What we cut from the original Phase 8
- SOC 2 Type II audit — $30-80K cost, procedural
- Actual fr-CA translations as Phase 8 item (moved to 9-lite as optional)
- Real Procore/ACC/Bluebeam/DocuSign production integrations — all partnership-gated
- TrustLayer, myCOI, Siteline, GCPay, Trimble Pay, Ceridian/Dayforce — partnership-gated
- Get-listed-in-X-marketplace items — require applications

---

## 11. Phase 9-lite — Canadian compliance

**Target:** Weeks 18-22. Optional based on your appetite.
**Rule:** Only build items that are free to implement. Skip anything requiring paid regulators, translation services, or CA-specific hosting costs you're not already paying.

### 9-lite.1 — Free implementation items (recommended)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 65 | Law 25 Privacy Officer surface — DSAR intake form, 30-day SLA timer, consent manager UI, breach register (internal log) | M | P1 | Pure product work. Strong portfolio signal for privacy engineering. |
| 66 | RBQ license verification — consume free RBQ open data feed, surface license + subclass + validity on sub profile | S | P1 | Differentiator. No competitor ships this. Half-day of work. |
| 67 | T5018 contractor payment slip generator — annual CRA slip, XML + PDF export | S | P1 | Procore and Buildertrend do not ship. Portfolio flag. |
| 68 | Ontario 2026 Construction Act prompt-payment engine — proper-invoice template, 28/7-day timers, notice-of-non-payment forms, holdback ledger with annual release calc | M | P1 | Calendaring + form generation. Demo-worthy. |
| 69 | CCQ / ARQ attestation capture — manual entry of attestation number + expiry, reminder system, sub-profile badge | S | P1 | Extends compliance module. |

**Acceptance criteria (Law 25):** User can submit a DSAR request through a public intake form. Privacy Officer (admin role) sees request, timer counts down to 30-day SLA. Consent manager tracks per-event consent (what data processing, when, granted/revoked). Internal breach register logs incidents with required fields.

**Acceptance criteria (RBQ):** On a sub's profile, paste their RBQ license number. System hits the RBQ public feed, returns name + subclass + status + expiry. Badges render green/yellow/red based on validity.

**Acceptance criteria (T5018):** Admin can generate a T5018 summary for a fiscal year. System aggregates all sub payments, produces slip per sub where total > $500. Export as CRA-format XML and per-sub PDF.

**Acceptance criteria (Ontario 2026):** Project has a province setting. Ontario projects surface a "Proper Invoice" template with mandatory fields. On invoice submission, 28-day timer starts for owner approval, 7-day for GC-to-sub cascade. Missing-deadline events generate notice-of-non-payment drafts. Holdback ledger tracks per-project accumulation and calculates annual release (January 1).

### 9-lite.2 — Optional i18n track (fr-CA)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 70 | i18n plumbing — install `next-intl` or similar, wrap app, extract strings to keys, build language switcher | M | P1 | Plumbing is portfolio-worthy regardless. ~6-10 hours. |
| 71 | fr-CA translation of the en.json file | M | P2 | Only if you're willing to self-translate. Claude or DeepL can draft; you polish. Quebec terminology matters (fr-CA not fr-FR). |

**Acceptance criteria (plumbing):** Every hardcoded user-facing string becomes a `t('key')` lookup. Language switcher in user settings. Switching language instantly re-renders. Locale-aware date/number/currency formatting.

**Acceptance criteria (translation):** `fr.json` has complete coverage of `en.json`. No missing keys. Manual QA pass on the 10 most-visited pages in French.

### 9-lite.3 — Stub only (do not implement)

- Canadian data residency (ca-central-1 hosting) — a deployment decision, not a build task. Note in README.
- CAI breach notification send — requires a real regulator account. Internal breach register covers the product surface.
- Quebec hypothec denunciation — only if you want extra Quebec polish; skip for v1.
- Bill 96 fr-CA legal mandate UI — once 9-lite.2 ships, this is satisfied by having French available.
- Ceridian/Dayforce payroll integration — partnership-gated, stub only.

### Phase 9-lite total: 5 required + 2 optional = up to 7 items.

---

## 12. Phase 10 — Residential depth + client portal polish

**Target:** Weeks 22-28. After the moat is built.

### 10.1 — Residential gaps

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 72 | Client-initiated warranty request portal (post-handover) | M | P1 | Homeowners lose portal access at handover in most products today. |
| 73 | Specifications / scope-of-work documents distinct from selections | M | P2 | Custom-home dispute driver. |
| 74 | Allowance running-balance rollup widget | S | P1 | #1 late-stage residential dispute. Pure aggregation on existing data. |
| 75 | Homeowner-initiated walkthrough / punch capture | M | P2 | No vendor ships natively. Differentiator. |
| 76 | Proposal / estimate generation with native e-signature | M | P1 | Table stakes residential. BT, JobTread, UDA, BuildBook all ship. |
| 77 | Photo journal (no timelapse — that's hardware) | S | P2 | Small effort. |

### 10.2 — Client portal (cross-segment)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 78 | Multi-stakeholder guest access (architect, lender, co-signer roles with distinct scopes) | M | P1 | Most portals collapse "client" into one login. |
| 79 | Consolidated decision log — immutable timeline across selections, COs, specs, allowances | S | P1 | Aggregation. Differentiator. Scope-dispute defense. |
| 80 | Self-serve e-sign + payment in one flow (saved methods) | M | P1 | Table stakes. |
| 81 | Milestone celebration / shareable progress cards | S | P2 | Residential emotional UX. |
| 82 | Separate architect / owner / tenant views on commercial projects | M | P1 | Procore + Northspyre ship. Standard commercial. |

### Phase 10 total: 11 items.

---

## 13. What we cut and why

This list is itself a portfolio artifact. A reviewer seeing principled cuts with reasoning > someone who tried to ship everything and clearly pulled back midway.

**Cut: Phase 8 SOC 2 Type II audit.** $30-80K + 6-9 months procedural. Portfolio project. Replaced with a documented "what SOC 2 compliance would require" README section.

**Cut: Phase 8 production integrations (Procore, ACC, Bluebeam, DocuSign, QuickBooks prod, Xero prod, Sage prod, M365 prod, TrustLayer, myCOI, Siteline, GCPay, Trimble Pay, Ceridian, Dayforce, Agave, Workato).** All require partner program applications, business entity verification, and in many cases revenue thresholds. Infrastructure is built (Phase 4C.1, 8-lite.1); connectors are stubbed or demo against sandboxes where possible.

**Cut: Phase 8 marketplace listings (Procore App Marketplace, ACC Partner Card).** Both require formal applications. Not feasible for a portfolio.

**Cut: Phase 9 Canadian items that cost money.** Data residency hosting, CAI real-regulator notifications, paid translation services. Replaced with internal equivalents (breach register, self-translation, README note on hosting).

**Cut: Phase 7 AI waves 2 and 3.** Original plan had 11 AI items. We ship 1 well. Q&A copilot, auto daily log, auto-tag, exec summary reports, drawing reconciliation AI, PPE detection, contract compliance AI, takeoff AI — all deferred to V2+.

**Cut: Phase 6 native mobile app.** Requires Apple Developer ($99/yr) + Google Play ($25 one-time). Replaced with PWA, which covers 95% of use cases without either fee.

**Cut: Multi-currency (USD/CAD).** Marked V2+ in original plan. Still V2+.

**Cut: Real-time collaboration (WebSocket typing indicators, presence, Google Docs-style editing).** V2+.

**Cut: Construction loan draw integrations (Built, Northspyre), homeowner financing programs, owner-side AP integrations.** All partnership-gated or require referenced lender relationships.

**Cut: Predictive dashboards / delay scoring AI.** Needs real customer historical data. Infeasible pre-revenue.

---

## 14. Per-item workflow (hand-hold section)

For someone new to full-stack, here's how to actually work each item.

### Step 1 — Start the chat
Open a new Claude chat (in Claude Code or the desktop app). Use this exact prompt:

> Continuing BuiltCRM. Read `docs/specs/builtcrm_phase4_portfolio_scope.md` first. We're on [Phase X, item #Y]. Context-window preferences: warn at 50%, wrap-up signal at limit, no auto status dumps.

### Step 2 — Orient Claude
Ask Claude to read the current state of the relevant files before proposing changes. For a nav fix, that's the sidebar component + `portalHref` helper. For a new module, that's the existing schema + any HTML mockup.

**Good first message:**
> "Before we start item #1, read `src/components/Sidebar.tsx` and `src/lib/portalHref.ts`. Tell me what each currently does and where the stale paths are."

### Step 3 — Plan before coding
Ask Claude to propose the change in plain English first. No code yet. This catches misunderstandings cheaply.

**Good message:**
> "What's your plan to fix this? Don't write code yet — just describe the change."

### Step 4 — Code it
Claude writes the change. Claude shows you the diff. You read it. If anything looks off, push back. Don't accept code you don't understand.

**Good pushback:**
> "Why are you using `useEffect` here instead of just doing it server-side?"

Claude should be able to answer. If the answer is "I don't know, let me reconsider" — good, that's the feedback loop working.

### Step 5 — Test locally
Run the dev server. Click the thing. Does it work? Does anything obviously break?

### Step 6 — Check the Definition of Done
Per CLAUDE.md:
1. Does it work across all relevant portal roles?
2. Is authorization enforced at the loader/action level (not just UI)?
3. Are audit events written for state-changing actions?
4. Does TypeScript compile clean? (`npm run build`)
5. Does the feature handle empty state gracefully?

If any is "no," keep working. Don't move to the next item.

### Step 7 — Move on
One item done. Next item. Don't write a handoff doc — that's for wrap-up only.

### When you hit the 50% context warning
- Finish the item you're on, if close
- If not close, ask Claude: "Give me the wrap-up. What do I save, what do I delete, what's the next chat's kickoff prompt, and what state is this item in?"
- Move files into the project folder as instructed
- Open new chat with the kickoff prompt

### When you're stuck
Three things to try in order:
1. **Show Claude the error.** Paste the actual error message, not your paraphrase.
2. **Show Claude the context.** "Here's the file. Here's what I ran. Here's what I expected. Here's what happened."
3. **Ask for a rollback path.** "If this gets worse, what's the clean revert?"

---

## 15. Definition of Done

Inherited from CLAUDE.md. A feature is complete when:

1. The specified behavior works across all portal roles that interact with it
2. Authorization is enforced at the API/loader level, not just the UI
3. Audit events are written for state-changing actions
4. TypeScript compiles with zero errors
5. The feature handles the empty state gracefully

Add for Phase 4+:

6. The feature works on mobile browser (responsive is already baseline)
7. Any new table has a migration file checked in
8. Any new API route has basic authorization tests
9. Any new UI component has keyboard accessibility (Tab, Enter, Escape)

---

## 16. Risks, open questions, and parking lot

### Risks
- **Drawings module scope creep.** This is the single largest item in the whole plan. Timebox it ruthlessly. If 3 weeks isn't enough, cut version-compare to V2.
- **PWA vs native temptation.** Resist the urge to "just try" native mid-Phase-6. You'll blow the budget.
- **i18n during rapid feature work.** If you add i18n plumbing (item 70), every new string after that point must use `t()` — don't backslide into hardcoded strings mid-sprint.

### Open questions (resolve before the relevant phase starts)
- **Do you self-translate fr-CA or skip?** Locks before Phase 9-lite.
- **Does SSO stub need a working OIDC test?** Or is a well-documented SAML endpoint sufficient?
- **Do you want Quebec hypothec as part of 9-lite or defer?** Marked as stub currently.
- **Closeout package output format — PDF book or hosted timeline?** Affects item 48 design.

### Parking lot (things we talked about and aren't doing)
- AI selection inspiration
- Real-time collaborative editing
- Photo timelapse (hardware integration)
- Multi-currency
- Native mobile
- Enterprise procurement/bid management at BuildingConnected parity
- BIM viewer custom build
- Takeoff AI

### Files to delete or archive after adopting this plan

Safe to delete from project folder (superseded):
- None yet. All current handoffs remain useful until specifically noted.

Safe to archive (move to `docs/archive/`):
- `phase2_session1_handoff.md` through `phase2_session8_handoff.md` — keep only `phase2_session12_handoff.md` as the latest Phase 2 reference
- Once Phase 4A is complete, `phase3_current_session_handoff.md` can be archived

**Never delete:**
- `CLAUDE.md`
- `builtcrm_master_module_map.md`
- `integration_architecture_spec.md`
- `builtcrm_phase4_plus_implementation_plan.md` (the full enterprise plan — reference for "what would this look like at scale")
- `builtcrm_2026_gap_analysis.md` (renamed from compass_artifact_wf-...)
- **This document**
- Any schema file
- Any HTML mockup
- Any spec PDF

---

## Appendix A — Running item count

| Phase | Items |
|---|---|
| 4A | 14 |
| 4B | 10 |
| 4C | 12 |
| 4D | 7 |
| 5 | 6 |
| 6 | 6 |
| 7.1 | 1 |
| 8-lite | 8 |
| 9-lite | 5-7 (optional i18n adds 2) |
| 10 | 11 |
| **Total** | **80-82 items** |

Down from 148 in the original plan. Cut was mostly Phase 8 and 9 enterprise/compliance items.

---

## Appendix B — First chat kickoff (copy this)

```
Continuing BuiltCRM post-Phase-3. Read
`docs/specs/builtcrm_phase4_portfolio_scope.md` first — that's the
active plan. Companion docs:
- `docs/specs/builtcrm_phase4_plus_implementation_plan.md` (full enterprise plan, reference only)
- `docs/specs/builtcrm_2026_gap_analysis.md` (competitive research)
- `CLAUDE.md` (stack + conventions)

We're starting Phase 4A, item #1 (portalHref() stale paths).

Context-window preferences: warn at 50%, wrap-up signal at limit,
no auto status dumps.

First, read the relevant files (src/components/Sidebar.tsx,
src/lib/portalHref.ts, anywhere portalHref is called) and tell me
in plain English what's currently broken before proposing any fix.
```

---

## 17. Claude Code execution rules

This section is for when you're using **Claude Code** (the terminal/IDE agent) rather than chat. Claude Code is agentic — it will happily complete multiple items autonomously if you let it. These rules keep you in control without micromanaging every step.

### 17.1 — Safe-to-autorun vs require-design-input

Split every item in this plan into two buckets before Claude Code starts:

**Safe-to-autorun (let Claude Code batch these):**
These items are mechanical. Claude Code can plan, implement, test, and report without needing you to intervene mid-stream. You review the diff when it finishes.

- 4A items 1, 2, 3, 4, 6, 7, 8 (all wiring and redirects)
- 4A items 13, 14 (exports, nav dropdown) — after design is clear from existing mockups
- 4B items 16, 21, 22 (notification preferences, doc categories, versioning — additive features with clear schemas)
- 4C item 27 (sync event audit log — pure schema + logging)
- 4D items 40, 42, 43 (deferred fixes from handoff)
- 8-lite items 57, 59 (webhook catalog page, rate limiting)
- Any Phase 10 item with an existing HTML mockup in `docs/design/`

**Require-design-input (Claude Code must pause and ask):**
These items need a decision that isn't already written down. Claude Code should draft options and stop.

- 4A items 5, 9, 10, 11, 12 (settings audit + pages — especially 11/12 which have no prototype)
- 4B items 15, 17, 18, 19, 20 (notification UI shell, search, daily logs, punch list, submittals — first-time module builds)
- 4B items 23, 24 (Gantt, reports — scope-sensitive)
- 4C items 25, 26, 28 (OAuth flow, webhook receiver, integration UI — security-critical architecture)
- 4C items 30-33 (Stripe — touches real test money, wants your eyes)
- 4D items 37, 38, 39, 41 (cross-project pages, procurement — new UX patterns)
- All of Phase 5 (commercial modules — each is a major feature)
- All of Phase 6 (PWA architecture decisions)
- Phase 7.1 (AI agent — API key strategy, prompt design)
- 8-lite items 58, 60, 61, 62, 63, 64 (API keys, docs, custom fields, CSV import, SSO, integration gallery)
- All of Phase 9-lite (compliance — legally-sensitive even as portfolio)

**Universal stop-and-ask triggers** (override the above):
- Any change to `db/schema/*.ts` — schema changes get eyes
- Any change to `auth/` or policies — auth changes get eyes
- Any new dependency in `package.json` — review before install
- Any file deletion — confirm before delete
- Any change to `CLAUDE.md` or this plan doc — confirm before edit

### 17.2 — The Claude Code kickoff prompt

Use this at the start of every Claude Code session. It's longer than the chat kickoff because Claude Code needs explicit agentic boundaries.

```
Read these files in order:
1. CLAUDE.md
2. docs/specs/builtcrm_phase4_portfolio_scope.md
3. Any spec referenced by the item you're about to work on

We're working on [Phase X, items #Y-Z] from the portfolio scope doc.

Execution rules (from §17):
- For each item, first determine if it's "safe-to-autorun" or "require-design-input" per §17.1
- Safe-to-autorun: plan, implement, verify, report done. Continue to next item.
- Require-design-input: draft 2-3 options, stop, wait for my decision.
- Universal stop triggers: schema changes, auth changes, new dependencies, file deletions, edits to CLAUDE.md or the plan doc itself.

Verification per item:
- Run `npm run build` — must pass with zero errors
- Run `npm run lint` — must pass
- If the item adds a DB migration: run `npm run db:migrate` on a fresh seed
- Report the acceptance criteria from the plan doc and confirm each is met

Context-window preferences:
- Warn at ~50% usage
- At wrap-up: tell me what to save, what to archive, and the next session's kickoff prompt
- Do NOT write a handoff document unless I explicitly ask

Start by telling me which items in the range are safe-to-autorun vs
require-design-input, then ask me to confirm before proceeding.
```

### 17.3 — File-path hints for Phase 4A (next phase up)

So Claude Code doesn't burn time searching:

| Item | Likely files to read first |
|---|---|
| 1 (portalHref) | `src/lib/portalHref.ts`, `src/components/Sidebar.tsx`, grep for `portalHref(` across `src/app/` |
| 2 (Package Documents buttons) | `src/app/(contractor)/billing/**`, search for `Package Documents` string |
| 3 (nav badge counts) | `src/lib/getPortalNavCounts.ts` (or similar), `src/components/Sidebar.tsx`, loader files per portal |
| 4 (Date.now hydration) | Grep `const now = Date.now()` across `src/` — fix by moving to server loaders or `useEffect` |
| 5 (contractor settings audit) | `src/app/(contractor)/settings/**` — audit, do not redesign |
| 6 (sign-out button) | `src/components/Sidebar.tsx` footer area, `src/auth/signOut.ts` |
| 7 (root redirect) | `src/app/page.tsx` or `src/middleware.ts` |
| 8 (dark mode) | `src/lib/theme.ts` or `src/components/ThemeProvider.tsx`, grep for per-page dark toggles |
| 9 (contractor Organization page) | Use `docs/design/contractor_settings_integrations.html` as the visual reference; new route under `src/app/(contractor)/settings/organization/` |
| 10 (contractor Team & Roles) | Existing `src/app/(contractor)/settings/team/` if present, otherwise new; see `domain/policies` for permission model |
| 11, 12 (subcontractor pages) | **No prototype exists** — STOP, ask for design direction first |
| 13 (exports) | `src/app/api/export/**`, libraries: `pdfkit` or `@react-pdf/renderer` for PDFs, `archiver` for ZIPs |
| 14 (project nav dropdown) | `src/components/TopBar.tsx` or shell header, `src/lib/getAccessibleProjects.ts` |

### 17.4 — Verification commands reference

Keep these in muscle memory:

```bash
npm run build       # TypeScript compile + Next.js build
npm run lint        # ESLint
npm run db:migrate  # Apply Drizzle migrations
npm run db:seed     # Reset and reseed dev data (destructive)
npm run test        # Run tests (if any are written)
npm run dev         # Start dev server for manual testing
```

For Claude Code after any item:
```bash
npm run build && npm run lint
```
Both must pass before moving on. No exceptions.

### 17.5 — How to review a Claude Code batch

When Claude Code finishes a batch of safe-to-autorun items and reports done, don't just approve. Run this checklist:

1. **Read the diff.** Every file changed. If anything touches a file you didn't expect, ask why.
2. **Check the item acceptance criteria.** Open this plan doc, re-read the criteria for each completed item, and verify in the running app.
3. **Click through in the browser.** Don't trust "build passes" as "feature works."
4. **Check authorization.** Open DevTools, hit the new endpoint as a different role. Does it 403 correctly?
5. **Check the empty state.** Delete the seed data for the feature. Does it render gracefully?
6. **Commit with a clear message.** One commit per item or per coherent group. Never "Phase 4A done" as a single commit — you'll never be able to bisect later.

### 17.6 — Recovery patterns (when Claude Code goes wrong)

Claude Code sometimes over-reaches. Here's how to recover:

**"It changed files I didn't expect."**
Run `git diff` and `git checkout -- <file>` to revert specific files without losing the good changes. Don't blow away the whole branch.

**"It added a dependency I didn't approve."**
`git checkout -- package.json package-lock.json` before running `npm install` again.

**"It tried to do 5 items when I wanted 2."**
Tell it to stop, revert the extra items, and re-prompt with an explicit "items #N through #M ONLY, stop after #M."

**"It modified the schema without asking."**
Hard revert. Schema changes need human eyes every time. Update the kickoff prompt to emphasize this if it keeps happening.

**"It wrote a 'handoff document' when you didn't ask."**
Delete it. Remind it in the next prompt: "per §17.2, no handoff docs unless I explicitly ask."

### 17.7 — When to use chat instead of Claude Code

Not every task benefits from Claude Code. Use plain chat (Claude.ai desktop/web) for:

- **Planning sessions** — brainstorming, scoping, revising this doc
- **Single file questions** — "why isn't this working?"
- **Strategic decisions** — anything from §16 open questions
- **Code review of existing work** — paste the file, ask for analysis
- **Debugging a single nasty bug** — less overhead than spinning up the agent

Use Claude Code for:
- **Multi-file changes** — when a feature touches 3+ files
- **Mechanical item batches** — running through a list of 4A items
- **Migrations + refactors** — anything systematic across the codebase
- **Full feature builds** — when you have clear acceptance criteria

### 17.8 — The one-line summary of §17

> Tell Claude Code exactly which items it can run solo, which need your input, stop-triggers that override both, and never accept a "done" report without reading the diff.

---

*End of plan.*
