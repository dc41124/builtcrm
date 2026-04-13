# BuiltCRM — Master Module Map
## Design Sprint Tracking Document

**Last updated:** April 13, 2026 — End of Session 19 (Final Audit + Consistency Pass)
**Status:** DESIGN SPRINT COMPLETE — 19 sessions, all modules production-ready
**Organization:** Shared modules → Paired workflow modules → Portal-specific modules → Product chrome → Integrations → V2 deferred

---

## How This Document Works

Every module in BuiltCRM falls into one of four categories:

- **Shared modules** — Same interaction pattern adapted per portal (accent color, tone, scoping). Design the pattern once, then apply it three or four times.
- **Paired workflow modules** — Contractor initiates, another portal responds. Designed together so data flow and handoffs are coherent end-to-end.
- **Portal-specific modules** — Unique to one portal. No paired surface elsewhere.
- **Product chrome** — Landing page, auth, onboarding, notifications, settings.

**Status key:**
- ✅ Done — Production-ready mockup exists
- ⏸️ V2 — Deferred to post-launch

---

## Foundation Layer (Complete)

| Asset | Status | File |
|-------|--------|------|
| Design system + tokens | ✅ Done | phase_1_design_system_shared_shell__1_.html |
| Shared shell pattern | ✅ Done | (embedded in all production files) |
| Schema (36 tables + 2 mods) | ✅ Done | drizzle_schema_*.ts (5 files) |
| Contractor billing draw workspace | ✅ Done | phase_3_billing_draw_workspace.html |
| Client onboarding flow | ✅ Done | client_onboarding_flow.html |

**Legacy Tier 1 prototypes (pre-design-system, NOT production-ready):**

