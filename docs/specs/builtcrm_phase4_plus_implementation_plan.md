# BuiltCRM — Phase 4+ Segmented Implementation Plan

**Date:** April 16, 2026
**Purpose:** Consolidated implementation plan merging your Phase 4 list, Phase 3 handoff deferrals, and all 85+ gaps identified in the 2026 GC competitive gap analysis
**Status:** Living document — sequence-ready but not locked
**Strategic frame:** Pitching to real GCs, all four portals equally, full competitive landscape

---

## How this document is organized

1. **Strategic decision point** — the one choice that reshapes everything below
2. **Sequencing logic** — the reasoning behind the phase order before jumping to the lists
3. **Phases 4A → 4D** — your existing plan, corrected and expanded with items from the Phase 3 handoff that were missed
4. **Phase 5 — Commercial GC parity** — the commercial-GC module stack the product is missing
5. **Phase 6 — Field/mobile + subcontractor depth** — native app, offline, safety, time/labor
6. **Phase 7 — AI layer** — the competitive AI features needed to not look dated in a 2026 pitch
7. **Phase 8 — Enterprise trust + deal-breaker integrations** — SOC 2, SSO, Bluebeam, ACC, M365
8. **Phase 9 — Canadian compliance moat** — Law 25, Bill 96, CCQ/RBQ/ARQ/CNESST, Ontario 2026, Quebec hypothec — the defensible wedge
9. **Phase 10 — Residential depth + client portal polish** — where residential builders beat BuiltCRM today
10. **V2+ / Strategic deferrals** — things to leave off the near-term plan
11. **Cross-phase sequencing summary** — the full build order in one table
12. **Files to delete / archive after moving this into the project folder**

Every item carries: **effort (S ≤ 1 sprint, M ≈ 1 quarter, L multi-quarter)**, **priority (P0 deal-gate, P1 standard, P2 differentiator, P3 nice-to-have)**, and a **why-it-matters** note.

---

## 1. The strategic decision point

The research surfaced this and it reshapes everything downstream. Before locking sequencing, pick a path:

**Path A — Canadian-native compliance-first positioning.** Lean hard into Law 25, Bill 96 fr-CA, CCQ/ARQ/CNESST/RBQ verification, Ontario 2026 Construction Act, Quebec hypothec denunciation, T5018. Phase 9 moves to the front. You compete on a moat Procore/Buildertrend/JobTread structurally cannot match quickly. Smaller addressable market, higher win rate inside it.

**Path B — Generalist North American mid-market.** Race Procore on drawings, inspections, BIM viewer, bid management, AI parity. Phase 5 and 7 move to the front. Larger addressable market, much longer build, parity fight BuiltCRM will lose on ecosystem depth.

**This document assumes Path A** because it's the winnable fight and aligns with your Quebec base. If you decide Path B, swap Phase 9 with Phase 5 in the sequencing, drop the Quebec-specific items to Phase 10+, and accept that the pitch is commodity until AI parity ships.

The rest of the document assumes Path A unless explicitly called out.

---

## 2. Sequencing logic — the reasoning before the lists

Six principles drive the order:

1. **Ship 4A in the first 2–3 weeks regardless of path.** These are polish items that compound. Demo quality and daily-driver feel depend on them. Do not let them slip behind feature work.

2. **SOC 2 Type II starts immediately (in parallel).** 6–9 month audit window. If not started at kickoff of Phase 4, it blocks enterprise deals for a full calendar year. It runs alongside everything else — it is procedural not product work.

3. **Notification UI ships before anything else in 4B.** Data already writes to DB. One week of work. Every other module feels more alive once the bell works. High-leverage, low-cost, unlocks activation.

4. **Drawings + inspections before any commercial GC pitch.** These are the two modules where a commercial GC walks out of a demo if they're missing. Both are large. Both have to happen in Phase 5. Everything else in Phase 5 is sized around what can ship alongside them without stealing focus.

5. **Pick one AI agent and ship it well, then stop.** The research showed competitors shipped ~15 agent-style features in 2025. Trying to match them is a losing fight. Ship one credible agent (Meeting Minutes + RFI Draft is the recommended pair — one is category-wide gap, one is table stakes). Everything else is Phase 7 Wave 2 or V2+.

6. **Canadian compliance (Phase 9) is the differentiator so it ships before residential/client polish (Phase 10).** Residential polish is nice-to-have. Compliance is the pitch.

**The overall cadence:**
- **Weeks 1–4:** Phase 4A (polish) + SOC 2 kickoff + notification UI
- **Months 2–4:** Phase 4B field workflows + Phase 4D schema work
- **Months 3–6:** Phase 5 commercial parity (drawings, inspections first)
- **Months 4–7:** Phase 7 AI Wave 1 + Phase 8 trust + deal-breaker integrations
- **Months 6–9:** Phase 9 Canadian compliance moat
- **Months 9–12:** Phase 6 field/mobile/sub depth + Phase 10 residential
- **Year 2:** V2+ / Strategic deferrals
- **Phase 4C integrations** slot wherever the underlying workflow module is stable — never before

