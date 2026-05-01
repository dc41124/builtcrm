# Rate Limiting (per API key): V1 Stubs to Productionize

**Surfaced during:** Step 59 (Rate Limiting per API Key), 2026-05-01.
**Status:** Cached sliding-window limiters + per-key overrides
shipping with Step 59; supporting surfaces noted as gaps.

---

This spec catalogs the deliberate approximations in Step 59 v1. None
blocks the v1 portfolio demo — a reviewer can hammer `/api/v1/ping`
past 60/min and watch the 429 + `Retry-After` arrive, then watch the
counters reset on the next window. Promote in the order below for
production.

---

## 1. Admin UI to mutate per-key rate limits

### Current approximation
The two columns (`rate_limit_per_minute`, `rate_limit_per_hour`) are
populated read-only from the loader and surfaced in the UI as a
"Custom RL" pill on rows that have overrides. There's no Create- or
Edit-modal field, no API route to PATCH the values, no support
flow. Setting a custom limit today requires a SQL UPDATE.

### Production gap
- Customers asking for higher caps go through engineering instead of
  ops/support.
- No way to throttle a noisy customer down without revoking their
  key entirely.
- The "Custom RL" pill is informational dead weight when nothing
  shows it as actionable.

### Target design
- New API route `PATCH /api/contractor/api-keys/[id]` that accepts
  `{rateLimitPerMinute?: number | null, rateLimitPerHour?: number | null}`.
  Admin-only. `null` clears back to the default. Audit row
  `api_key.rate_limit_changed` with prev/new values.
- Two paths to set this:
  1. **Customer self-serve** — fields on the create-modal scope
     section, defaulted to "Use platform defaults" with an "Advanced"
     disclosure. Validation: minute cap ≤ hour cap, both > 0.
  2. **Platform admin support tool** — a hidden page (or feature
     flag) at `/internal/api-keys/[id]/limits` for the BuiltCRM team
     to raise individual customer caps without giving the customer
     the ability to set their own.
- UI: edit pencil icon next to "Custom RL" pill that opens an inline
  popover with the two number inputs.

### Why deferred
Portfolio mode — every reviewer key uses defaults. Slot in when
real customers ask.

---

## 2. Tests for the rate-limit surface

### Current approximation
Step 59 ships with zero new tests. Manual smoke confirms the 429
fires past 60/min, but the cached factory, the dual-window enforcement,
the header materialization, and the 429-with-`Retry-After` path are
unit-test-shaped functions that don't have unit tests.

### Production gap
Per the project's Definition of Done:

> 8. Any new API route has basic authorization tests (role-based —
> deny the wrong portal, deny the wrong org)

Specifically needed:
- `tests/lib/ratelimit-api-key.test.ts` — mock `@upstash/ratelimit`
  return shape, assert `enforceApiKeyRateLimit` runs both windows in
  parallel, picks the right `blockedBy`, computes `retryAfterSec`
  from the correct window's reset, header materialization shape,
  factory cache hit on second call with same tuple.
- `tests/api/v1-ping-rate-limit.test.ts` — fire 65 requests with one
  key, assert 60 succeed and 5 return 429 with `Retry-After` header
  set; confirm headers shape on the 60 successes.

### Target design
Mock `@upstash/ratelimit` at the SDK level (`vi.mock`) — no live
Redis calls in CI. The integration test against `/api/v1/ping` can
hit a stub Redis or in-memory shim.

### Why deferred
Same trade as Steps 56-58 — manual smoke verified. Test pyramid is
the next pass and bundles cleanly with the other deferred test work.

---

## 3. Limiter cache eviction policy

### Current approximation
`apiKeyLimiterCache: Map<string, Ratelimit>` is unbounded. Cache key
shape is `${limit}:${window}` — typically 2 entries (default min,
default hour). Each unique custom-limit pairing adds an entry.

### Production gap
A misconfigured admin or a future-feature that sets random per-key
limits could grow this map without bound. Each `Ratelimit` instance
is small but not free; many thousands of unique tuples in one
process is a memory + GC concern. `Ratelimit` instances also hold
references to the Redis client + analytics buffer (off here, but
still).

### Target design
- Cap at ~256 entries with a small LRU eviction policy. The realistic
  upper bound for a single deployment is "default + a few dozen
  enterprise-tier overrides" — 256 is an order of magnitude buffer.
- On eviction, the next request for that tuple constructs a fresh
  `Ratelimit` — no behavior change, just a GC opportunity.
- Add a metric / log line on first construction so we'd see runaway
  growth in observability.

### Why deferred
Today's actual cache size is 2. The unbounded-growth shape only
matters once §1 (admin UI for per-key limits) ships AND someone uses
it heavily.

---

## 4. Per-IP rate limit layered on top of per-key

### Current approximation
Per-key only. An attacker holding stolen keys (e.g. from a leaked
GitHub repo) can rotate them across requests and exhaust each one's
60/min cap independently — the IP doing the attacking is unbounded.

### Production gap
Defense-in-depth gap. Standard pattern is per-key + per-IP, with the
per-IP cap higher than per-key (e.g. 600/min) so legitimate multi-key
usage (CI runner shelling multiple integrations) isn't punished but
single-IP credential rotation gets caught.

