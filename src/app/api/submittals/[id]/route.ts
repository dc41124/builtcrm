import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { submittals } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { getSubmittal } from "@/domain/loaders/submittals";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/submittals/[id] — full detail (documents + transmittal log).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const item = await getSubmittal({
      session: session.session as unknown as { appUserId?: string | null },
      submittalId: id,
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

// PATCH /api/submittals/[id] — non-status edits.
//
// Authorization matrix:
//  - Draft rows: the submitting org (sub or GC) can edit title/spec/
//    type/dueDate. GC can additionally set reviewer fields.
//  - Non-draft rows: contractor only. (Once submitted, sub shouldn't be
//    mutating the package metadata.)
//
// Reviewer fields (reviewerName/reviewerOrg/reviewerEmail) editable by
// GC only, any non-terminal state.

const BodySchema = z.object({
  specSection: z.string().min(1).max(40).optional(),
  title: z.string().min(1).max(255).optional(),
  submittalType: z
    .enum([
      "product_data",
      "shop_drawing",
      "sample",
      "mock_up",
      "calculations",
      "schedule_of_values",
    ])
    .optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  routedToOrgId: z.string().uuid().nullable().optional(),
  reviewerName: z.string().max(200).nullable().optional(),
  reviewerOrg: z.string().max(200).nullable().optional(),
  reviewerEmail: z.string().email().max(320).nullable().optional(),
});

export async function PATCH(
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
    const [head] = await db
      .select({
        id: submittals.id,
        projectId: submittals.projectId,
        submittedByOrgId: submittals.submittedByOrgId,
        status: submittals.status,
      })
      .from(submittals)
      .where(eq(submittals.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      head.projectId,
    );
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isSubmittingSub =
      ctx.role === "subcontractor_user" &&
      head.submittedByOrgId === ctx.organization.id;

    // Draft can be edited by either the submitting org (sub) or GC.
    // Anything else: GC only.
    const canEditCore =
      isContractor || (isSubmittingSub && head.status === "draft");
    if (!canEditCore) {
      throw new AuthorizationError(
        "Not allowed to edit this submittal",
        "forbidden",
      );
    }

    // Reviewer fields are GC-only even in draft.
    const touchesReviewer =
      parsed.data.reviewerName !== undefined ||
      parsed.data.reviewerOrg !== undefined ||
      parsed.data.reviewerEmail !== undefined ||
      parsed.data.routedToOrgId !== undefined;
    if (touchesReviewer && !isContractor) {
      throw new AuthorizationError(
        "Only contractors can edit reviewer fields",
        "forbidden",
      );
    }

    const patch: Partial<typeof submittals.$inferInsert> = {};
    if (parsed.data.specSection !== undefined)
      patch.specSection = parsed.data.specSection;
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.submittalType !== undefined)
      patch.submittalType = parsed.data.submittalType;
    if (parsed.data.dueDate !== undefined) patch.dueDate = parsed.data.dueDate;
    if (parsed.data.routedToOrgId !== undefined)
      patch.routedToOrgId = parsed.data.routedToOrgId;
    if (parsed.data.reviewerName !== undefined)
      patch.reviewerName = parsed.data.reviewerName;
    if (parsed.data.reviewerOrg !== undefined)
      patch.reviewerOrg = parsed.data.reviewerOrg;
    if (parsed.data.reviewerEmail !== undefined)
      patch.reviewerEmail = parsed.data.reviewerEmail;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ id });
    }

    await db.transaction(async (tx) => {
      await tx.update(submittals).set(patch).where(eq(submittals.id, id));
      await writeAuditEvent(
        ctx,
        {
          action: "updated",
          resourceType: "submittal",
          resourceId: id,
          details: { metadata: { fields: Object.keys(patch) } },
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
