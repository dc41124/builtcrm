import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import {
  organizationUsers,
  privacyOfficers,
  roleAssignments,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";

// Step 65 Session B — designate or change the org's Privacy Officer.
//
// Contractor admins only. Body: { userId } — the designated officer's
// user id. Must be an active contractor member of this org. The
// `privacy_officers` table has UNIQUE(organization_id), so designation
// is an upsert: insert on first call, update on subsequent calls.

const BodySchema = z.object({
  userId: z.string().uuid(),
});

export async function PUT(req: Request) {
  return withErrorHandler(
    async () => {
      const { session } = await requireServerSession();
      const ctx = await getOrgContext(session);
      if (ctx.role !== "contractor_admin") {
        throw new AuthorizationError(
          "Only contractor admins can designate the Privacy Officer.",
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
      const { userId } = parsed.data;

      // Validate the candidate is an active contractor member of this org.
      const member = await withTenant(ctx.organization.id, (tx) =>
        tx
          .select({
            userId: users.id,
            email: users.email,
            displayName: users.displayName,
          })
          .from(organizationUsers)
          .innerJoin(users, eq(users.id, organizationUsers.userId))
          .innerJoin(
            roleAssignments,
            and(
              eq(roleAssignments.userId, organizationUsers.userId),
              eq(roleAssignments.organizationId, organizationUsers.organizationId),
              eq(roleAssignments.portalType, "contractor"),
            ),
          )
          .where(
            and(
              eq(organizationUsers.organizationId, ctx.organization.id),
              eq(organizationUsers.userId, userId),
              eq(organizationUsers.membershipStatus, "active"),
              eq(users.isActive, true),
            ),
          )
          .limit(1),
      );
      if (member.length === 0) {
        return NextResponse.json(
          { error: "invalid_candidate", message: "User is not an active member of this org." },
          { status: 400 },
        );
      }

      // Read the current officer to detect insert-vs-change for the audit row.
      const existing = await withTenant(ctx.organization.id, (tx) =>
        tx
          .select({
            id: privacyOfficers.id,
            userId: privacyOfficers.userId,
          })
          .from(privacyOfficers)
          .where(eq(privacyOfficers.organizationId, ctx.organization.id))
          .limit(1),
      );
      const previous = existing[0] ?? null;
      const action = previous ? "privacy.officer.changed" : "privacy.officer.designated";

      const now = new Date();

      // Upsert. The (organization_id) UNIQUE constraint makes this clean.
      await withTenant(ctx.organization.id, async (tx) => {
        if (previous) {
          await tx
            .update(privacyOfficers)
            .set({
              userId,
              designatedAt: now,
              designatedByUserId: ctx.user.id,
            })
            .where(eq(privacyOfficers.id, previous.id));
        } else {
          await tx.insert(privacyOfficers).values({
            organizationId: ctx.organization.id,
            userId,
            designatedAt: now,
            designatedByUserId: ctx.user.id,
          });
        }

        // Audit inside the same transaction so a failure to write the
        // audit row rolls back the designation.
        await writeOrgAuditEvent(
          ctx,
          {
            action,
            resourceType: "privacy_officer",
            resourceId: previous?.id ?? userId,
            details: {
              previousState: previous ? { userId: previous.userId } : null,
              nextState: { userId },
              metadata: {
                designatedByUserId: ctx.user.id,
              },
            },
          },
          tx,
        );
      });

      return NextResponse.json({ ok: true });
    },
    { path: "/api/contractor/privacy/officer", method: "PUT" },
  );
}
