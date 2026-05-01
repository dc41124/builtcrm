# Per-Org API Keys: V1 Stubs to Productionize

**Surfaced during:** Step 58 (Per-Org API Key Management), 2026-05-01.
**Status:** Schema, hash helper, auth gate, CRUD, and UI shipping with
Step 58; supporting surfaces noted as gaps.

---

This spec catalogs the deliberate approximations in Step 58 v1. None
blocks the v1 portfolio demo — a reviewer can create a key in the UI,
copy it from the one-time-reveal modal, hit `GET /api/v1/ping` with
`Authorization: Bearer …`, and watch revocation kill subsequent
calls. Promote in the order below for production.

---

## 1. `api_key.used` audit events (sampled)

### Current approximation
Step 58 spec listed three audit events: `api_key.created`,
`api_key.revoked`, `api_key.used` (sampled). Only the first two land.
The auth helper bumps `api_keys.last_used_at` on success
(fire-and-forget) but never writes a `used` audit row, so the page's
"Recent activity" feed surfaces creation + revocation only.

### Production gap
- `last_used_at` is a single timestamp (latest call only) — no per-
  endpoint or per-time-bucket detail.
- Compliance / security review can't see "what did this key actually
  call last week?" without a separate request log.
- The page's "Recent usage" stat counts `used` audit events, so it
  always reads `0` until this lands.

### Target design
- In `requireApiKey()`, after `lastUsedAt` bump: write `api_key.used`
  audit row with `{method, pathname, status, scope, durationMs}` —
  but only every Nth call per key (e.g. 1-in-100, with N tunable per
  request volume). Sampling lives in Redis as a per-key counter.
- Bursty error states (auth failures, scope denials) escape the
  sampling and always log — those are the rows reviewers need to see
  in real time.
- UI's "Recent activity" panel already renders the `used` shape; just
  needs the rows to exist.

### Why deferred
The right sampling logic depends on Step 59's rate-limit Redis
counters — those land next, so wire `api_key.used` sampling on top
of that infrastructure rather than building parallel Redis counters
now.

---

## 2. Sandbox / test-mode keys (`bcrm_test_` prefix)

### Current approximation
Only `bcrm_live_` keys exist. The UI banner already mentions "Test-
mode keys are coming soon" matching the prototype copy; the schema
has no `kind` column.

### Production gap
- Reviewers integrating against a real org can't safely test
  destructive endpoints (delete project, etc.) without affecting
  production data.
- Standard SaaS pattern (Stripe `sk_test_`, OpenAI sandbox keys) —
  expected by anyone integrating.

### Target design
- Add `api_keys.kind` enum (`live | test`). Default `live`. Schema
  change — needs migration.
- `bcrm_test_` prefix for test keys; `parseBearerToken()` already
  accepts both shapes, just needs the prefix branching logic.
- Test-mode requests run against a separate `test` schema or get
  filtered by a `is_test_data: true` flag in app code. Schema
  approach is cleaner; flag approach is faster to ship.
- UI: scope picker becomes scope + mode picker on the create modal.
  Reveal modal shows the prefix in a different color so users don't
  confuse them.

### Why deferred
The whole point of test-mode is to exercise the full API surface —
which doesn't exist until Step 60 ships the documented endpoints.
Test keys without a real API to call would be empty ceremony.

---

## 3. Real `/api/v1/*` endpoint surface

### Current approximation
Only `GET /api/v1/ping` exists — a sample endpoint that exercises
`requireApiKey()` end-to-end and returns `{orgId, keyId, scopes,
effectiveScope}`. Sufficient to prove the auth chain works; not
useful as a real integration target.

### Production gap
The whole point of API keys is to authenticate programmatic access
to a real REST surface — projects, RFIs, change orders, draws,
documents, webhooks. None of those exist as `/api/v1/*` routes yet.