---

## 3. Phase 4A — Technical debt & polish (corrected and expanded)

**Target:** First 2–3 weeks. Don't let feature work start until this is done. These items make demos feel tight and daily driving feel smooth.

### 4A.1 — Quick wiring fixes (from your list + handoff deferrals)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 1 | `portalHref()` stale paths | S | P1 | Handoff-confirmed broken |
| 2 | Package Documents buttons in billing workspace (wire to real endpoints) | S | P1 | UI-only placeholders today |
| 3 | Nav badge counts: `getPortalNavCounts()` per portal | S | P1 | Known deferred from HANDOFF.md |
| 4 | `const now = Date.now()` hydration sweep | S | P2 | Low risk, no visible bug but worth cleaning |
| 5 | Contractor settings prototype audit (timebox to 4 hours — do not let it balloon) | S | P2 | Known gap, flagged earlier |
| 6 | Sign out button in sidebar footer (user avatar area) | S | P1 | From Phase 3 handoff — you flagged this and forgot |
| 7 | Root URL → products page redirect | S | P1 | From Phase 3 handoff — temporary home |

### 4A.2 — Dark mode wiring

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 8 | Wire dark mode toggle through user settings page globally (remove per-page toggles) | S | P1 | Already deferred from Phase 3 Step 15 |

### 4A.3 — Admin/settings page mockups

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 9 | Contractor portal: Organization page | S–M | P1 | Prototype exists in settings_integrations.html |
| 10 | Contractor portal: Team & Roles page (with actual permission editor, not just display) | M | P1 | Permission wiring was a gap I flagged |
| 11 | Subcontractor portal: Team page | S–M | P1 | **No prototype exists** — needs design pass first |
| 12 | Subcontractor portal: Settings page | S–M | P1 | **No prototype exists** — needs design pass first |

### 4A.4 — Export wiring

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 13 | Export/download endpoints batch: payment PDF, photo zip, receipt links | M | P1 | **Larger than your list suggests** — PDF gen + zip streaming is multi-day per endpoint |

### 4A.5 — Navigation improvement

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 14 | Project navigation dropdown in top bar (you flagged this in the intro) | S–M | P1 | User-mentioned, not on the current list |

### 4A.6 — Moved OUT of 4A (these were miscategorized as polish; they are real features)

- **Contractor cross-project approvals page** → moved to Phase 4D
- **Contractor cross-project payment-tracking page** → moved to Phase 4D
- **Weekly reports table** → moved to Phase 4D (from HANDOFF.md deferred list)
- **Lien waiver sub fan-out (`createWaiverForDraw`)** → moved to Phase 4D (from HANDOFF.md deferred list)

**Phase 4A total:** 14 items, ~3 weeks at 1 FTE.

---

## 4. Phase 4B — Core feature gaps (resequenced for ROI)

**Target:** Months 2–4. Sequenced by user-visible impact per sprint.

### 4B.1 — Notifications (do this first, one week, huge perceived quality jump)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 15 | Full notification center UI (data writes already exist in `activity_feed_items`) | S–M | P1 | Single highest-ROI item in Phase 4 |
| 16 | Notification preferences / digest settings | S | P1 | Natural pairing with the center |
| 17 | Email digest worker (Trigger.dev) | S | P1 | Unlocks day-1 engagement |

### 4B.2 — Global search

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 18 | Global search across projects, RFIs, COs, documents, messages, approvals | M | P1 | Daily-use, independent, high leverage |

### 4B.3 — Field workflow block (build shared primitives once)

Before building individual modules, build the shared primitives: assignable item + status workflow + photo attachment + mobile input view + custom fields. Each module below then becomes ~40% cheaper.

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 19 | **Shared primitives:** assignable item base, status workflow engine, photo attachment, mobile input | M | P1 | Infrastructure for items 20–22 |
| 20 | Daily logs / field reports (simplest — validates the primitives) | M | P1 | Table stakes |
| 21 | Punch list | M | P1 | Table stakes |
| 22 | Formal submittals (ball-in-court, spec section linkage) | M | P1 | Table stakes |

### 4B.4 — Document categories (do before or alongside 4B.3 so modules can attach cleanly)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 23 | Custom document categories (user-created, all 3 portals) | S–M | P1 | Prerequisite for 20–22 attachments |
| 24 | File versioning on documents (pairs with custom categories) | M | P2 | Differentiator; natural pairing |

### 4B.5 — Scheduling (pulled out of 4B into its own mini-phase)

Scheduling (Gantt) at 2–3x any other 4B item should not compete with the items above. Scope to "basic Gantt view" only.

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 25 | Scheduling — basic Gantt (dependencies, critical path, baseline) | L | P2 | Isolated mini-phase, sized |

### 4B.6 — Reporting

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 26 | Report generation / export (PDF, CSV, scheduled email delivery) | M | P1 | Depends on data from 4B.1–4B.4 |

