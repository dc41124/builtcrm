import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { submittals } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { formatNumber } from "@/lib/submittals/config";

// POST /api/submittals — create a submittal (always starts in draft).
//
// Both contractor (admin/pm) and subcontractor_user can create:
//  - Sub: creates for their own org only; submittedByOrgId = their org.
//  - GC: can submit on behalf of any sub; must supply submittedByOrgId.
//  - `revisionOfId` (optional) links the new draft to a prior revision.
//    If supplied, the action layer carries the prior spec_section/title/
//    type forward as defaults (UI prefills; we trust the body).
//
// Sequential number computed inside the transaction as max+1 with a
// fallback retry-on-collision through the unique index on
// (projectId, sequentialNumber).

const BodySchema = z.object({
  projectId: z.string().uuid(),
  specSection: z.string().min(1).max(40),
  title: z.string().min(1).max(255),
  submittalType: z.enum([
    "product_data",
    "shop_drawing",
    "sample",
    "mock_up",
    "calculations",
    "schedule_of_values",
  ]),
  // Optional: subs can omit and the action infers from ctx.organization.id.
  // Contractors must supply it explicitly (they're submitting on behalf of
  // a sub, so we can't guess which sub).
  submittedByOrgId: z.string().uuid().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dueDate must be YYYY-MM-DD")
    .nullable()
    .optional(),
  revisionOfId: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
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
    const ctx = await getEffectiveContext(
      session,
      input.projectId,
    );
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    const isSub = ctx.role === "subcontractor_user";
    if (!isContractor && !isSub) {
      throw new AuthorizationError(
        "Only contractors and subs can create submittals",
        "forbidden",
      );
    }
    // Resolve the submitting org: contractors must supply it, subs can
    // omit it (we default to their own org) but if they do supply it, it
    // must match their org.
    let submittedByOrgId: string;
    if (isSub) {
      submittedByOrgId = input.submittedByOrgId ?? ctx.organization.id;
      if (submittedByOrgId !== ctx.organization.id) {
        throw new AuthorizationError(
          "Subs can only submit for their own org",
          "forbidden",
        );
      }
    } else {
      if (!input.submittedByOrgId) {
        return NextResponse.json(
          {
            error: "missing_field",
            message: "submittedByOrgId is required when a contractor creates a submittal",
          },
          { status: 400 },
        );
      }
      submittedByOrgId = input.submittedByOrgId;
    }

    const result = await db.transaction(async (tx) => {
      const [{ nextNumber }] = await tx
        .select({
          nextNumber: sql<number>`coalesce(max(${submittals.sequentialNumber}), 0) + 1`,
        })
        .from(submittals)
        .where(eq(submittals.projectId, input.projectId));

      const [row] = await tx
        .insert(submittals)
        .values({
          projectId: input.projectId,
          sequentialNumber: nextNumber,
          specSection: input.specSection,
          title: input.title,
          submittalType: input.submittalType,
          submittedByOrgId,
          status: "draft",
          dueDate: input.dueDate ?? null,
          revisionOfId: input.revisionOfId ?? null,
          createdByUserId: ctx.user.id,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "submittal",
          resourceId: row.id,
          details: {
            nextState: {
              sequentialNumber: row.sequentialNumber,
              status: row.status,
              submittalType: row.submittalType,
              specSection: row.specSection,
              revisionOfId: row.revisionOfId,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `${formatNumber(row.sequentialNumber)}: ${row.title}`,
          body: `Submittal draft created for ${row.specSection}`,
          relatedObjectType: "submittal",
          relatedObjectId: row.id,
          visibilityScope: "internal_only",
        },
        tx,
      );

      return row;
    });

    return NextResponse.json({
      id: result.id,
      number: formatNumber(result.sequentialNumber),
      status: result.status,
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
