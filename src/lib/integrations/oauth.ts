import { and, eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { auditEvents, integrationConnections } from "@/db/schema";

import {
  decryptTokenOrNull,
  encryptToken,
  encryptTokenOrNull,
} from "./crypto";
import { getProviderConfig } from "./registry";
import { decodeState, encodeState } from "./state";
import type {
  IntegrationProviderKey,
  OAuth2Config,
  OAuth2TokenResponse,
} from "./types";

// Generic OAuth 2.0 authorization_code handler. One path for four providers
// (QuickBooks, Xero, Sage, Google Calendar). Stripe uses stripe_connect and
// is early-returned at every entrypoint here — its real onboarding route is
// at src/app/api/contractor/stripe/connect/onboard/route.ts.

// --------------------------------------------------------------------------
// Helpers — config / credentials lookup
// --------------------------------------------------------------------------

function mustGetProvider(
  key: IntegrationProviderKey,
): OAuth2Config {
  const entry = mustGetCatalog(key);
  if (!entry.oauth) {
    throw new OAuthError(
      "provider_not_oauth2",
      `Provider ${key} is not an OAuth 2.0 connector (flow: ${entry.flow})`,
    );
  }
  return entry.oauth;
}

function mustGetCatalog(key: IntegrationProviderKey) {
  const entry = getProviderConfig(key);
  if (!entry) throw new OAuthError("unknown_provider", `Unknown provider: ${key}`);
  return entry;
}

function mustGetCredentials(
  cfg: OAuth2Config,
  key: IntegrationProviderKey,
): { clientId: string; clientSecret: string } {
  const clientId = process.env[cfg.clientIdEnvVar];
  const clientSecret = process.env[cfg.clientSecretEnvVar];
  if (!clientId || !clientSecret) {
    throw new OAuthError(
      "missing_credentials",
      `${cfg.clientIdEnvVar} and ${cfg.clientSecretEnvVar} must be set to connect ${key}`,
    );
  }
  return { clientId, clientSecret };
}

export class OAuthError extends Error {
  constructor(
    public code:
      | "unknown_provider"
      | "provider_not_oauth2"
      | "missing_credentials"
      | "invalid_state"
      | "token_exchange_failed"
      | "refresh_failed"
      | "revoke_failed"
      | "connection_not_found",
    message: string,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

// --------------------------------------------------------------------------
// Audit writer — org-scoped (no project context)
// --------------------------------------------------------------------------

type OAuthAuditAction =
  | "oauth.connect.started"
  | "oauth.connect.completed"
  | "oauth.connect.failed"
  | "oauth.refresh.succeeded"
  | "oauth.refresh.failed"
  | "oauth.revoked";

async function writeOAuthAudit(args: {
  action: OAuthAuditAction;
  organizationId: string;
  actorUserId: string;
  connectionId: string | null;
  provider: IntegrationProviderKey;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await dbAdmin.insert(auditEvents).values({
    actorUserId: args.actorUserId,
    organizationId: args.organizationId,
    objectType: "integration_connection",
    objectId: args.connectionId ?? "00000000-0000-0000-0000-000000000000",
    actionName: args.action,
    metadataJson: {
      provider: args.provider,
      ...(args.metadata ?? {}),
    },
  });
}

// --------------------------------------------------------------------------
// startOAuth — builds the authorize URL the browser should be redirected to
// --------------------------------------------------------------------------

export type StartOAuthInput = {
  providerKey: IntegrationProviderKey;
  orgId: string;
  userId: string;
  redirectUri: string;
};

export type StartOAuthResult = { authorizeUrl: string };

export async function startOAuth(
  input: StartOAuthInput,
): Promise<StartOAuthResult> {
  const catalog = mustGetCatalog(input.providerKey);
  if (catalog.flow !== "oauth2_code") {
    throw new OAuthError(
      "provider_not_oauth2",
      `${input.providerKey} uses flow "${catalog.flow}", not oauth2_code. Route the user to the provider-specific entrypoint instead.`,
    );
  }

  const cfg = mustGetProvider(input.providerKey);
  const { clientId } = mustGetCredentials(cfg, input.providerKey);

  const state = encodeState({
    org: input.orgId,
    user: input.userId,
    provider: input.providerKey,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: input.redirectUri,
    scope: cfg.scopes.join(" "),
    state,
    ...(cfg.extraAuthorizeParams ?? {}),
  });

  await writeOAuthAudit({
    action: "oauth.connect.started",
    organizationId: input.orgId,
    actorUserId: input.userId,
    connectionId: null,
    provider: input.providerKey,
    metadata: { redirectUri: input.redirectUri },
  });

  return {
    authorizeUrl: `${cfg.authorizeUrl}?${params.toString()}`,
  };
}

// --------------------------------------------------------------------------
// handleCallback — verifies state, exchanges code, stores encrypted tokens
// --------------------------------------------------------------------------

export type HandleCallbackInput = {
  providerKey: IntegrationProviderKey;
  code: string;
  state: string | null;
  callbackQuery: URLSearchParams;
  redirectUri: string;
};

export type HandleCallbackResult = {
  connectionId: string;
  organizationId: string;
};

export async function handleCallback(
  input: HandleCallbackInput,
): Promise<HandleCallbackResult> {
  const catalog = mustGetCatalog(input.providerKey);
  if (catalog.flow !== "oauth2_code") {
    throw new OAuthError(
      "provider_not_oauth2",
      `${input.providerKey} does not use oauth2_code`,
    );
  }

  const decoded = decodeState(input.state);
  if (!decoded.ok) {
    throw new OAuthError("invalid_state", `State rejected: ${decoded.reason}`);
  }
  if (decoded.payload.provider !== input.providerKey) {
    throw new OAuthError(
      "invalid_state",
      `State provider mismatch (state=${decoded.payload.provider}, url=${input.providerKey})`,
    );
  }

  const cfg = mustGetProvider(input.providerKey);
  const { clientId, clientSecret } = mustGetCredentials(cfg, input.providerKey);

  let token: OAuth2TokenResponse;
  try {
    token = await exchangeCode({
      cfg,
      clientId,
      clientSecret,
      code: input.code,
      redirectUri: input.redirectUri,
    });
  } catch (err) {
    await writeOAuthAudit({
      action: "oauth.connect.failed",
      organizationId: decoded.payload.org,
      actorUserId: decoded.payload.user,
      connectionId: null,
      provider: input.providerKey,
      metadata: {
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err instanceof OAuthError
      ? err
      : new OAuthError("token_exchange_failed", `Token exchange failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const { externalAccountId, externalAccountName } = cfg.extractAccount
    ? cfg.extractAccount({
        callbackQuery: input.callbackQuery,
        tokenResponse: token,
      })
    : { externalAccountId: null, externalAccountName: null };

  const tokenExpiresAt = computeExpiry(token);
  const grantedScopes = typeof token.scope === "string"
    ? token.scope.split(/\s+/).filter(Boolean)
    : cfg.scopes;

  // OAuth callback is pre-tenant (token-resolved → org); use admin pool.
  const result = await dbAdmin.transaction(async (tx) => {
    const [row] = await tx
      .insert(integrationConnections)
      .values({
        organizationId: decoded.payload.org,
        provider: input.providerKey,
        connectionStatus: "connected",
        connectedByUserId: decoded.payload.user,
        accessTokenEnc: encryptToken(token.access_token),
        refreshTokenEnc: encryptTokenOrNull(
          typeof token.refresh_token === "string" ? token.refresh_token : null,
        ),
        tokenExpiresAt,
        externalAccountId,
        externalAccountName,
        grantedScopes,
        connectedAt: new Date(),
      })
      .returning({ id: integrationConnections.id });

    await tx.insert(auditEvents).values({
      actorUserId: decoded.payload.user,
      organizationId: decoded.payload.org,
      objectType: "integration_connection",
      objectId: row.id,
      actionName: "oauth.connect.completed",
      metadataJson: {
        provider: input.providerKey,
        externalAccountId,
        externalAccountName,
        hasRefreshToken: Boolean(token.refresh_token),
      },
    });

    return row;
  });

  return {
    connectionId: result.id,
    organizationId: decoded.payload.org,
  };
}

// --------------------------------------------------------------------------
// refreshToken — called by Trigger.dev scheduled job + ad hoc on 401
// --------------------------------------------------------------------------

export type RefreshTokenResult =
  | { ok: true }
  | { ok: false; error: string };

export async function refreshToken(
  connectionId: string,
): Promise<RefreshTokenResult> {
  // Refresh runs from a scheduled job (no session) — admin pool.
  const [conn] = await dbAdmin
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, connectionId))
    .limit(1);
  if (!conn) {
    throw new OAuthError("connection_not_found", `No connection ${connectionId}`);
  }

  const catalog = getProviderConfig(conn.provider);
  if (!catalog || catalog.flow !== "oauth2_code") {
    // Not our flow — silently skip.
    return { ok: true };
  }

  const cfg = mustGetProvider(conn.provider);
  const { clientId, clientSecret } = mustGetCredentials(cfg, conn.provider);

  const refreshPlain = decryptTokenOrNull(conn.refreshTokenEnc);
  if (!refreshPlain) {
    await flagNeedsReauth(
      conn.id,
      conn.organizationId,
      conn.provider,
      "no_refresh_token",
    );
    return { ok: false, error: "no_refresh_token" };
  }

  try {
    const token = await exchangeRefresh({
      cfg,
      clientId,
      clientSecret,
      refreshToken: refreshPlain,
    });

    const tokenExpiresAt = computeExpiry(token);
    const nextRefreshEnc =
      typeof token.refresh_token === "string" && token.refresh_token
        ? encryptToken(token.refresh_token)
        : conn.refreshTokenEnc; // some providers omit on refresh — keep current

    await dbAdmin.transaction(async (tx) => {
      await tx
        .update(integrationConnections)
        .set({
          accessTokenEnc: encryptToken(token.access_token),
          refreshTokenEnc: nextRefreshEnc,
          tokenExpiresAt,
          connectionStatus: "connected",
          consecutiveErrors: 0,
          lastErrorMessage: null,
        })
        .where(eq(integrationConnections.id, connectionId));

      await tx.insert(auditEvents).values({
        actorUserId: conn.connectedByUserId,
        organizationId: conn.organizationId,
        objectType: "integration_connection",
        objectId: conn.id,
        actionName: "oauth.refresh.succeeded",
        metadataJson: { provider: conn.provider },
      });
    });

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await flagNeedsReauth(conn.id, conn.organizationId, conn.provider, message);
    return { ok: false, error: message };
  }
}

async function flagNeedsReauth(
  connectionId: string,
  organizationId: string,
  provider: IntegrationProviderKey,
  errorMessage: string,
): Promise<void> {
  await dbAdmin.transaction(async (tx) => {
    await tx
      .update(integrationConnections)
      .set({
        connectionStatus: "needs_reauth",
        lastErrorMessage: errorMessage,
      })
      .where(eq(integrationConnections.id, connectionId));

    await tx.insert(auditEvents).values({
      actorUserId: (
        await tx
          .select({ connectedByUserId: integrationConnections.connectedByUserId })
          .from(integrationConnections)
          .where(eq(integrationConnections.id, connectionId))
          .limit(1)
      )[0]?.connectedByUserId ?? "00000000-0000-0000-0000-000000000000",
      organizationId,
      objectType: "integration_connection",
      objectId: connectionId,
      actionName: "oauth.refresh.failed",
      metadataJson: { provider, error: errorMessage },
    });
  });
}

// --------------------------------------------------------------------------
// revokeConnection — tombstone pattern, not hard delete
// --------------------------------------------------------------------------

export type RevokeConnectionInput = {
  connectionId: string;
  organizationId: string;
  actorUserId: string;
};

export async function revokeConnection(
  input: RevokeConnectionInput,
): Promise<void> {
  // Revocation is OAuth machinery — admin pool to keep oauth.ts pre-tenant
  // and uniform with the other 6 sites in this file.
  const [conn] = await dbAdmin
    .select()
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.id, input.connectionId),
        eq(integrationConnections.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  if (!conn) {
    throw new OAuthError("connection_not_found", `No connection ${input.connectionId} in this org`);
  }
  if (conn.connectionStatus === "disconnected") {
    // Idempotent: already disconnected.
    return;
  }

  const catalog = getProviderConfig(conn.provider);

  // Best-effort provider-side revoke. If the provider call fails, we still
  // tombstone locally — user intent is to disconnect. The audit event captures
  // whichever outcome we got.
  let providerRevokeError: string | null = null;
  if (catalog?.flow === "oauth2_code") {
    const cfg = catalog.oauth ?? null;
    const accessPlain = decryptTokenOrNull(conn.accessTokenEnc);
    if (cfg?.revokeUrl && accessPlain) {
      try {
        const { clientId, clientSecret } = mustGetCredentials(cfg, conn.provider);
        const res = await fetch(cfg.revokeUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
          },
          body: new URLSearchParams({ token: accessPlain }).toString(),
        });
        if (!res.ok && res.status !== 204) {
          providerRevokeError = `HTTP ${res.status}`;
        }
      } catch (err) {
        providerRevokeError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  await dbAdmin.transaction(async (tx) => {
    await tx
      .update(integrationConnections)
      .set({
        connectionStatus: "disconnected",
        accessTokenEnc: null,
        refreshTokenEnc: null,
        tokenExpiresAt: null,
        disconnectedAt: new Date(),
      })
      .where(eq(integrationConnections.id, input.connectionId));

    await tx.insert(auditEvents).values({
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      objectType: "integration_connection",
      objectId: input.connectionId,
      actionName: "oauth.revoked",
      metadataJson: {
        provider: conn.provider,
        providerRevokeError,
      },
    });
  });
}

// --------------------------------------------------------------------------
// Internal — provider HTTP calls
// --------------------------------------------------------------------------

type ExchangeArgs = {
  cfg: OAuth2Config;
  clientId: string;
  clientSecret: string;
};

async function exchangeCode(
  args: ExchangeArgs & { code: string; redirectUri: string },
): Promise<OAuth2TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
  });
  return postTokenEndpoint(args.cfg, args.clientId, args.clientSecret, body);
}

async function exchangeRefresh(
  args: ExchangeArgs & { refreshToken: string },
): Promise<OAuth2TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
  });
  return postTokenEndpoint(args.cfg, args.clientId, args.clientSecret, body);
}

async function postTokenEndpoint(
  cfg: OAuth2Config,
  clientId: string,
  clientSecret: string,
  body: URLSearchParams,
): Promise<OAuth2TokenResponse> {
  // Intuit, Xero, Sage, Google all accept Basic auth for client credentials.
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OAuthError(
      body.has("refresh_token") ? "refresh_failed" : "token_exchange_failed",
      `Token endpoint returned HTTP ${res.status}: ${text.slice(0, 400)}`,
    );
  }
  const json = (await res.json()) as OAuth2TokenResponse;
  if (typeof json.access_token !== "string" || !json.access_token) {
    throw new OAuthError(
      "token_exchange_failed",
      "Token endpoint returned 200 but no access_token in body",
    );
  }
  return json;
}

function computeExpiry(token: OAuth2TokenResponse): Date | null {
  if (typeof token.expires_in !== "number" || token.expires_in <= 0) {
    return null;
  }
  // Subtract 60s for clock skew so the refresh query fires a minute early.
  return new Date(Date.now() + (token.expires_in - 60) * 1000);
}
