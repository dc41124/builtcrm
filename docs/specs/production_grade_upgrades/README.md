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
- [offline_outbox_generic_producers.md](offline_outbox_generic_producers.md) — Step 51 outbox is generic-by-design but only daily-logs is registered as a producer; other field-mutating actions (RFI, punch, inspections, crew entries, submittals, drawings, transmittals) need their own producers + conflict resolvers.
- [offline_background_sync_api.md](offline_background_sync_api.md) — Step 51 drain triggers on `online` event + manual button only; Background Sync API (Chrome/Edge), Periodic Sync (Chrome desktop), and iOS-tail UX (push reminders) are deferred. Native iOS shell is a long-tail escape hatch.
- [safety_corrective_action_tracker.md](safety_corrective_action_tracker.md) — Step 52 corrective actions are denormalised JSON inside `safety_form_incidents`; production needs a first-class table with status lifecycle, due-date reminders, closeout-blocking gate, and cross-project queue.
- [safety_template_field_editor.md](safety_template_field_editor.md) — Step 52 templates are seeded fixtures only; production needs an in-app field editor with drag-reorder, type-aware config, validation rules, and template versioning so historical submissions render against the field set in effect at submission time.

## Running lists (seed notes — not full specs)

- [reports_wiring_running_list.md](reports_wiring_running_list.md) — gaps surfaced during the Step 24.5 reports loader pass: AR trend perf, Job Cost folding into WIP, proper SPI/earned-value math, compliance type taxonomy, labor rates.
