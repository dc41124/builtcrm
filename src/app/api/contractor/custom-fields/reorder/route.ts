import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { withTenant } from "@/db/with-tenant";
import { customFieldDefinitions } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// Step 61 — Bulk reorder of custom field definitions for one entity type.
//
// POST /api/contractor/custom-fields/reorder
// body: { entityType, orderedIds: string[] }
//
// Replaces the order_index of every definition in `orderedIds` with its
// position in the array (0-based). All definitions for the entity type
// must be included; we don't try to merge partial updates because that
// invites a class of "fields disappear after reorder" bugs.

const BodySchema = z.object({
  entityType: z.enum(["project", "subcontractor", "document", "rfi"]),
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { entityType, orderedIds } = parsed.data;

  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can manage custom fields.",
        "forbidden",
      );
    }

    await withTenant(ctx.organization.id, async (tx) => {
      // Stamp each id with its array index inside one transaction so the
      // table never observes a partial reorder. We update one row per
      // id rather than building a CASE expression because the surface
      // is small (max 200) and the simpler pattern is easier to audit.
      for (let i = 0; i < orderedIds.length; i++) {
        await tx
          .update(customFieldDefinitions)
          .set({ orderIndex: i })
          .where(
            and(
              eq(customFieldDefinitions.id, orderedIds[i]),
              eq(customFieldDefinitions.organizationId, ctx.organization.id),
              eq(customFieldDefinitions.entityType, entityType),
            ),
          );
      }
    });

    await writeOrgAuditEvent(ctx, {
      action: "custom_field.reordered",
      resourceType: "custom_field_definition",
      // The "object" is a synthetic group, so use the org id as a stable
      // anchor and put detail in the metadata. Audit-feed readers ignore
      // the resourceId for grouped events; resourceType + actionName
      // disambiguate.
      resourceId: ctx.organization.id,
      details: { metadata: { entityType, count: orderedIds.length } },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code = err.code === "unauthenticated" ? 401 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    // eslint-disable-next-line no-console
    console.error("[custom-fields/reorder] error:", err);
    return NextResponse.json(
      { error: "internal_error", message: "Something went wrong." },
      { status: 500 },
    );
  }
}

