# Offline Outbox: Generic-Producer Coverage

**Surfaced during:** Step 51 (Offline-First Daily Logs + Photo Capture), 2026-04-30.
**Status:** Approximation shipping with Step 51; production gap noted.

---

## 1. Current approximation (Phase 4+ Step 51)

The IndexedDB outbox at `src/lib/offline/queue.ts` is built generically — it stores rows of `{ kind, payload, attempts, status, … }` and a registry maps `kind` → drain handler. But only **one producer** is registered:

- `daily_log_create` (with chained `photo_link` follow-ups)

Every other field-mutating action stays online-required:
- RFI responses (subcontractors on site, often spotty cell)
- Inspection result completions (quality / safety walks)
- Punch-item status updates (close-out push)
- Daily-log crew entries (subs reporting hours)
- Submittal review actions, transmittal acknowledgments, drawing markups

If the user is offline and tries any of those, the existing fetch fails and the form throws. No queue, no recovery.

## 2. Production gap

A field-grade construction app needs **all** mutating actions resilient to spotty connectivity, not just daily logs. The Step 51 spec scoped narrowly to keep the conflict story manageable (daily logs have a single dedup key — `(projectId, logDate)` — and a clear per-day quantum). Other surfaces have richer conflict semantics:

- **RFI responses**: thread-ordered with state machine (open / awaiting / answered). Two offline replies on the same RFI are not symmetric — order matters.
- **Inspection results**: per-item / per-zone, but a completed inspection finalizes everything. Mid-completion offline edits + a parallel online "complete" action need explicit reconciliation.
- **Punch-item updates**: status transitions are ordered (`open → in_progress → ready_for_review → closed`). LWW is wrong.
- **Crew entries**: payroll-adjacent. Conflicts here have legal and billing weight.

So the right model is: each producer registers its own conflict resolver, retry policy, and post-drain side effects. The outbox is the substrate; the producer brings the policy.

## 3. Target design

### Producer registry shape (already partly in place)

```ts
type OutboxProducer<P> = {
  kind: string;
  drain: (row: OutboxRow<P>) => Promise<DrainResult>;
  describe: (payload: P) => { title: string; subtitle?: string };
  conflictPolicy: "reject_quarantine" | "lww_with_backup" | "merge" | "custom";
  resolveConflict?: (row: OutboxRow<P>, serverError: ApiError) => Promise<DrainResult>;
};
```

### Producers to register (priority order)

1. **`rfi_response_create`** — sub posts an answer offline. Server-side ordering is by submitted_at; offline submitted_at uses Decision-3 hybrid clock (same as Step 51). Conflict if the RFI was closed in parallel: quarantine, surface "RFI closed before your response synced — reopen?" UX.
2. **`punch_item_status_update`** — state transitions. Reject-quarantine on illegal transitions (e.g., trying to mark `closed` when it's already `verified`).
3. **`inspection_result_upsert`** — per-item, idempotent on `(inspectionId, itemId, completedAt)`. Background sync only — no UI interrupt.
4. **`daily_log_crew_entry_create`** — subcontractor side of daily logs. Same hybrid-clock authority as the GC log itself; reject-quarantine if the parent log isn't visible to the user (org-membership change while offline).
5. **`submittal_review_action`** — approve / return-with-comments. Same state-machine hazard as punch items.
6. **`drawing_markup_create`** — per-sheet pin/comment. Last-write-wins is fine here (markups don't supersede each other), but photo-style chained R2 upload applies.
7. **`transmittal_recipient_ack`** — anonymous-recipient flow; needs the access token in the payload.

### Schema additions per producer

Each table that becomes a producer target needs a `client_uuid` column for idempotency (same pattern as the daily-logs migration shipping with Step 51). Migration size grows linearly with producer count.

### UI additions

The current `/contractor/settings/offline-queue` page lists pending writes by kind. Once multiple producers are registered, that page needs:
- Filter by kind
- Group by parent entity (e.g., all queued actions on RFI #432)
- Conflict-resolution sub-views per kind (each producer ships its own dialog)

### Sync orchestration

Single in-flight per kind today (so log-create finishes before its photo-links). With multiple producers, ordering across kinds matters:
- Drain creates before updates before deletes
- Drain parents before children (log-create before photo-link, RFI-response before reply-to-response)
- Topological sort on `dependsOn` references between rows

## 4. Migration path

1. Confirm Step 51 daily-logs producer is stable in dev for ≥ 2 sessions (no false-conflicts, no orphan photos).
2. Land `client_uuid` schema migrations for each new producer table in one batch (cheap — they're nullable text/uuid).
3. Register producers in priority order above; ship one per session, each with conflict UX.
4. Refactor queue page to support multi-kind grouping + per-kind conflict resolvers.
5. Add cross-kind dependency resolver to drain order.

## 5. Effort estimate

**Phase-size: M-L per producer batch.** Producers 1–3 (RFI, punch, inspection) are P1 — same field-use case as daily logs. Producers 4–7 are P2 (mixed surfaces, narrower offline need). All seven plus orchestration work ≈ a 6–8 session sub-phase. Best done as a dedicated "Phase 6.5: Offline Coverage Expansion" after Steps 51–53 land.

## Related

- Step 51 (`phase_4plus_build_guide.md`) — the originating step
- [`offline_background_sync_api.md`](offline_background_sync_api.md) — the iOS Safari / Background Sync side of the story
