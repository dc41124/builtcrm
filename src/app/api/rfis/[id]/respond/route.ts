import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { documents, rfiResponses, rfis } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  body: z.string().min(1).max(10000),
  isOfficialResponse: z.boolean().optional(),
  attachedDocumentId: z.string().uuid().optional(),
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
    // Entry-point dbAdmin: tenant unknown until we resolve project
    // from the RFI row. Slice 3 pattern.
    const [rfi] = await dbAdmin.select().from(rfis).where(eq(rfis.id, id)).limit(1);
    if (!rfi) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      rfi.projectId,
    );

    // Subs respond when assigned to their org. Contractors may also respond
    // (they author formal responses for clarification threads).
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isAssignedSub =
      ctx.role === "subcontractor_user" &&
      rfi.assignedToOrganizationId === ctx.organization.id;
    if (!isContractor && !isAssignedSub) {
      throw new AuthorizationError(
        "Not permitted to respond to this RFI",
        "forbidden",
      );
    }

    if (rfi.rfiStatus !== "open" && rfi.rfiStatus !== "pending_response") {
      return NextResponse.json(
        { error: "invalid_state", state: rfi.rfiStatus },
        { status: 409 },
      );
    }

    if (parsed.data.attachedDocumentId) {
      const [doc] = await dbAdmin
        .select({ id: documents.id })
        .from(documents)
        .where(
          and(
            eq(documents.id, parsed.data.attachedDocumentId),
            eq(documents.projectId, rfi.projectId),
          ),
        )
        .limit(1);
      if (!doc) {
        return NextResponse.json({ error: "document_not_found" }, { status: 404 });
      }
    }

    const previousState = rfi.rfiStatus;

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [response] = await tx
        .insert(rfiResponses)
        .values({
          rfiId: rfi.id,
          respondedByUserId: ctx.user.id,
          body: parsed.data.body,
          isOfficialResponse: parsed.data.isOfficialResponse ?? false,
          attachedDocumentId: parsed.data.attachedDocumentId ?? null,
        })
        .returning();

      await tx
        .update(rfis)
        .set({ rfiStatus: "answered", respondedAt: new Date() })
        .where(eq(rfis.id, rfi.id));

      await writeAuditEvent(
        ctx,
        {
          action: "responded",
          resourceType: "rfi",
          resourceId: rfi.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "answered", responseId: response.id },
            metadata: { isOfficialResponse: response.isOfficialResponse },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "comment_added",
          summary: `RFI-${String(rfi.sequentialNumber).padStart(3, "0")} answered: ${rfi.subject}`,
          body: parsed.data.body.slice(0, 255),
          relatedObjectType: "rfi",
          relatedObjectId: rfi.id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      return response;
    });

    return NextResponse.json({ responseId: result.id, status: "answered" });
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