| Asset | File | Why it's legacy |
|-------|------|-----------------|
| Contractor dashboard (Tier 1) | contractor_dashboard_tier_1_v_3_refined.html | Uses Inter font, old token names (--bg/--panel/--text), wrong accent (#1d4ed8 blue), 300px sidebar, 64px topbar. Superseded by contractor_project_home.html (Session 12) + phase_2_contractor_dashboard.html. |
| Commercial client project home (Tier 1) | client_project_home_tier_1_v_2_refined.html | Same old token system as above. Superseded by commercial_client_portal_pages.html (Session 14). |

These files remain in the project for historical reference but should not be used as implementation targets. All production mockups use the design system established in Session 1.

---

## 1. Shared Modules

### 1A. Messages / Inbox — ✅ DONE (Session 8)
**Schema:** conversations, conversation_participants, messages · **File:** messages_conversations_shared.html
**Key features:** Master-detail inbox, 4-portal views (contractor, sub, commercial, residential), conversation type pills (General/RFI/CO/Approval), linked workflow jump chips, unread tracking, typing indicators, system messages, compose with attachments, portal-specific language and scoping.

### 1B. Documents Browser — ✅ DONE (Session 9)
**Schema:** documents, document_links · **File:** documents_file_management_shared.html
**Key features:** File browser with category tree, version history, document_links for object references, visibility-scoped per audience, upload with type/visibility/linking, bulk download/share, superseded version tracking.

### 1C. Schedule / Timeline — ✅ DONE (Session 10)
**Schema:** milestones · **File:** schedule_timeline_shared.html
**Key features:** Milestone-based timeline with phase grouping, client timelines curated and tone-appropriate, countdown indicators, status tracking.

### 1D. Payment / Financial View — ✅ DONE (Session 11)
**Schema:** All billing tables · **File:** payment_financial_view_shared.html
**Key features:** Contract summary → billing progress → draw history → sub payment rollup → retainage. Contractor and subcontractor views.

---

## 2. Paired Workflow Modules

### 2A. RFIs — ✅ DONE (Session 2)
| Surface | Portal | File |
|---------|--------|------|
| RFI workspace (create, track, escalate) | Contractor | rfi_workflow_paired.html |
| RFI response page (completeness gating) | Subcontractor | rfi_workflow_paired.html |

**Key features:** Master-detail queue, issue vs formal RFI branching, escalation mechanics, response completeness gating, create form.

### 2B. Change Orders — ✅ DONE (Session 3)
| Surface | Portal | File |
|---------|--------|------|
| CO management workspace | Contractor | change_orders_workflow.html |
| Scope change review | Commercial Client | change_orders_workflow.html |
| Scope change review | Residential Client | change_orders_workflow.html |

**Key features:** Multi-type CO queue, cost/schedule impact, approval flow, negotiation mechanics, client-facing "Scope Changes" language.

### 2C. Approvals — ✅ DONE (Session 3)
| Surface | Portal | File |
|---------|--------|------|
| Approvals workspace | Contractor | approvals_workflow.html |
| Approval center | Commercial Client | approvals_workflow.html |
| Decisions | Residential Client | approvals_workflow.html |

**Key features:** Cross-type queue (CO, procurement, design, general), decision options (approve/with note/return/reject), delegation, residential "Decisions" language.

### 2D. Compliance — ✅ DONE (Session 4)
| Surface | Portal | File |
|---------|--------|------|
| Compliance workspace + scorecard | Contractor | compliance_workflow_paired.html |
| Compliance submission page | Subcontractor | compliance_workflow_paired.html |

**Key features:** Org-level scorecard, COI verification checklist, restriction mechanics, payment hold linkage.

### 2E. Billing / Draw Review — ✅ DONE (Session 5)
| Surface | Portal | File |
|---------|--------|------|
| Billing draw workspace | Contractor | phase_3_billing_draw_workspace.html |
| Billing/draw review | Commercial Client | billing_draw_client_review.html |

**Key features:** AIA G702/G703, SOV table, retainage, lien waivers, client approval with line-item review, contract financial snapshot in client billing rail.

### 2F. Upload Requests — ✅ DONE (Session 7)
| Surface | Portal | File |
|---------|--------|------|
| Upload requests workspace | Contractor | upload_requests_workflow_paired.html |
| Upload response page | Subcontractor | upload_requests_workflow_paired.html |

**Key features:** Full lifecycle (Open→Submitted→Accepted/Completed), file type expectations, completeness awareness, related object linking, accept & close / request revision actions.

---

## 3. Portal-Specific Modules

### 3A. Contractor Project Home (refresh) — ✅ DONE (Session 12)
**File:** contractor_project_home.html
**Key features:** Contacts strip promoted above KPIs, sidebar organized into Operations + Resources, 5-KPI strip, hero actions (New RFI, Upload Document, Create Draw, Send Message), right rail (Current Blockers, Upcoming Milestones, Quick Access module links).

### 3B. Subcontractor Today Board + Project Home (refresh) — ✅ DONE (Session 13)
**File:** subcontractor_today_board_project_home.html
**Key features:** Dual-view file with view switcher. Today Board is cross-project execution surface; Project Home is project-scoped. Blue-steel #3d6b8e accent. Compliance banner always visible in sidebar.

### 3C. Commercial Client Portal Pages — ✅ DONE (Session 14)
**File:** commercial_client_portal_pages.html
**Key features:** 4 pages with tab switcher: Progress & Updates (phase progress + weekly report feed), Photos (category filters + 4-column grid), Documents (owner upload zone + curated subset), Payment History (draw ledger + lien waiver tracking + change order financial summary).

### 3D. Residential Client Portal Pages — ✅ DONE (Session 15)
**File:** residential_client_portal_pages.html
**Key features:** 3 pages with tab switcher: Progress & Photos (combined — homeowners want one feed), Documents (simpler categories + upload zone), Budget (milestone-based payments + selections impact + educational tone).

### 3E. Selections Management (Contractor side) — ✅ DONE (Session 6)
**File:** selections_management_contractor.html
**Key features:** Contractor-curated selections admin, allowance-based pricing, draft→published lifecycle, option curation and recommendation tagging.

### 3F. Residential Selections (Client side) — ✅ DONE (Session 6)
**File:** residential_selections_flow.html
**Key features:** Full selections interaction — browse, compare, provisional select, confirm, revision window. Allowance vs upgrade pricing, lead time impact, swatch previews.

---

## 4. Product Chrome

### 4A. Marketing Website — ✅ DONE (Sessions 16–17)
**File:** marketing_website.html
**Key features:** 4-page marketing site (Home, Solutions, Pricing, Resources). Warm #faf9f7 background, editorial feel. Hero with full HTML/CSS dashboard mockup. Solutions with portal-segmented tabs. Pricing with 3 tiers. FAQ as messages module replica. Resources with 6 full articles (blogs, guides, case studies).

### 4B. Login / Auth Flow — ✅ DONE (Session 17)
**File:** login_auth_flow.html
**Key features:** 5 screens (login, forgot password, email sent, reset password, portal selector). SSO placeholder. Edge-case portal routing for multi-portal users.

### 4C. Client Onboarding Flow — ✅ DONE (earlier sprint)
**File:** client_onboarding_flow.html
**Key features:** Invitation token → account creation → welcome screen.

### 4D. Contractor Settings / Integrations — ✅ DONE (Session 18)
**File:** contractor_settings_integrations.html
**Key features:** Full settings sidebar (Organization, Connections, Data, Security, Preferences). Integration card grid with connect/disconnect. QuickBooks detail panel with health strip, project mapping, sync activity log. Payments view with Stripe Connect, payment methods, transaction list.

### 4E. Notification Center — ⏸️ V2

---

## 5. Integration Architecture (Session 18)

### 5A. Integration Architecture Spec — ✅ DONE
**File:** integration_architecture_spec.md
**Covers:** Accounting (QuickBooks/Xero/Sage), payment processing (Stripe Connect), email bridging, calendar sync, PM tool migration, webhook API, tier gating, security, implementation phasing.

### 5B. Integration Schema — ✅ DONE
**File:** drizzle_schema_phase4_integrations.ts
**Tables:** integration_connections, sync_events, payment_transactions, webhook_events (tables 33–36).

---

## 6. V2 Deferred

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
- Custom document categories (user-created, all 3 portals)
- Interactive demos (live portal mockups with synthetic data)
- Marketing nav dropdown menus with sub-sections
- Figma/Framer/Canva connector for custom design work
- Proper dedicated landing page (conversion-focused, A/B testable)
- Free trial mechanics (14-day Professional tier, nudge emails)
- Google Drive / Dropbox document sync
- Zapier / Make connector
- BuiltCRM public REST API (beyond webhooks)
- AI-powered accounting data mapping
- Multi-currency support (CAD/USD)
- Sage 300 on-prem connector

---

## Global Design Notes — Apply to All Modules

1. **Pill overflow fix:** All `.pill` elements must use `white-space: nowrap; flex-shrink: 0; font-size: 10px`. Parent flex containers use `min-width: 0; flex: 1` on the text side.

2. **Portal accent colors (confirmed production):**
   - Contractor: purple `#5b4fc7`
   - Subcontractor: blue-steel `#3d6b8e`
   - Residential Client: teal `#2a7f6f`
   - Commercial Client: blue `#3178b9`

3. **Residential language rules:**
   - "Change Orders" → "Scope Changes"
   - "Approvals" → "Decisions"
   - "RFIs" → not shown to residential (activity feed only)
   - Tone is conversational, explanation-forward, non-intimidating

4. **Pending schema additions:**
   - `change_orders.schedule_days_impact INTEGER` — structured schedule impact
   - Potential `approval_items` table if cross-type pattern grows

5. **Design system fonts:** DM Sans (display), Instrument Sans (body), JetBrains Mono (codes). Never Inter/Roboto/system defaults.

6. **Paired workflow pattern:** When designing modules, always build contractor + response side in the same file with portal switching. This ensures data flow coherence.

7. **No emojis anywhere** — all icons are inline SVGs from shared set.

8. **Sidebar widths by portal (intentional variation):**
   - Contractor / Subcontractor / Shared modules: `272px`
   - Commercial Client: `260px` (simpler nav, narrower)
   - Residential Client: `256px` (simplest nav, narrowest)
   - Marketing site: no sidebar (full-width marketing layout)

9. **Implementation normalization notes (from Session 19 audit):**
   - **Theme class naming:** Standardize to `.app.sub-theme` / `.app.comm-theme` / `.app.resi-theme` pattern (currently mixed with bare `.app.commercial` / `.app.residential` / `.app.sub` in some files)
   - **Duration variables:** Standardize to `--dur-fast: 120ms` / `--dur-normal: 200ms` / `--dur-slow: 350ms` (currently mixed `--dur-*` and `--duration-*` naming, with occasional value drift to 250ms/400ms)
   - **Spacing tokens:** Standardize `--sp-*` tokens across all files (currently only 7 of 22 files declare them; others hardcode identical px values)
   - These are cosmetic naming inconsistencies — the actual visual output is consistent across all files. Normalize during implementation, not mockup phase.

---

## Schema File Index

| File | Tables |
|------|--------|
| drizzle_schema_first_pass.ts | 1–15 (identity, projects, documents, workflows, billing, compliance, audit) |
| drizzle_schema_v2_additions.ts | 16–22 (rfis, rfi_responses, change_orders, milestones, conversations, conversation_participants, messages) |
| drizzle_schema_phase3_billing.ts | 23–28 (schedule_of_values, sov_line_items, draw_requests, draw_line_items, lien_waivers, retainage_releases) |
| drizzle_schema_remaining_gaps.ts | 29–32 + mods (invitations, selection_categories, selection_items, selection_options, selection_decisions + project/activity mods) |
| drizzle_schema_phase4_integrations.ts | 33–36 (integration_connections, sync_events, payment_transactions, webhook_events) |

**Total: 36 tables + 2 table modifications**

---

## Session History

| Session | Module | Type | File(s) |
|---------|--------|------|---------|
| 1 | Design System + Shell | Foundation | phase_1_design_system_shared_shell__1_.html |
| 2 | RFIs | Paired workflow | rfi_workflow_paired.html |
| 3 | Change Orders + Approvals | Paired workflow | change_orders_workflow.html, approvals_workflow.html |
| 4 | Compliance | Paired workflow | compliance_workflow_paired.html |
| 5 | Billing/Draw Client Review | Paired workflow | billing_draw_client_review.html |
| 6 | Selections (Contractor + Residential) | Portal-specific | selections_management_contractor.html, residential_selections_flow.html |
| 7 | Upload Requests | Paired workflow | upload_requests_workflow_paired.html |
| 8 | Messages / Conversations | Shared | messages_conversations_shared.html |
| 9 | Documents / File Management | Shared | documents_file_management_shared.html |
| 10 | Schedule / Timeline | Shared | schedule_timeline_shared.html |
| 11 | Payment / Financial View | Shared | payment_financial_view_shared.html |
| 12 | Contractor Project Home refresh | Portal-specific | contractor_project_home.html |
| 13 | Sub Today Board + Project Home | Portal-specific | subcontractor_today_board_project_home.html |
| 14 | Commercial Client Portal Pages | Portal-specific | commercial_client_portal_pages.html |
| 15 | Residential Client Portal Pages | Portal-specific | residential_client_portal_pages.html |
| 16 | Marketing Website | Product chrome | marketing_website.html |
| 17 | Marketing Website Part 2 + Login/Auth | Product chrome | marketing_website.html, login_auth_flow.html |
| 18 | Integrations Planning | Integrations | integration_architecture_spec.md, drizzle_schema_phase4_integrations.ts, contractor_settings_integrations.html |
| 19 | Final Audit + Consistency Pass | Wrap-up | builtcrm_master_module_map.md, project_status_tracking_updated.md |

---

## Design Sprint Complete

**19 sessions. 24 production HTML mockups. 2 spec documents. 5 schema files (36 tables). 1 design system.**

All modules designed, all schemas written, all cross-file consistency verified. The next phase is implementation.

---

## Build Strategy

### Project Context

BuiltCRM is a resume/portfolio project. The goal is to build something that could legitimately ship to market — real architecture, real workflows, real data layer — but it won't have customers. It will run on a default domain from the hosting provider. This means there's no V1 ship deadline, no customer migration concerns, and no reason to build throwaway UI.

### Key Insight: Build the Backend Once, Build the Frontend Once

The 24 HTML mockups from Sessions 1–19 are the **feature spec**, not the implementation target. They define every workflow, every data relationship, every portal variation, and every screen. The frontend implementation will be built from a Figma redesign pass (V2 quality) rather than recreating the V1 mockups pixel-for-pixel and then tearing them down.

### Build Order

**Step 1 — Full backend buildout**
Schema, auth (Better Auth), memberships, all workflows, background jobs (Trigger.dev), file storage (R2), integrations. Use the HTML mockups as the feature spec for what each API endpoint, loader, and action needs to support. Follow the First Implementation Slice spec for initial architecture proof, then build out remaining modules.

Reference docs: Technical Architecture Prep, Engineering Architecture Layer, First Implementation Slice Spec, Build Execution Checklist.

Implementation slice order (from First Implementation Slice Spec):
1. Slice A — Identity + project access (Better Auth, orgs, projects, memberships, context resolver)
2. Slice B — Shared project read layer (contractor/sub/client home loaders, same project → different shaped views)
3. Slice C — Scoped files (document metadata, upload flow, signed access, portal-scoped visibility)
4. Slice D — First real workflow (upload requests + scoped file submission)
5. Remaining modules following design sprint order: RFIs → Change Orders → Approvals → Compliance → Billing/Draw → Selections → Messages → Documents → Schedule → Payments → Settings/Integrations

**Step 2 — Figma UI redesign**
Before building React components, redesign all screens in Figma using the V1 mockups as feature reference. This is where dark mode, mobile responsive layouts, refined component library, micro-interactions, and visual polish happen. Can run in parallel with Step 1 backend work.

**Step 3 — Frontend build (once, at final quality)**
Build React components against the working backend using the finalized Figma designs. One build pass. No throwaway UI work. Every component is production quality from the start.

**Step 4 — V2 features (28 deferred items)**
Daily logs, punch list, notification center, Gantt scheduling, global search, predictive dashboard, and the rest of the V2 deferred list. These add new screens and new backend modules on top of the working app. Each item gets its own Figma design before frontend implementation.

### What This Means in Practice

- The HTML mockups remain the authoritative feature spec throughout implementation
- Backend can be built and tested with minimal UI (basic forms, data tables) while Figma work happens
- No Supabase prototype step — the real stack (Next.js + Drizzle + Better Auth + Trigger.dev + R2 + Docker on Render) is the only stack
- V2 deferred items are additive — they don't require rearchitecting anything from Steps 1–3
- Marketing website (marketing_website.html) ships separately and can use the V1 mockup design directly since it's already polished and doesn't need the Figma revamp

---

### Complete File Inventory

**Production mockups (24 HTML files):**
phase_1_design_system_shared_shell__1_.html, rfi_workflow_paired.html, change_orders_workflow.html, approvals_workflow.html, compliance_workflow_paired.html, phase_3_billing_draw_workspace.html, billing_draw_client_review.html, selections_management_contractor.html, residential_selections_flow.html, upload_requests_workflow_paired.html, messages_conversations_shared.html, documents_file_management_shared.html, schedule_timeline_shared.html, payment_financial_view_shared.html, contractor_project_home.html, subcontractor_today_board_project_home.html, commercial_client_portal_pages.html, residential_client_portal_pages.html, marketing_website.html, login_auth_flow.html, client_onboarding_flow.html, contractor_settings_integrations.html, phase_2_contractor_dashboard.html, subcontractor_today_board.html

**Legacy prototypes (2 HTML files — not production-ready):**
contractor_dashboard_tier_1_v_3_refined.html, client_project_home_tier_1_v_2_refined.html

**Schema (5 TypeScript files):**
drizzle_schema_first_pass.ts, drizzle_schema_v2_additions.ts, drizzle_schema_phase3_billing.ts, drizzle_schema_remaining_gaps.ts, drizzle_schema_phase4_integrations.ts

**Specs and tracking (4 Markdown/PDF files):**
integration_architecture_spec.md, builtcrm_master_module_map.md, project_status_tracking_updated.md, plus reference PDFs
