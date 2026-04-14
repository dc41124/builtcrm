import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { documents, uploadRequests } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  documentId: z.string().uuid(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const [request] = await db
      .select()
      .from(uploadRequests)
      .where(eq(uploadRequests.id, id))
      .limit(1);
    if (!request) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      request.projectId,
    );

    if (ctx.role !== "subcontractor_user") {
      throw new AuthorizationError(
        "Only subcontractors can submit upload requests",
        "forbidden",
      );
    }
    if (request.requestedFromOrganizationId !== ctx.organization.id) {
      throw new AuthorizationError(
        "Request not assigned to your organization",
        "forbidden",
      );
    }
    if (
      request.requestStatus !== "open" &&
      request.requestStatus !== "revision_requested"
    ) {
      return NextResponse.json(
        { error: "invalid_state", state: request.requestStatus },
        { status: 409 },
      );
    }

    const [doc] = await db
      .select({ id: documents.id, title: documents.title, projectId: documents.projectId })
      .from(documents)
      .where(and(eq(documents.id, parsed.data.documentId), eq(documents.projectId, request.projectId)))
      .limit(1);
    if (!doc) {
      return NextResponse.json({ error: "document_not_found" }, { status: 404 });
    }

    const previousState = request.requestStatus;

    await db.transaction(async (tx) => {
      await tx
        .update(uploadRequests)
        .set({
          requestStatus: "submitted",
          submittedDocumentId: doc.id,
          submittedAt: new Date(),
          submittedByUserId: ctx.user.id,
        })
        .where(eq(uploadRequests.id, request.id));

      await writeAuditEvent(
        ctx,
        {
          action: "submitted",
          resourceType: "upload_request",
          resourceId: request.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "submitted", documentId: doc.id },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "file_uploaded",
          summary: `Upload submitted: ${request.title}`,
          body: doc.title,
          relatedObjectType: "upload_request",
          relatedObjectId: request.id,
          visibilityScope: "subcontractor_scoped",
        },
        tx,
      );
    });

    return NextResponse.json({ id: request.id, status: "submitted" });
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
