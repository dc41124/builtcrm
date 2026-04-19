// Stripe Connect is NOT OAuth 2.0 authorization_code. The entrypoint lives at
// `src/app/api/contractor/stripe/connect/onboard/route.ts` and uses the Stripe
// SDK to generate an Account Link. No OAuth 2.0 provider config exists here
// because the generic handler in `src/lib/integrations/oauth.ts` early-returns
// whenever it sees `flow: 'stripe_connect'` on the PROVIDER_CATALOG entry.
//
// This file exists so a grep for the Stripe integration under
// `src/lib/integrations/providers/` finds a landing page with the correct
// pointer, rather than appearing to be missing.

export const STRIPE_CONNECT_ONBOARD_ROUTE =
  "/api/contractor/stripe/connect/onboard";
