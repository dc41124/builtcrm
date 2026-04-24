import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

import { auth } from "@/auth/config";
import { authLimiter, enforceLimit } from "@/lib/ratelimit";

// Better Auth owns the auth surface; we only wrap POST with a rate limit
// to defend against credential-stuffing / password-spray. GET is session
// validation (hit on every authenticated page load) — rate-limiting it
// would break the app, so GET passes through untouched.

const handlers = toNextJsHandler(auth.handler);

export const GET = handlers.GET;

export async function POST(req: Request) {
  const limit = await enforceLimit(authLimiter, req);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((limit.reset - Date.now()) / 1000)),
        },
      },
    );
  }
  return handlers.POST(req);
}
