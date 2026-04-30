# Safety Forms: Template Field Editor

**Surfaced during:** Step 52 (Safety Forms), 2026-04-30.
**Status:** Approximation shipping with Step 52; production gap noted.

---

## 1. Current approximation (Phase 4+ Step 52)

The contractor template detail page shows the prototype's read-only field
list — number, icon, label, required badge, type tag — exactly as the
prototype JSX defines:

```jsx
<div className="sf-tpl-field">
  <span className="sf-tpl-field-num">{seq}</span>
  <span className="sf-tpl-field-icon">{iconForType}</span>
  <span className="sf-tpl-field-label">{f.label}</span>
  {f.required && <span className="sf-tpl-field-req">REQUIRED</span>}
  <span className="sf-tpl-field-type">{f.type}</span>
</div>
```

The prototype's subhead reads: *"These render in mobile order during
completion. Drag to reorder, tap to edit."*

In v1 we don't ship reorder or edit. Templates are author-time fixtures
seeded into each org by `scripts/bootstrap_new_env.ts`. To change a
template field, an engineer edits the seed file and re-runs the seed (or
the user duplicates a template via the existing duplicate button — also a
v1.5 affordance, not in this step's scope).

This is fine for the portfolio demo because:
- The seeded library covers 6 templates across all 4 form types.
- The prototype shows "duplicate" but the duplicated template would be
  identical to the source — no in-app edit means no real customization.

It is not fine in production.

## 2. Production gap

Real safety programs are organization-specific:
- A roofing GC needs different JHA fields than a plumbing GC.
- A particular company's incident-report form has to match their insurer's
  required-fields list, which changes every renewal cycle.
- Subcontractors get added to a project mid-build and the GC realises they
  need a hot-work-permit JHA template — the GC needs to author it in-app,
  not file an engineering ticket.

OSHA + bonding-company audits also expect that the contractor can produce
the historical version of a template that was in effect when a given form
was filled out. That requires versioning, not just an edit.

## 3. Target design

### Editor UX

- Template detail → "Edit fields" button (already in prototype, currently
  no-op).
- Drag handle on each field row (use `react-beautiful-dnd` or
  `dnd-kit/sortable`).
- Click a field → side drawer opens with: label, type, required toggle,
  hint, options (for select/checklist), and a per-type config block.
- "Add field" CTA at the bottom — type picker covers the 11 types from
  the prototype (text, textarea, select, checklist, datetime, signature,
  photo, attendees, people, hazards, actions).
- Save → validates structure (no duplicate keys, options not empty for
  select, etc.) and writes a new template version.

### Versioning

Add a `version` integer to `safety_form_templates` and bump on every
save. `safety_forms.template_version` references the version that was
active at submission. Old versions are retained read-only for audit
reproducibility (`safety_form_template_versions` table).

```
safety_form_template_versions
  id                  uuid pk
  template_id         uuid FK
  version             integer
  fields_json         jsonb
  saved_by_user_id    uuid FK
  saved_at            timestamptz
  UNIQUE (template_id, version)
```

Submission `data_json` continues to reference field keys; the renderer
loads `safety_form_template_versions` if `template_version != current`.

### Optional: validation rules per field

A field config can include validation hints — min length, regex, max
attendees, required-photo-count. Renders client-side and server-side.
Defer to a v2 of the editor; v1 ships type + label + required + hint +
options only.

## 4. Migration path

1. Add `version` column to `safety_form_templates` (default 1).
2. Add `template_version` column to `safety_forms` (denormalised).
3. Add `safety_form_template_versions` table.
4. On every save in the editor, bump `version` and append a row.
5. Build the field-editor drawer + drag-reorder UI.
6. Validation pass (Zod schema for `fields_json` shape per field type).
7. Rendering: form wizard reads `safety_form_template_versions` joined on
   the form's `template_version` so historical forms render with their
   original field set.

## 5. Effort estimate

**Phase-size: M.** Schema + version table = 1 session. Editor drawer +
drag-reorder + Zod validation = 2 sessions. Total ~3 sessions, ideally
right after the corrective-action tracker since both are post-Step-52
safety-quality-of-life work.

## Related

- Step 52 (`phase_4plus_build_guide.md`) — the originating step
- [`safety_corrective_action_tracker.md`](safety_corrective_action_tracker.md)
  — the other Step 52 follow-up