**Phase 4B total:** 12 items (including the shared primitives). Notification UI ships first — expect quality jump perceivable on the same commit.

---

## 5. Phase 4C — Integration infrastructure (timing: stabilize workflows first)

**Target:** Months 4–7. Infra-only per your handoff — no live API keys.
**Rule:** Do not start until the workflow module being synced is stable. Integrations on half-built objects create duplicate bug surfaces.

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 27 | QuickBooks connector (connect/disconnect, sync log) | M | P1 | Standard expectation |
| 28 | Xero connector | M | P1 | Standard for Canadian mid-market |
| 29 | Stripe Connect connector | M | P1 | Already in your integration spec |
| 30 | Sage 300 on-prem connector | L | P2 | Narrow segment; defer unless named deal |
| 31 | Google Drive / Dropbox document sync | M | P2 | Common ask, not a deal-breaker |
| 32 | Zapier / Make connector | M | P2 | "We have it" bullet; low pull |
| 33 | AI-powered accounting data mapping | L | P2 | Only ship after basic connectors are in field use |
| 34 | BuiltCRM public REST API (beyond webhooks) | L | P2 | Defer unless named deal |

**Phase 4C total:** 8 items. QB + Xero + Stripe ship first, rest are optional based on demand.

---

## 6. Phase 4D — Scale & platform (schema sprint, do in one shot)

**Target:** Weeks 4–8, can run parallel with 4B. These are schema migrations and cross-project pages. Do them together to avoid migrating twice.

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 35 | Sub-scoped financials: `organizationId` on `draw_requests` / SOV (also fixes `pendingFinancialsCents` hardcoded to 0) | M | P1 | Data-model debt |
| 36 | `tradeScope` field on `SubPaymentRollupRow` | S | P1 | Known gap |
| 37 | Cross-project Budget Overview / Payment Tracking / Retainage page | M | P1 | Moved from 4A — this is a real feature |
| 38 | Contractor cross-project approvals page | M | P1 | Moved from 4A — this is a real feature |
| 39 | Procurement / purchase orders | L | P1 | Commercial GC expectation |
| 40 | Multi-project dashboard views | M | P2 | Defer in urgency |
| 41 | `weekly_reports` table for PM-authored narratives | S | P2 | From HANDOFF.md deferred |
| 42 | Lien waiver sub fan-out (`createWaiverForDraw`) | S | P1 | From HANDOFF.md deferred |
| 43 | Audit log viewer page (data exists in `audit_events` + `activity_feed_items`) | S | P2 | Enterprise trust; pairs with notification UI |

**Phase 4D total:** 9 items. Do the schema items (35, 36, 41) in one migration sprint.

---

## 7. Phase 5 — Commercial GC parity (the pitch-enabling phase)

**Target:** Months 3–6. Without items 44 and 45 a commercial GC will not take a demo seriously. Everything else in this phase is sized around what can ship alongside these two.

### 5.1 — Non-negotiable commercial modules

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 44 | **Drawings / sheet management with markup and version control** — OCR sheet naming, set/revision tracking, markup layers (personal + published), persistence across revisions, mobile/offline, hyperlinks to RFIs/punch/submittals, measurement tools, QR codes | L | **P0** | Commercial GC gate. Procore/ACC/PlanGrid/Bluebeam all ship deeply. No credible commercial pitch without this. |
| 45 | **Inspections module (QA/QC checklists)** — template builder with conditional logic, mobile-first with photos, pass/fail/NA observations, reinspection linkage, separate Quality and Safety tracks | M | **P0** | Commercial GC gate. Distinct from milestones. Procore/ACC/Fieldwire/CMiC all ship this. |

### 5.2 — Quick wins (small, standard, pairs well with the big items)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 46 | Meeting minutes module — Agenda → Minutes mode, attendee roster, auto carry-forward of unresolved items, distribution tracking | S–M | P1 | Procore/ACC/CMiC ship; BT/JobTread don't. Quick win. |
| 47 | Transmittals module — formal time-stamped record of information sent with sender/recipient/method/acknowledgment | S | P1 | Contract audit trail. BT/JobTread don't ship. Quick win. |
| 48 | Closeout packages — closeout register keyed to spec sections, required-doc matrix per sub, automated reminders, hyperlinked PDF binder, warranty metadata | M | P2 | Known white-space even for Procore (Buildr/Extracts Pro/Pype are paid add-ons). Natural extension of your planned warranty tracking. |
| 49 | Subcontractor prequalification — financials, EMR/safety, bonding, SPL/APL limits, insurance verification before award | M | P2 | Strong adjacency to existing COI/WSIB. ACC TradeTapp cuts time ~33%. Differentiator. |

