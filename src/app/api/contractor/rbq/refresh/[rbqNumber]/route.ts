import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";
import {
  forceRefreshSingle,
  isValidRbqFormat,
  normalizeRbqNumber,
} from "@/lib/integrations/rbq";

// Step 66 — Force-refresh a single RBQ number against the cache.
// Contractor admin only. The path parameter is the RBQ number itself
// (URL-encoded if it contains dashes; the natural format already uses
// only digits and dashes which are URL-safe).

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ rbqNumber: string }> },
) {
  return withErrorHandler(
    async () => {
      const { rbqNumber: rawParam } = await params;
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can force-refresh an RBQ lookup.",
          "forbidden",
        );
      }

      const decoded = decodeURIComponent(rawParam);
      const normalized = isValidRbqFormat(decoded)
        ? decoded
        : normalizeRbqNumber(decoded);
      if (!normalized) {
        return NextResponse.json(
          {
            error: "invalid_format",
            message: "RBQ number must be 10 digits (####-####-##).",
          },
          { status: 400 },
        );
      }

      const result = await forceRefreshSingle(normalized);

      await writeOrgAuditEvent(ctx, {
        resourceType: "rbq_license_cache",
        resourceId: normalized,
        action: "rbq.refreshed",
        details: {
          metadata: {
            status: result.status,
            expiryDate: result.expiryDate,
            sourceVersion: result.sourceVersion,
          },
        },
      });

      return NextResponse.json({ ok: true, result });
    },
    { path: "/api/contractor/rbq/refresh/[rbqNumber]", method: "POST" },
  );
}
