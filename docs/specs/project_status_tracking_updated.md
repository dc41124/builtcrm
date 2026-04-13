# BuiltCRM — Project Status & Tracking
## Updated: April 13, 2026 — End of Session 19 (DESIGN SPRINT COMPLETE)

---

## Completed — All Design Sprints (19 of 19)

### Design System
- [x] Design tokens (DM Sans + Instrument Sans + JetBrains Mono, warm neutral palette, spacing, radii, shadows)
- [x] Layout: white sidebar, gray canvas (#eef0f3), white cards
- [x] Four portal accent colors: purple (#5b4fc7) contractor, teal (#2a7f6f) residential, blue-steel (#3d6b8e) subcontractor, blue (#3178b9) commercial
- [x] Shared shell pattern (sidebar, topbar, navigation, breadcrumbs)
- [x] Icon direction: stroke-width 2.4, construction-appropriate
- [x] No emojis anywhere — all icons are inline SVGs from shared set

### Schema — 36 Tables + 2 Modifications (Complete)
- [x] First pass (15 tables): users, organizations, organization_users, role_assignments, projects, memberships, documents, document_links, upload_requests, billing_packages, compliance_records, activity_feed_items, audit_events
- [x] V2 additions (7 tables): rfis, rfi_responses, change_orders, milestones, conversations, conversation_participants, messages
- [x] Phase 3 billing (6 tables): schedule_of_values, sov_line_items, draw_requests, draw_line_items, lien_waivers, retainage_releases
- [x] Remaining gaps (5 tables): invitations, selection_categories, selection_items, selection_options, selection_decisions
- [x] Phase 4 integrations (4 tables): integration_connections, sync_events, payment_transactions, webhook_events
- [x] Table mods: projects (+contract_value_cents, +address), activity_feed_items (+actor_user_id)
- [ ] **Pending schema addition:** change_orders.schedule_days_impact INTEGER
- [ ] **Pending schema addition:** potential approval_items table

### Designed Pages — All Production-Ready Mockups
| File | Page | Portal(s) |
|------|------|-----------|
| phase_1_design_system_shared_shell.html | Design system + shell reference | Shared |
| phase_3_billing_draw_workspace.html | AIA G702/G703 billing workspace | Contractor |
| residential_selections_flow.html | Full selections interaction | Residential Client |
| rfi_workflow_paired.html | RFI/Issue workspace + response page | Contractor + Subcontractor |
| change_orders_workflow.html | CO management + review + scope changes | Contractor + Commercial + Residential |
| approvals_workflow.html | Approvals workspace + center + decisions | Contractor + Commercial + Residential |
| compliance_workflow_paired.html | Compliance tracking + submission | Contractor + Subcontractor |
| billing_draw_client_review.html | Draw review + approval | Commercial Client |
| selections_management_contractor.html | Selections admin + curation | Contractor |
| upload_requests_workflow_paired.html | Upload request + response flow | Contractor + Subcontractor |
| messages_conversations_shared.html | Thread-based messaging | All portals |
| documents_file_management_shared.html | File browser + category tree | All portals |
| schedule_timeline_shared.html | Milestone-based timeline | All portals |
| payment_financial_view_shared.html | Financial overview + billing | Contractor + Subcontractor |
| contractor_project_home.html | Project home refresh | Contractor |
| subcontractor_today_board_project_home.html | Today Board + Project Home | Subcontractor |
| commercial_client_portal_pages.html | Progress, Photos, Documents, Payment | Commercial Client |
| residential_client_portal_pages.html | Progress & Photos, Documents, Budget | Residential Client |
| login_auth_flow.html | Login, signup, password reset, portal selector | All portals |
| client_onboarding_flow.html | Invitation → account creation → welcome | Both Clients |
| marketing_website.html | 4-page marketing site with full resources content | Public-facing |
| contractor_settings_integrations.html | Settings: Integrations + Payments management | Contractor |
| phase_2_contractor_dashboard.html | Contractor dashboard | Contractor |
| subcontractor_today_board.html | Subcontractor today board | Subcontractor |

**Legacy prototypes (pre-design-system, NOT for implementation):**

| File | Notes |
|------|-------|
| contractor_dashboard_tier_1_v_3_refined.html | Uses Inter font, old tokens, wrong accent. Superseded by contractor_project_home.html. |
| client_project_home_tier_1_v_2_refined.html | Same old token system. Superseded by commercial_client_portal_pages.html. |

### Integration Architecture (Session 18)
- [x] Full integration architecture spec (integration_architecture_spec.md)
- [x] Phase 4 schema (4 tables): integration_connections, sync_events, payment_transactions, webhook_events
- [x] Contractor settings / integrations UI mockup

### Session 19 Final Audit Results
- [x] Design token consistency verified across all production files
- [x] Portal accent colors correct in all files (4 accent sets confirmed)
- [x] Font stack correct everywhere (DM Sans / Instrument Sans / JetBrains Mono)
- [x] Schema-to-mockup coverage complete (all 36 tables map to mockup features)
- [x] Integration spec aligns with billing/payment mockups (draw approval → invoice push, Stripe Connect → Pay Now)
- [x] All V2 deferred items documented (28 items)
- [x] Legacy Tier 1 files identified and marked
- [x] Sidebar width intentional variation documented (272px/260px/256px by portal complexity)
- [x] Implementation normalization items catalogued (theme class names, duration vars, spacing tokens)

### Key Product Decisions
- Builder-curated selections model for v1 (not AI)
- Financial health strip on dashboard → dedicated Financials module
- Compliance banner always visible in subcontractor sidebar
- Commercial vs residential portals with distinct tone, color, features
- Onboarding: invitation token → account creation → welcome
- Residential uses "Scope Changes" not "Change Orders"
- Residential uses "Decisions" not "Approvals"
- Schedule view added to subcontractor sidebar
- Daily logs and formal submittals deferred to v2
- Production mindset — designing for real contractors
- Paired workflow design pattern: build contractor + response side together
- Cross-type approvals queue (COs, procurement, design, general)
- Pill overflow fix: white-space nowrap, flex-shrink 0, font-size 10px — apply globally
- Auth: portal selector is edge case only, most users route directly to single portal
- Commercial client documents: curated subset with owner upload capability
- Commercial payment history: full draw ledger + lien waiver tracking + change order financial summary
- Residential Progress & Photos combined into single page (not split like commercial)
- Residential Budget page: milestone-based payments, selections impact, educational tone
- Residential Documents: homeowner uploads (HOA approvals, insurance, signed selections, loan docs)
- Marketing site: warm #faf9f7 background (distinct from app's #eef0f3), editorial feel
- Brand: contractor purple #5b4fc7 leads on marketing site, portal colors appear on Solutions page
- Pricing: SMB-tier (Starter $119-149/mo, Professional $319-399/mo, Enterprise custom)
- FAQ styled as messages module replica — sells messaging while answering questions
- Interactive demos: native embed with synthetic data, full-screen modal (post-build, not mockup phase)
- Free trial: 14-day Professional tier, no credit card, nudge at day 10-12, downgrade/pay at day 14
- Hero product shot: full HTML/CSS dashboard mockup (not image) — resolution-independent, updates with product

### Session-Specific Decision Log

#### Session 12 Decisions (Contractor Project Home Refresh)
- Contacts strip promoted to horizontal bar between hero and KPI cards
- Sidebar reorganized into: Workspace (global), Projects, Operations (project-scoped), Resources (project-scoped)
- Operations section: Project Home, RFIs, Change Orders, Approvals, Compliance, Selections, Upload Requests
- Resources section: Documents, Schedule, Financials, Billing/Draws
- Summary strip expanded to 5 KPIs: Current Phase, Approvals Waiting, Open RFIs, Compliance %, Billing Progress
- Hero actions: New RFI, Upload Document, Create Draw, Send Message
- Right rail: Current Blockers (danger-tinted), Upcoming Milestones (with countdown), Quick Access module links

#### Session 13 Decisions (Subcontractor Today Board + Project Home Refresh)
- Single file with view switcher for both surfaces
- Blue-steel #3d6b8e accent throughout
- Compliance banner always visible in sidebar (per product decision)
- Sidebar: Workspace, Projects, Project Scope (RFIs, Compliance, Upload Responses, Documents, Schedule, Financials)
- Today Board: cross-project execution surface with "What needs attention now", "Today across projects", "GC requests waiting on you", "Payment status"
- Today Board tabs: My Work, RFIs, Upload Responses, Compliance, Documents, Messages, Payments
- Today Board rail: Compliance state, Quick access, Current project focus
- Project Home: project-scoped with 5-KPI strip (Your Scope, Open RFIs, GC Requests, Compliance, Payment)
- Project Home tabs: My Work, RFIs, Upload Responses, Compliance, Documents, Messages, Schedule
- Project Home rail: Milestones with countdown, Quick access, GC contacts

#### Session 14 Decisions (Commercial Client Portal Pages)
- 4 new pages built in single file with tab switcher: Progress & Updates, Photos, Documents, Payment History
- Progress & Updates: phase progress overview, filter bar, formal weekly report feed with embedded metrics
- Photos: stats bar, category filters, chronological photo sets, 4-column grid with hover overlays
- Documents: upload zone for owner docs, category browser, owner uploads visually distinguished
- Payment History: 4 summary KPIs, segmented progress bar, lien waiver summary, full payment ledger
- Lien waiver visibility: commercial clients see unconditional lien waiver collection status per draw

#### Session 15 Decisions (Residential Client Portal Pages)
- 3 pages in single file with tab switcher: Progress & Photos, Documents, Budget
- Progress & Photos COMBINED (not split like commercial) — homeowners want one feed, not two tabs
- Budget page: milestone-based payment schedule, selections impact bar, total investment tracker
- Budget tone: educational, uses "Investment Summary" not "Payment History"
- Documents: homeowner-specific upload categories (HOA approvals, insurance, signed selections, loan docs)
- Residential teal accent #2a7f6f with softer UI — larger radii, gentler shadows
- Custom document categories deferred to V2

#### Session 16 Decisions (Marketing Website)
- 4-page marketing site: Home (Product), Solutions, Pricing, Resources
- NOT inside the app shell — full-width marketing layout with sticky nav, hero sections, card grids, footer
- Warm #faf9f7 background (softer/warmer than app's #eef0f3) for editorial feel
- DM Sans + Instrument Sans carried from design system
- Hero: "Run your builds, not your inbox" — confident, not corporate buzzword soup
- "Get Started Free" CTA on homepage + persistent header CTA
- Login button in header as bridge to auth flow
- Trust bar with placeholder company names (Summit Contracting, Ridgeline Builders, etc.)
- 6 feature cards: AIA billing, RFIs, Client portals, Selections, Compliance, Schedule
- Solutions page: audience-segmented tabs (GC, Sub, Commercial Owner, Homeowner) with portal accent colors
- Pricing: 3 tiers — Starter $119-149/mo, Professional $319-399/mo, Enterprise custom
- Annual/monthly toggle with 20% save badge
- Subs and clients always free (included in plan)
- FAQ styled as chat bubbles between user roles (Homeowner, GC, Commercial Owner) and BuiltCRM support
- Resources: filterable card grid (Blog, Guides, Case studies) with placeholder content
- Footer: 4-column layout (Brand + Product + Solutions + Company)

#### Session 17 Decisions (Marketing Website Part 2 — Resources Content + Polish)
- Resources page: 6 card grid now clickable, each opens full-screen article overlay with editorial formatting
- Article overlays: sticky back nav, header with category badge + meta bar, prose body with h2/h3, blockquotes, callout boxes, stat highlights, and bottom CTA
- 6 articles written: 2 blogs, 2 guides, 2 case studies
- Case studies include fictional but realistic stats, quotes, and company profiles
- Resource card thumbnails upgraded to subtle SVG illustrations per category
- Pricing FAQ: chat bubbles replaced with messages module replica
- Solutions page: 4 gray placeholder preview boxes replaced with mini SVG wireframe mockups of each portal
- Homepage product preview: placeholder replaced with full HTML/CSS contractor dashboard mockup inside browser chrome frame
- Interactive demos deferred to product build phase

#### Session 18 Decisions (Integrations Planning)
- Integration philosophy: BuiltCRM is system of record, integrations are connectors not features, tier-gated
- Accounting: QuickBooks Online (priority), Xero, Sage Business Cloud — event-driven push + daily reconciliation pull
- Draw approval triggers invoice push to accounting. Daily job pulls payment status back.
- Payment processing: Stripe Connect (Standard accounts) — ACH for draws ($5 cap), card for selections
- Contractors onboard via Stripe's hosted flow, manage own payouts/KYC
- Clients pay as guests — ACH or card via Stripe Elements, can save payment methods
- Email bridging: outbound notifications (all tiers) + reply-by-email via signed reply-to addresses
- Calendar: iCal feeds for V1 (all tiers, no OAuth needed), direct Google/Outlook integration V2
- PM tool migration: CSV/Excel self-service import (Professional), assisted Procore/Buildertrend (Enterprise)
- Webhook API: Enterprise outbound event stream, HMAC-SHA256 signed, 6-attempt retry
- All sync via Trigger.dev background jobs — never in request path
- Idempotency keys: {provider}:{entity_type}:{builtcrm_id}:{action}:{version}
- OAuth tokens encrypted at rest (AES-256-GCM), per-org encryption keys
- Integration connections scoped to organization, not user — only org admins manage
- Conflict resolution: BuiltCRM wins on billing data, accounting wins on payment data
- Settings sidebar structure: Organization, Connections, Data, Security, Preferences
- 4 new schema tables: integration_connections, sync_events, payment_transactions, webhook_events
- Total schema: 36 tables + 2 modifications
- Implementation phases: Phase 1 (email + CSV + iCal + Stripe), Phase 2 (QB + reply-by-email + CSV import), Phase 3 (Xero + webhooks + Google Cal), Phase 4 (Sage + migrations + SSO)

#### Session 19 Findings (Final Audit + Consistency Pass)
- All 22+ production HTML files use correct design system tokens
- All portal accent colors verified correct across every file
- All fonts correct (DM Sans / Instrument Sans / JetBrains Mono — no Inter/Roboto anywhere)
- 2 legacy Tier 1 files identified as pre-design-system (wrong tokens, fonts, dimensions) — marked as non-production
- Sidebar widths vary by portal type (272/260/256px) — documented as intentional
- Theme class naming inconsistency found: `.app.sub-theme` vs `.app.sub`, `.app.commercial` vs `.app.comm-theme` — normalize during implementation
- Duration variable naming inconsistency: `--dur-*` vs `--duration-*` with some value drift — normalize to `--dur-fast:120ms / --dur-normal:200ms / --dur-slow:350ms`
- Spacing tokens (--sp-*) declared in only 7 of 22 files — others use identical hardcoded px values — normalize during implementation
- Schema-to-mockup coverage complete: all 36 tables map to at least one mockup feature
- Integration spec billing flow aligns with draw workspace + client billing review mockups
- Stripe Connect payment flow aligns with client-facing "Pay Now" action in billing review
- All 28 V2 deferred items documented in both tracking documents

---

## V2 Deferred Items (28 total)
- AI selection inspiration
- Daily logs / field reports
- Formal submittals
- Dark mode
- Mobile optimization
- Predictive dashboard
- Selection enhancements (ranking, bundling, AR, availability)
- Punch list
- Full notification center
- Global search
- Scheduling (Gantt-style, beyond milestones)
- Procurement / purchase orders
- Warranty tracking
- Notification preferences / digest settings
- Multi-project dashboard views
- Report generation / export
- Custom document categories (user-created, all 3 portals) ← Session 15
- Interactive demos: Solutions page links into live portal mockups with synthetic data ← Sessions 16–17
- Marketing nav: 4 pages become dropdown menus with sub-sections ← Session 16
- Figma/Framer/Canva connector for custom V2 design work ← Session 16
- Proper dedicated landing page (conversion-focused, A/B testable) ← Session 17
- Free trial mechanics: 14-day Professional tier, nudge emails at day 10-12, downgrade/pay at day 14 ← Session 17
- Google Drive / Dropbox document sync ← Session 18
- Zapier / Make connector ← Session 18
- BuiltCRM public REST API (beyond webhooks) ← Session 18
- AI-powered accounting data mapping ← Session 18
- Multi-currency support (CAD/USD) ← Session 18
- Sage 300 on-prem connector ← Session 18

---

## Schema File Index
| File | Tables |
|------|--------|
| drizzle_schema_first_pass.ts | 1–15 |
| drizzle_schema_v2_additions.ts | 16–22 |
| drizzle_schema_phase3_billing.ts | 23–28 |
| drizzle_schema_remaining_gaps.ts | 29–33 + mods |
| drizzle_schema_phase4_integrations.ts | 33–36 |

---

## Design Sprint Complete — No Further Design Sessions

This document and the master module map are now in their final state. The design sprint produced 24 production HTML mockups, 5 schema files (36 tables), 1 integration architecture spec, and 1 marketing website — all following a unified design system across 4 portal types.

### Build Strategy (Decided Post-Sprint)

**Resume project context:** BuiltCRM is a portfolio project — built to market-ready quality but won't be shared publicly or have customers. No V1 ship deadline, no customer migration concerns.

**Approach:** Build the backend once (full stack), redesign UI in Figma before building frontend, build frontend once at final quality. The 24 HTML mockups serve as the feature spec, not the pixel-for-pixel implementation target.

**Build order:**
1. Full backend (Better Auth + Drizzle + Trigger.dev + R2 + Docker on Render) — follow First Implementation Slice Spec
2. Figma UI redesign (can overlap with Step 1) — dark mode, mobile, refined components, polish
3. Frontend build from Figma designs (one pass, final quality)
4. V2 features (28 deferred items — additive, no rearchitecting)

**No Supabase prototype step.** The real stack is the only stack. See master module map "Build Strategy" section for full details.

Next step: implementation using the Build Execution Checklist, Technical Architecture Prep, Engineering Architecture Layer, and First Implementation Slice Spec as guides.
