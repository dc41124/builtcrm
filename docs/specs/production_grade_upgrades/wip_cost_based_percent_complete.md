# WIP Schedule — Cost-Based Percent-Complete Upgrade

## Current approximation

The contractor WIP report (`src/domain/loaders/wip.ts`) computes **percent complete from milestone weighting** via `computePercentComplete` in `src/lib/reports/math.ts`. Earned revenue is derived as `contractWithCO × schedulePercentComplete`. Cost-to-date is the sum of received PO line values only.

**Current formula:**

```
% Complete  = schedule-based (milestone duration / unweighted count)
Earned      = (Contract + Approved COs) × % Complete
Over/Under  = Earned − Billed
Backlog     = (Contract + Approved COs) − Billed
```

## Production gap

WIP is a **cost-accounting artifact** consumed by three audiences that reject schedule-based approximations:

| Audience | What they expect | Why schedule-% fails |
|---|---|---|
| **External auditors** | ASC 606 / IFRS 15 percentage-of-completion (input method — cost-based) | Schedule-based POC is allowed under specific conditions (output method) but requires documented, reliable output measures. Milestone weighting alone doesn't qualify. |
| **Bonding companies / sureties** | Monthly cost-based WIP schedule in AIA G703 / industry-standard format | Sureties rely on cost-based % for bonding capacity and work-in-hand calculations. Schedule-% distorts bonding underwriting. |
| **Tax / financial statement consumers** | POC revenue recognition tied to cost | Inflated or deflated earned-revenue numbers produce wrong taxable income and wrong margin disclosures. |

Schedule-% is **not inherently wrong** — it's the wrong tool for WIP. It belongs in the Schedule Performance report.

## Target design

### Target formula (percentage-of-completion, input method)

```
% Complete = Cost-to-Date / (Cost-to-Date + ETC)
Earned     = (Contract + Approved COs) × % Complete
Over/Under = Earned − Billed
Backlog    = (Contract + Approved COs) − Billed
```

Where:
- **Cost-to-Date** = unified ledger of realized costs (committed + received POs, labor hours × rates, misc expenses, equipment)
- **ETC** (Estimate-to-Complete) = PM-entered forecast of remaining cost to finish the project

### New schema

#### 1. `project_budget_line_items`

Source of truth for the original cost budget. Locks at project-active; revisions are a governed action with audit trail.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid NOT NULL | FK projects, CASCADE |
| `cost_code_id` | uuid NOT NULL | FK cost_codes, RESTRICT |
| `category` | text | labor / material / subcontract / equipment / overhead |
| `original_budget_cents` | integer NOT NULL | budget at contract signing |
| `revised_budget_cents` | integer NOT NULL | after approved COs (defaults to original) |
| `notes` | text | |
| timestamps | | |

**Constraints:** UNIQUE(project_id, cost_code_id). Index on project_id.

#### 2. `cost_transactions` (unified ledger)

Every realized cost on a project. Populated from multiple source systems (POs, daily log labor, misc expense entries) via inserts at the action layer.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid NOT NULL | FK projects, CASCADE |
| `cost_code_id` | uuid | FK cost_codes, SET NULL |
| `source_type` | text NOT NULL | 'po_line', 'labor', 'misc_expense', 'equipment', 'subcontract_payment' |
| `source_id` | uuid | FK into source table (po_line_id, daily_log_crew_entry_id, etc.) |
| `transaction_date` | timestamptz NOT NULL | when the cost was realized (PO received date, labor date, etc.) |
| `amount_cents` | integer NOT NULL | signed; reversals allowed |
| `description` | text | |
| `recorded_by_user_id` | uuid | FK users, SET NULL |
| timestamps | | |

**Indexes:** (project_id, transaction_date), (cost_code_id, transaction_date), (source_type, source_id) for reverse lookups.

**Alternative:** If the fan-out is small enough, this can start as a computed view over `purchase_order_lines` + `daily_log_crew_entries` + a new `misc_expenses` table. Promote to a real table when labor rate history and misc adjustments require stable IDs.

#### 3. `project_forecasts` (ETC snapshots)

