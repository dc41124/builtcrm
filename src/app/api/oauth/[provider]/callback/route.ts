import { NextResponse } from "next/server";

import type { IntegrationProviderKey } from "@/domain/loaders/integrations";
import { handleCallback, OAuthError } from "@/lib/integrations/oauth";

// GET /api/oauth/[provider]/callback
//
// The provider redirects the user back here with `code` + `state` query params.
// We verify the signed state (which carries orgId + userId), exchange the code
// for tokens, encrypt and store them, then redirect the user to the settings
// integrations page with a success/error flag.
//
// No session check — the state parameter is the authentication artifact.

const VALID_PROVIDERS = new Set<IntegrationProviderKey>([
  "quickbooks_online",
  "xero",
  "sage_business_cloud",
  "google_calendar",
  "outlook_365",
]);

const SETTINGS_PATH = "/contractor/settings/integrations";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!VALID_PROVIDERS.has(provider as IntegrationProviderKey)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 400 });
  }
  const providerKey = provider as IntegrationProviderKey;

  const url = new URL(req.url);
  const errorParam = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (errorParam) {
    // Provider-side failure (user declined, invalid scope, etc.) — the
    // provider puts the reason in the `error` query param per RFC 6749 §4.1.2.1.
    return redirectToSettings(req, {
      provider: providerKey,
      status: "failed",
      reason: errorParam,
    });
  }

  if (!code) {
    return redirectToSettings(req, {
      provider: providerKey,
      status: "failed",
      reason: "missing_code",
    });
  }

  const redirectUri = new URL(
    `/api/oauth/${providerKey}/callback`,
    req.url,
  ).toString();

  try {
    await handleCallback({
      providerKey,
      code,
      state,
      callbackQuery: url.searchParams,
      redirectUri,
    });
    return redirectToSettings(req, {
      provider: providerKey,
      status: "connected",
    });
  } catch (err) {
    const reason =
      err instanceof OAuthError
        ? err.code
        : err instanceof Error
          ? err.message
          : "unknown_error";
    return redirectToSettings(req, {
      provider: providerKey,
      status: "failed",
      reason,
    });
  }
}

function redirectToSettings(
  req: Request,
  params: { provider: IntegrationProviderKey; status: string; reason?: string },
) {
  const target = new URL(SETTINGS_PATH, req.url);
  target.searchParams.set("provider", params.provider);
  target.searchParams.set("oauth", params.status);
  if (params.reason) target.searchParams.set("reason", params.reason);
  return NextResponse.redirect(target.toString());
}