### 5.3 — Strategic, larger commercial features (sequence carefully)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 50 | Bid management (single-GC ITB distribution + bid leveling) — invite workflow, bidder CRM, bid forms, side-by-side leveling matrix, award-to-contract handoff | L | P2 | Don't fight BuildingConnected's 1.5M-sub network. Build for mid-market single-GC use. |
| 51 | BIM integration — embed lightweight IFC viewer (Xeokit open-source) + deep-link to ACC Model Coordination | S–M (integration) or L (native) | P2 | Standard for commercial >$50M. Integrate, don't rebuild Navisworks. |

**Phase 5 total:** 8 items. Items 44 and 45 are each multi-month; the rest fit around them.

---

## 8. Phase 6 — Field/mobile + subcontractor depth

**Target:** Months 9–12. This is where the sub portal becomes genuinely competitive vs Rhumbix/eSUB/Siteline/Flashtract.

### 6.1 — True native mobile + offline

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 52 | True offline-first sync (PWA with IndexedDB, selective sync, automatic conflict resolution) | L | **P0** | Fieldwire benchmark. Deal-breaker in basements/tunnels/steel high-rises. Responsive web cannot do this. |
| 53 | Native mobile app (iOS + Android) | L | P1 | Decision point — if not shipping native, drop "mobile optimization" from V2+ and commit to PWA |
| 54 | Voice-to-text notes and voice memos on photos/tasks (on-device) | S–M | P2 | CompanyCam's hook. Shrinking differentiator — ship within 12 months or drop from marketing. |

### 6.2 — Photos + spatial intelligence

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 55 | Geotagged photos with preserved EXIF + map view | S–M | P1 | CompanyCam's value prop. Procore ships deeply. |
| 56 | Pin photos/issues/RFIs/punch to sheet coordinates with room/location tagging | L | P1 | Binds drawings/RFIs/punch/inspections into one spatial model. Fieldwire/ACC core flow. Requires item 44 (drawings). |
| 57 | Photo auto-tagging (rooms/trades) — ML model for progress documentation | M | P2 | ACC Autotags + Procore Photo Intelligence ship this. Differentiator. |

### 6.3 — Safety suite (biggest insurance/EMR-discount driver)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 58 | Incidents + near-miss + safety observations | M | P1 | Raken ships this. Core safety. |
| 59 | JHA/JSA / Pre-task plans / AHA templates | M | P1 | Rhumbix-grade. Table stakes for commercial. |
| 60 | Toolbox talks library + attendance tracking | S–M | P1 | Raken's managed library is a differentiator. |
| 61 | OSHA 300/300A/301 injury log auto-roll + ITA CSV export (US only) | M | P2 | US-only; skip unless US market is named. |

### 6.4 — Subcontractor-specific capabilities

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 62 | Crew-based geofenced timekeeping (foreman crew hours by cost code, geofence + selfie) | L | P1 | Table stakes for commercial subs. Rhumbix + HCSS lead. |
| 63 | Labor burden roll-up (burden % for taxes/benefits/PPE → actual-vs-budget) | M | P1 | Pairs with 62. Standard sub-ops feature. |
| 64 | Equipment hours + optional telematics ingest (CAT/Komatsu/Case/Samsara) | M | P2 | HCSS-dominant. Differentiator. |
| 65 | **T&M tickets with on-site GC e-signature** — digital ticket: crew + equipment + materials + markup, countersigned on-device | M | P1 | Subs' #1 cash leak. Rhumbix flagship. Highest-value single sub feature. |
| 66 | Self-serve state-specific lien waiver generation + pay app bundling (COIs + certified payroll + waivers) | M | P1 | ~75% of sub payments stall on waiver defects (Siteline data). Extends your lien waiver module. |
| 67 | Formal AIA G702/G703 PDF generation with math validation | S–M | P1 | Output artifact. You have the math already. |
| 68 | Bid invitation / ITB workflow for subs to respond (Yes/Maybe/No + unit pricing + RFI during bid) | M | P1 | Pairs with item 50. Standard sub feature. |
| 69 | Production reports / unit quantities installed ($/unit, hrs/unit) | M | P2 | Rhumbix shipped; Procore light. Differentiator. |
| 70 | Crew certification matrix (OSHA 10/30, H2S, first aid) with expiry alerting | S–M | P2 | Standard sub-ops expectation. |
| 71 | Certified payroll (US WH-347) — prevailing wage + fringe splits | M | P2 | US-only; integrate Foundation Software rather than build unless US public works is a target segment. |

### 6.5 — Other field essentials

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 72 | Weather auto-log (pull weather API on every daily log) | S | P1 | Procore standard. Defends delay claims. Small effort. |
| 73 | Delivery receiving — packing slip photo + driver signature tied to PO | S | P1 | Standard field operation. |
| 74 | Visitor sign-in kiosk with OSHA muster list | S | P2 | Differentiator. Safety audit requirement. |
| 75 | QR/barcode scanning for equipment + materials with auto-GPS | M | P1 | Procore ships. Standard. |

**Phase 6 total:** 24 items. Largest phase by count — split into Safety (58–61), Sub Ops (62–71), Mobile Core (52–57), Field Essentials (72–75) as sub-sprints.

