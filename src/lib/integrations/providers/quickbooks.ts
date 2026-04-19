import type { OAuth2ProviderConfig } from "./types";

// QuickBooks Online — Intuit OAuth 2.0.
// Step 25 ships the provider config only. Scope-specific logic (invoice push,
// payment reconciliation) lands in Step 30-33. The sandbox authorize URL is
// the same as production; sandbox vs production is controlled by the OAuth
// app's registration in the Intuit developer portal.
//
// Note on realmId: Intuit returns the company/realm identifier as a query
// parameter on the callback URL (not inside the token response). `extractAccount`
// reads it from the callback query.
export const quickbooksProvider: OAuth2ProviderConfig = {
  key: "quickbooks_online",
  authorizeUrl: "https://appcenter.intuit.com/connect/oauth2",
  tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer_tokens",
  revokeUrl: "https://developer.api.intuit.com/v2/oauth2/tokens/revoke",
  scopes: ["com.intuit.quickbooks.accounting"],
  clientIdEnvVar: "QUICKBOOKS_CLIENT_ID",
  clientSecretEnvVar: "QUICKBOOKS_CLIENT_SECRET",
  extractAccount: ({ callbackQuery }) => {
    const realmId = callbackQuery.get("realmId");
    return {
      externalAccountId: realmId,
      externalAccountName: null, // company name fetched after first API call
    };
  },
};
