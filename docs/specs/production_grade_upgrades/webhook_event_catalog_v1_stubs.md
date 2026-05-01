# Webhook Event Catalog: V1 Stubs to Productionize

**Surfaced during:** Step 57 (Webhook Event Catalog Page), 2026-05-01.
**Status:** Catalog UI shipping with Step 57; emission + supporting surfaces noted as gaps.

---

This spec catalogs the deliberate approximations in Step 57 v1. The
catalog page is fully functional as a documentation artifact, but the
machinery it documents is mostly intentional — emission, schema
generation, and the surrounding endpoint-management surfaces still
need to land before this is a real outbound webhook product. None
blocks the v1 portfolio demo. Promote in the order below for production.

---

## 1. Outbound webhook emission (the actual emitter)

### Current approximation
The catalog documents the *intended* event surface, but no code in
`src/jobs/` or `src/app/api/` actually fires these events to external
endpoints. Step 26 wired the inbound `webhook_events` receiver
(`integration-webhook-processor.ts`) — the outbound side is a stub.

### Production gap
Without an emitter, the catalog is documentation for a feature that
doesn't exist. A reviewer who reads the catalog and then signs up to
register an endpoint gets nothing.

### Target design
- New `outbound_webhook_endpoints` table: `orgId`, `url`, `secret`
  (HMAC signing key), `enabledEventKeys` (text array — subset of
  catalog keys), `apiVersion` (e.g. `"v1.1"`), `status`
  (`active | paused | failing`), `lastSuccessAt`, `lastFailureAt`,
  `consecutiveFailures`.
- New `outbound_webhook_deliveries` table mirroring the inbound
  `webhook_events` shape: `endpointId`, `eventKey`, `payload`,
  `attemptCount`, `nextRetryAt`, `deliveryStatus`,
  `responseStatusCode`, `responseBodyExcerpt`.
- Domain helper `emitWebhookEvent(orgId, eventKey, payload, tx?)`
  writes one `outbound_webhook_deliveries` row per active endpoint
  subscribed to that key. Call from existing audit-event sites
  (`writeAuditEvent` / `writeOrgAuditEvent` are the natural hooks).
- New scheduled Trigger.dev task `outbound-webhook-dispatcher` that
  claims `received|retrying` rows and POSTs them with the HMAC header.
  Same retry-with-jitter shape `integration-webhook-processor.ts`
  already uses for inbound.

### Why deferred
Build guide explicitly said "If outbound webhook emission isn't
wired yet, that's fine — this catalog documents the intended event
surface and drives the emission code." Step 57 is the docs deliverable;
emission is its own chunk of work spanning schema, dispatcher, and
endpoint CRUD.

---

## 2. Real OpenAPI YAML generation

### Current approximation
The "OpenAPI YAML" button in the hero copies a literal placeholder
string (`# BuiltCRM Webhook OpenAPI 3.1 spec\n# (would download .yaml)`)
to the clipboard. This matches the prototype but isn't useful.

### Production gap
- Reviewers who open the page expect a real spec they can download
  and feed into Postman, Stoplight, or their codegen of choice.
- Internal SDK generation (a TypeScript or Python client for partners)
  needs the spec to exist.

### Target design
- New module `src/lib/integrations/webhookOpenapi.ts` that walks
  `WEBHOOK_EVENT_CATALOG`, infers a JSON Schema for each
  `examplePayload` (or reads a hand-authored schema once §3 lands),
  emits an OpenAPI 3.1 document with one `webhooks:` entry per event
  key. Top-level `info.version` reads `WEBHOOK_EVENT_CATALOG_VERSION`.
- New API route `GET /api/webhooks/openapi.yaml` returns the rendered
  YAML with `Content-Type: application/yaml`. Cache the output for an
  hour — the catalog only changes when code ships.
- Hero button calls `window.location = "/api/webhooks/openapi.yaml"`
  to trigger a download instead of a clipboard copy.

### Why deferred
Cosmetic until §3 lands — without formal schemas the spec would be
inferred from one example each and would mislead more than help.

---

## 3. Formal JSON Schema per event

### Current approximation
`WebhookEventDefinition` only carries an `examplePayload`. No formal
schema. The "Schema" tab in the event accordion is rendered but
non-functional (it doesn't switch the view).

### Production gap
- Consumers can't validate inbound webhook payloads without writing
  their own schema by example.
- Type generation for the payload shapes can't happen.
- Breaking-change detection across catalog versions has nothing to
  diff against.

### Target design
- Extend `WebhookEventDefinition`:
  ```ts
  type WebhookEventDefinition = {
    /* existing fields */
    payloadSchema: JsonSchema7; // additionalProperties:false enforced
  };
  ```
- Hand-author one schema per event using the existing examplePayload
  as the source of truth. Use `Type.Object` from `@sinclair/typebox`
  if dep budget allows; otherwise a hand-written JSON Schema literal.
- Catalog UI: wire the "Schema" tab to render the schema in the same
  syntax-highlighted panel currently used for the example.
- Lint rule (test): for every event, validate that `examplePayload`
  conforms to `payloadSchema`. Catches drift on every PR.

### Why deferred
Adds ~25 schemas worth of work (~1 day). Doesn't block the demo —
"Example payload" is the more useful tab for a first-time reader.

---

## 4. Endpoint CRUD UI (Settings › Webhooks › Endpoints)

### Current approximation
The prototype's left sidebar shows sub-items for "Endpoints" (with
count `3`), "Delivery log" (`2.4k`), and "Signing secrets" — but the
sidebar wasn't reproduced in the production page (the contractor
portal's `AppShell` provides the actual nav). Only the catalog page
exists; the other three sub-routes don't.

