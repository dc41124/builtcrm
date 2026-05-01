# RFI Quick-Capture: V1 Stubs to Productionize

**Surfaced during:** Step 55 (Field RFI Quick-Capture), 2026-04-30.
**Status:** Stubs shipping with Step 55; production gaps noted.

---

This spec catalogs the deliberate approximations in Step 55 v1. None
blocks the v1 demo. Promote in the order below for production cutover.

---

## 1. Structured GPS columns on `rfis`

### Current approximation
The Quick RFI FAB packs the GPS reading into `rfis.location_description`
as a prefix string (`"GPS 47.5605, -52.7126 · {transcript}"`). The data
is captured and queryable as text, but not as floats — you can't
filter "RFIs within 50m of point X" without a regex on the column.

### Production gap
Spatial queries (cluster RFIs by area, render RFIs as pins on the
drawing module the way Step 54 photos work, geofence alerts) all want
`numeric(9, 6)` lat/lng columns.

### Target design
- Add `location_lat`, `location_lng` columns to `rfis` (`numeric(9,6)`,
  nullable, with CHECK ranges).
- Backfill from `location_description` via a one-shot migration that
  greps the `GPS X.X, Y.Y` prefix.
- Update the Quick RFI FAB to send structured columns; keep the prefix
  in `location_description` for human readability (or drop it once the
  RFI workspace renders coords as a chip).

### Why deferred
Schema change. Step 55 is intentionally schema-free; columns are a
clean follow-up that can ship alongside Step 56 (Meeting Minutes AI)
or whenever the next batch of `rfis` schema work happens.

---

## 2. `projects.default_rfi_recipient_user_id` config column

### Current approximation
Quick-capture RFIs default `assignedToOrganizationId =
project.contractorOrganizationId` and leave `assignedToUserId` null.
The contractor org's general inbox is responsible for picking the
draft up.

### Production gap
Most contractors want a single named PM as the default recipient per
project (the "RFI inbox owner"). Routing to "anyone on the contractor
org" creates ambiguity about who has triaged a new draft.

### Target design
- Add `projects.default_rfi_recipient_user_id uuid REFERENCES users(id)
  ON DELETE SET NULL`.
- A new section in the contractor project settings page lets an admin
  pick the default recipient.
- The /api/rfis POST handler reads it and assigns there when the
  caller didn't pass `assignedToUserId`.

### Why deferred
Schema change. Same batch as the GPS columns above.

---

## 3. Server-side transcription (Step 56 hand-off)

### Current state
Web Speech API runs entirely in the browser. Accuracy varies; iOS
Safari support is partial; long-form dictation is unreliable.

### Production target (Step 56)
The build guide explicitly hands transcription off to Step 56's
Meeting Minutes AI infrastructure. When that lands, the Quick RFI FAB
gains a "send for transcription" path: persist the audio blob, kick a
background job (Trigger.dev), update the RFI body when the
transcription finishes. The Web Speech path stays as the live preview
during recording.

### Why deferred
Spec calls it out. No work for Step 55.

---

## 4. Photo offline outbox for Quick RFI

### Current approximation
The FAB uploads photos to R2 *before* enqueueing the parent RFI write.
If the device is offline at submit time, the user gets a "Save without
photo" path — the photo bytes are dropped on the floor.

### Production gap
A worker in a parking garage with no signal SHOULD be able to capture
a photo + dictate a description, hit submit, and have everything
queue. The daily-logs producer already does this for daily-log photos
(see `src/lib/offline/dailyLogs.ts` photo R2 chain).

### Target design
- Create `rfi_quick_create_photo` outbox kind (or generalize the
  daily-log photo chain into a generic `outbox_photo` kind, tracked in
  `offline_outbox_generic_producers.md`).
- Persist the blob in IndexedDB alongside the parent outbox row; drain
  the photo AFTER the parent succeeds, then PATCH the RFI's
  attachmentDocumentIds.
- Edge: if the photo fails permanently after the RFI is created, leave
  the RFI standing without the attachment + surface the orphan photo
  in the offline-queue UI for manual retry.

### Why deferred
Daily-logs already shipped this; the pattern is known. Step 55 v1 is
narrowed to ship the FAB UX; the photo-outbox slice is a distinct,
clean follow-up session.

---

## 5. Dedicated `rfi_idempotency_keys` table

### Current approximation
The route dedupes on `audit_events.metadata_json->>'clientUuid'`. This
works, but reads run a JSONB ->> filter on every replay which isn't
indexed.

### Production gap
Once volume grows, a JSONB filter on `audit_events` becomes a hot path
without an expression index, and the audit-events table is already a
firehose for every action across the app.

### Target design
Two cheap options when it bites:
1. Add a partial expression index on `audit_events ((metadata_json
   ->>'clientUuid')) WHERE object_type = 'rfi' AND action_name =
   'created'`.
2. Promote to a dedicated `rfi_idempotency_keys (project_id, client_uuid,
   rfi_id, created_at)` table.

Option 1 is the cheaper first step. Option 2 if multiple modules end
up needing the same dedupe pattern.

### Why deferred
Demo volume is small; the JSONB filter is fine for v1. Real flag is
when slow-query alerts show this filter eating budget.