---

## 9. Phase 7 — AI layer

**Target:** Months 4–7. Ship Wave 1 well, then evaluate before Wave 2.
**Rule:** Pick ONE agent and ship it well. Don't chase the ~15-agent race.

### 7.1 — Wave 1: The two must-have agents

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 76 | **Meeting Minutes AI agent** — transcription + action-item extraction + automatic assignment to responsible party + carry-forward to next meeting | S–M | **P0** | **Category-wide gap** — no major vendor has fully closed this. Highest differentiation per effort in the entire AI category. Pairs with item 46. |
| 77 | **RFI Draft agent** — suggests RFI content from voice/photo/location; suggests responses from past RFIs and spec references | M | P1 | Table stakes. Procore and ACC both ship. Cheapest credible "we have AI" story in pitch deck. |

### 7.2 — Wave 2: Ship after Wave 1 validates the AI stack

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 78 | Project Q&A copilot — Trunk Tools-style Q&A over specs/RFIs/drawings/submittals ("what are the insulation R-values on floor 3?") | L | P1 | Procore Assist, Autodesk Assistant, Trunk Tools, Buildots Dot, Document Crunch Chat all ship. Table stakes by end of 2026. |
| 79 | Auto-draft daily log from photos + voice + schedule | M | P1 | Becoming table stakes. Buildertrend's AI Client Updates shows the playbook. |
| 80 | Document auto-tag / auto-classify (category, project, trade) | M | P1 | Table stakes. Autodesk Autotags. Pairs with items 23–24. |
| 81 | AI executive summary reports (weekly client updates, draw-approval summaries) | S–M | P1 | Buildertrend's flagship 2025 AI feature (97% faster updates). Pairs with item 26. |

### 7.3 — Wave 3: Differentiators, ship selectively

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 82 | Drawing version reconciliation — clouded + **unclouded** changes diff overlay | M–L | P2 | Trunk Tools differentiator. Extends item 44. |
| 83 | Predictive delay/risk scoring (needs historical data — may be unfeasible pre-revenue) | L | P3 | Autodesk Construction IQ, Procore Insights. Only feasible with customer data. Defer. |
| 84 | PPE/hazard photo detection (missing hard hats, falls, electrical hazards) | M–L | P2 | Procore Safety Agent. Differentiator. Pairs with Phase 6 safety suite. |
| 85 | Contract/spec compliance AI — flag risk/indemnity/payment terms | M | P2 | Document Crunch (being acquired by Trimble). Differentiator. |
| 86 | Takeoff AI from drawings | L | P3 | Togal.AI territory. Integrate rather than build. |

**Phase 7 total:** 11 items across 3 waves. **Ship items 76 + 77 first. Do not start Wave 2 until Wave 1 is in production use.**

---

## 10. Phase 8 — Enterprise trust + deal-breaker integrations

**Target:** Months 1–9 (SOC 2 starts immediately). Integrations slot alongside the workflow modules they sync.
**Rule:** SOC 2 Type II is the single longest-dated item in the entire plan. Start now or accept a year of blocked enterprise deals.

### 8.1 — Trust trifecta (hard gates for enterprise)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 87 | **SOC 2 Type II audit** — start at Phase 4 kickoff | L (procedural) | **P0** | 6–9 month audit window. Mid-market baseline. |
| 88 | **SSO (SAML 2.0, Okta, Entra ID)** | M | **P0** | Hard gate >100 seats. |
| 89 | Audit log exports (admin-facing, CSV + API) | S | P1 | Completes the trio. Data exists. |
| 90 | Granular per-project permissions matrix (beyond role-level) | M | P1 | Standard commercial. Extends item 10. |

### 8.2 — French (fr-CA) localization (deal gate for Quebec)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 91 | fr-CA localization across all 4 portals (Canadian French, not fr-FR) | M | **P0** | **Bill 96 legal requirement (in force June 2025)**. Fines up to C$30K. Procore ships; BT limited; JobTread nothing. |

### 8.3 — Deal-breaker integrations (lose RFPs without these)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 92 | Microsoft 365 — Outlook add-in for RFIs/submittals + Teams notifications | M | P1 | ~70% of GC/owner buyers |
| 93 | DocuSign integration | S | P1 | Enterprise legal standard even with native e-sign |
| 94 | **Bluebeam Revu** (Studio Prime / markup sync) | M | P1 | Most-requested drawing integration. Estimators live in Revu. |
| 95 | **Autodesk ACC / PlanGrid** bidirectional sync (RFIs, issues, sheets) | M | P1 | ACC is drawing set of record for most commercial GCs. |
| 96 | OneDrive / SharePoint (for M365 buyers) | M | P1 | Standard with M365. |
| 97 | Slack and Teams — chat notifications + deep links | S–M | P1 | Chat-first GCs expect this. |