### Target design
- New limiter `apiKeyIpLimiter` (sliding-window, 600/min) using
  `identifierFromRequest()` (already exists in `ratelimit.ts`) for
  the bucket key.
- Run it in `requireApiKey()` after the per-key check — same shape,
  separate counter. On block, 429 with a different `error` string
  (`per_ip_rate_limit_exceeded`) so partner integrations can
  distinguish.
- Consider exempting Cloudflare/Render proxy IPs from the per-IP
  layer (would block all traffic behind shared egress).

### Why deferred
Real defense is Cloudflare / WAF in front of the app. Per-IP rate
limits in app code matter most when there's no edge layer; until
the deployment moves off Render's free tier (no WAF), they're
nice-to-have.

---

## 5. Per-endpoint rate-limit overrides

### Current approximation
All `/api/v1/*` endpoints share the same per-key budget. A `GET
/api/v1/projects?limit=10` and a `POST /api/v1/projects` with 50KB
of attachments are weighted identically — both consume one unit.

### Production gap
Write-heavy or expensive endpoints (large file downloads, complex
report generation) deserve tighter limits than cheap reads. The
opposite is also true: a cheap status check shouldn't burn the same
budget as a heavy mutation.

### Target design
- `requireApiKey(req, scope, opts?)` accepts `{cost?: number}`
  defaulting to 1. Routes pass `{cost: 5}` for expensive operations.
- Sliding-window limiter would need to count units, not requests —
  `@upstash/ratelimit` doesn't natively support weighted counts, so
  this becomes a manual `INCRBY` + `EXPIRE` on the cached bucket
  shape.
- Alternative: separate "expensive" and "cheap" buckets per key
  (`per-min-cheap: 60, per-min-expensive: 6`) — simpler, less
  precise.

### Why deferred
We have one endpoint (`/ping`) and it's free. Land alongside Step 60's
real `/api/v1/*` surface when there's actually a cost gradient to
encode.

---

## 6. `/api/v1/usage` endpoint for clients to query their state

### Current approximation
Clients only see their rate-limit state on actual requests via
headers. To preflight-check "do I have budget for the next 10
calls," they have to make a call.

### Production gap
- Wasteful for clients with large pending workloads — they batch up
  500 calls, fire them, find out at #61 they're rate-limited, have
  to retry.
- Standard SaaS feature (Stripe `Rate-Limit` headers + `/v1/usage`
  patterns, GitHub `/rate_limit`).

### Target design
- `GET /api/v1/usage` — returns the current state for the requesting
  key without consuming budget. Implementation: `Ratelimit.getRemaining`
  pattern (Upstash exposes this) — peek at the bucket without
  incrementing.
- Same headers + JSON body as a regular response, but `_self: true`
  flag so clients can distinguish.

### Why deferred
Cosmetic until §5 (per-endpoint costs) lands. Without weighted
costs, client preflight-pacing is straightforward arithmetic against
the headers from any prior call.

---

## 7. Sustained-429 alerting + customer notifications

### Current approximation
A customer hitting their cap for hours generates 429s but no
notification. The next time they look at the API keys page they'll
see the cap on the banner; until then, silence.

### Production gap
- Healthy integration that outgrew its limit looks identical to a
  bug from outside.
- The fix (raise the cap, see §1) requires support intervention but
  no signal triggers that intervention.

### Target design
- Cron task `api-key-saturation-watcher` (Trigger.dev) runs every 15
  min, queries Upstash for keys whose `remaining` has been at 0 for
  >N consecutive windows, emits `api_key.sustained_throttle`
  notification to the owning org admin via the existing notification
  pipeline (Step 21 territory).
- Notification copy includes the key name, observed sustained 429s,
  and a deep-link to the API keys page where the user can request a
  cap raise (once §1 is wired).

### Why deferred
Notification surfaces from Phase 1 already exist; this is one extra
producer. Slot in when real customer traffic surfaces the need.

---

## 8. Header shape — RFC 9239 `RateLimit-Policy`

### Current approximation
We emit the de-facto standard `X-RateLimit-Limit / -Remaining /
-Reset` headers, plus extensions `X-RateLimit-Limit-Hour` and
`X-RateLimit-Remaining-Hour` for the second window. The `X-` prefix
itself is deprecated per RFC 6648 (informally), and multi-window
rate limits aren't standardized in the `X-RateLimit-*` family.

### Production gap
- Forward-looking API consumers (especially generators that read
  OpenAPI specs) expect the structured RFC 9239 shape:
  `RateLimit: limit=60, remaining=42, reset=18` plus
  `RateLimit-Policy: 60;w=60, 1000;w=3600`.
- Step 60 (API docs) will document whatever we emit — better to ship
  the standard shape before the docs lock in expectations.

### Target design
- Keep the `X-RateLimit-*` headers for backward compat (any client
  already wired to the de-facto shape keeps working).
- Add the RFC 9239 headers alongside.
- Update the API docs (Step 60) to document both, recommending the
  RFC 9239 shape.

### Why deferred
Cosmetic. No client integrations exist yet — there's nothing to break.
Slot in alongside Step 60.

---
