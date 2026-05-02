import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { organizations } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";
import {
  forceRefreshSingle,
  isValidRbqFormat,
  normalizeRbqNumber,
} from "@/lib/integrations/rbq";

// Step 66 — Set / update an RBQ license number on a subcontractor org.
// Contractor admin only. After the column write, force-refreshes the
// cache row so the UI shows live data on the next render.

const BodySchema = z.object({
  rbqNumber: z.string().trim().min(0).max(15),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ subOrgId: string }> },
) {
  return withErrorHandler(
    async () => {
      const { subOrgId } = await params;
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can update a sub's RBQ number.",
          "forbidden",
        );
      }

      const json = await req.json().catch(() => null);
      const parsed = BodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_body", issues: parsed.error.issues },
          { status: 400 },
        );
      }

      const raw = parsed.data.rbqNumber.trim();
      let normalized: string | null = null;
      if (raw.length > 0) {
        normalized = isValidRbqFormat(raw) ? raw : normalizeRbqNumber(raw);
        if (!normalized) {
          return NextResponse.json(
            {
              error: "invalid_format",
              message:
                "RBQ number must be 10 digits (####-####-##). Got: " + raw,
            },
            { status: 400 },
          );
        }
      }

      // Confirm the target org exists. dbAdmin so we don't depend on
      // the contractor having an org_users membership in the sub org.
      const orgRows = await dbAdmin
        .select({ id: organizations.id, rbqNumber: organizations.rbqNumber })
        .from(organizations)
        .where(eq(organizations.id, subOrgId))
        .limit(1);
      if (orgRows.length === 0) {
        return NextResponse.json(
          { error: "not_found" },
          { status: 404 },
        );
      }
      const previousValue = orgRows[0].rbqNumber;

      await dbAdmin
        .update(organizations)
        .set({ rbqNumber: normalized })
        .where(eq(organizations.id, subOrgId));

      await writeOrgAuditEvent(ctx, {
        resourceType: "organization",
        resourceId: subOrgId,
        action: normalized ? "rbq.number_set" : "rbq.number_cleared",
        details: {
          previousState: { rbqNumber: previousValue },
          nextState: { rbqNumber: normalized },
        },
      });

      // Force a cache refresh against the new number so the UI shows
      // live data on the next render. No-op when the number was cleared.
      let refresh = null;
      if (normalized) {
        refresh = await forceRefreshSingle(normalized);
      }

      return NextResponse.json({ ok: true, rbqNumber: normalized, refresh });
    },
    { path: "/api/contractor/subcontractors/[subOrgId]/rbq-number", method: "PATCH" },
  );
}
