import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { organizations } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";
import { forceRefreshSingle } from "@/lib/integrations/rbq";

// Step 66 — Force-refresh every RBQ number on file across all
// subcontractor orgs the platform tracks. Contractor admin only.
// Today this iterates one number at a time through the stub fetcher;
// production will switch to a single CSV diff download in
// `rbq-cache-refresh.ts` and this endpoint becomes a thin wrapper
// that triggers that job.

export async function POST() {
  return withErrorHandler(
    async () => {
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can refresh the RBQ cache.",
          "forbidden",
        );
      }

      const orgs = await dbAdmin
        .select({ rbqNumber: organizations.rbqNumber })
        .from(organizations)
        .where(isNotNull(organizations.rbqNumber));

      const numbers = Array.from(
        new Set(
          orgs
            .map((o) => o.rbqNumber)
            .filter((n): n is string => typeof n === "string" && n.length > 0),
        ),
      );

      let refreshed = 0;
      const errors: string[] = [];
      for (const number of numbers) {
        try {
          await forceRefreshSingle(number);
          refreshed++;
        } catch (err) {
          errors.push(`${number}: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }

      await writeOrgAuditEvent(ctx, {
        resourceType: "rbq_license_cache",
        resourceId: "bulk",
        action: "rbq.bulk_refreshed",
        details: {
          metadata: {
            total: numbers.length,
            refreshed,
            errors: errors.length,
          },
        },
      });

      return NextResponse.json({
        ok: true,
        total: numbers.length,
        refreshed,
        errors,
      });
    },
    { path: "/api/contractor/rbq/refresh-all", method: "POST" },
  );
}