### 8.4 — Deal-maker integrations (win competitive bake-offs)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 98 | TrustLayer and myCOI — COI automation | M | P1 | Procore Marketplace cornerstones. Natural fit with compliance module. |
| 99 | Siteline / GCPay / Trimble Pay (ex-Flashtract) — sub pay app + waivers | M | P1 | Critical for GCs >$10M volume. |
| 100 | Get listed on Procore App Marketplace + ACC Partner Card | M (business dev) | P1 | Expands TAM — owners and subs mandate Procore on many projects. |
| 101 | Adobe Acrobat Sign (DocuSign alternative) | S | P2 | Coverage. |
| 102 | Box and Egnyte (AEC-specific file governance) | M | P2 | Standard for enterprise AEC. |
| 103 | HubSpot / Salesforce / Pipedrive for preconstruction sales | M | P2 | Enterprise requires Salesforce. BT ships all three. |
| 104 | Stack / PlanSwift / Togal.AI — estimating handoff | M | P2 | Handoff to preconstruction. |
| 105 | Samsara / Motive — heavy/civil fleet telematics | M | P2 | Heavy/civil segment. |
| 106 | **Ceridian/Dayforce** (must-have for Canadian payroll) + Gusto/ADP (US) | M | P1 | **Canadian deal-gate.** |
| 107 | Busybusy / ClockShark / ExakTime — field time tracking | M | P2 | Alternative to native time tracking (items 62–63). |
| 108 | SafetyCulture / HammerTech — safety/QA-QC forms | M | P2 | Alternative if Phase 6 safety suite slips. |

### 8.5 — Infra enablers

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 109 | Webhook event catalog (fine-grained events + retries + filtering) | S | P1 | Already partially on your roadmap; formalize. iPaaS integrators expect it. |
| 110 | Agave connector (construction iPaaS — connects ACC to 10+ ERPs) | M | P2 | Multiplier — better than 20 shallow native integrations. |
| 111 | Workato connector | M | P2 | Enterprise iPaaS. |
| 112 | Custom fields on entities | M | P1 | JobTread markets this aggressively. Standard. |
| 113 | Bulk CSV import/export (beyond your Procore/Buildertrend migration plan) | S | P1 | Onboarding blocker; demo requirement. |

**Phase 8 total:** 27 items. SOC 2 + SSO + fr-CA are the three that block the most deals. The integration count looks high but most are light connector work once the webhook + API layer is solid (item 109).

---

## 11. Phase 9 — Canadian compliance moat (the wedge)

**Target:** Months 6–9. This is the unique positioning vs Procore/BT/JobTread. Path A makes this phase the product's differentiation.

### 9.1 — V1 must-ship for Quebec credibility

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 114 | **Law 25 compliance pack** — Canadian data residency (ca-central-1), granular consent, DSAR workflows (30-day SLA), breach register + CAI notification, Privacy Officer surface, PIA/TIA templates, automated decision-making disclosure for AI | L | **P0** | **C$25M or 4% global revenue penalties. Private right of action enables class actions.** Deal-breaker for Quebec. |
| 115 | **RBQ license verification** — automated lookup via RBQ open data JSON/CSV feed; surface license + subclass + validity on sub profile; 10-digit format on estimates/invoices/contracts | S | P1 | Unique differentiator — no competitor ships this. GCs jointly liable if sub lacks RBQ (fines C$12K/$33K). |
| 116 | **CCQ competency card tracking** + R-20 sector classification (residential / I&C / civil-roads) + 13% taxable benefits accrual | M | P1 | **No major competitor ships.** Legal requirement — employers must verify competency before assignment. |
| 117 | **ARQ (Attestation de Revenu Québec) + CNESST attestation verification** — mandatory for contracts ≥C$25K; ARQ 90-day validity tracking; Revenu Québec web service integration | M | P1 | Plugs directly into your COI/WSIB module. CNESST validation releases GC from sub liability. |
| 118 | **Quebec legal hypothec (Art. 2726 CCQ) workflow** — pre-work denunciation/notice to owner, 30-day registration at RDPRM, hypothec rights tracking | M | P1 | Quebec-unique. Extends your lien waiver module. No prompt-payment regime in Quebec alone. |
| 119 | GST + QST + HST invoice handling — QST 9.975% and GST 5% shown separately, GST#/QST#/RBQ# on templates | S | P1 | Small but essential. |

### 9.2 — V2 pan-Canada (ship before US expansion)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 120 | **Ontario Construction Act 2026 (Bill 216/60, O. Reg. 264/25)** — proper invoice templates, 28/7/14-day timers, notice-of-non-payment workflows, holdback ledger with annual release, adjudication packet builder, private-adjudicator support | L | **P0 if ON is a target province** | **In force January 1, 2026.** Deal-breaker for ON sales. |
| 121 | BC Construction Prompt Payment Act (in force 2026 pending regs) — province-aware rules engine | M | P1 | Adjacent to Ontario work. Share code. |
| 122 | Alberta PPCLA workflows (transition ended Aug 29, 2024) | M | P1 | Adjacent. |
| 123 | **T5018 contractor payment reporting** — annual CRA slip for subs >$500 | S–M | P1 | Penalties $100–$7,500 per slip. Procore/BT don't ship (US-built). |

