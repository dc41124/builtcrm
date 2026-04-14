# Step 18 — Documents: handoff note

## What shipped

Role-scoped document browser wired into all three project portal pages.
Reuses the Step 8 R2 upload plumbing (`/api/upload/request` +
`/api/upload/finalize`); this step adds metadata editing, archive, and
supersession.

### New files

- `src/app/api/documents/[id]/route.ts` — `PATCH` title /
  documentType / visibilityScope / audienceScope / documentStatus
  (archive + restore). Writes `document.updated`, `document.archived`,
  or `document.restored` audit events.
- `src/app/api/documents/[id]/supersede/route.ts` — `POST` replace-and-
  archive. Takes a freshly-uploaded `storageKey`, creates a new
  `documents` row inheriting type / visibility / audience from the
  prior row, flips the prior row to `is_superseded=true` +
  `document_status='superseded'`, and writes a `document_links` row on
  the NEW row with `link_role='supersedes'` pointing at the old id.
  Writes two audit events in the same txn (`document.superseded` on
  prior, `document.uploaded` on new).
- `src/components/documents-ui.tsx` — shared client component. Grouped
  list by `documentType`, inline metadata edit, archive, supersede
  (uploads a new file then calls the supersede route), download via
  `/api/files/[documentId]`. Toggle to show/hide superseded versions.

### Modified files

- `src/domain/loaders/project-home.ts` — added `DocumentRow`,
  `DocumentLinkRow` types and a `loadDocumentsForProject(projectId,
  audience)` helper. Wired a `documents` field into
  `ContractorProjectView`, `SubcontractorProjectView`, and
  `ClientProjectView`.
- `src/app/(portal)/contractor/project/[projectId]/page.tsx`,
  `src/app/(portal)/subcontractor/project/[projectId]/page.tsx`,
  `src/app/(portal)/client/project/[projectId]/page.tsx` — each renders
  `<DocumentsPanel>`. Client portal passes `canWrite={false}`.

## Design rules applied

- **No schema change.** Supersession is modelled entirely via
  `document_links` rows with `link_role='supersedes'` (schema rule:
  don't add columns; no `document_versions` table). The supersession
  pointer `supersededByDocumentId` on `DocumentRow` is resolved at load
  time by querying `document_links` where
  `(linkedObjectType='document', linkRole='supersedes', linkedObjectId
  in <doc ids>)` and flipping the direction — the NEW document carries
  the link back to the OLD one.
- **Role-scoped reads.** `loadDocumentsForProject` filters rows by an
  `audience` argument the caller passes in (contractor / subcontractor
  / client):
  - `contractor`: everything except `archived`.
  - `subcontractor`: excludes `visibility_scope='internal_only'` and any
    row whose `audience_scope` is `internal`, `client`,
    `commercial_client`, or `residential_client`. So subs see
    contractor / subcontractor / mixed rows that aren't marked
    internal-only.
  - `client`: only `visibility_scope` in (`project_wide`,
    `client_visible`), and only `audience_scope` in (`client`,
    `commercial_client`, `residential_client`, `mixed`).
  - All audiences exclude `documentStatus='archived'`.
- **Write gate.** `document.write` policy covers contractor_admin,
  contractor_pm, and subcontractor_user (clients are read-only). On
  top of the policy gate, the `PATCH` and `supersede` routes enforce
  "only the original uploader OR a contractor can edit" by checking
  `uploadedByUserId === ctx.user.id` when the actor is a
  subcontractor. Superseded rows are immutable (409 on edit).
- **Audit events.** `document.updated`, `document.archived`,
  `document.restored`, `document.superseded`, and
  `document.uploaded` (for the new row created during supersession).
  No activity-feed entries — documents are not approval-worthy, same
  rule as messages.
- **Storage key guard.** The supersede route re-applies the same
  `${orgId}/${projectId}/` prefix check and `objectExists` probe that
  the Step 8 finalize route uses, so a malicious client can't point a
  new document row at someone else's R2 object.

## Verification status

- TypeScript: `npx tsc --noEmit` is clean for everything in this
  step. The pre-existing `scripts/list-ids.ts(13,22)` error (projectCode
  possibly null) is still present from Step 17, unrelated.
- Not yet exercised in a browser. Dev server was not started. Manual
  test flow:
  1. Log in as contractor on a seeded project. Scroll to
     "Documents" → Upload form. Pick a PDF, set
     `visibility=project_wide`, `audience=mixed`, submit.
  2. The row should appear under its documentType group. Click
     "Download" — a new tab should open at a short-lived presigned
     URL.
  3. Click "Edit", change the title, save. Reload; change should
     persist.
  4. Click "Supersede", pick a different file. Prior row should gain
     a "(superseded)" badge and disappear unless the "Show superseded
     versions" checkbox is ticked. A new row should appear at the top
     of the same documentType group.
  5. Log in as a subcontractor on the same project. The mixed-audience
     doc should be visible. Upload a new doc as the sub with
     `visibility=internal_only` and `audience=contractor`, then reload
     as a different sub (on a project they both belong to) — the
     internal-only row should NOT appear. Verify contractor still sees
     it.
  6. Log in as client on the same project. Only `project_wide` /
     `client_visible` rows with client-friendly audience should show.
  7. Confirm audit_events rows for `document.updated`, `document.
     archived`, `document.superseded`, `document.uploaded`.

## Deferred / known limitations

- **Role isn't passed to the UI.** `DocumentsPanel` uses `canWrite` to
  gate the upload form and action buttons, and the server enforces
  per-row ownership. The UI optimistically shows "Edit" / "Supersede"
  on every writable row — a sub who clicks them on someone else's doc
  will get a 403 toast-style inline error. Fix later by passing the
  effective role down and pre-hiding the buttons.
- **No bulk actions.** Design mockup has bulk select + bulk download /
  share / delete. Not built — list view only, one row at a time.
- **No detail rail.** Mockup has a right-hand preview panel (metadata,
  version history, links). Explicitly deferred as a Phase 3 frontend
  concern.
- **No dedicated category tree.** Grouping is by `document_type`
  string only. The mockup's "Drawings / Submittals / COI" taxonomy can
  be enforced once we decide whether `document_type` is free-text or
  a controlled vocabulary.
- **Linked-object display is plain text.** `document.links` rows with
  `linkedObjectType != 'project'` render as `role→type:prefix` with no
  jump navigation, matching the Step 17 messages pattern.
- **Attachment picker for messages.** Step 17 left a TODO to wire a
  document picker into `messages-ui.tsx` now that Documents exists.
  Not done in this step — follow-up.
- **No `document.created` audit event path from `/api/upload/finalize`
  relabel.** The existing finalize route writes `document.uploaded`
  already; left alone to avoid churn.

## Suggested next step

Step 19 — Schedule / Timeline (read
`docs/design/schedule_timeline_shared.html`). Then circle back and
wire the document picker into `messages-ui.tsx`.
