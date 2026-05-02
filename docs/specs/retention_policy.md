# Data Retention & Deletion Policy

**Owner:** Privacy Officer (per organization)
**Source of truth:** [src/lib/retention/tiers.ts](../../src/lib/retention/tiers.ts)
**Schema columns:** `retention_class`, `retention_until`, `legal_hold` on every in-scope table (Step 66.5 migration `0056_aromatic_mantis.sql`)
**Status as of 2026-05-01:** Tier classification + `legal_hold` enforcement on operational purges are live. Unified sweep + project-closeout backfill ship in Step 66.6.

## Why this exists

Construction-industry data has wildly different retention obligations:

- **CRA s.230** requires payers to keep payment-tax-slip source records for 6 years from the end of the tax year.
- **Ontario Construction Act** + provincial limitation periods reach to 6+ years for contract/lien records; 7 years is the conservative practitioner floor.
- **PIPEDA Principle 5** + **Quebec Law 25 art. 23** require minimization — keep personal data only as long as necessary.
- **SOC 2 Trust Services Criterion P4** requires retention/disposal procedures with auditable evidence.

A blanket "keep everything" or "delete after N days" approach satisfies none of these. The tier system below assigns each table a retention class with a defensible regulatory anchor.

## Retention tiers

| Tier | Floor | Configurable | Trigger | Anchor |
|---|---|---|---|---|
| `statutory_tax` | 6 years from end of tax year | No | Insert (`created_at + 7y`) | CRA s.230 |
| `statutory_construction` | 7 years from project closeout | No | Project closeout | ON Construction Act, QC Civil Code |
| `project_record` | 2 years post-closeout | Org may extend | Project closeout | Practitioner standard for warranty/handover |
| `operational` | 90 days from last activity | Org may shorten to 30 days | Activity timestamp | PIPEDA / Law 25 minimization |
| `auth_ephemeral` | Token expiry + 7 days | No | Token expiry | Best practice |
| `design_archive` | Indefinite | No | Never | Liability defense over project lifetime |
| `privacy_fulfillment` | Per row type (DSAR 30d post-fulfillment, breach 7y, consent forever) | No | Terminal state | Law 25 §34, regulatory inquiry windows |
| `contract_signature_audit` | 10 years from signature | No | Signature event | Provincial limitation periods on contract disputes |

**`legal_hold = true`** overrides every tier above and pauses scheduled deletion for the row. Required for SOC 2 P4 and active dispute defense.

## What's in scope

96 tables across 33 schema files carry the three retention columns. The full mapping lives in [src/db/schema/_shared.ts](../../src/db/schema/_shared.ts) (tier helper) and is applied via `...retention("<tier>")` spreads on each `pgTable` declaration.

Highlights by tier:

- **`statutory_tax`** (8 tables): `payments`, `draws`, `draw_requests`, `invoices`, `purchase_orders`, `stripe_customers`, `subscription_invoices`, etc.
- **`statutory_construction`** (12 tables): `change_orders`, `lien_waivers`, `time_entries`, `prequal_submissions`, `audit_events` (see exception below), etc.
- **`project_record`** (~36 tables): every nested project artifact — RFIs, daily logs, submittals, transmittals, meetings, weekly reports, punch list, inspections, selections.
- **`operational`** (11 tables): conversational/transient — messages, notifications, activity feed, sync events.
- **`design_archive`** (6 tables): drawings, sheets, markups, measurements, photo pins.
- **`privacy_fulfillment`** (4 tables): DSAR queue, consent register, breach register, breach-notification drafts.

## What's NOT in scope

Tables EXCLUDED from retention columns by design:

- **`users`, `auth_user`, `userNotificationPreferences`** — Law 25 erasure follows the existing tombstone-update path in `src/domain/user-deletion.ts` + `src/jobs/account-anonymization-sweep.ts`. Tombstone preserves `audit_log` foreign-key integrity; scheduled deletion would break it.
- **`organizations`, `organizationUsers`, `roleAssignments`** — pure authorization lookups; cascade with parent.
- **`closeoutCounters`, `safetyFormCounters`** — sequence allocators; no user data.
- **`r2OrphanQueue`** — system housekeeping table; manages its own 7-day lifecycle via the existing `r2-orphan-purge` job.
- **Reference tables** (10 tables) — the row IS the reference (cost codes, vendors, plan catalog, prequal templates, etc.); no per-row retention decision.

## Audit-events tier exception

`audit_events` is classified `operational` (90-day default), not `statutory_construction` (7-year), by deliberate decision. The 7-year construction-records floor lives on the source rows (`change_orders`, `lien_waivers`, `time_entries`, `payment_transactions`, etc.), each of which carries its own `retention_class = 'statutory_construction'`. The audit log is a denormalized event stream; bounding it at 90 days preserves the cost/forensics trade-off documented in `security_posture.md §6` without weakening regulatory coverage on the primary records.

## R2 object cleanup

R2 objects don't get deleted by row deletion alone. Two paths:

1. **Trigger-driven enqueue** — every retention-enabled table that holds an R2 key has an `AFTER DELETE` trigger writing to `r2_orphan_queue`. The `r2-orphan-purge` job (daily at 04:45 UTC) drains the queue.
2. **Tmp prefix lifecycle** — R2 objects under `tmp/` are deleted after 7 days regardless of DB references (configured at the bucket level, not in code).

The registry of R2-key-holding columns lives in [src/lib/retention/r2-registry.ts](../../src/lib/retention/r2-registry.ts) and is consumed by the unified sweep job (Step 66.6).

## Active enforcement (today)

Six daily Trigger.dev jobs perform scheduled deletion on operational-tier tables:

| Job | Target | Window | UTC schedule |
|---|---|---|---|
| `data-export-cleanup` | `data_exports` (user_data_gdpr only) | Per-row `expires_at` | 03:15 |
| `integration-sync-event-cleanup` | `sync_events` (succeeded only) | 90 days | 03:30 |
| `webhook-payload-purge` | `webhook_events` (delivered/processed only) | 90 days | 03:45 |
| `notification-purge` | `notifications` (read only) | 90 days | 04:00 |
| `audit-event-purge` | `audit_events` | 90 days | 04:15 |
| `activity-feed-purge` | `activity_feed_items` | 90 days | 04:30 |

**Every job honors `legal_hold = true`** as of Step 66.5 — rows under hold are excluded from the delete predicate.

User-deletion (Law 25 erasure) runs separately via `account-anonymization-sweep` at 05:00 UTC, executing the tombstone path in `src/domain/user-deletion.ts`.

## Pending in Step 66.6

- **Unified retention-sweep job** — drives deletion off `retention_until` + `legal_hold` for tables outside the operational tier (statutory, project-record, design-archive, privacy-fulfillment).
- **Project-closeout backfill** — when `projects.closed_at` is set, walk child rows and populate `retention_until` for `statutory_construction` and `project_record` tiers.
- **Self-serve legal-hold management** — admin UI to set/release holds by project, table, or organization (today they're set via direct DB update).
- **Per-org operational tier override** — shorten 90-day default to a 30-day floor.

## SOC 2 / Compliance mapping

This policy is the primary evidence artifact for:

- **CC6.1, CC6.7** — logical access controls (legal_hold management is admin-only)
- **CC7.2** — system monitoring (sweep activity feed in audit_events)
- **P4** — retention and disposal of personal information (the entire tier system)

Cross-referenced from [compliance_map.md](compliance_map.md) and [security_posture.md](security_posture.md) §6.
