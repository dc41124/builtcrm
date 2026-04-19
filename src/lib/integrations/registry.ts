// Integration provider registry (Step 29, plan A).
//
// Single authoritative source for every integration provider BuiltCRM knows
// about. Each provider is a single file under `./providers/{key}.ts` that
// default-exports a `ProviderConfig`; this file imports all of them and
// exposes them as a Map keyed by `IntegrationProviderKey`.
//
// Consumers:
//   - UI catalog (via `src/domain/loaders/integrations.ts` which re-exports
//     `allProviders()` to keep existing import paths working)
//   - OAuth handler in `./oauth.ts`
//   - Webhook verifier / extractor lookup in `./webhook-verify.ts`
//   - Legacy `/api/integrations/connect` stub for non-OAuth providers
//
// To add a new provider:
//   1. Create `./providers/{key}.ts` default-exporting a `ProviderConfig`.
//   2. Add the provider key to `IntegrationProviderKey` in `./types.ts` and
//      to the `integration_provider` pg enum in the schema.
//   3. Import the new default export below and add it to `entries`.
// No other file needs editing — the OAuth handler and webhook verifier pick
// the new provider up automatically.

import type { IntegrationProviderKey, ProviderConfig } from "./types";

import googleCalendar from "./providers/google";
import outlook from "./providers/outlook";
import postmark from "./providers/postmark";
import quickbooks from "./providers/quickbooks";
import sage from "./providers/sage";
import sendgrid from "./providers/sendgrid";
import stripe from "./providers/stripe";
import xero from "./providers/xero";

// Order here controls the default UI card order. Email providers lead
// because they're Phase-1 available; accounting and payments cluster next;
// calendars trail. The loader's filter/sort logic is free to re-order in
// rendering — this is just the source order.
const entries: ProviderConfig[] = [
  postmark,
  sendgrid,
  quickbooks,
  xero,
  sage,
  stripe,
  googleCalendar,
  outlook,
];

// Public: the registry itself, as a read-only Map (matches the Step 29
// prompt's shape — `exports a providers Map`).
export const providers: ReadonlyMap<IntegrationProviderKey, ProviderConfig> =
  new Map(entries.map((e) => [e.provider, e]));

// Public: single-provider lookup. Returns null when the key isn't registered.
// The generic OAuth handler uses this to pull `.oauth`; the webhook verifier
// uses it to pull `.webhooks`; the legacy connect route uses it to validate
// an incoming provider key.
export function getProviderConfig(
  key: IntegrationProviderKey,
): ProviderConfig | null {
  return providers.get(key) ?? null;
}

// Public: iteration order matches `entries` above. Returned as readonly so
// consumers can't mutate the registry at runtime.
export function allProviders(): readonly ProviderConfig[] {
  return entries;
}
