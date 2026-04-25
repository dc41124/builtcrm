import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { db } from "@/db/client";
import { milestoneDependencies, milestones } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { wouldCreateCycle } from "@/domain/schedule/dependencies";

// POST /api/milestones/[id]/dependencies
//
// Add a predecessor edge (`predecessorId` → this milestone). Guards:
//   - Same-project: the predecessor must belong to the same project.
//     Cross-project dependencies are out of scope for Step 23 and
//     would also cross the visibility/role boundary in ugly ways.
//   - No cycles: server-side replay of the client's cycle-safe
//     candidate filter. Defense-in-depth — client filters the picker
//     but the server must still reject a crafted request.
//   - No self-edge: DB check constraint catches it too, mapped to a
//     clean 400 here rather than leaking a 500.
//   - No duplicates: unique index on (predecessor_id, successor_id)
//     will reject a second insert; we detect and map to 409.

const BodySchema = z.object({
  predecessorId: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: successorId } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const predecessorId = parsed.data.predecessorId;

  if (predecessorId === successorId) {
    return NextResponse.json({ error: "self_edge" }, { status: 400 });
  }

  const [succ, pred] = await Promise.all([
    db
      .select({ id: milestones.id, projectId: milestones.projectId })
      .from(milestones)
      .where(eq(milestones.id, successorId))
      .limit(1),
    db
      .select({ id: milestones.id, projectId: milestones.projectId })
      .from(milestones)
      .where(eq(milestones.id, predecessorId))
      .limit(1),
  ]);
  if (!succ[0] || !pred[0]) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (succ[0].projectId !== pred[0].projectId) {
    return NextResponse.json(
      {
        error: "cross_project",
        message: "Dependencies must be within the same project",
      },
      { status: 400 },
    );
  }

  try {
    const ctx = await getEffectiveContext(
      session,
      succ[0].projectId,
    );
    assertCan(ctx.permissions, "milestone", "write");

    // Cycle check: would the new edge create a loop?
    const existingEdges = await db
      .select({
        predecessorId: milestoneDependencies.predecessorId,
        successorId: milestoneDependencies.successorId,
      })
      .from(milestoneDependencies);
    if (
      wouldCreateCycle({
        predecessorId,
        successorId,
        edges: existingEdges,
      })
    ) {
      return NextResponse.json(
        { error: "cycle", message: "That would create a circular dependency" },
        { status: 409 },
      );
    }

    const [row] = await db
      .insert(milestoneDependencies)
      .values({ predecessorId, successorId })
      .onConflictDoNothing({
        target: [
          milestoneDependencies.predecessorId,
          milestoneDependencies.successorId,
        ],
      })
      .returning();

    if (!row) {
      return NextResponse.json(
        { error: "duplicate", message: "This dependency already exists" },
        { status: 409 },
      );
    }

    await writeAuditEvent(ctx, {
      action: "dependency_added",
      resourceType: "milestone",
      resourceId: successorId,
      details: {
        nextState: {
          dependencyId: row.id,
          predecessorId,
        },
      },
    });

    return NextResponse.json({ id: row.id });
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

// DELETE /api/milestones/[id]/dependencies?predecessorId=<uuid>
// Removes an edge. Query-string based to avoid a dedicated nested
// route for the predecessor — edges are edge-shaped, not resources
// with their own lifecycle.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: successorId } = await params;
  const { session } = await requireServerSession();
  const url = new URL(req.url);
  const predecessorId = url.searchParams.get("predecessorId");
  if (!predecessorId) {
    return NextResponse.json(
      { error: "invalid_body", message: "predecessorId query param required" },
      { status: 400 },
    );
  }

  const [succ] = await db
    .select({ id: milestones.id, projectId: milestones.projectId })
    .from(milestones)
    .where(eq(milestones.id, successorId))
    .limit(1);
  if (!succ) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session,
      succ.projectId,
    );
    assertCan(ctx.permissions, "milestone", "write");

    const result = await db
      .delete(milestoneDependencies)
      .where(
        and(
          eq(milestoneDependencies.predecessorId, predecessorId),
          eq(milestoneDependencies.successorId, successorId),
        ),
      )
      .returning();
    if (result.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    await writeAuditEvent(ctx, {
      action: "dependency_removed",
      resourceType: "milestone",
      resourceId: successorId,
      details: {
        previousState: { predecessorId },
      },
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