### Target design
Step 60 (Public API Docs Page) explicitly calls out the endpoints to
build first: "auth, projects (list/get), RFIs (list/get/create),
change orders (list/get), documents (list/get), webhooks
(subscribe/unsubscribe)." Each route:
- Wraps `requireApiKey(req, requiredScope)` with the right scope per
  resource (read endpoints → `read`, mutations → `write`, deletions
  / org-config → `admin`).
- Reads via `withTenant(ctx.orgId, ...)` so RLS enforces the org
  boundary even if app code forgets.
- Returns paginated JSON with `Link` headers (RFC 5988) for cursor
  pagination — matches GitHub/Stripe convention.

### Why deferred
This is literally Step 60. Step 58 ships the auth primitive; Step 60
wraps it with documented endpoints.

---

## 4. Per-key request metrics + dashboard

### Current approximation
The "Usage at a glance" stats panel renders four cards but the data
is sparse: active key count is real, "Recent usage" counts audit
events tagged `used` (always 0 until §1 lands), "Failed auth" counts
audit rows whose reason mentions `401` (also empty), and "Endpoint"
is just the static string `/api/v1/*`. The prototype's mock numbers
(14,287 / 184ms / etc.) aren't backed by real data yet.

### Production gap
- Contractors can't see "which key is hitting us hardest" or "is
  this key approaching its rate limit."
- No top-N endpoint breakdown per key.
- No 24h/7d/30d trend charts.

### Target design
- New table `api_key_request_metrics` (or roll into a generic
  `request_metrics` once a real ingest exists): aggregated per
  (key_id, hour_bucket, endpoint_template) with count + p50/p95/p99
  latency.
- Step 59's rate-limit Redis counters become the source of truth for
  the live "this minute" view; the table holds the historical
  rollup, populated by a Trigger.dev `request-metrics-rollup`
  scheduled task that drains Redis hourly.
- UI: replace the four-stat strip with a real chart strip — top-N
  endpoints (table), requests over time (sparkline), p95 latency
  (single number).

### Why deferred
Same dep as §1: needs Step 59's per-key Redis counters to exist
before there's anything to aggregate.

---

## 5. Pepper rotation procedure

### Current approximation
`API_KEY_PEPPER` is a single env var; losing it (or rotating it)
invalidates every issued API key immediately. There's no documented
procedure or dual-pepper read window for a clean roll.

### Production gap
- Pepper compromise → emergency rotation → every customer with API
  keys loses access until they regenerate. Not acceptable for any
  real integration.
- Routine pepper rotation (annual security hygiene) is currently a
  fire drill instead of a planned operation.

### Target design
- Support `API_KEY_PEPPER_PRIMARY` (used to hash new keys) and
  `API_KEY_PEPPER_SECONDARY` (read-only, for keys hashed before
  rotation). `requireApiKey()` tries primary first; on miss, tries
  secondary; on hit-via-secondary, optionally rehashes the row in
  place with the new pepper (silent re-encryption) and logs a
  metric.
- Document the rotation playbook: set secondary = current, set
  primary = new, deploy, wait 60 days for in-flight keys to migrate,
  remove secondary, deploy.
- Audit event `api_key.rehashed` tracks silent re-encryption for
  compliance.

### Why deferred
We have one pepper, set today, never rotated. The need only
crystallizes after an incident or when SOC 2 review asks the
question. Ship the procedure when the first customer cares.

---

## 6. Tests for API key surface

### Current approximation
Step 58 ships with zero new tests. The existing 202 tests still pass
end-to-end and the build/lint are clean, but the new code paths
(`src/lib/api-keys/*`, the four CRUD routes, the auth helper, the
sample `/api/v1/ping`) are validated only by manual smoke testing.

### Production gap
Per the project's Definition of Done (Phase 4+ build guide):

> 8. Any new API route has basic authorization tests (role-based —
> deny the wrong portal, deny the wrong org)

Specifically needed:
- `tests/lib/api-keys/hash.test.ts` — round-trip generate → hash →
  parse, modulo-bias guard on `randomBase62`, constant-time
  comparison correctness, parser rejection cases (wrong prefix,
  wrong length, non-base62 chars in tail).