Monthly PM-entered forecasts with an audit trail. Bonding companies and auditors want to see how ETCs moved quarter-over-quarter.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `project_id` | uuid NOT NULL | FK projects, CASCADE |
| `forecast_date` | date NOT NULL | month-end anchor |
| `submitted_by_user_id` | uuid NOT NULL | FK users, RESTRICT |
| `total_etc_cents` | integer NOT NULL | PM's remaining cost estimate |
| `total_cost_to_date_cents` | integer NOT NULL | snapshot of ledger sum at forecast time |
| `confidence` | text | 'low' / 'medium' / 'high' — for surety commentary |
| `notes` | text | narrative explaining forecast shift |
| `superseded_by_forecast_id` | uuid | FK self, SET NULL — most recent wins |
| timestamps | | |

**Constraints:** UNIQUE(project_id, forecast_date).

#### 4. `project_budget_forecasts` (optional — cost-code-level ETC)

Supports per-cost-code % complete if needed. Start without it; add when a user asks for cost-code roll-up on WIP.

### Labor rates

Needed before labor lands in `cost_transactions`:

- **`organization_labor_rates`** table — per (organization_id, trade) with effective-dated rate rows
- Daily log crew entries already carry `trade` + `hours` + `headcount`; join to rate at the trade + date to compute cost

Alternative: per-sub-org override rate in `project_organization_memberships` (already exists — add a `labor_rate_cents_per_hour` column for sub-scoped rates that beat the trade default).

## Loader changes

- `getWIPReport` switches to cost-based %:
  - `costToDate` from `cost_transactions` where `project_id = ?`
  - `etc` from latest `project_forecasts` row for project
  - `% complete = costToDate / (costToDate + etc)` when ETC is present; fall back to current schedule-% with a flag in the row (`percentCompleteMethod: "cost" | "schedule"`)
- Reports UI shows method as a tooltip/caption so the consumer knows which method a row is on

## UI surfaces (new)

1. **Budget entry workspace** (per project) — grid: cost code × category × original/revised. Import-from-SOV action for initial seed.
2. **Monthly ETC update flow** — PM opens project, system shows cost-to-date, PM enters remaining-cost-to-complete by cost code or lump-sum, confirms. Creates a new `project_forecasts` row.
3. **ETC history view** — table + chart showing forecast movement over time. Part of the Project Financials page.
4. **Labor rate management** — org settings page to enter per-trade rates. Project-scoped overrides inline on sub membership row.
5. **Cost transactions ledger** — filterable table of all cost entries per project. Core audit surface.
6. **Bonding export** — CSV/PDF in AIA G702/G703 format for WIP submission to sureties.

## Auth / policy

- Budget writes: contractor admin role + project membership
- Budget revisions after project-active: require approved CO or named exception; audit event `project.budget.revised` with before/after
- Forecast writes: PM role on the project + contractor org member
- Forecast entry is the **only** way to change ETC; no backdoor edits. Monthly forecasts are traditionally dated as of month-end regardless of entry date
- Audit events: `project.budget.created`, `project.budget.revised`, `project.forecast.submitted`, `project.forecast.superseded`

## Migration path

**Phase A — Foundation**
- Ship `project_budget_line_items`
- Ship `cost_transactions` (start as view or table per scale)
- Backfill: for each existing project, generate cost_transactions rows from every received PO line

**Phase B — Forecasts**
- Ship `project_forecasts` + ETC entry UI
- Nightly cron: snapshot cost-to-date into forecasts when a new one is submitted

**Phase C — Labor**
- Ship `organization_labor_rates`
- Back-populate labor cost_transactions from `dailyLogCrewEntries` × rate
- Add labor-cost columns to WIP

**Phase D — Cost-based WIP**
- Switch `getWIPReport` to cost-based % where a forecast exists
- Keep schedule-% as fallback + explicit method flag
- Add bonding-export endpoint

**Phase E — Budget revision workflow**
- Approved-CO → budget-revision automation
- Budget-revision UI + approval trail

## Dependencies

- **Cost codes** — already exist (`cost_codes` table)
- **Purchase orders + lines** — already exist, feed cost_transactions for material/subcontract
- **Approved change order totals** — already exist, drive `revised_budget_cents`
- **Time tracking with rates** — partial (`daily_log_crew_entries` has hours; rates don't exist yet)
- **Audit events** — already exist (`audit_events` table)

## Effort estimate

Roughly a full phase (~4–6 weeks focused work) covering:

- 3 new tables + 1 optional + 1 rate table = 4–5 migrations
- 1 unified cost ledger backfill script
- 1 forecast entry UI + history view
- 1 budget entry/revision UI
- WIP loader rewrite
- Bonding export endpoint
- Audit events + policy rules
- Documentation + marketing copy ("ASC 606-ready WIP")
