# Offline Outbox: Background Sync API + iOS Safari Strategy

**Surfaced during:** Step 51 (Offline-First Daily Logs + Photo Capture), 2026-04-30.
**Status:** Approximation shipping with Step 51; production gap noted.

---

## 1. Current approximation (Phase 4+ Step 51)

Drain triggers in Step 51:

- `window.addEventListener('online', drainQueue)` — fires when the tab comes back online while open.
- Manual "Sync now" button on `/contractor/settings/offline-queue`.

That covers the **happy path** — user is on site, captures a daily log offline, walks back to the truck, opens the app, sees pending count, drains. But it leaves three gaps:

1. **Tab closed mid-offline.** User submits a log offline, force-quits the browser (battery, distraction, end of day). When they later reopen the app online, drain fires on next load. Acceptable but slow — the log doesn't reach the office until the user remembers to open the app.
2. **App backgrounded for hours.** PWA installed on a phone, sits in the dock. The `online` event still fires when the OS gives the page CPU back, but PWA scheduling on iOS in particular is aggressive.
3. **iOS Safari has no Background Sync API.** Even on Chrome/Edge/Android, where Background Sync would let the service worker drain queued writes without the app being open, we can't rely on it as the primary path because ~40% of construction users (per gap analysis) are on iPhones.

## 2. Production gap

For a field-grade construction app, "the office should see the log within minutes of the user getting cell signal, regardless of whether the app is open" is the bar. The current approach gates that on user behavior (must reopen the app). Three concrete failure modes:

- **Compliance / inspection records.** A safety inspection logged offline at 2pm on a Friday should hit the office record before Monday morning, even if the user's phone goes to a hotel charger and the app isn't reopened until Tuesday.
- **Audit trail timing.** `submittedAt` reflects drain time on iOS (Decision-3 hybrid clock), so a Friday log arriving Tuesday looks like a Tuesday log unless the hybrid clock kicks in. Background Sync would shrink that window dramatically on Android.
- **Push-notification triggers.** If the office is waiting on a sub's RFI response, queueing the response on the sub's phone with no drain until app-reopen breaks the upstream notification chain. The PM gets paged hours late.

## 3. Target design

### Three-tier drain strategy

| Tier | Trigger | Platforms | Coverage |
|---|---|---|---|
| **T1: Foreground `online`** (current) | `window.online` event | All | Tab open + reconnects |
| **T2: Service-worker Background Sync** | `sync` event in SW | Chrome / Edge / Android | Tab closed, app backgrounded |
| **T3: Periodic Background Sync** | `periodicsync` event | Chrome desktop only | Long-tail catch-up |

iOS Safari sits at T1 only for the foreseeable future (no API, no roadmap). Mitigation for iOS:

- Aggressive in-app drain on every page load (already in T1).
- "Open app to sync" push-notification reminder if outbox is non-empty for > N hours (requires Web Push, separate decision — Apple finally added Web Push to PWAs in iOS 16.4 but it requires user-installed PWAs).
- **Native iOS shell** (Capacitor / Tauri) as a long-term escape hatch — gives us BackgroundFetch on iOS but is a Phase 11+ scope explosion.

### Service-worker registration shape

Add to `src/app/sw.ts` (Serwist):

```ts
import { Serwist } from "serwist";
import { drainOutbox } from "@/lib/offline/queue.sw";

self.addEventListener("sync", (event) => {
  if (event.tag === "outbox-drain") {
    event.waitUntil(drainOutbox());
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "outbox-periodic") {
    event.waitUntil(drainOutbox());
  }
});
```

The catch: `drainOutbox` in the SW context can't reuse `src/lib/offline/queue.ts` directly because that file imports `idb` for the main thread. Need a SW-safe variant (`queue.sw.ts`) that talks to the same IndexedDB stores. Single source of truth for store schema; two consumers.

### Registration on enqueue

When the main thread enqueues a write while offline:

```ts
// after idb.put(...)
if ("serviceWorker" in navigator && "SyncManager" in window) {
  const reg = await navigator.serviceWorker.ready;
  await reg.sync.register("outbox-drain"); // platform-conditional
}
```

`SyncManager` is the feature flag; `await reg.sync.register` queues the SW sync event.

### Periodic sync (T3)

For long-tail recovery (user installed the PWA, never opens it, but has a big offline write from days ago), `periodicSync.register("outbox-periodic", { minInterval: 24 * 60 * 60 * 1000 })`. Chrome desktop only; won't help mobile.

### Notification UX on iOS

When the user reopens the app and drain runs, they need to know what synced. Today's plan covers this with a "Synced 3" toast. The iOS-specific gap is the **before** state — multi-day-old pending writes the user forgot about. Surface in the offline-indicator banner: "3 pending sync · oldest 2 days." Pushes the user to the queue page if it bothers them.

## 4. Migration path

1. Confirm Step 51's T1 drain is reliable in dev across all four portals.
2. Refactor `src/lib/offline/queue.ts` into `queue.shared.ts` (store schema + types) + `queue.main.ts` (main-thread API) + `queue.sw.ts` (SW-thread API).
3. Add `sync` event handler to `sw.ts`, register `outbox-drain` tag from main thread on enqueue.
4. Feature-detect `SyncManager` and `PeriodicSyncManager`; gate registration on availability.
5. Add iOS-tail UX: oldest-pending-age in offline-indicator, "open app to sync" push notification (requires Web Push setup — separate decision).
6. Native iOS shell only if real-world iOS users complain about sync lag — defer.

## 5. Effort estimate

**Phase-size: S-M for tiers T1+T2, large for T3 + iOS native shell.** Service-worker drain handler ≈ 1 session. Periodic Sync ≈ 0.5 session (it's mostly registration). iOS push-reminder ≈ 1 session for backend + 1 for client. Native shell is multi-phase. Reasonable scope: bundle T2 + T3 + iOS-tail UX into a single ~2-session sub-step in "Phase 6.5: Offline Coverage Expansion" alongside the [generic producers](offline_outbox_generic_producers.md) work.

## Related

- Step 51 (`phase_4plus_build_guide.md`) — the originating step
- Step 50 (PWA scaffolding) — Serwist / sw.ts is the substrate
- [`offline_outbox_generic_producers.md`](offline_outbox_generic_producers.md) — the producer-coverage side of the story
