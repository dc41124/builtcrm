import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { withTenant } from "@/db/with-tenant";
import {
  safetyFormTemplateAssignments,
  safetyFormTemplates,
} from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/safety-form-templates/[id]/assignments
// Returns the list of (sub_org, project) tuples this template is assigned to.
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
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can manage template assignments",
        "forbidden",
      );
    }

    const rows = await withTenant(ctx.organization.id, async (tx) => {
      // Confirm the template is owned by this org (RLS would filter
      // anyway; explicit check returns a cleaner 404).
      const [tpl] = await tx
        .select({ id: safetyFormTemplates.id })
        .from(safetyFormTemplates)
        .where(
          and(
            eq(safetyFormTemplates.id, id),
            eq(safetyFormTemplates.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);
      if (!tpl) throw new AuthorizationError("Template not found", "not_found");

      return tx
        .select()
        .from(safetyFormTemplateAssignments)
        .where(eq(safetyFormTemplateAssignments.templateId, id));
    });

    return NextResponse.json({ rows });
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

// PUT /api/safety-form-templates/[id]/assignments — replace the assignment
// set wholesale. Body: { assignments: [{ orgId, projectId? }, ...] }.
const PutSchema = z.object({
  assignments: z
    .array(
      z.object({
        orgId: z.string().uuid(),
        projectId: z.string().uuid().nullable().optional(),
      }),
    )
    .max(200),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session } = await requireServerSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const parsed = PutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can manage template assignments",
        "forbidden",
      );
    }

    await withTenant(ctx.organization.id, async (tx) => {
      const [tpl] = await tx
        .select({ id: safetyFormTemplates.id })
        .from(safetyFormTemplates)
        .where(
          and(
            eq(safetyFormTemplates.id, id),
            eq(safetyFormTemplates.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);
      if (!tpl) throw new AuthorizationError("Template not found", "not_found");

      // Replace-all semantics: delete existing then insert. Both run inside
      // the same transaction so the RLS check stays consistent.
      await tx
        .delete(safetyFormTemplateAssignments)
        .where(eq(safetyFormTemplateAssignments.templateId, id));

      if (parsed.data.assignments.length > 0) {
        await tx.insert(safetyFormTemplateAssignments).values(
          parsed.data.assignments.map((a) => ({
            templateId: id,
            organizationId: a.orgId,
            projectId: a.projectId ?? null,
            assignedByUserId: ctx.user.id,
          })),
        );
      }

      await writeOrgAuditEvent(
        ctx,
        {
          action: "updated",
          resourceType: "safety_form_template",
          resourceId: id,
          details: {
            nextState: { assignmentCount: parsed.data.assignments.length },
          },
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

