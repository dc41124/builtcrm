import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { punchItemComments, punchItems } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/punch-items/[id]/comments — post a non-system comment.
//
// Authorization: contractor OR the assigned sub org. Residential
// clients don't comment (the walkthrough view is read-only per the
// Step 19 auth matrix).
//
// System comments are written only by the transition endpoint — never
// via this route. The isSystem flag on inserts here is hardcoded to
// false.

const BodySchema = z.object({
  body: z.string().min(1).max(4000),
});

export async function POST(
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
      .select({
        id: punchItems.id,
        projectId: punchItems.projectId,
        assigneeOrgId: punchItems.assigneeOrgId,
        status: punchItems.status,
      })
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
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isAssignedSub =
      ctx.role === "subcontractor_user" &&
      head.assigneeOrgId === ctx.organization.id;
    if (!isContractor && !isAssignedSub) {
      throw new AuthorizationError(
        "Only contractors and the assigned sub can comment",
        "forbidden",
      );
    }

    // Verified / void items are terminal — don't reopen the thread.
    if (head.status === "verified" || head.status === "void") {
      return NextResponse.json(
        {
          error: "closed",
          message: "This item is closed; new comments aren't allowed.",
        },
        { status: 409 },
      );
    }

    const [row] = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(punchItemComments)
        .values({
          punchItemId: id,
          authorUserId: ctx.user.id,
          body: parsed.data.body,
          isSystem: false,
        })
        .returning();
      await writeAuditEvent(
        ctx,
        {
          action: "comment_posted",
          resourceType: "punch_item",
          resourceId: id,
          details: { metadata: { commentId: inserted[0].id } },
        },
        tx,
      );
      return inserted;
    });

    return NextResponse.json({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    });
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