### 9.3 — V3 US entry (deferred unless US is named target)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 124 | OSHA 300/300A/301 + ITA CSV export | M | P2 | US only. |
| 125 | 50-state mechanics lien preliminary notice engine — **integrate Levelset (Procore Pay) rather than build** | M (integration) / L (native) | P2 | CA 20-day preliminary notice forfeits lien rights entirely. |
| 126 | E-Verify for federal contracts + ~20 mandate states | M | P2 | US only. |
| 127 | 1099-NEC reporting | S | P2 | US only. |
| 128 | Bond tracking (Miller Act + Little Miller Act) | M | P2 | US public works. |
| 129 | Davis-Bacon certified payroll (WH-347) — **integrate Foundation Software** | M (integration) / L (native) | P2 | Foundation is market leader. |
| 130 | DBE/MBE/WBE tracking (USDOT 49 CFR Part 26) | M | P2 | US public works. |

**Phase 9 total:** 17 items. Items 114 (Law 25) + 120 (Ontario 2026) are the two largest; they are also the two biggest selling points.

---

## 12. Phase 10 — Residential depth + client portal polish

**Target:** Months 9–12. Comes after the moat is built.

### 10.1 — Residential gaps

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 131 | Client-initiated warranty request portal (post-handover) — homeowner submits title/description/photos; builder schedules inspection | M | P1 | BT + UDA ship. Homeowners lose portal access at handover today. |
| 132 | Specifications / scope-of-work documents distinct from selections | M | P2 | CoConstruct historical differentiator. Custom-home dispute driver. |
| 133 | Allowance running-balance rollup — "$8,200 remaining across all allowances" dashboard widget | S | P1 | Pure aggregation on existing data. #1 late-stage residential dispute. |
| 134 | Homeowner-initiated walkthrough / punch capture from client portal | M | P2 | No vendor ships natively. Differentiator. |
| 135 | Mood / inspiration boards (multi-page, product clipper, paint swatches) | M | P2 | Houzz Pro owns category. Differentiator for design-build. |
| 136 | Vendor / showroom catalog integrations (Ferguson, Build.com, Kohler, Moen, BM paint) | L | P2 | Houzz Pro territory. Large effort, differentiator. |
| 137 | Pre-construction questionnaire templates | S | P2 | Houzz Pro. Small. |
| 138 | Proposal / estimate generation with native e-signature | M | P1 | Table stakes — BT, JobTread, UDA, BuildBook all ship. |
| 139 | Photo journal (timelapse deferred — hardware integration) | S | P2 | Small effort photo journal; timelapse is Phase V2+. |
| 140 | Construction loan draw integration (Built / getbuilt.com, Northspyre) | L | P3 | Large effort; defer unless a residential lender partnership is named. |
| 141 | Homeowner financing partner programs (Buildertrend Financing is sole vendor) | M | P3 | Differentiator for remodelers; defer. |

### 10.2 — Client portal (cross-segment)

| # | Item | Effort | Priority | Why |
|---|---|---|---|---|
| 142 | Owner-side AP integration (Northspyre-style auto-capture from email → sync Sage Intacct/Acumatica/Oracle JDE) | L | P2 | Commercial owner differentiator. |
| 143 | Multi-stakeholder guest access (architect/lender/interior designer/co-signer roles, distinct scopes) | M | P1 | Most portals collapse "client" into one login. |
| 144 | Consolidated decision log — immutable timeline across selections + COs + specs + allowances | S | P1 | Aggregation of existing data. Differentiator. Scope-dispute defense. |
| 145 | Self-serve e-sign + payment in one flow (saved methods, 3DS auth) | M | P1 | Table stakes. BT + UDA + BuildBook + Houzz all ship. |
| 146 | Milestone celebration / shareable progress cards + videos + referral moments | S | P2 | Residential emotional-UX differentiator. |
| 147 | Separate architect / owner / tenant views on commercial projects | M | P1 | Procore + Northspyre ship. Standard commercial. |
| 148 | True consumer-grade mobile client UX (native, not just responsive) | L | P2 | BT/UDA reviews consistently flag "desktop shrunk." Requires item 53 native mobile. |

**Phase 10 total:** 18 items. Split into Residential (131–141), Client Portal Core (142–148).

---

## 13. V2+ / Strategic deferrals

Keep these explicitly off the near-term plan. Revisit after Phase 10.

| # | Item | Rationale |
|---|---|---|
| — | AI selection inspiration | V2+ per your handoff. Low priority for Path A. |
| — | Predictive dashboard | Needs customer historical data. Unfeasible pre-revenue. |
| — | Selection enhancements (ranking, bundling, AR, availability) | V2+ differentiators. |
| — | Interactive demos with synthetic data | Marketing feature. V2+. |
| — | Multi-currency (CAD/USD) | Portfolio project; no real cross-border pain yet. Revisit only if US expansion is locked in. |
| — | Real-time message features (typing indicators, presence dots) | Requires WebSocket/SSE infra. Low pull. |
| — | Real-time collaborative editing (Google Docs-style SOV/schedule) | Large effort, low urgency. V2+. |
| — | Photo timelapse (hardware integration) | Small photo journal ships in Phase 10; timelapse V2+. |

