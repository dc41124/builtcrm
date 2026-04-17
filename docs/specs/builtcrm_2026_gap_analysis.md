# BuiltCRM 2026 gap analysis: what's missing to win GC deals

**Bottom line:** BuiltCRM has an unusually strong financial/compliance spine for a pre-revenue product, but sits behind 2026 market expectations in four structural areas: (1) a core commercial GC module stack (drawings, inspections, meetings, bid/prequal, closeout), (2) a credible AI layer — competitors shipped ~15 agent-style features in 2025, (3) a native-grade Quebec compliance story (Law 25, Bill 96 FR-CA, CCQ/CNESST/RBQ, Ontario's January 2026 Construction Act amendments), and (4) the enterprise-trust trifecta of SSO, SOC 2 Type II, and a published webhook catalog. The Phase 4 roadmap addresses many field and platform gaps but leaves the commercial GC pitch materially incomplete. The good news: BuiltCRM's Quebec origins and existing COI/WSIB/billing mechanics create a defensible wedge that Procore, Buildertrend and JobTread cannot match without a ground-up rebuild — if the product leans into Law 25, French, CCQ/ARQ attestation verification, and Quebec legal hypothec workflows rather than chasing Procore feature-for-feature.

The analysis below is organized by the user's ten research questions. Every item excludes features already on Phase 4A–4D and V2+ lists. Effort is rough: **S** ≤ 1 sprint, **M** 1 quarter, **L** multi-quarter.

---

## 1. Standard/expected features for commercial GCs in 2026

Benchmarking against Procore, Autodesk Construction Cloud (ACC), CMiC, Buildertrend, and JobTread surfaces eight commercial-GC modules considered table stakes that are not on BuiltCRM's roadmap. These overlap with research questions 5 and 7 and are detailed there; the summary ranking is:

**P0 table stakes (must ship before a credible commercial pitch):** Drawings/sheet management with markup and version control, Inspections module (QA/QC checklists distinct from milestones).

**P1 quick wins (small effort, standard expectation):** Meeting minutes module, Transmittals module.

**P1–P2 differentiators:** Closeout packages, Subcontractor prequalification — both are known white-space even against Procore, where customers routinely pay for third-party add-ons (Buildr, Extracts Pro, TradeTapp).

**P2–P3 strategic:** Bid management (single-GC leveling only — don't fight BuildingConnected's 1.5M-sub network), BIM viewer (embed ACC / lightweight IFC viewer rather than rebuild Navisworks).

Section 5 below details each gap with competitor parity, effort, and JTBD.

---

## 2. Subcontractor-facing expectations

Subcontractor modules have bifurcated into two competitive tracks: **trade-ops platforms** (Rhumbix, eSUB, HCSS) that own time/labor/production, and **sub-pay platforms** (Siteline, Trimble Pay/Flashtract, GCPay) that own pay apps and waivers. Procore and Autodesk Build partially address both but leave meaningful gaps. BuiltCRM's subcontractor portal is missing ten capabilities subs now expect from a GC platform.

**Crew-based geofenced timekeeping** is effectively table stakes: foreman enters crew hours by cost code with geofence + optional selfie, killing buddy-punching and producing wage-hour audit trails. Rhumbix and HCSS HeavyJob lead; Procore Timecards lacks rich geofencing. **Large effort, standard.** Pairs with **labor burden roll-up** (applying burden % for taxes/benefits/PPE to actual-vs-budget) and **equipment hours with optional telematics ingest** (CAT, Komatsu, Case, Samsara) — HCSS-dominant, Procore light.

**Time & materials tickets with on-site GC e-signature** is the single most-requested sub feature: digital ticket capturing crew + equipment + materials + markup, countersigned on-device. Rhumbix flagship workflow; also in eSUB. Subs consistently cite unrecovered T&M as their #1 cash leak. **Medium effort, standard.**

**Self-serve state-specific lien waiver generation and pay application bundling** matters because roughly three-quarters of sub payments stall on waiver defects (Siteline customer data). Siteline and Trimble Pay set the bar with an "Unconditional Waiver Vault" tied to ACH release. BuiltCRM already has lien waivers in the billing flow, but sub-initiated generation with state templates and compliance-doc bundling (COIs, certified payroll, waivers) is a distinct capability. **Medium effort, standard for commercial subs.**

**Formal AIA-style G702/G703 pay app PDF generation with math validation** — BuiltCRM has SOV math, but subs expect the output artifact. **Medium, standard.**

**Bid invitation / ITB workflow with sub response (Yes/Maybe/No, unit pricing, RFI during bid)** is missing entirely. Buildertrend, Procore Bidding, and BuildingConnected all ship this. **Medium, standard** for any preconstruction-capable product.

**Certified payroll (US WH-347)** auto-generated from timecards with prevailing-wage rates and fringe splits — Rhumbix explicit, Foundation Software is the market leader, Procore does not ship natively. **Medium effort, differentiator in a non-US-focused product; table stakes if targeting US public works.**

**Production reports / unit quantities installed** (labor productivity as $/unit or hrs/unit) and **crew certification matrices** (OSHA 10/30, H2S, first aid expirations with 30/60/90-day alerting) round out the expected sub layer.

---

## 3. Field-side / mobile-first capabilities

Phase 4's planned native mobile app and daily logs close some of this gap, but eleven distinct field capabilities are still missing from the roadmap.

**True offline-first sync** is the single biggest deal-breaker. Fieldwire is the benchmark: full plan markup, task creation, photo capture offline with smart selective sync and automatic conflict resolution on reconnect. Responsive web cannot do this — it requires a PWA with IndexedDB or native storage. Basements, tunnels, steel-shielded high-rises routinely have zero signal. **Large effort, standard (deal-breaker).**

**Geotagged photos with preserved EXIF metadata and map view** is CompanyCam's entire value prop and Procore's photo-map is built on it. Preserving GPS/timestamp/author through the upload pipeline plus displaying pins on a project map is **small-to-medium effort, standard**.

**Pin photos and issues to sheet/drawing coordinates with room/location tagging** is the workflow that binds drawings, RFIs, punch, and inspections into one spatial model. Fieldwire and Autodesk Build's core flow; Procore invested heavily in AI auto-extracting Locations from drawings in 2025. **Large effort (needs PDF engine + spatial index), standard commercial / differentiator vs Buildertrend-tier.**

**Voice-to-text notes and voice memos on photos/tasks** — CompanyCam's voice notes let gloved hands work. On-device speech recognition. **Small-to-medium, differentiator but shrinking fast** as Procore and ACC ship AI daily logs.

**Full safety suite: incidents, near-miss, JHA/JSA, pre-task plans, toolbox talks, safety observations, OSHA 300 auto-roll.** Raken ships incidents + observations + managed toolbox talk library; Rhumbix handles PTP/AHA. This is the biggest insurance/EMR-discount driver for GCs — safety software pays for itself through premium reductions. **Large effort (multi-feature), standard.**

**Weather auto-log** (Procore pulls weather APIs on every daily) to defend delay claims — **small, standard**. **Configurable inspection forms** with photo/pass-fail/signature/corrective-action (already covered in section 5). **Delivery receiving** with packing slip photo and driver signature tied to PO — **small, standard**. **Visitor sign-in kiosk** with OSHA muster list — **small, differentiator**. **QR/barcode scanning for equipment and materials** with auto-GPS on scan — Procore ships native QR print and iOS scan for Equipment, **medium, standard**.

---

## 4. AI features shipped by competitors in 2025–2026

The AI gap is structural. BuiltCRM's roadmap lists only "AI accounting mapping" and "AI selection inspiration" — neither matches what flagship competitors are selling. **In 2025, the AI construction PM category moved from experiments to ~15 GA agent-style features**; not shipping a credible AI story by mid-2026 is now a pitch liability.

**Procore Helix and Procore Assist** (renamed from Copilot) went GA globally in 2025 with Spanish and Polish multilingual support and mobile voice. The **Agent Builder** is in open beta with >1,000 customer-built agents by Groundbreak 2025. Pre-built agents shipped or in beta: RFI Creation Agent, Daily Log Agent, Submittal Agent, Copilot Reporting Agent (March 2025), Schedule/RFI Risk Agent, and a Safety Agent that analyzes jobsite photos for missing PPE, falls and electrical hazards and auto-drafts observation reports. Procore Insights (predictive risk across RFIs/submittals/daily logs) went GA in early 2025. Photo Intelligence summarizes progress and safety from jobsite photos.

**Autodesk Construction Cloud** shipped the Autodesk Assistant in March 2025 as a conversational copilot over Build and Docs. Construction IQ (5M+ uses/year) delivers ML risk scoring across design, RFIs, quality, and safety. Shipped features: Autotags on Photos, Symbol Detection in Takeoff, Automatic Spec Sectioning, AutoSpecs suggested submittals, Sheets auto-extraction, Quick Create RFI via AI (September 2025), and TradeTapp Financial Data Extraction from PDFs. The January 2026 release added Meeting Minutes as a Project Data Agent source in beta.

**Trunk Tools** (Series B July 2025) is the AI-native benchmark: **TrunkText** (sub-30-second Q&A over specs/RFIs/drawings/submittals), **TrunkSubmittal** (auto-review vs specs/RFIs; Gilbane rolled it out enterprise-wide to 200+ projects in November 2025), and **TrunkReview** (drawing-revision diff AI that scans a 20-sheet bulletin in 5 minutes with visual overlay of clouded and **unclouded** changes).

**Document Crunch** (being acquired by Trimble, Q2 2026) ships CrunchAI for Contracts (flags risk/indemnity/payment terms, 80% review time reduction) and CrunchAI for Specifications (extended to 1,000-page spec books in August 2025), deployed on 10,000+ projects.

**OpenSpace** launched its Visual Intelligence Platform in September 2025; Progress Tracking went GA June 2025, quantifying work-in-place across 700+ components. OpenSpace acquired Disperse in October 2025 for verified progress analytics. **Buildots** (Series D May 2025, $45M) ships 360° hard-hat capture with the **Dot** generative AI assistant and predictive delay tooling. **Togal.AI** holds five AI patents awarded in 2025 for takeoff (98% accuracy, 5x faster), with Togal.CHAT drafting RFIs and submittals from plans.

**Buildertrend** shipped one major AI feature: AI-powered Client Updates (June 2025) that auto-drafts weekly client summaries from daily logs, schedule, change orders and invoices — 60 minutes of builder time collapsed to 6.5 minutes.

**Category-shipping status summary:**

| AI capability | Status 2026 | Effort to ship |
|---|---|---|
| Project Q&A copilot (Procore Assist, Autodesk Assistant, Trunk, Buildots Dot, Document Crunch Chat, Togal.CHAT, ALICE Insights Agent) | **Table stakes** | L |
| RFI draft / response suggestion | **Table stakes** | M |
| Auto-draft daily log from photos/voice | Becoming table stakes | M |
| Document auto-tag/classification | Table stakes | M |
| AI executive summary reports | Table stakes | S-M |
| Drawing version reconciliation (Trunk's clouded+unclouded diff) | Emerging table stakes | M-L |
| Predictive delay/risk (needs historical data) | Differentiator | L |
| PPE/hazard photo detection | Differentiator | M-L |
| Contract/spec compliance AI | Differentiator (soon standard) | M |
| Takeoff AI from drawings | Differentiator | L |
| **Meeting transcription + action-item extraction** | **Category-wide gap** | S-M |

That last row matters: meeting-minute AI is the one adjacency that no major vendor has fully closed, and it sits next to two modules BuiltCRM would be adding anyway (meetings, notifications). It's a low-effort, high-signal differentiator.

---

## 5. Commercial GC table-stakes features not on the Phase 4 plan

Eight concrete module gaps, ranked by build priority.

**Drawings / sheet management with markup and version control** — the source of truth for the current drawing set. Expected features: OCR auto-sheet naming, set/revision tracking, markup layers (personal and published), markup persistence across revisions, mobile/offline, hyperlinks to RFIs/punch/submittals, measurement tools, QR codes. Procore, ACC (Autodesk Docs/Build), legacy PlanGrid, and Bluebeam Revu all ship this deeply; Buildertrend and JobTread are weak (mostly static file storage). **Large effort, standard — non-negotiable for commercial GC credibility above ~$10M revenue.**

**Inspections module (QA/QC checklists)** distinct from milestones. Covers pre-pour, pre-drywall, rough-in, MEP coordination, safety inspections. Needs template builder with conditional logic, mobile-first with photos, pass/fail/NA observations, reinspection linkage, separate Quality and Safety tracks. Procore (deep), ACC Forms/Issues, Fieldwire and CMiC all ship this. **Medium effort, standard; differentiator if BuiltCRM auto-links failed inspections to punch/RFIs.**

**Meeting minutes module** — first-class meeting object with Agenda → Minutes mode, attendee roster, automatic carry-forward of unresolved items to next agenda, distribution tracking. Procore, ACC, CMiC have this; Buildertrend and JobTread do not. **Small-to-medium effort, standard. Quick win.**

**Transmittals module** — formal, time-stamped record of information sent (drawings, contracts, RFIs) with sender/recipient/method/acknowledgment. Critical for contract audit trail and dispute defense. Procore, CMiC, Viewpoint ship this; Buildertrend and JobTread do not. **Small effort, standard. Quick win.**

**Closeout packages (O&M manuals, as-builts, warranty handover)** — roughly a third of project data is lost at handover according to Buildr/Procore-cited industry data. Native closeout is a known white-space even for Procore: customers pay for third-party add-ons Buildr, Extracts Pro, and Pype. Build a closeout register keyed to spec sections with a required-doc matrix per sub, automated reminders, hyperlinked PDF binder generation, and warranty metadata capture. **Medium effort, differentiator — natural extension of BuiltCRM's already-planned warranty tracking.**

**Subcontractor prequalification workflows** — qualify subs on financials, EMR/safety, bonding capacity, SPL/APL limits, and insurance before award. ACC's TradeTapp cuts qualification time ~33%; CMiC's dedicated Prequalification module integrates COMPASS Q-Score; Procore and Buildertrend require third parties. **Medium effort, differentiator.** Strong adjacency to BuiltCRM's existing COI/WSIB tracking — the data model already supports it.

**Bid management (ITB distribution + bid leveling)** for single-GC use, not a sub network. ACC's BuildingConnected leverages a 1.5M+ sub network that is not replicable; CMiC and Procore Bidding ship standalone bid workflows. Scope to: invite workflow, bidder CRM, bid forms/packages, side-by-side leveling matrix, award-to-contract handoff. **Large effort, standard module / differentiator if priced below ACC for mid-market GCs.**

**BIM integration** — commercial GCs >$50M increasingly expect in-platform 3D model viewing. ACC Model Coordination is the category leader (RVT/DWG/IFC/NWC/VUE + automated clash + Navisworks round-trip); Procore has a lighter BIM viewer; Revizto competes. **Recommendation: embed a lightweight IFC viewer using an open-source engine like Xeokit plus a deep-link integration to ACC rather than rebuild Navisworks parity.** Small-to-medium as an integration; large if built natively.

---

## 6. Residential builder table-stakes not on the Phase 4 plan

BuiltCRM's residential flow is strong on selections but missing seven capabilities competitors ship.

**Client-initiated warranty request portal (post-handover)** — BuiltCRM has warranty tracking planned, but the distinct UX of homeowners submitting claims (title/description/photos) with builder scheduling inspection appointments is a Buildertrend and UDA ConstructionOnline ClientLink capability. Homeowners complain that after handover they lose the portal and revert to lost emails. **Medium effort, becoming standard. Confirm whether this is in scope.**

**Specifications / scope-of-work documents distinct from selections.** Specs are contract-grade written SOW ("all interior doors solid-core, R-21 walls"); selections are the tile-picking flow. Custom-home disputes routinely trace to spec language buried in a PDF contract not versioned with decisions. CoConstruct historically differentiated here. **Medium effort, differentiator for custom/semi-custom.**

**Allowance running-balance rollup** distinct from per-selection allowance display. UDA and Buildertrend show allowance math per line; no one ships a **dashboard widget** showing "you have $8,200 remaining across all allowances." This is the #1 late-stage residential dispute. **Small effort (pure aggregation on existing data), meaningful differentiator.**

**Homeowner-initiated walkthrough / punch capture from client portal.** Punch list is planned, but all competitors make it builder-facing. Giving homeowners tap-to-tag on photos from their own phone at pre-close walkthrough is a distinct UX no vendor ships natively. **Medium effort, differentiator.**

**Mood / inspiration boards.** Houzz Pro owns this category with multi-page mood boards, product clipper, Benjamin Moore/Sherwin-Williams swatches, and explicit separation of Mood Boards (inspiration) vs Selection Boards (approval). BuildBook ships a lighter version. **Medium effort, differentiator for design-build; standard for that segment.**

**Vendor / showroom catalog integrations** (Ferguson, Build.com, Kohler, Moen, Benjamin Moore). Houzz Pro has a marketplace catalog and Product Clipper saving any web product with full metadata. UDA stores vendor/SKU/UPC fields but no live catalog APIs. **Large effort (partnerships + integration), differentiator.**

**Additional residential gaps:** Pre-construction questionnaire templates (Houzz Pro, small effort), proposal/estimate generation with native e-signature (table-stakes — Buildertrend, JobTread, UDA, BuildBook all ship; medium effort), photo journal and timelapse (photo journal small; timelapse large via hardware integration), **construction loan draw integration** (Built/getbuilt.com and Northspyre dominate; large effort, differentiator), and homeowner financing partner programs (Buildertrend Financing is the sole vendor here; medium, differentiator for remodelers).

---

## 7. Client portal expectations (both commercial and residential) in 2026

Seven client-portal gaps transcend the residential/commercial split.

**Owner-side AP integration** — commercial owner AP teams receive invoices from GC, architects, and FF&E vendors and manually re-key. Northspyre's differentiator is automated data capture from email with sync to Sage Intacct, Acumatica, Oracle JDE. **Large effort, differentiator for commercial owner-side**.

**Multi-stakeholder guest access** with distinct roles for architect, lender, interior designer, and co-signing family. Most portals collapse "client" into one login. Honest Buildings (now Procore) excelled at per-vendor scoped bid rooms; Buildertrend offers limited role-based subs/team/clients. **Medium effort, differentiator residential / standard commercial.**

**Consolidated decision log** — immutable, time-stamped audit trail of every approval (selections + change orders + specs + allowances) on a single timeline. UDA timestamps selection signatures; Buildertrend logs CO approvals; but no vendor aggregates these. Scope disputes nine months in ("I never approved that") are the JTBD. **Small effort (aggregation of existing data), differentiator.**

**Self-serve e-sign + payment in one flow** with saved payment methods and 3DS auth. Buildertrend, UDA, BuildBook, Houzz Pro all ship this; JobTread lacks native invoicing. **Medium effort, table stakes.**

**Milestone celebration / emotional UX** — homeowners remember the emotional journey. Buildertrend's AI Client Updates is the closest equivalent. Shareable "Framing Complete!" cards, progress videos, and referral-friendly moments are meaningfully missing across the category. **Small effort, differentiator for residential.**

**Separate architect / owner / end-user views on commercial projects** — architect needs RFIs/submittals, owner needs budget/schedule, tenants need fit-out decisions. Procore and Northspyre ship distinct role-based experiences; residential PM tools do not. **Medium effort, standard commercial / differentiator residential.**

**Mobile-first client UX.** Homeowner reviews consistently flag Buildertrend/UDA as "desktop software shrunk." BuildBook and Houzz Pro execute best. Responsive alone isn't enough — client expectations now skew consumer-app-grade. **Large effort (native), differentiator.**

---

## 8. Nice-to-have differentiators with 2025–2026 traction

Fifteen differentiators cluster into three tiers. The trust trifecta plus French localization are P0 — not technically differentiators anymore, they are deal gates.

**P0 enterprise trust layer:** SSO (SAML 2.0, Okta, Entra ID) is a hard gate above ~100 seats (medium effort). **SOC 2 Type II** is now mid-market baseline — expect a 6–9 month audit window; this is the single longest-dated item on any roadmap and should start immediately. Audit log exports (small effort) complete the trio. Granular per-project permissions (medium, standard). **French (fr-CA) localization is a Quebec legal gate under Bill 96 in force June 2025** — fr-FR is not acceptable, must be Canadian French; fines up to C$30K. Procore ships fr-CA; Buildertrend limited; JobTread nothing. Medium effort, deal-breaker for Quebec.

**Clear wedge vs Procore and Buildertrend:** **Native in-app e-signature** on contracts/COs/lien waivers removes per-envelope cost — Buildertrend and JobTread embed signing, Procore still relies on DocuSign/Adobe integration (medium effort, differentiator). **Embedded analytics / BI dashboards** at standard pricing matter because Procore Analytics (Power BI-based) is an upsell and ACC Insights ships but is priced up (medium-to-large, differentiator). **In-product automation/workflow builder** — JobTread markets this as a moat vs Procore, which pushes customers to ACC Connect/Workato (large effort, differentiator). **Custom approval chains and conditional logic in forms** (medium each, differentiator).

**Infrastructure differentiators:** **Webhook event catalog** with fine-grained event types, retries and filtering is expected by any iPaaS integrator — low effort once events exist. **Custom fields on entities** (medium, standard — JobTread markets this aggressively). **Bulk CSV import/export** is an onboarding blocker and sales-demo requirement (small, standard). **Voice-to-text field notes** is a fading differentiator — Procore and ACC shipped AI daily logs in 2025, so ship within 12 months or drop from marketing. **Real-time collaborative editing (Google Docs-style)** on SOVs/schedules is a large effort with high differentiation but low urgency.

---

## 9. Industry-specific compliance/regulatory expectations

This is the most defensible section of a BuiltCRM pitch — Quebec-built is a selling point if the product actually ships Quebec-specific compliance. None of Procore, Buildertrend, or JobTread ships a real Quebec compliance story; CMiC (Toronto) has partial bilingual and some Canadian payroll hooks but no CCQ depth.

**V1 must-ship for Quebec credibility:**

**Law 25 compliance pack** is the single most important regulatory investment. Penalties reach C$25M or 4% of global revenue with a unique private right of action enabling class actions. Required: Canadian data residency (ca-central-1 or similar, with the residency/sovereignty distinction addressed — US-parented hosting remains exposed to the CLOUD Act), granular consent management, DSAR workflows (30-day SLA), breach incident register with CAI notification, Privacy Officer designation surface, PIA/TIA templates for cross-border flows to US sub-processors, and automated decision-making disclosure if AI/scoring is used. **Large effort, deal-breaker for Quebec / strong differentiator nationally.**

**RBQ license verification** leverages the open data JSON/CSV feed of active licenses. GCs are jointly liable if a sub lacks proper RBQ subclass (fines from C$12K individuals / C$33K corps). RBQ numbers must appear on estimates/invoices/contracts in 10-digit format. **Small effort, unique differentiator — no competitor ships automated RBQ lookup.**

**CCQ competency card tracking** plus R-20 sector classification (residential / industrial / I&C / civil-roads) and 13% taxable benefits accrual. Employers legally must verify competency before assignment. **No major competitor ships this natively** — only Quebec-local payroll (Nethris, Employeur D). **Medium effort, unique differentiator.**

**ARQ (Attestation de Revenu Québec) and CNESST attestation verification** — mandatory for contracts ≥ C$25K within 10 days of work start; ARQ is valid 90 days so tracking expiry is critical. CNESST "Validation de conformité" releases GCs from subcontractor liability. Plugs directly into BuiltCRM's existing COI/WSIB module via Revenu Québec's "My Account for businesses" verification web service. **Medium effort, unique differentiator.**

**Quebec legal hypothec (Art. 2726 CCQ)** workflows extending the existing lien waiver module. Unique to Quebec: anyone without a direct contract with the owner must send a written **denunciation/notice to owner before starting work**, or hypothec rights are lost entirely. Registration within 30 days of completion at RDPRM. Quebec has no prompt-payment/adjudication regime — alone among major provinces. **Medium effort.**

**GST + QST + HST invoice line handling** with QST at 9.975% and GST at 5% shown separately, registration numbers (GST#, QST#, RBQ#) surfaced on invoice templates. **Small effort.**

**V2 pan-Canada:**

**Ontario Construction Act amendments effective January 1, 2026** (Bill 216/60, O. Reg. 264/25) require a mandatory annual holdback release (eliminating statutory notices of non-payment for holdback), expanded adjudication scope now covering change orders and extensions, permitted private adjudicators, and 28-day owner-to-GC / 7-day GC-to-sub clocks triggered by "proper invoice." Alberta PPCLA transition ended August 29, 2024. BC's Construction Prompt Payment Act received Royal Assent November 27, 2025 and comes into force in 2026 pending regulations. Build a province-aware rules engine: proper-invoice templates with required fields, 28/7/14-day timers, notice-of-non-payment workflows with prescribed forms, holdback ledger with annual release calc for Ontario post-2026, adjudication packet builder. **Large effort, standard within 12 months of launch for any Canadian sale.**

**T5018 contractor payment reporting** — annual CRA slip for any subcontractor receiving >$500; penalties $100–$7,500 per slip with conspiracy penalties up to 200% of tax avoided. Procore and Buildertrend do not ship this (US-built). **Small-to-medium effort.**

**V3 US entry:**

OSHA 300/300A/301 injury recordkeeping with ITA CSV export (medium). State-by-state mechanics lien preliminary notice engine — CA's 20-day preliminary notice is the killer: missing it forfeits lien rights entirely (Civ. Code §§8200–8216). Levelset (now Procore Pay), Handle, SunRay, Billd, and Document Crunch ship 50-state engines — **integrate Levelset rather than build.** E-Verify for federal contracts and the ~20 states that mandate it (medium). 1099-NEC reporting (small). Bond tracking for Miller Act and Little Miller Act public work (medium). Davis-Bacon certified payroll (WH-347) is a large build — Foundation Software is the market leader; recommend integrating rather than building if US public works becomes a target segment. DBE/MBE/WBE tracking for USDOT 49 CFR Part 26 (medium). SOC 2 Type II and CCPA/CPRA (covered in section 8).

---

## 10. Integrations that close real deals

Procore's App Marketplace lists 500+ apps and ACC Connect claims 290+ partners / 400+ integrations via Workato — these are self-reported marketing numbers, but set buyer expectations. Categorize integrations by deal-impact, not count.

**Deal-breaker-if-missing (lose RFPs without these):**

Microsoft 365 (Outlook add-in for RFIs/submittals + Teams notifications) covers ~70% of GC/owner buyers — Procore and ACC both ship this deeply. DocuSign remains the enterprise legal standard even when native e-sign exists. **Bluebeam Revu (Studio Prime or markup sync)** is the single most-requested drawing integration — estimators and field supers live in Revu. **Autodesk ACC / PlanGrid** bidirectional sync on RFIs/issues/sheets because ACC is the drawing set of record for most commercial GCs. OneDrive / SharePoint for M365 buyers. Slack and/or Teams for chat-based notifications and deep links.

**Deal-makers (win competitive bake-offs):**

**TrustLayer and myCOI** for COI automation — both are Procore Marketplace cornerstones; natural fit with BuiltCRM's compliance module (medium effort). **Siteline, GCPay, or Trimble Pay (ex-Flashtract)** for subcontractor pay app and lien waiver workflow — critical for GCs above $10M volume. **Getting listed on the Procore App Marketplace and becoming an ACC Partner Card** expands TAM materially because many owners and subs mandate Procore on projects. Adobe Acrobat Sign as a DocuSign alternative. Box and Egnyte — Egnyte is an AEC-specific file governance leader and an official Autodesk partner. HubSpot, Salesforce, Pipedrive for preconstruction sales — Buildertrend ships all three; Salesforce is required for enterprise. Stack, PlanSwift, and Togal.AI for estimating handoff. Samsara and Motive for heavy/civil fleet telematics. **Ceridian/Dayforce is must-have to compete in the Canadian payroll segment**; Gusto and ADP cover US (Buildertrend ships Gusto). Busybusy, ClockShark, ExakTime for field time tracking. SafetyCulture and HammerTech for safety/QA-QC forms.

**Strategic note:** iPaaS-friendliness matters more than native count. ACC's ecosystem is effectively multiplied by Workato; Agave markets itself as "construction's data-integration platform" connecting ACC to 10+ ERPs. A rich webhook catalog plus a clean REST API (both planned) plus a published Agave and Workato connector will outperform 20 shallow native integrations.

---

## Conclusion: where BuiltCRM wins, and the one decision that matters most

The research surfaces ~85 distinct gaps across the ten questions, but the competitive story collapses to one strategic choice: **compete as a Quebec-native, bilingual, compliance-deep platform** or **compete as a generalist North American mid-market PM tool**. The first path is winnable. The second is not.

The Quebec-native path requires Law 25, Bill 96 fr-CA, CCQ/ARQ/CNESST/RBQ verification, Quebec legal hypothec denunciation workflows, Ontario 2026 Construction Act prompt-payment tooling, and T5018 reporting as launch-grade features — a path where Procore, Buildertrend, and JobTread are structurally behind and cannot catch up quickly. Paired with the closeout and prequalification differentiators (both natural adjacencies to existing COI/billing mechanics) and a credible meeting-minutes AI agent (the one AI adjacency the category has not closed), BuiltCRM can pitch a defensible "Canadian GC" positioning.

The generalist path requires matching Procore on drawings, inspections, BIM, bid management, and full AI agents while shipping SOC 2 Type II, SSO, and 12+ deal-breaker integrations — a two-year build that still ends in a feature-parity fight BuiltCRM will lose on ecosystem depth.

**The three highest-leverage gaps to close first, regardless of path:** (1) drawings + markup + inspections module — without these, commercial GCs will not take a demo seriously; (2) SOC 2 Type II (start the 6–9 month audit window now, it will block enterprise deals for a year if delayed); (3) a single AI agent that actually works — most likely an RFI draft agent or meeting-minute summarizer, because these are the cheapest credible AI stories with the highest pitch-deck ROI. Everything else sequences behind those three.