- `tests/lib/api-keys/auth.test.ts` — happy path (valid key →
  context), revoked key → 401, missing header → 401, scope-too-low
  → 403, scope-rank elevation (admin grants write+read).
- `tests/api/contractor-api-keys.test.ts` — sub denied, client
  denied, contractor_pm denied on POST/DELETE/rotate but allowed on
  GET, contractor_admin allowed on all four, wrong-org member
  denied, full-key returned in POST response, prefix-only on GET.
- `tests/api/v1-ping.test.ts` — anon → 401, valid key → 200 with
  expected shape.

### Target design
Mock `dbAdmin` at the SDK level for unit tests; use the existing
`withRealDatabase` helper (or whatever the project's integration-
test bootstrap is) for the route tests.

### Why deferred
Same trade as Steps 56 and 57 — manual smoke verified, the test
pyramid is the next pass. Also blocks on Step 60 for full happy-
path integration coverage.

---

## 7. UI: "Test this key" inline button on the reveal modal

### Current approximation
The reveal modal shows the full key once and ends. The user copies
and goes elsewhere to verify it works. The "Test endpoint" quick-ref
card in the modal mentions `GET /api/v1/ping` but doesn't fire it.

### Production gap
- Friction. Users want to know the key actually works before they
  paste it into their integration.
- A failed first-call (typo, wrong env, etc.) is a 30-minute debug
  loop instead of a 30-second confidence check.

### Target design
- Add a "Test this key" button next to "Copy key" in the reveal
  modal. On click: `fetch("/api/v1/ping", { headers: { Authorization:
  \`Bearer ${revealedKey.fullKey}\` }})`. Show a green "Authenticated
  as <orgName>" pill on 200, red error message on non-200.
- Same test surface available from the row actions on every active
  key — but the user no longer has the full key for those, so the
  row test would have to be a "send a test request server-side using
  the stored key_hash to look up the key" operation, which is
  awkward. Skip for now.

### Why deferred
Cosmetic. The end-to-end flow already works; this is a friction
reduction. Slot in when polishing the demo.

---

## 8. "View full audit log" link from the activity panel

### Current approximation
The "Recent activity" panel shows the 10 most recent api_key.*
events. There's no overflow link to a full filtered audit view.

### Production gap
After a few weeks of usage, "10 most recent" misses most of what
matters. Compliance review needs the whole history filtered to
api_key events.

### Target design
- "View full audit log" button (already in the panel hdr) links to
  `/contractor/settings?tab=orgsec&filter=api_key` — leverages the
  existing audit-log surface in `SettingsShell` rather than building
  a parallel page.
- The settings audit-log filter currently doesn't accept a URL
  query-string preset; needs a small enhancement to read `?filter=`
  on mount and pre-populate.

### Why deferred
Small enough it could land any time. Bundle with the next
audit-log surface improvement.

---

## 9. Better Auth + API key unification (long term)

### Current approximation
The app has two parallel auth systems: Better Auth for human session
auth (cookie-backed), and the API key system for programmatic
access (Bearer-token). They share the same `users` and
`organizations` tables but the auth contexts diverge — `OrgContext`
(session-derived) vs `ApiKeyContext` (key-derived). Routes have to
pick one or the other.

### Production gap
- Routes that should be available to both surfaces (e.g. read
  endpoints that a human OR a script might call) need a dual-auth
  helper that accepts either credential and normalizes them.
- Without unification, every new route picks one or the other and
  gets the other one as a follow-up — duplicated maintenance.

### Target design
- New helper `requireAuth(req, opts)` that accepts session cookie OR
  Bearer token. Normalizes to a unified `ActorContext` shape that
  carries `{ kind: "user" | "api_key", orgId, userId?, keyId?,
  scopes }`.
- Routes that have hard requirements (e.g. "must be a human session
  for CSRF reasons") can opt out via `opts.requireKind = "user"`.
- Audit events grow an `actorKind` column to distinguish.

### Why deferred
Architectural change — needs careful rollout to avoid breaking the
existing session-only routes. Not blocking; the duplication is
manageable until the API surface is large.

---