---

## 14. Cross-phase sequencing summary (the full build order)

| Months | Primary phase | Secondary (parallel) | Key deliverables |
|---|---|---|---|
| 1 | 4A — Polish | **SOC 2 Type II kickoff (Phase 8)** | All 14 polish items done. SOC 2 scoping complete. |
| 1–2 | 4B.1 — Notifications | 4D schema sprint (35, 36, 41, 42) | Notification center live. Schema migrations merged. |
| 2–3 | 4B.2–4B.4 — Search + field workflow primitives + daily logs | Phase 8 fr-CA localization begins | Search + daily logs live. French complete by month 3. |
| 3–4 | 4B — Punch list, submittals, doc categories, versioning | Phase 7.1 — **Meeting Minutes AI agent** | All Phase 4B core items live except Gantt + reports. First AI agent in production. |
| 3–5 | Phase 5.1 — **Drawings + Inspections** | Phase 8 SSO + deal-breaker integrations (M365, DocuSign) | Drawings module in alpha. Inspections live. SSO shipped. |
| 4–5 | Phase 5.2 — Meetings + Transmittals (pair with AI agent) | Phase 7.1 — **RFI Draft agent** | Quick wins shipped. Second AI agent live. |
| 5–6 | Phase 5.3 — Closeout + Prequalification | Phase 8 integrations wave 2 (Bluebeam, ACC, TrustLayer) | Drawings GA. Closeout differentiator live. |
| 6–7 | Phase 4B — Gantt + Reports | Phase 4C — QB + Xero + Stripe connectors | Basic Gantt live. Accounting integrations in field use. |
| 6–8 | **Phase 9 — Canadian compliance moat** | Phase 7.2 — AI Wave 2 (Q&A copilot, auto daily log, doc auto-tag) | Law 25, RBQ, CCQ, ARQ, CNESST all live. Project Q&A in beta. |
| 8–9 | Phase 9 — Ontario 2026 + T5018 | Phase 4D — Procurement/POs + cross-project pages | ON prompt payment engine live. Canadian stack complete. |
| 9–10 | Phase 6.1 — Offline-first PWA / native mobile decision | Phase 8 — Ceridian/Dayforce + myCOI integrations | Offline core live. |
| 10–11 | Phase 6.2–6.4 — Safety suite + sub time/T&M + photo spatial | Phase 10.1 — Residential gaps (warranty portal, allowance rollup) | Safety suite live. T&M + crew time live. Residential differentiators live. |
| 11–12 | Phase 6.5 + Phase 10.2 — Field essentials + client portal polish | Phase 7.3 — AI differentiators (selective) | Full feature set. AI Wave 3 opportunistic. |
| 12+ | V2+ / Strategic deferrals | — | Revisit per customer demand. |

**Total item count across all phases:** 148 items (85 research gaps + 40 Phase 4 items + 23 handoff + strategic additions).

---

## 15. Files to move into the project folder

**Add this document as:**
- `builtcrm_phase4_plus_implementation_plan.md` → `docs/specs/` in your repo

**Research output to keep as reference:**
- The gap analysis artifact from the previous message — save it as `builtcrm_2026_gap_analysis.md` in `docs/specs/`

**No files to delete.** Everything in the project folder remains relevant — all 24 HTML mockups, JSX prototypes, schema files, handoff docs, and spec PDFs continue to be the authoritative source.

**After moving these two docs in, the next chat can start with:**

> "Continuing BuiltCRM post-Phase-3. Read `builtcrm_phase4_plus_implementation_plan.md` and `builtcrm_2026_gap_analysis.md` in docs/specs/. We're starting [Phase 4A / whatever you decide]. Context-window preferences: warn at 50%, wrap-up signal at limit, no auto status dumps."

---

## 16. Open decisions that need your call before implementation starts

1. **Path A vs Path B** (Canadian moat vs generalist). Locking this changes Phase 9 positioning.
2. **Native mobile vs PWA** (item 53). Answer changes Phase 6 scope.
3. **US market timing** (Phase 9.3 items 124–130). Defer or not?
4. **SOC 2 Type II — kickoff date.** Literally every day matters on this.
5. **Bid management scope** (item 50) — mid-market only, or attempt BuildingConnected parity? Recommend mid-market only.
6. **BIM: integrate vs build** (item 51) — recommend integrate.
7. **Ontario 2026 (item 120) — launch-ready or fast-follow?** If ON is a target province, launch-ready is required. Came into force January 1, 2026.

Resolve these before Phase 4B ends to avoid sequencing surprises.
