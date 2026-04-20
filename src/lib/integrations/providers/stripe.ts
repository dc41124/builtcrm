import type { ProviderConfig } from "../types";

// Stripe Connect. NOT OAuth 2.0 authorization_code — the entrypoint lives
// at `src/app/api/contractor/stripe/connect/onboard/route.ts` and uses the
// Stripe SDK to generate an Account Link. The generic OAuth handler in
// `src/lib/integrations/oauth.ts` early-returns whenever it sees
// `flow === 'stripe_connect'` on this config.
//
// Inbound webhooks KEEP their dedicated static route at
// `/api/webhooks/stripe` (signature via `stripe.webhooks.constructEvent()`),
// so the `webhooks` field here signals the scheme for documentation but
// the generic handler at `/api/webhooks/[provider]` excludes Stripe by
// Next.js static-route precedence.

const stripe: ProviderConfig = {
  provider: "stripe",
  name: "Stripe Connect",
  description:
    "ACH and card payments routed to your connected Stripe account.",
  category: "payments",
  minTier: "professional",
  phase1: false,
  flow: "stripe_connect",
  // No `oauth` — Stripe uses its own Account Link flow.
  webhooks: {
    signatureScheme: "stripe",
    signatureHeader: "stripe-signature",
    secretEnvVar: "STRIPE_WEBHOOK_SECRET",
    // No extractIdentity — the dedicated /api/webhooks/stripe route handles
    // Stripe events inline and doesn't flow through the generic dispatcher.
  },
  sync: {
    entities: ["payment", "payout", "subscription", "connect_account"],
  },
};

export default stripe;