### Production gap
- Contractors can't register a webhook endpoint URL.
- Contractors can't see what's been delivered or what's failing.
- Contractors can't view or rotate their endpoint signing secrets.

### Target design
Three sibling routes under `/contractor/settings/webhooks/`:
- `/endpoints` — list/create/edit/delete `outbound_webhook_endpoints`
  rows; per-endpoint event subscription (multi-select against catalog
  keys); pause/resume; force re-test (sends a synthetic
  `webhook.test_event` to the URL).
- `/deliveries` — paginated log of `outbound_webhook_deliveries`
  rows; filter by endpoint, event key, status, time range. Click a
  row → full request/response dump + manual retry button.
- `/signing-secrets` — view masked secret per endpoint, rotate
  (generates a new secret + grace period where both verify).

These should follow the same `SettingsShell`-style nav-out pattern
the catalog uses (entry in `CONTRACTOR_TABS`).

### Why deferred
Each is its own page with state-mutating actions. Layered on top of
§1 (emission) — building the endpoints UI before the dispatcher
exists is a UI for nothing.

---

## 5. HMAC signature helper + endpoint signing-secret table

### Current approximation
The catalog page tells consumers about `X-BuiltCRM-Signature` and
shows a curl example, but there's no server-side helper to actually
generate that signature on emission, and no table to store the
per-endpoint signing secret it'd be computed against.

### Production gap
Without this, emission (§1) can't sign anything; without signed
requests, the catalog's whole "verify the signature before trusting
the payload" pitch is theoretical.

### Target design
- Schema: signing secret lives on the `outbound_webhook_endpoints`
  row from §1 — single source of truth, no separate table needed.
  Generate as `wsec_` + 32 random base62 chars.
- Helper `signWebhookPayload(secret, payload, timestamp)` →
  `t=${unix},v1=${hmac_sha256_hex}`. Lives in
  `src/lib/integrations/webhookSigning.ts`.
- Mirror verification helper for testing (mirrors what consumers
  would write):
  `verifyWebhookSignature(secret, header, payload, opts)`.
- Reject requests where `timestamp` is more than 5 minutes old —
  matches the catalog's documented replay-protection guarantee.
- Test fixture: round-trip sign+verify against the catalog's example
  payloads.

### Why deferred
Same as §4 — building before §1 is plumbing for nothing. Slot in
together with the emission dispatcher.

---

## 6. API-version pinning per endpoint

### Current approximation
The catalog footer says "Pin your endpoint to a specific version
under Endpoints › Edit › API version" and the hero shows
`API version: v1.1`, but there's no version field on any future
endpoint table and no version-aware payload renderer.

### Production gap
Once `v1.2` adds new optional fields and `v2.0` renames or removes
fields, endpoints pinned to older versions need their payloads
shaped accordingly. Without this, an emission code change
unilaterally breaks every consumer.

### Target design
- Catalog already has `WEBHOOK_EVENT_CATALOG_VERSION = "v1.1"` and
  `sinceVersion` per event. Add an `until` (nullable) or
  `removedInVersion` field for the breaking-change side.
- Endpoint table (§1) stores `apiVersion: "v1.1"`. Emission resolves
  the payload shape per endpoint version: filter out events newer
  than the pinned version, drop fields added after the pinned
  version, restore renamed fields to their old keys.
- Catalog UI: API-version dropdown that re-renders the example
  payloads under each version, with diff badges on changed fields.

### Why deferred
Only matters once a v1.2 ships. We have one version, no breaking
changes. Land alongside the second version bump.

---

## 7. "Schema" tab functionality

### Current approximation
The event-card payload viewer has two tabs — "Example payload"
(active) and "Schema" — but clicking "Schema" doesn't do anything.
The prototype rendered both tabs decoratively; the production port
preserved that for visual fidelity.

### Production gap
Reviewers who click "Schema" expecting to see the formal schema
get a confusing no-op.

### Target design
Two-step:
1. **Now (cheap):** wire the tab so clicking "Schema" toggles to a
   "Schema available in v1.2" placeholder pane. Honest and removes
   the dead-click.
2. **Later (after §3):** render the JSON schema in the same
   syntax-highlighted panel.

### Why deferred
Step (1) is small enough it could go in v1.0.1 if desired, but it
landed as decorative in the prototype and the demo flow doesn't hit
the tab. Bundle with §3 for a single coherent change.

---
