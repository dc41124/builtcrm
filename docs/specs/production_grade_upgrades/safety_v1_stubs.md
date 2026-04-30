# Safety Forms: V1 Stubs to Productionize

**Surfaced during:** Step 52 (Safety Forms), 2026-04-30.
**Status:** Stubs shipping with Step 52; production gap noted.

---

This spec catalogs the four UI affordances + computed metrics that ship as
stubs / placeholders in Step 52 v1. Each is independently fixable; none
blocks the v1 demo. Real customers should not see these in their first
impression of the product, so promote in the order below for a production
cutover.

---

## 1. PDF export of safety-form history

### Current approximation
The contractor workspace and submission-detail pages render an "Export
PDF" / "Export history" button that calls `alert("PDF export — coming
next")` (workspace) or is a no-op (`<button type="button">` with no
handler) on the detail page.

### Production gap
The build guide explicitly calls for this:
> Report export: safety form history per project as PDF.

Auditors and project closeout binders need a portable record of every
safety-form submission. Without it, the only export path is "screenshot
each submission" — not viable at any real construction scale.

### Target design
- New route: `GET /api/safety-forms/export?projectId=…&from=…&to=…&types=…`
- Reuse `src/lib/pdf/` infrastructure (transmittals + closeout already
  use it). Generate a multi-form PDF with:
  - Cover page: project name, date range, total counts by type.
  - One section per submission — full data, signatures (rendered from
    inline base64), photos (proxied from R2 with presigned URLs).
  - Audit trail page: per-form submitted-at, submitted-by, flagged status.
- Per-submission single-form PDF on the detail page's "Export PDF"
  button — one route, optional `formId` filter.

### Effort estimate
**S–M.** ~1 session including header/footer styling.

---

## 2. Photo capture in the wizard (real R2 upload chain)

### Current approximation
The wizard's `photo` field type renders a "Take photo" button that emits
client-minted `IMG_####` tokens into `data_json`. The contractor detail
page renders these as placeholder `has-img` tiles labelled "IMG_1234.jpg"
with no actual image bytes anywhere.

```ts
// src/app/(portal)/safety-forms-shared.tsx — FieldRenderer photo case
onClick={() =>
  onChange([...arr, `IMG_${Math.floor(1000 + Math.random() * 9000)}`])
}
```

### Production gap
The build guide:
> Mobile UI: templated form completion, photo attach, signature field.
> Photos: stored as blobs in IndexedDB until synced. Thumbnail generated
> locally for in-app display.

Subs in the field need to capture incident scenes, sign-in sheets, and
JHA setups. Without real photo capture this is a screenshot demo, not a
field tool.

### Target design
- `<input type="file" accept="image/*" capture="environment">` on the
  photo field for mobile camera launch; fallback to file picker on
  desktop.
- Online path: presigned R2 PUT (existing `/api/upload/request`) →
  `/api/upload/finalize` → store the returned `documentId` in
  `data_json[fieldKey]` (array of UUIDs).
- Offline path: store the blob + 160×160 thumbnail in IndexedDB via
  the existing Step 51 `photos` store (already there for daily logs);
  extend `safety_form_create` producer to walk the same 4-step R2 chain
  as `daily_log_create` after the parent form is created.
- `safety_form_incidents.photo_count` becomes the count of linked
  documentIds rather than the placeholder integer it is today.
- Detail page reads documentIds, presigns download URLs, renders
  thumbnails inline.

### Effort estimate
**M.** ~1.5 sessions — most of the lift is already in the Step 51
producer pattern; this is a second producer kind that reuses the chain.

---

## 3. Subcontractor template-assignment UI

### Current approximation
The API exists (`PUT /api/safety-form-templates/[id]/assignments`,
replace-all semantics) and is unit-tested. The contractor template
detail page (`/contractor/settings/safety-templates/[templateId]`) has
no UI to invoke it. The decision to give subs visibility on a template
must currently be made by hitting the API directly — fine for the demo
because the dev seed populates a sensible default, but useless for any
real onboarding.

