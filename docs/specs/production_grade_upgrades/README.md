# Production-Grade Upgrades (Post Phase 4+)

Holding folder for architectural upgrades identified during Phase 4+ wiring that are pragmatic approximations in the portfolio-quality build but wouldn't pass a production audit. Each spec here documents:

1. **Current approximation** — what ships in Phase 4+
2. **Production gap** — why it fails a real-world deployment (auditor, surety, regulator, scale, etc.)
3. **Target design** — schema, loaders, UI, policies required
4. **Migration path** — order of operations and dependencies
5. **Effort estimate** — rough phase-size classification

The full catalog will be audited after Phase 4+ completes and promoted into numbered production-upgrade phases. New entries are added here as approximations are discovered during feature wiring.

---

## Current specs

- [wip_cost_based_percent_complete.md](wip_cost_based_percent_complete.md) — WIP schedule uses milestone-weighted % complete; ASC 606 / bonding companies require cost-based POC.

## Running lists (seed notes — not full specs)

- [reports_wiring_running_list.md](reports_wiring_running_list.md) — gaps surfaced during the Step 24.5 reports loader pass: AR trend perf, Job Cost folding into WIP, proper SPI/earned-value math, compliance type taxonomy, labor rates.
