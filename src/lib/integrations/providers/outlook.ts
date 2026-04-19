import type { ProviderConfig } from "../types";

// Outlook / Microsoft 365 via Microsoft Graph. Standard OAuth 2.0
// authorization_code. Like Google Calendar, inbound notifications use a
// validation-token subscription scheme (Graph subscriptions) rather than
// HMAC; it ships with the Calendar connector in a later step.
// TODO(outlook-calendar-inbound): implement validation-token verifier once
// the Graph subscription is actually created.

const outlook: ProviderConfig = {
  provider: "outlook_365",
  name: "Outlook / Microsoft 365",
  description:
    "Push milestones to Outlook calendars via Microsoft Graph.",
  category: "calendar",
  minTier: "enterprise",
  phase1: false,
  flow: "oauth2_code",
  oauth: {
    // Common `/common/` tenant endpoint so org admins from any AAD tenant
    // can connect. Single-tenant apps swap in the tenant ID at deploy time.
    authorizeUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: [
      "offline_access",
      "User.Read",
      "Calendars.ReadWrite",
    ],
    clientIdEnvVar: "OUTLOOK_CLIENT_ID",
    clientSecretEnvVar: "OUTLOOK_CLIENT_SECRET",
  },
  sync: {
    entities: ["calendar_event"],
  },
};

export default outlook;
