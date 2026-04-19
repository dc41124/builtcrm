import type { ProviderConfig } from "../types";

// SendGrid — alternative transactional email provider. API-key auth, same
// non-OAuth pattern as Postmark (see postmark.ts). Email-provider choice
// (Postmark vs SendGrid) is deferred — see HANDOFF.md's Phase 4C section.
//
// SendGrid's Event Webhook signs deliveries with ECDSA by default when
// "Signed Event Webhook" is enabled; the basic path still offers HMAC-
// SHA256 base64 in the `x-twilio-email-event-webhook-signature` header.
// Parking the simpler path here until email is actually wired.

const sendgrid: ProviderConfig = {
  provider: "sendgrid",
  name: "SendGrid Email",
  description: "Alternative transactional email provider.",
  category: "email",
  minTier: "starter",
  phase1: true,
  flow: "none",
  webhooks: {
    signatureScheme: "hmac-sha256-b64",
    signatureHeader: "x-twilio-email-event-webhook-signature",
    secretEnvVar: "SENDGRID_WEBHOOK_SECRET",
  },
  sync: {
    entities: ["email_delivery", "email_bounce"],
  },
};

export default sendgrid;
