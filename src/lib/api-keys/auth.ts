import { and, eq, isNull, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { apiKeys } from "@/db/schema";
import { AuthorizationError } from "@/domain/permissions";
import {
  enforceApiKeyRateLimit,
  rateLimitHeadersFor,
  type ApiKeyRateLimitResult,
} from "@/lib/ratelimit";

import { hashApiKey, parseBearerToken } from "./hash";

// Step 58 — per-route API key auth helper.
//
// Why a per-route helper rather than middleware: middleware runs in
// the Edge runtime, which can't import node:crypto's HMAC. Per-route
// gating also gives us typed responses and per-endpoint scope
// enforcement without smuggling state through request headers.
//
// Auth flow:
//   1. Parse `Authorization: Bearer bcrm_live_xxx` (cheap surface check)
//   2. HMAC-SHA256(pepper, fullKey) → indexed lookup on key_hash
//   3. Reject if revoked
//   4. Verify granted scope ≥ requiredScope (admin > write > read)
//   5. Bump last_used_at fire-and-forget (does not block the response)
//   6. Return ApiKeyContext with orgId/scopes/keyId for downstream use.
//
// Failures throw AuthorizationError so the route's existing
// try/catch (already used for session-auth routes) returns the right
// HTTP code. The same shape — `unauthenticated` → 401, `forbidden` →
// 403 — keeps the API consistent across the two auth surfaces.

export type ApiKeyScope = "read" | "write" | "admin";

export type ApiKeyContext = {
  keyId: string;
  orgId: string;
  scopes: ApiKeyScope[];
  /** The most-privileged scope on the key, used for sample-rate
   *  decisions and audit-event metadata. */
  effectiveScope: ApiKeyScope;
  /** Rate-limit state from the just-completed enforcement pass.
   *  Routes call `apiKeyResponseHeaders(ctx)` to surface this. */
  rateLimit: ApiKeyRateLimitResult;
};

/**
 * Thrown when a key passes auth but exceeds its rate limit. Routes
 * convert this to a 429 with the standard headers (see
 * `apiKeyResponseHeaders` below). Distinct from AuthorizationError
 * so middlewares / catches downstream can treat it differently —
 * 429 is a transient state, 401/403 are not.
 */
export class RateLimitExceededError extends Error {
  constructor(
    public readonly result: Extract<ApiKeyRateLimitResult, { ok: false }>,
  ) {
    super(
      `API key rate limit exceeded (${result.blockedBy} window). Retry after ${result.retryAfterSec}s.`,
    );
    this.name = "RateLimitExceededError";
  }
}

/** Convenience: lift the rate-limit headers off a context for a route's
 *  successful response. Spread onto NextResponse.json options or set
 *  individually on a Response. */
export function apiKeyResponseHeaders(ctx: ApiKeyContext): Record<string, string> {
  return rateLimitHeadersFor(ctx.rateLimit);
}

const SCOPE_RANK: Record<ApiKeyScope, number> = {
  read: 1,
  write: 2,
  admin: 3,
};

function effectiveScopeOf(scopes: ApiKeyScope[]): ApiKeyScope {
  return scopes.reduce<ApiKeyScope>(
    (acc, s) => (SCOPE_RANK[s] > SCOPE_RANK[acc] ? s : acc),
    "read",
  );
}

/**
 * Authenticate an inbound /api/v1/* request and enforce a minimum
 * scope. Throws AuthorizationError on any failure; the route
 * converts that into the right HTTP code.
 *
 * @param req — the route's Request
 * @param requiredScope — minimum granted scope (default "read")
 */
export async function requireApiKey(
  req: Request,
  requiredScope: ApiKeyScope = "read",
): Promise<ApiKeyContext> {
  const fullKey = parseBearerToken(req.headers.get("authorization"));
  if (!fullKey) {
    throw new AuthorizationError(
      "Missing or malformed Authorization header. Expected `Bearer bcrm_live_…`.",
      "unauthenticated",
    );
  }

  const keyHash = hashApiKey(fullKey);
  const [row] = await dbAdmin
    .select({
      id: apiKeys.id,
      orgId: apiKeys.orgId,
      scopes: apiKeys.scopes,
      revokedAt: apiKeys.revokedAt,
      rateLimitPerMinute: apiKeys.rateLimitPerMinute,
      rateLimitPerHour: apiKeys.rateLimitPerHour,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!row) {
    // Same error shape for "key doesn't exist" and "key revoked" —
    // don't leak which one to an attacker probing for valid prefixes.
    throw new AuthorizationError("Invalid or revoked API key.", "unauthenticated");
  }

  const scopes = row.scopes as ApiKeyScope[];
  const effective = effectiveScopeOf(scopes);
  if (SCOPE_RANK[effective] < SCOPE_RANK[requiredScope]) {
    throw new AuthorizationError(
      `This key has scope '${effective}'. Required: '${requiredScope}'.`,
      "forbidden",
    );
  }

  // Step 59 — rate limit. Both windows enforced; cached limiter
  // instances per (limit, window) tuple keep this cheap. Failure
  // throws with the full result so the route can spread the standard
  // headers onto the 429 response.
  const rateLimit = await enforceApiKeyRateLimit({
    keyId: row.id,
    perMinute: row.rateLimitPerMinute,
    perHour: row.rateLimitPerHour,
  });
  if (!rateLimit.ok) {
    throw new RateLimitExceededError(rateLimit);
  }

  // Fire-and-forget last_used_at bump. Awaiting this would add a
  // round-trip to every authenticated request. Errors here are
  // intentionally swallowed — they don't justify failing an otherwise-
  // valid request, and the next successful auth will set the column.
  void dbAdmin
    .update(apiKeys)
    .set({ lastUsedAt: sql`NOW()` })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {});

  return {
    keyId: row.id,
    orgId: row.orgId,
    scopes,
    effectiveScope: effective,
    rateLimit,
  };
}
