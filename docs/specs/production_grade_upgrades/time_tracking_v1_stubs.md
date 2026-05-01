# Time Tracking: V1 Stubs to Productionize

**Surfaced during:** Step 53 (Subcontractor Time Tracking), 2026-04-30.
**Status:** Stubs shipping with Step 53; production gaps noted.

---

This spec catalogs the four areas in Step 53 v1 that ship as stubs or
deliberate deferrals. Each is independently fixable; none blocks the v1
demo. Promote in the order below for a production cutover.

---

## 1. Overlap-prevention via Postgres exclusion constraint

### Current approximation
Overlap is enforced at the action layer by `assertNoOverlap()` in
`src/domain/actions/time-entries.ts`. It runs a `SELECT … LIMIT 1`
range-overlap check before every insert / update against the same
worker's other entries (open entries treat NOW() as their end).

### Production gap
App-level enforcement has a window. Two concurrent inserts can both pass
the SELECT and then both INSERT before either notices the other — the
classic check-then-act race. The damage radius is small (one worker, two
overlapping rows), but a live workforce of dozens of crews on the clock
will eventually trip this.

### Target design
- Enable `btree_gist` extension (touches `bootstrap_new_env.md`).
- Add an `EXCLUDE USING gist` constraint on `time_entries`:
  ```sql
  ALTER TABLE time_entries
    ADD CONSTRAINT time_entries_no_overlap
    EXCLUDE USING gist (
      user_id WITH =,
      tstzrange(clock_in_at, COALESCE(clock_out_at, 'infinity'::timestamptz), '[)') WITH &&
    );
  ```
- Keep `assertNoOverlap()` as a friendly pre-check (turns the constraint
  violation into a 409 with a helpful message instead of a generic 500).

### Why deferred
Adding a Postgres extension touches every fresh-env bootstrap path. Step
53 ships clean overlap behavior in the common case; the corner-case race
is a Phase 6.5 hardening task.

---

## 2. PWA offline outbox for time entries

### Current approximation
The schema reserves `time_entries.client_uuid` (uuid, unique) for the
future outbox idempotency key. The `clockIn` action already honours it
on retry (returns the existing row id without inserting). The clock-in
modal's connection toggle and the "Offline · 2 queued" pill in the
prototype's top bar are deliberately omitted from the v1 page — there's
no real outbox to drain.

### Production gap
The build-guide spec (#7 under Step 53) explicitly calls for
"Offline-capable" — workers in basements, parking garages, and tower
elevators routinely lose signal and need clock-in/out to be reliable
across connectivity blips.

### Target design
Reuse the safety-forms outbox pattern (Step 51 IndexedDB chain). Time
entries are smaller payloads — clock-in carries no photos. The producer
chain:
1. Worker taps Clock In → write to local IndexedDB with a freshly minted
   `client_uuid` and `status: "queued"`.
2. Background sync drains the queue against `POST /api/time-entries`
   with `mode: "clock-in"`. Server returns 200 → flip local row to
   `running`.
3. Clock Out resolves locally first (records the offline timestamp),
   queues a `POST /api/time-entries/clock-out` (which doesn't yet take
   a `clientClockOutAt` — a v1 production add).
4. Manual entries queue identically.

### Why deferred
The PWA story is bigger than time-tracking — it depends on the
service-worker shell and the generic outbox infrastructure tracked in
`offline_outbox_generic_producers.md`. Step 53 lands the schema hooks
(`client_uuid`); the wiring is a dedicated session.

---

## 3. Mobile today-board "big Clock In" button — ✅ SHIPPED 2026-04-30

### Status
Full mobile PWA surface ships at `/m/time` and `/m/time/timesheet`.
Reuses the same `/api/time-entries` endpoints + `getWorkerWeekView`
loader; no API changes. The `/subcontractor/today` desktop surface is
intentionally still untouched per the original Step 53 scope — the
mobile users land on `/m/time` instead, which is the proper PWA home
for field workers.

### What shipped
- **`/m/time`** — big circular clock-in/out button (140×140), running
  timer with seconds-blink colon, today's entries strip with status
  border-left, GPS toggle, bottom nav, FAB. Bottom-sheet modal for
  clock-in (project + task + notes + offline banner) and clock-out
  (this-shift summary + notes).
- **`/m/time/timesheet`** — per-day stacked cards with totals, week
  navigator, sticky submit-week CTA when drafts exist in the current
  week.
- Both screens share the `/m` route segment with no portal shell;
  `viewport-fit: cover` + safe-area insets respected.

### Original target design (preserved for reference)
Add a top-of-page "Time" card on the today board: idle / running /
clock-out states with a pulsing green LED. STILL DEFERRED — the
`/subcontractor/today` desktop card was not touched. If we later want
the time card on the desktop today board, that's a separate slice.

---

## 4. Real geolocation capture

### Current approximation
The `time_entries` schema accepts `location_lat` / `location_lng`. The
clock-in modal exposes a "Capture GPS at clock-in" toggle. The toggle
flips a state bit but the action does **not** call
`navigator.geolocation.getCurrentPosition()` — it always submits `null`
for both columns. Honest demo: the UI affordance + storage are real;
the actual browser permission prompt is wired up, just not making the
geolocation API call.

### Production gap
GPS is a key payroll-fraud-prevention feature for sub admins. Workers
clocking in from home instead of the jobsite is a real cost — the
location anchor is the cheapest signal we can capture.

### Target design
- Add a thin client helper (`src/lib/time-tracking/geolocation.ts`):
  ```ts
  export async function captureGps(): Promise<{ lat: number; lng: number } | null> {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000, maximumAge: 60_000 },
      );
    });
  }
  ```
- Call it from `time-shell.tsx`'s `handleClockIn` when `captureGps` is
  true. Pass the result to `/api/time-entries`.
- Show a "Locating…" spinner during the prompt; gracefully accept
  permission-denied and continue without coords.

### Why deferred
GPS is one line of UI logic away. It was held out of v1 to keep the
demo deterministic (browser geolocation prompts are flaky in headless
test environments). Production cutover: 1-day task.

---

## 5. Contractor visibility ladder

### Current implementation
The contractor reports tile (`reports-ui.tsx`, "Time Tracking Rollup")
reads `getContractorTimeRollup` — aggregated approved/submitted hours
by project and by sub crew. **No raw row access.**

### Production gap (deliberate, captured for review)
A contractor might legitimately need per-day visibility on a sub crew
when reconciling a labor-cost dispute. The current rollup gives them
totals only.

### Target design (when needed)
Two ladders:
- **Sub admin opt-in.** Sub admin can flag a project as
  "contractor-visible time entries" → contractor reports tile
  drills down into per-day rows for that project only.
- **Forensic mode.** A contractor admin can request a per-row export
  for a specific worker + date range; sub admin must approve. The
  request + approval sit in `audit_events`.

### Why deferred
Privacy default: sub-internal payroll data stays sub-internal. We'll
ladder up only when a real customer asks — not speculatively.
