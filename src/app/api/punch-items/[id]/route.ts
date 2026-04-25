import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { punchItems } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { getPunchItem } from "@/domain/loaders/punch-list";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/punch-items/[id]
//
// Full detail fetch — used by the workspace's DetailPanel to populate
// photos + comment thread client-side when the user selects an item
// from the list. Role-gated via getPunchItem; subs only see items
// assigned to their org.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  try {
    const item = await getPunchItem({
      session: session,
      itemId: id,
    });
    return NextResponse.json(item);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}

// PATCH /api/punch-items/[id] — non-status edits.
//
// Used for editing title / description / location / priority / dueDate
// / assignee / clientFacingNote. Status transitions go through the
// separate /transition endpoint with state-machine enforcement.
//
// Authorization: contractor only. Subs can't edit item fields — they
// can only transition state and post comments.

const BodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().min(1).max(10000).optional(),
  location: z.string().max(2000).nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assigneeOrgId: z.string().uuid().nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  clientFacingNote: z.string().max(4000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const [head] = await db
      .select({ id: punchItems.id, projectId: punchItems.projectId })
      .from(punchItems)
      .where(eq(punchItems.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit punch items",
        "forbidden",
      );
    }

    const patch: Partial<typeof punchItems.$inferInsert> = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.description !== undefined)
      patch.description = parsed.data.description;
    if (parsed.data.location !== undefined) patch.location = parsed.data.location;
    if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
    if (parsed.data.assigneeOrgId !== undefined)
      patch.assigneeOrgId = parsed.data.assigneeOrgId;
    if (parsed.data.assigneeUserId !== undefined)
      patch.assigneeUserId = parsed.data.assigneeUserId;
    if (parsed.data.dueDate !== undefined) patch.dueDate = parsed.data.dueDate;
    if (parsed.data.clientFacingNote !== undefined)
      patch.clientFacingNote = parsed.data.clientFacingNote;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ id });
    }

    await db.transaction(async (tx) => {
      await tx.update(punchItems).set(patch).where(eq(punchItems.id, id));
      await writeAuditEvent(
        ctx,
        {
          action: "updated",
          resourceType: "punch_item",
          resourceId: id,
          details: {
            metadata: { fields: Object.keys(patch) },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ id });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
