import type { ProviderConfig } from "../types";

// Google Calendar — OAuth 2.0. `access_type=offline` + `prompt=consent`
// guarantee a refresh_token on first consent; without them, Google only
// returns a refresh_token on the very first connect and silently omits it
// on re-consent, which bites when a user reconnects to pick a different
// calendar.
//
// Inbound notifications don't use HMAC — Google uses a channel-token scheme
// (per-channel secret set at watch-creation time, echoed back in the
// `X-Goog-Channel-Token` header). Signed into the type system as
// `google-channel-token`; the webhook-verify adapter currently 501s this
// pending the Calendar connector that creates the watch in the first place.
// TODO(google-calendar-inbound): implement verifier against
// integration_connections.mapping_config.channelToken.

const googleCalendar: ProviderConfig = {
  provider: "google_calendar",
  name: "Google Calendar",
  description:
    "Push milestones and inspections directly to a Google Calendar.",
  category: "calendar",
  minTier: "enterprise",
  phase1: false,
  flow: "oauth2_code",
  oauth: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    clientIdEnvVar: "GOOGLE_CLIENT_ID",
    clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
    extraAuthorizeParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  },
  webhooks: {
    signatureScheme: "google-channel-token",
    signatureHeader: "x-goog-channel-token",
    // Secret is per-subscription, stored on integration_connections.mapping_config
    // when the Calendar connector creates the watch — not a global env var.
  },
  sync: {
    entities: ["calendar_event"],
  },
};

export default googleCalendar;
