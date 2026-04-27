import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
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

  // Entry-point dbAdmin: we don't know the project yet. Both rows
  // share a project (enforced below) — admin pool reads only the
  // projectId. The follow-up writes use withTenant.
  const [succ, pred] = await Promise.all([
    dbAdmin
      .select({ id: milestones.id, projectId: milestones.projectId })
      .from(milestones)
      .where(eq(milestones.id, successorId))
      .limit(1),
    dbAdmin
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

    const result = await withTenant(ctx.organization.id, async (tx) => {
      // Cycle check: would the new edge create a loop? RLS on
      // milestone_dependencies filters via the milestones policy, which
      // already scopes to the caller's accessible projects — single-project
      // edges (enforced above) yield the full edge set for cycle detection.
      const existingEdges = await tx
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
        throw new CycleError();
      }

      const [created] = await tx
        .insert(milestoneDependencies)
        .values({ predecessorId, successorId })
        .onConflictDoNothing({
          target: [
            milestoneDependencies.predecessorId,
            milestoneDependencies.successorId,
          ],
        })
        .returning();

      if (!created) {
        throw new DuplicateEdgeError();
      }

      await writeAuditEvent(ctx, {
        action: "dependency_added",
        resourceType: "milestone",
        resourceId: successorId,
        details: {
          nextState: {
            dependencyId: created.id,
            predecessorId,
          },
        },
      }, tx);

      return created;
    });

    return NextResponse.json({ id: result.id });
  } catch (err) {
    if (err instanceof CycleError) {
      return NextResponse.json(
        { error: "cycle", message: "That would create a circular dependency" },
        { status: 409 },
      );
    }
    if (err instanceof DuplicateEdgeError) {
      return NextResponse.json(
        { error: "duplicate", message: "This dependency already exists" },
        { status: 409 },
      );
    }
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

class CycleError extends Error {}
class DuplicateEdgeError extends Error {}

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

  const [succ] = await dbAdmin
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

    const deleted = await withTenant(ctx.organization.id, async (tx) => {
      const result = await tx
        .delete(milestoneDependencies)
        .where(
          and(
            eq(milestoneDependencies.predecessorId, predecessorId),
            eq(milestoneDependencies.successorId, successorId),
          ),
        )
        .returning();
      if (result.length === 0) return false;

      await writeAuditEvent(ctx, {
        action: "dependency_removed",
        resourceType: "milestone",
        resourceId: successorId,
        details: {
          previousState: { predecessorId },
        },
      }, tx);
      return true;
    });

    if (!deleted) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

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
