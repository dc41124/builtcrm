import type { IntegrationProviderKey } from "@/domain/loaders/integrations";

import { googleCalendarProvider } from "./google";
import { quickbooksProvider } from "./quickbooks";
import { sageProvider } from "./sage";
import type { OAuth2ProviderConfig } from "./types";
import { xeroProvider } from "./xero";

// Map of every OAuth 2.0 authorization_code provider. Stripe is intentionally
// absent (uses Stripe Connect, see providers/stripe.ts). Postmark / SendGrid /
// Outlook have entries in PROVIDER_CATALOG but no OAuth config yet — they'll
// land when the respective connector ships.
export const OAUTH2_PROVIDERS: Partial<
  Record<IntegrationProviderKey, OAuth2ProviderConfig>
> = {
  quickbooks_online: quickbooksProvider,
  xero: xeroProvider,
  sage_business_cloud: sageProvider,
  google_calendar: googleCalendarProvider,
};

export function getOAuth2Provider(
  key: IntegrationProviderKey,
): OAuth2ProviderConfig | null {
  return OAUTH2_PROVIDERS[key] ?? null;
}

export type { OAuth2ProviderConfig, OAuth2TokenResponse } from "./types";
