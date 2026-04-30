# Safety Forms: First-Class Corrective Action Tracker

**Surfaced during:** Step 52 (Safety Forms), 2026-04-30.
**Status:** Approximation shipping with Step 52; production gap noted.

---

## 1. Current approximation (Phase 4+ Step 52)

Corrective actions on incident reports ship as denormalized JSON inside
`safety_form_incidents.corrective_actions_json`:

```json
[
  { "id": "ca-1", "action": "Add hand-deburr tool to mandatory tool kit",
    "owner": "Mike Sullivan", "due": "2026-04-23" },
  …
]
```

The contractor sees them on the incident detail page. They render. They are
audit-trail visible. But they have no lifecycle:

- No status field (`open` / `in_progress` / `verified` / `closed`).
- No reminder notifications when due dates approach or pass.
- No closeout gate — a project can ship to closeout with open CAs hanging.
- No cross-incident view — "show me every open CA across the org" is
  impossible without scanning every incident's JSON column.
- No standalone audit trail per CA (who edited what, when).
- Owner is free-text, not an FK to `users`. So @-mention notifications and
  per-user CA lists don't work.

## 2. Production gap

OSHA / surety auditors and bonding companies want to see: *"Show me every
corrective action from any safety incident in the last 12 months. For each,
show the open date, current status, who owns it, when it was verified
closed, and the audit trail of edits."* The denormalized JSON makes this
either a per-incident scrape or impossible.

Insurers use CA closure rate as a leading indicator of safety culture.
Construction GCs that bid on public work need to demonstrate active
mitigation tracking — not just "we wrote it down."

## 3. Target design

### New table: `safety_corrective_actions`

```
id                       uuid pk
safety_form_id           uuid not null  FK → safety_forms.id (cascade)
sequence                 integer not null  -- 1, 2, 3 within the parent form
action_text              text not null
owner_user_id            uuid FK → users.id (restrict)
owner_organization_id    uuid FK → organizations.id (restrict)
due_date                 date
status                   enum  ('open' | 'in_progress' | 'verified' | 'closed' | 'cancelled')
opened_at                timestamptz not null
status_changed_at        timestamptz
verified_by_user_id      uuid FK → users.id
verified_at              timestamptz
closed_at                timestamptz
closeout_blocking        boolean default true   -- if true, blocks project closeout
created_at / updated_at
UNIQUE (safety_form_id, sequence)
```

### UI additions

- **Per-incident**: replace the inline cards with a CA tracker block that
  shows status, due-soon highlights, and a status-change action.
- **Project-level**: `/contractor/project/[projectId]/safety-forms/corrective-actions`
  page — open CAs across all incidents on the project.
- **Org-level**: `/contractor/(global)/safety/corrective-actions` —
  cross-project queue. Filter by status, owner, due window.
- **My CAs**: the assigned user sees their CAs in a dashboard widget.
- **Closeout gate**: closeout package builder (Step 47) refuses to advance
  to "ready for client" if any CA on this project is `closeout_blocking`
  and not `closed` / `cancelled`.

### Notifications

- Daily check at 9am project-local time: any CA where `due_date <= today + 3`
  and status in (`open`, `in_progress`) → email + push to `owner_user_id`.
- Status flip to `verified` → notify the original incident reporter.
- Status flip to `closed` → notify project admins.

### Migration path from JSON

`safety_form_incidents.corrective_actions_json` keeps existing rows. New
incidents write to both — JSON for back-compat, table rows for tracking.
Once the new table is live in prod for one full incident-cycle, drop the
JSON column in a follow-up migration.

## 4. Migration path

1. Add `safety_corrective_actions` table + status enum (one new migration).
2. Backfill: for each existing `safety_form_incidents.corrective_actions_json`
   array, insert one row per element with `status='open'`.
3. Update incident POST handler to dual-write (JSON + table) for one cycle.
4. Build CA list pages (project + org).
5. Wire closeout-blocking gate into Step 47's package builder.
6. Daily reminder job (Trigger.dev, runs at 9am per project timezone).
7. Drop `corrective_actions_json` column once dual-write has been live ≥30 days.

## 5. Effort estimate

**Phase-size: M.** Schema + backfill = 1 session. List pages + closeout gate
= 1 session. Daily reminder + notifications = 1 session. Total ~3 sessions
in Phase 6.5 (or whenever a real customer asks).

## Related

- Step 52 (`phase_4plus_build_guide.md`) — the originating step
- Step 47 (closeout packages) — where the closeout-blocking gate hooks in
- Step 22 (notifications) — what the daily reminders ride on
