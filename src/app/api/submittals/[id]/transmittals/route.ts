import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { documents, submittalTransmittals, submittals } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";
import { formatNumber } from "@/lib/submittals/config";

// POST /api/submittals/[id]/transmittals
//
// Logs a transmission event on the submittal timeline. GC-only — subs
// don't log transmittals. Three directions (see schema / config.ts):
//  - outgoing_to_reviewer: GC marks the package as sent to the reviewer
//  - incoming_from_reviewer: GC logs the reviewer's response on their
//    behalf (stamp page + notes). Pairs with the transition action that
//    sets status to returned_*; typically called from the UI in sequence.
//  - forwarded_to_sub: GC closes the loop back to the sub. Emits
//    submittal_returned so the sub sees the result.
//
// `documentId` is optional — pure-log entries (no cover sheet) are fine.

const BodySchema = z.object({
  direction: z.enum([
    "outgoing_to_reviewer",
    "incoming_from_reviewer",
    "forwarded_to_sub",
  ]),
  documentId: z.string().uuid().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
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
  const input = parsed.data;

  try {
    const [current] = await db
      .select({
        id: submittals.id,
        projectId: submittals.projectId,
        sequentialNumber: submittals.sequentialNumber,
        title: submittals.title,
        status: submittals.status,
        submittedByOrgId: submittals.submittedByOrgId,
      })
      .from(submittals)
      .where(eq(submittals.id, id))
      .limit(1);
    if (!current) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      current.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors log submittal transmittals",
        "forbidden",
      );
    }

    // Document (if any) must live on the same project.
    if (input.documentId) {
      const [doc] = await db
        .select({ id: documents.id, projectId: documents.projectId })
        .from(documents)
        .where(eq(documents.id, input.documentId))
        .limit(1);
      if (!doc || doc.projectId !== current.projectId) {
        return NextResponse.json(
          { error: "invalid_document", message: "Document not on this project" },
          { status: 400 },
        );
      }
    }

    const row = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(submittalTransmittals)
        .values({
          submittalId: id,
          direction: input.direction,
          transmittedByUserId: ctx.user.id,
          documentId: input.documentId ?? null,
          notes: input.notes ?? null,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: `transmittal_${input.direction}`,
          resourceType: "submittal",
          resourceId: id,
          details: {
            nextState: {
              transmittalId: inserted.id,
              direction: inserted.direction,
              documentId: inserted.documentId,
            },
          },
        },
        tx,
      );
      return inserted;
    });

    // forwarded_to_sub is the cue to notify the submitting sub org.
    if (input.direction === "forwarded_to_sub") {
      await emitNotifications({
        eventId: "submittal_returned",
        actorUserId: ctx.user.id,
        projectId: current.projectId,
        relatedObjectType: "submittal",
        relatedObjectId: id,
        targetOrganizationId: current.submittedByOrgId,
        vars: {
          number: formatNumber(current.sequentialNumber),
          title: current.title,
          status: current.status,
          actorName: ctx.user.displayName ?? ctx.user.email,
        },
      });
    }

    return NextResponse.json({ id: row.id });
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
