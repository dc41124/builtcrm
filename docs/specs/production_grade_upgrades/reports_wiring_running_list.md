# Reports Wiring — Running List of Production Gaps

Seed notes from the Step 24.5 reports-loader wiring pass. Each entry names a
specific approximation that ships in Phase 4+ and points at the data or
design gap the full repo audit should re-surface and prioritize. Not a
spec — just enough context for the audit phase to pick up the thread.

Most entries here likely consolidate into a single production-grade cost-
and-forecast foundation (see `wip_cost_based_percent_complete.md`). Treat
them as related findings, not independent work items.

---

## 1. AR trend performance — materialized snapshots

**Current:** `getARReport` computes the 8-week "as-of" trend live by
replaying every draw + payment_transaction against 8 snapshot dates. Per
contractor fetch the cost is O(drawCount × 8). Fine at portfolio scale
(hundreds of draws), painful at thousands.

**Target:** Persistent snapshot table written nightly (or on each draw
state change). Trend read = one indexed range query.

**Rough shape:** `ar_snapshots(organization_id, as_of_date, total_outstanding_cents, ...)`
— row per org per day. Trend query = last 56 rows.

**File:** `src/domain/loaders/ar-aging.ts`

## 2. Cost-based WIP + Job Cost

Already specced in detail at
[`wip_cost_based_percent_complete.md`](wip_cost_based_percent_complete.md).
The Job Cost report has the same root cause (budget = `contractValueCents`,
projected = `max(committed, actual)`) and consumes the same foundation.
Audit should treat these two reports as a **single upgrade target**, not
separate work items.

**Files:** `src/domain/loaders/wip.ts`, `src/domain/loaders/job-cost.ts`

## 3. Schedule SPI — proper earned-value math

**Current:** SPI approximated as `milestone-weighted % complete ÷ planned
elapsed %`. Works at face value but conflates "calendar progress" with
"work progress." Doesn't support baseline vs. forecast comparisons, re-
baselining events, or per-milestone weights that aren't just duration-
based.

**Target:** PMBOK-style earned-value schedule:

- Baseline schedule captured at project activation (immutable once locked)
- Each milestone carries a planned-value weight (often $ budget or
  percent-complete weight from the contractor)
- BCWS (planned value) = sum of planned-weight for milestones whose
  planned date has passed
- BCWP (earned value) = sum of planned-weight for milestones actually
  completed
- SPI = BCWP / BCWS
- Re-baselining creates a new baseline row; report shows vs. current
  baseline, with history of previous baselines for surety/audit trails

**Schema additions (rough):** `project_baselines`, `milestone_baseline_weights`
linked to `milestones`.

**File:** `src/domain/loaders/schedule-performance.ts`

## 4. Compliance type taxonomy

**Current:** `compliance_type` is free-form varchar. Sub matrix columns
are dynamic top-N by prevalence because the fixed GL/WC/Auto/Bond/W-9/
License assumption in the prototype doesn't match the schema. The
`daysUntilExpiry` bucketing and severity rules assume all compliance
types are date-driven, which isn't true for every doc type (e.g., a W-9
doesn't expire).

**Target:** Taxonomy catalog:

- `compliance_type_catalog(id, key, display_name, requires_expiry,
  default_renewal_days, ...)` — per-org table with a seeded
  construction-industry starter set (GL, WC, Auto, Bond, W-9, Business
  License, OSHA-10, etc.)
- Non-expiry types (W-9, EIN) tracked as "present / absent" rather than
  date-based
- Fixed-column matrix built against the catalog, not ad-hoc discovery
- Compliance type becomes a FK column on `compliance_records` (migration
  + backfill by mapping existing strings into the catalog)

**File:** `src/domain/loaders/compliance-report.ts`

## 5. Labor rates + cost columns

**Current:** Labor report is hours-only. Cost columns (labor cost, burn,
blended rate) are hidden because `daily_log_crew_entries` carries hours
but no rate.

**Target:** Already covered under the WIP upgrade spec's "Labor rates"
section. Once `organization_labor_rates` ships (per (org, trade)
effective-dated rate rows), the Labor report adds cost columns and the
WIP cost-ledger includes realized labor.

**File:** `src/domain/loaders/labor-report.ts`

---

## Related upstream consolidation

After the full repo audit, expect items 2, 3, and 5 to collapse into one
coherent "cost + forecast + baseline" foundation phase. Items 1 and 4 are
standalone and can ship independently or bundled with adjacent work.