### Production gap
Per Step 52 Decision 6, sub visibility is gated by per-template
assignments. With no UI, that gate either stays empty (subs see nothing)
or stays at whatever the seed inserted. Real GCs need to onboard a sub
mid-project and immediately decide which safety templates that sub crew
sees.

### Target design
- On the template detail page, add an "Assign to subs" panel:
  - Table of all sub orgs the contractor has on any active project.
  - Per row: a multi-select of project IDs (or "all projects" toggle).
  - Save button calls the existing PUT endpoint with the assembled
    assignment array.
- Optional bulk action on the templates index page: "Assign Daily
  Toolbox Talk to all subs on Riverside Office Complex."
- Soft confirmation: "Marcus Chen at Steel Frame Co. will see this
  template starting now."

### Effort estimate
**S–M.** ~1 session. Pairs naturally with the field-editor work
(`safety_template_field_editor.md`) since both are template-detail-page
features.

---

## 4. OSHA recordable rate calculation

### Current approximation
The reports panel and the workspace's right-rail "Compliance posture"
card both render `OSHA recordable rate: 0.00` and `Toolbox talk
completion: 96%` as static / approximated values.

```ts
// src/domain/loaders/safety-report.ts
const toolboxTalkCompletionPct = Math.min(
  100,
  Math.round((totals.toolboxTalks / Math.max(1, projectRows.length)) * 14),
);
```

The "184 days without lost time" value falls back to a fixed 184 when
there are no recent lost-time events — not a real running counter from
the most recent recorded incident.

### Production gap
OSHA's recordable incident rate is `(recordable cases × 200,000) ÷
total hours worked`. The numerator is now real (it's the count of
`safety_form_incidents` rows where severity ∈ {recordable, lost_time,
fatality}). The denominator — total hours worked — does not exist
in the schema until Step 53 ships sub time tracking.

Toolbox talk completion percent is similar: the real metric is "talks
held ÷ project-days × crew-count." Without crew-day data (also Step 53)
this is a guess.

Bonding companies and surety providers ask for these numbers as
quarterly attestations. Demo-grade values won't pass an audit.

### Target design
- Wait for Step 53 (`time_entries` table). Then:
  - Sum `time_entries.duration_minutes / 60` per org-quarter for the
    OSHA rate denominator.
  - Compute `recordableRate = (recordableCount * 200_000) / totalHours`
    with explicit time-window filters (last 12 months, last quarter, etc).
  - Toolbox completion = (toolbox-talk count) / (sum of crew-days from
    `daily_log_crew_entries`).
- "Days without lost time" — running counter from the most recent
  incident with severity ∈ {lost_time, fatality}, capped to project
  start when there's never been one.
- Surface the calc methodology in a tooltip per metric so auditors can
  reproduce.

### Effort estimate
**S** for the calc itself once Step 53 lands. ~0.5 session + tests. The
gating dependency is Step 53, not the calc.

---

## Summary

| Stub | Effort | Gating | Recommended order |
|---|---|---|---|
| 1. PDF export | S–M | None | First — auditors will ask for this |
| 2. Photo capture | M | None | Second — biggest field-experience gap |
| 3. Sub assignment UI | S–M | None | Third — pair with template field editor |
| 4. OSHA rate calc | S | Step 53 | Last — gated by hours data |

Total ≈ 4–5 sessions across the four. Best done as one "Phase 6.5:
Safety v2" sub-step after the corrective-action tracker
(`safety_corrective_action_tracker.md`) and template field editor
(`safety_template_field_editor.md`).

## Related

- Step 52 (`phase_4plus_build_guide.md`) — the originating step
- [`safety_corrective_action_tracker.md`](safety_corrective_action_tracker.md) — companion follow-up
- [`safety_template_field_editor.md`](safety_template_field_editor.md) — companion follow-up
- Step 53 (`phase_4plus_build_guide.md`) — gates stub #4 (OSHA rate calc)
