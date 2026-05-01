import { NextResponse } from "next/server";

import { AuthorizationError } from "@/domain/permissions";
import {
  apiKeyResponseHeaders,
  RateLimitExceededError,
  requireApiKey,
} from "@/lib/api-keys/auth";
import { rateLimitHeadersFor } from "@/lib/ratelimit";

// GET /api/v1/ping — minimal authenticated endpoint that exercises
// the API-key auth helper end-to-end. Documents the canonical
// shape every other /api/v1/* route should follow:
//
//   1. Wrap the handler in try/catch.
//   2. Call `requireApiKey(req, requiredScope)` first.
//   3. On success, return the response with `apiKeyResponseHeaders(ctx)`
//      spread into headers — surfaces X-RateLimit-* to the client.
//   4. On failure, the catch block converts AuthorizationError →
//      401/403 and RateLimitExceededError → 429 with Retry-After.
//
// The auth-error shape (`{error, message}`) is consistent across
// every /api/v1/* route so partner integrations can write one error
// handler.

export async function GET(req: Request) {
  try {
    const ctx = await requireApiKey(req, "read");
    return NextResponse.json(
      {
        ok: true,
        orgId: ctx.orgId,
        keyId: ctx.keyId,
        scopes: ctx.scopes,
        effectiveScope: ctx.effectiveScope,
        timestamp: new Date().toISOString(),
      },
      { headers: apiKeyResponseHeaders(ctx) },
    );
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          message: err.message,
          blockedBy: err.result.blockedBy,
          retryAfterSec: err.result.retryAfterSec,
        },
        { status: 429, headers: rateLimitHeadersFor(err.result) },
      );
    }
    if (err instanceof AuthorizationError) {
      const code = err.code === "unauthenticated" ? 401 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
