import { NextResponse } from "next/server";

import { AuthorizationError } from "@/domain/permissions";
import { requireApiKey } from "@/lib/api-keys/auth";

// GET /api/v1/ping — minimal authenticated endpoint that exercises
// the API-key auth helper end-to-end. Returns the resolved org +
// scope so partners building integrations can sanity-check their
// credentials before wiring real calls. Documents the canonical
// shape every other /api/v1/* route should follow.
//
// Auth: any scope (read|write|admin). The route asks for "read",
// which the helper evaluates as "≥ read" — every active key passes.

export async function GET(req: Request) {
  try {
    const ctx = await requireApiKey(req, "read");
    return NextResponse.json({
      ok: true,
      orgId: ctx.orgId,
      keyId: ctx.keyId,
      scopes: ctx.scopes,
      effectiveScope: ctx.effectiveScope,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
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
