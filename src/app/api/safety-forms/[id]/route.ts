import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { withTenant } from "@/db/with-tenant";
import { safetyFormIncidents, safetyForms } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// PATCH /api/safety-forms/[id] — update flag state and (later) corrective-
// action edits. Contractor admin/PM only per Decision-5.
const PatchSchema = z.object({
  flagged: z.boolean().optional(),
  flagReason: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session } = await requireServerSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    // Fetch the form first to get its projectId so we can resolve context.
    // Use withTenant against the user's primary org — RLS filters this to
    // forms the caller can see.
    const sessionData = session;
    const { dbAdmin } = await import("@/db/admin-pool");
    const [form] = await dbAdmin
      .select({ id: safetyForms.id, projectId: safetyForms.projectId })
      .from(safetyForms)
      .where(eq(safetyForms.id, id))
      .limit(1);
    if (!form) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(sessionData, form.projectId);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit safety form metadata",
        "forbidden",
      );
    }

    await withTenant(ctx.organization.id, async (tx) => {
      const updates: Partial<typeof safetyForms.$inferInsert> = {};
      if (parsed.data.flagged !== undefined) updates.flagged = parsed.data.flagged;
      if (parsed.data.flagReason !== undefined)
        updates.flagReason = parsed.data.flagReason ?? null;
      if (Object.keys(updates).length === 0) return;

      await tx.update(safetyForms).set(updates).where(eq(safetyForms.id, id));

      await writeAuditEvent(
        ctx,
        {
          action: "updated",
          resourceType: "safety_form",
          resourceId: id,
          details: { nextState: updates },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
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
    throw err;
  }
}

// GET /api/safety-forms/[id] — full detail including incident subtype.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session } = await requireServerSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const { dbAdmin } = await import("@/db/admin-pool");
    const [form] = await dbAdmin
      .select({ id: safetyForms.id, projectId: safetyForms.projectId })
      .from(safetyForms)
      .where(eq(safetyForms.id, id))
      .limit(1);
    if (!form) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(session, form.projectId);
    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [row] = await tx.select().from(safetyForms).where(eq(safetyForms.id, id)).limit(1);
      if (!row) throw new AuthorizationError("Not visible", "not_found");
      let incident: typeof safetyFormIncidents.$inferSelect | null = null;
      if (row.formType === "incident_report") {
        const [inc] = await tx
          .select()
          .from(safetyFormIncidents)
          .where(eq(safetyFormIncidents.safetyFormId, id))
          .limit(1);
        incident = inc ?? null;
      }
      return { row, incident };
    });

    return NextResponse.json(result);
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
    throw err;
  }
}
