import type { ProviderConfig } from "../types";

// Postmark — transactional email. API-key auth, not OAuth 2.0, so
// `flow: 'none'` and no `oauth` block. The connection row stores the
// server token encrypted in integration_connections.access_token_enc (same
// column re-used for non-OAuth credentials). Wiring the credential capture
// ships when the email-provider decision (Postmark vs SendGrid) lands —
// see HANDOFF.md.
//
// Inbound delivery events are signed with an HMAC-SHA256 base64 scheme
// when webhook subscriptions are configured; secret env var named below
// for forward-compatibility.

const postmark: ProviderConfig = {
  provider: "postmark",
  name: "Postmark Email",
  description:
    "Outbound notifications and reply-by-email for conversations, RFIs, approvals, and draws.",
  category: "email",
  minTier: "starter",
  phase1: true,
  flow: "none",
  webhooks: {
    signatureScheme: "hmac-sha256-b64",
    signatureHeader: "x-postmark-signature",
    secretEnvVar: "POSTMARK_WEBHOOK_SECRET",
  },
  sync: {
    entities: ["email_delivery", "email_bounce"],
  },
};

export default postmark;
