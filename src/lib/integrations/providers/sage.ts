import type { OAuth2ProviderConfig } from "./types";

// Sage Business Cloud Accounting — OAuth 2.0. Regional endpoints vary (UK/IE
// vs US/CA); the URLs below are for the `.ca` region matching BuiltCRM's
// Canadian focus. If a US customer connects, switch the subdomain via env.
export const sageProvider: OAuth2ProviderConfig = {
  key: "sage_business_cloud",
  authorizeUrl: "https://www.sageone.com/oauth2/auth/central",
  tokenUrl: "https://oauth.accounting.sage.com/token",
  scopes: ["full_access"],
  clientIdEnvVar: "SAGE_CLIENT_ID",
  clientSecretEnvVar: "SAGE_CLIENT_SECRET",
  // Sage requires `country` in the authorize URL to pre-select the accounting
  // region. Default to CA; the UI can surface this as a per-connection choice
  // later.
  extraAuthorizeParams: {
    country: "CA",
    locale: "en-CA",
  },
};
