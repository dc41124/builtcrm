import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { withTenant } from "@/db/with-tenant";
import { customFieldDefinitions } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// Step 61 — Custom field definition: PATCH (edit) + DELETE (soft-archive).
// contractor_admin only.

const OptionSchema = z.object({
  value: z.string().min(1).max(120),
  label: z.string().min(1).max(120),
});

const PatchBodySchema = z.object({
  label: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  options: z.array(OptionSchema).nullable().optional(),
  isRequired: z.boolean().optional(),
  // Restore an archived definition.
  reactivate: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session } = await requireServerSession();
  const { id } = await params;
  const parsed = PatchBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can manage custom fields.",
        "forbidden",
      );
    }

    const updated = await withTenant(ctx.organization.id, async (tx) => {
      const [existing] = await tx
        .select()
        .from(customFieldDefinitions)
        .where(
          and(
            eq(customFieldDefinitions.id, id),
            eq(customFieldDefinitions.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);
      if (!existing) return null;

      const update: Partial<typeof customFieldDefinitions.$inferInsert> = {};
      if (body.label !== undefined) update.label = body.label.trim();
      if (body.description !== undefined) {
        update.description = body.description?.trim() || null;
      }
      if (body.options !== undefined) update.optionsJson = body.options;
      if (body.isRequired !== undefined) update.isRequired = body.isRequired;
      if (body.reactivate === true) {
        update.isActive = true;
        update.archivedAt = null;
      }

      const [row] = await tx
        .update(customFieldDefinitions)
        .set(update)
        .where(eq(customFieldDefinitions.id, id))
        .returning();
      return { existing, row };
    });

    if (!updated) {
      return NextResponse.json(
        { error: "not_found", message: "Custom field not found." },
        { status: 404 },
      );
    }

    await writeOrgAuditEvent(ctx, {
      action: "custom_field.updated",
      resourceType: "custom_field_definition",
      resourceId: id,
      details: {
        previousState: {
          label: updated.existing.label,
          isRequired: updated.existing.isRequired,
          isActive: updated.existing.isActive,
        },
        nextState: {
          label: updated.row.label,
          isRequired: updated.row.isRequired,
          isActive: updated.row.isActive,
        },
      },
    });

    return NextResponse.json({ definition: updated.row });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE = soft-archive. Definition row stays; values stay; UI hides it.
// Use PATCH { reactivate: true } to restore.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session } = await requireServerSession();
  const { id } = await params;
  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only contractor admins can manage custom fields.",
        "forbidden",
      );
    }

    const archived = await withTenant(ctx.organization.id, async (tx) => {
      const [row] = await tx
        .update(customFieldDefinitions)
        .set({ isActive: false, archivedAt: new Date() })
        .where(
          and(
            eq(customFieldDefinitions.id, id),
            eq(customFieldDefinitions.organizationId, ctx.organization.id),
          ),
        )
        .returning();
      return row ?? null;
    });

    if (!archived) {
      return NextResponse.json(
        { error: "not_found", message: "Custom field not found." },
        { status: 404 },
      );
    }

    await writeOrgAuditEvent(ctx, {
      action: "custom_field.archived",
      resourceType: "custom_field_definition",
      resourceId: id,
      details: { metadata: { entityType: archived.entityType, key: archived.key } },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
  if (err instanceof AuthorizationError) {
    const code = err.code === "unauthenticated" ? 401 : 403;
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: code },
    );
  }
  // eslint-disable-next-line no-console
  console.error("[custom-fields/:id] route error:", err);
  return NextResponse.json(
    { error: "internal_error", message: "Something went wrong." },
    { status: 500 },
  );
}
