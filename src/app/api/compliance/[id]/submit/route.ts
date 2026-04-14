import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { complianceRecords } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  documentId: z.string().uuid(),
  expiresAt: z.string().datetime().optional(),
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
    const [record] = await db
      .select()
      .from(complianceRecords)
      .where(eq(complianceRecords.id, id))
      .limit(1);
    if (!record || !record.projectId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      record.projectId,
    );
    if (ctx.role !== "subcontractor_user") {
      throw new AuthorizationError(
        "Only the target subcontractor can submit compliance records",
        "forbidden",
      );
    }
    if (ctx.organization.id !== record.organizationId) {
      throw new AuthorizationError(
        "This compliance record belongs to another organization",
        "forbidden",
      );
    }
    if (
      record.complianceStatus !== "pending" &&
      record.complianceStatus !== "rejected" &&
      record.complianceStatus !== "expired"
    ) {
      return NextResponse.json(
        { error: "invalid_state", state: record.complianceStatus },
        { status: 409 },
      );
    }

    const previousState = record.complianceStatus;

    await db.transaction(async (tx) => {
      await tx
        .update(complianceRecords)
        .set({
          documentId: parsed.data.documentId,
          expiresAt: parsed.data.expiresAt
            ? new Date(parsed.data.expiresAt)
            : record.expiresAt,
          complianceStatus: "pending",
        })
        .where(eq(complianceRecords.id, record.id));

      await writeAuditEvent(
        ctx,
        {
          action: "submitted",
          resourceType: "compliance_record",
          resourceId: record.id,
          details: {
            previousState: { status: previousState },
            nextState: { status: "pending", documentId: parsed.data.documentId },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "file_uploaded",
          summary: `Compliance document submitted: ${record.complianceType}`,
          relatedObjectType: "compliance_record",
          relatedObjectId: record.id,
          visibilityScope: "project_wide",
        },
        tx,
      );
    });

    return NextResponse.json({ id: record.id, status: "pending" });
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
