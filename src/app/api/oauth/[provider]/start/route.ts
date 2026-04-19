import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth/config";
import {
  getContractorOrgContext,
  PROVIDER_CATALOG,
  type IntegrationProviderKey,
} from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";
import { OAuthError, startOAuth } from "@/lib/integrations/oauth";

// GET /api/oauth/[provider]/start
//
// Browser-direct entrypoint. The integrations settings page points an
// anchor/link at this URL; we 302 the user to the provider's authorize URL.
// No JSON return path — this must live inside a browser navigation so the
// provider's consent screen can render and then redirect back to us.
//
// Scope: contractor_admin only. Non-admins see a 403 rendered by Next.

const VALID_PROVIDERS = new Set<IntegrationProviderKey>([
  "quickbooks_online",
  "xero",
  "sage_business_cloud",
  "stripe",
  "google_calendar",
  "outlook_365",
  "postmark",
  "sendgrid",
]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!VALID_PROVIDERS.has(provider as IntegrationProviderKey)) {
    return NextResponse.json({ error: "unknown_provider" }, { status: 400 });
  }
  const providerKey = provider as IntegrationProviderKey;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const ctx = await getContractorOrgContext(
      session.session as unknown as { appUserId?: string | null },
    );
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only org admins can connect integrations",
        "forbidden",
      );
    }

    const catalog = PROVIDER_CATALOG.find((p) => p.provider === providerKey);
    if (!catalog) {
      return NextResponse.json({ error: "unknown_provider" }, { status: 400 });
    }
    if (catalog.flow === "stripe_connect") {
      // Stripe uses its own onboarding entrypoint — redirect there so the UI
      // can treat every provider uniformly.
      return NextResponse.redirect(
        new URL("/api/contractor/stripe/connect/onboard", req.url),
      );
    }
    if (catalog.flow !== "oauth2_code") {
      return NextResponse.json(
        {
          error: "flow_not_implemented",
          message: `Provider ${providerKey} has flow "${catalog.flow}"; no start route wired yet.`,
        },
        { status: 501 },
      );
    }

    const redirectUri = new URL(
      `/api/oauth/${providerKey}/callback`,
      req.url,
    ).toString();

    const { authorizeUrl } = await startOAuth({
      providerKey,
      orgId: ctx.organization.id,
      userId: ctx.user.id,
      redirectUri,
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    if (err instanceof OAuthError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: 400 },
      );
    }
    throw err;
  }
}
