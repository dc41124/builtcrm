import Stripe from "stripe";

// Shared Stripe client for platform Billing (subscriptions). This is distinct
// from any Stripe Connect config used for contractor payouts — intentionally
// a separate module so the two concerns don't tangle.
//
// Required env vars (see handoff at end of Session 2 for setup):
// - STRIPE_SECRET_KEY     server-side secret key (test mode: sk_test_…)
// - STRIPE_WEBHOOK_SECRET webhook signing secret (test mode: whsec_…)
// - NEXT_PUBLIC_APP_URL   base URL for Checkout success/cancel redirects
//                         (e.g. http://localhost:3000 in dev)

let cachedClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Billing endpoints require it.",
    );
  }
  cachedClient = new Stripe(key, {
    // Pin an API version so Stripe SDK-major upgrades don't change behavior
    // mid-session. Bump this deliberately when migrating Stripe APIs.
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
  });
  return cachedClient;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Webhook verification requires it.",
    );
  }
  return secret;
}

export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set. Checkout redirects require it.",
    );
  }
  return url.replace(/\/$/, "");
}
