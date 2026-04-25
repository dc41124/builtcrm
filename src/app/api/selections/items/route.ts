import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { selectionCategories, selectionItems } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  allowanceCents: z.number().int().min(0).optional(),
  decisionDeadline: z.string().datetime().optional(),
  affectsSchedule: z.boolean().optional(),
  scheduleImpactNote: z.string().optional(),
  revisionWindowHours: z.number().int().min(0).max(720).optional(),
  sortOrder: z.number().int().min(0).optional(),
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

  try {
    const ctx = await getEffectiveContext(
      session,
      parsed.data.projectId,
    );
    assertCan(ctx.permissions, "selection", "write");
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create selection items",
        "forbidden",
      );
    }

    const [category] = await db
      .select({ id: selectionCategories.id })
      .from(selectionCategories)
      .where(
        and(
          eq(selectionCategories.id, parsed.data.categoryId),
          eq(selectionCategories.projectId, ctx.project.id),
        ),
      )
      .limit(1);
    if (!category) {
      return NextResponse.json({ error: "category_not_found" }, { status: 404 });
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(selectionItems)
        .values({
          projectId: ctx.project.id,
          categoryId: category.id,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          allowanceCents: parsed.data.allowanceCents ?? 0,
          decisionDeadline: parsed.data.decisionDeadline
            ? new Date(parsed.data.decisionDeadline)
            : null,
          affectsSchedule: parsed.data.affectsSchedule ?? false,
          scheduleImpactNote: parsed.data.scheduleImpactNote ?? null,
          revisionWindowHours: parsed.data.revisionWindowHours ?? 48,
          sortOrder: parsed.data.sortOrder ?? 0,
        })
        .returning();
      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "selection_item",
          resourceId: row.id,
          details: {
            nextState: {
              title: row.title,
              status: row.selectionItemStatus,
              allowanceCents: row.allowanceCents,
            },
          },
        },
        tx,
      );
      return row;
    });

    return NextResponse.json({
      id: result.id,
      title: result.title,
      selectionItemStatus: result.selectionItemStatus,
    });
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
