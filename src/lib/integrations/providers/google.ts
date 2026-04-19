import type { OAuth2ProviderConfig } from "./types";

// Google Calendar — OAuth 2.0. `access_type=offline` + `prompt=consent`
// guarantee a refresh_token on first consent; without these, Google only
// returns a refresh_token on the very first connect and silently omits it
// on re-consent, which bites us when a user reconnects to pick a different
// calendar.
export const googleCalendarProvider: OAuth2ProviderConfig = {
  key: "google_calendar",
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
};
