import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { writeSystemAuditEvent } from "@/domain/audit";
import { AuthorizationError } from "@/domain/permissions";

// Global API error handler. Wrap every API route body in withErrorHandler
// to centralize:
//   - AuthorizationError → 4xx mapping (401 unauthenticated, 404 not_found,
//     403 fallback) with structured body
//   - Unhandled exceptions → audit log (via SYSTEM_USER_ID) + clean 500
//     response (`{ error: "internal_error" }`) with no stack trace leak
//
// Usage:
//   export async function POST(req: Request) {
//     return withErrorHandler(async () => {
//       // route logic — can throw AuthorizationError or any other Error
//       return NextResponse.json({ ok: true });
//     }, { path: "/api/whatever", method: "POST" });
//   }
//
// See docs/specs/security_posture.md §5 for the audit-logging rationale.

export type RouteContext = {
  path?: string;
  method?: string;
  // Optional user/org hints if known at exception time — included in the
  // audit metadata for triage. Never trusted for authorization.
  appUserId?: string | null;
  organizationId?: string | null;
};

// Handler returns an untyped NextResponse (matches Next.js route-handler
// signature). Routes commonly return a union of success and error shapes;
// a generic T over NextResponse<T> would force the caller to unify them
// manually, so we stay loose at the boundary.
export async function withErrorHandler(
  handler: () => Promise<NextResponse>,
  context?: RouteContext,
): Promise<NextResponse> {
  try {
    return await handler();
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
    await logUnhandledException(err, context);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

async function logUnhandledException(
  err: unknown,
  ctx?: RouteContext,
): Promise<void> {
  // Sentry first — it's the incident-response signal and has the full
  // stack trace. Audit is the compliance signal. Both should fire; a
  // failure in either must not block the other or the response.
  try {
    Sentry.captureException(err, {
      tags: {
        path: ctx?.path,
        method: ctx?.method,
        organization_id: ctx?.organizationId ?? undefined,
      },
      user: ctx?.appUserId ? { id: ctx.appUserId } : undefined,
    });
  } catch (sentryErr) {
    console.error("[api-error-handler] sentry capture failed:", sentryErr);
  }

  try {
    const message = err instanceof Error ? err.message : String(err);
    const errorClass = err instanceof Error ? err.constructor.name : "Unknown";
    await writeSystemAuditEvent({
      resourceType: "api_error",
      resourceId: randomUUID(),
      action: "unhandled_exception",
      organizationId: ctx?.organizationId ?? null,
      details: {
        nextState: {
          path: ctx?.path ?? null,
          method: ctx?.method ?? null,
          errorClass,
          // Truncate — full stack goes to Sentry. Audit rows stay small
          // and cheap to scan.
          message: message.slice(0, 500),
        },
        metadata: { appUserId: ctx?.appUserId ?? null },
      },
    });
  } catch (auditErr) {
    // Last-ditch fallback: never let an audit-write failure crash the
    // response. Log to stderr so the failure is still visible.
    console.error("[api-error-handler] audit write failed:", auditErr);
  }
}
