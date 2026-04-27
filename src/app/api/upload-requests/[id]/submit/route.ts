import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { documentLinks, documents, uploadRequests } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).optional(),
  responseNote: z.string().max(2000).optional(),
}).refine(
  (d) => d.documentId || (d.documentIds && d.documentIds.length > 0),
  { message: "At least one document is required" },
);

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
    // Entry-point dbAdmin: tenant unknown until we resolve project from
    // the upload_requests row. Slice 3 pattern.
    const [request] = await dbAdmin
      .select()
      .from(uploadRequests)
      .where(eq(uploadRequests.id, id))
      .limit(1);
    if (!request) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
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

    // Normalize to array of IDs
    const allDocIds = parsed.data.documentIds ?? (parsed.data.documentId ? [parsed.data.documentId] : []);
    if (allDocIds.length === 0) {
      return NextResponse.json({ error: "no_documents" }, { status: 400 });
    }

    const previousState = request.requestStatus;

    const documentCount = await withTenant(ctx.organization.id, async (tx) => {
      // Validate all documents exist in the same project — runs inside
      // withTenant so the documents read passes RLS (caller has POM).
      const docRows = await tx
        .select({ id: documents.id, title: documents.title, projectId: documents.projectId })
        .from(documents)
        .where(and(inArray(documents.id, allDocIds), eq(documents.projectId, request.projectId)));
      if (docRows.length !== allDocIds.length) {
        throw new DocumentMissingError();
      }
      const primaryDoc = docRows[0];


      await tx
        .update(uploadRequests)
        .set({
          requestStatus: "submitted",
          submittedDocumentId: primaryDoc.id,
          submittedAt: new Date(),
          submittedByUserId: ctx.user.id,
          responseNote: parsed.data.responseNote?.trim() || null,
        })
        .where(eq(uploadRequests.id, request.id));

      // Link all documents to the upload request
      for (const doc of docRows) {
        await tx.insert(documentLinks).values({
          documentId: doc.id,
          linkedObjectType: "upload_request",
          linkedObjectId: request.id,
          linkRole: "submission",
        });
      }

      await writeAuditEvent(
        ctx,
        {
          action: "submitted",
          resourceType: "upload_request",
          resourceId: request.id,
          details: {
            previousState: { status: previousState },
            nextState: {
              status: "submitted",
              documentId: primaryDoc.id,
              documentCount: docRows.length,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "file_uploaded",
          summary: `Upload submitted: ${request.title}`,
          body: docRows.length === 1
            ? primaryDoc.title
            : `${docRows.length} files submitted`,
          relatedObjectType: "upload_request",
          relatedObjectId: request.id,
          visibilityScope: "subcontractor_scoped",
        },
        tx,
      );

      return docRows.length;
    });

    return NextResponse.json({ id: request.id, status: "submitted", documentCount });
  } catch (err) {
    if (err instanceof DocumentMissingError) {
      return NextResponse.json({ error: "document_not_found" }, { status: 404 });
    }
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

class DocumentMissingError extends Error {}
