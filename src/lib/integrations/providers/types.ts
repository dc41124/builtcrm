import type { IntegrationProviderKey } from "@/domain/loaders/integrations";

// OAuth 2.0 token endpoint response shape — union of what the accounting +
// calendar providers actually return. Fields beyond the spec are provider-
// specific (e.g. QuickBooks `x_refresh_token_expires_in`); extraction lives in
// the provider's `extractAccount` hook.
export type OAuth2TokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number; // seconds
  refresh_token?: string;
  scope?: string;
  // QuickBooks / Xero stuff flows through — typed loose so we don't cast.
  [key: string]: unknown;
};

export type OAuth2ProviderConfig = {
  key: IntegrationProviderKey;
  authorizeUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  clientIdEnvVar: string;
  clientSecretEnvVar: string;
  // Provider-specific params appended to the authorize URL (e.g. Google's
  // `access_type=offline&prompt=consent` to guarantee a refresh_token).
  extraAuthorizeParams?: Record<string, string>;
  // Some providers return the external account identity as a query param on
  // the callback URL rather than in the token body (QuickBooks realmId). When
  // set, this function is called with both the callback query and the token
  // response; return any identity it can extract.
  extractAccount?: (args: {
    callbackQuery: URLSearchParams;
    tokenResponse: OAuth2TokenResponse;
  }) => {
    externalAccountId: string | null;
    externalAccountName: string | null;
  };
};
