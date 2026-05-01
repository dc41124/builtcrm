import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { withTenant } from "@/db/with-tenant";
import { auditEvents, documentLinks, rfis } from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  subject: z.string().min(1).max(255),
  body: z.string().max(10000).optional(),
  rfiType: z.enum(["formal", "issue"]).default("issue"),
  // Step 55 — quick-capture defaults to "draft"; existing contractor
  // create flows continue to send "open" (or omit and the route picks
  // "open" for contractors).
  status: z.enum(["draft", "open"]).optional(),
  assignedToOrganizationId: z.string().uuid().optional(),
  assignedToUserId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  drawingReference: z.string().max(255).optional(),
  specificationReference: z.string().max(255).optional(),
  locationDescription: z.string().max(2000).optional(),
  // Step 55 — idempotency key for the offline outbox. Lookup is via
  // audit_events.metadata_json.clientUuid; no new column needed.
  clientUuid: z.string().uuid().optional(),
  // Step 55 — quick-capture photo attachments. Document IDs are
  // pre-uploaded via the standard /api/files chain; we just write
  // document_links rows pointing at the new RFI.
  attachmentDocumentIds: z.array(z.string().uuid()).max(20).optional(),
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

  // Quick-capture (sub) creates default to assigning to the project's
  // contractor org — see authorization block below where we pull
  // project.contractorOrganizationId. For non-quick-capture creates we
  // still require an explicit assignment.
  const isQuickCapture =
    parsed.data.status === "draft" &&
    !parsed.data.assignedToOrganizationId &&
    !parsed.data.assignedToUserId;
  if (
    !isQuickCapture &&
    !parsed.data.assignedToOrganizationId &&
    !parsed.data.assignedToUserId
  ) {
    return NextResponse.json(
      { error: "invalid_body", message: "Must assign to a user or organization" },
      { status: 400 },
    );
  }

  try {
    const ctx = await getEffectiveContext(
      session,
      parsed.data.projectId,
    );
    // Step 55 — subs may now create RFIs, but ONLY in draft status. The
    // contractor inbox surfaces drafts for review and promotes to open.
    const isSub = ctx.role === "subcontractor_user";
    if (
      ctx.role !== "contractor_admin" &&
      ctx.role !== "contractor_pm" &&
      !isSub
    ) {
      throw new AuthorizationError(
        "Not authorized to create RFIs",
        "forbidden",
      );
    }
    if (isSub && parsed.data.status !== "draft") {
      throw new AuthorizationError(
        "Subcontractors can only create draft RFIs",
        "forbidden",
      );
    }

    // Step 55 — idempotent retry. The Step 51 outbox replays this with
    // the same clientUuid if the original response was lost. We probe
    // audit_events under tenant for a prior 'created' rfi with this key
    // in metadata. If found, return that RFI's id and exit.
    if (parsed.data.clientUuid) {
      const prior = await withTenant(ctx.organization.id, (tx) =>
        tx
          .select({
            objectId: auditEvents.objectId,
          })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.objectType, "rfi"),
              eq(auditEvents.actionName, "created"),
              eq(auditEvents.projectId, parsed.data.projectId),
              sql`${auditEvents.metadataJson}->>'clientUuid' = ${parsed.data.clientUuid}`,
            ),
          )
          .limit(1),
      );
      if (prior.length > 0) {
        return NextResponse.json({
          id: prior[0].objectId,
          idempotent: true,
        });
      }
    }

    // Resolve the assignment defaults for quick-capture: the project's
    // contractor org. The heuristic is "fan out to contractor's general
    // RFI inbox"; per-project default-recipient column is a follow-up
    // tracked in production_grade_upgrades/rfi_quick_capture_v1_stubs.md.
    const resolvedAssignedToOrgId = isQuickCapture
      ? ctx.project.contractorOrganizationId
      : parsed.data.assignedToOrganizationId ?? null;
    const desiredStatus = parsed.data.status
      ? parsed.data.status
      : isSub
        ? "draft"
        : "open";

    const result = await withTenant(ctx.organization.id, async (tx) => {
      // Compute next sequential number per project. Unique index on
      // (project_id, sequential_number) will reject collisions from
      // concurrent inserts and surface as a 500 — acceptable for a
      // rare race in this minimal slice.
      const [{ nextNumber }] = await tx
        .select({
          nextNumber: sql<number>`coalesce(max(${rfis.sequentialNumber}), 0) + 1`,
        })
        .from(rfis)
        .where(eq(rfis.projectId, ctx.project.id));

      const [row] = await tx
        .insert(rfis)
        .values({
          projectId: ctx.project.id,
          sequentialNumber: nextNumber,
          subject: parsed.data.subject,
          body: parsed.data.body ?? null,
          rfiStatus: desiredStatus,
          rfiType: parsed.data.rfiType,
          createdByUserId: ctx.user.id,
          assignedToOrganizationId: resolvedAssignedToOrgId,
          assignedToUserId: parsed.data.assignedToUserId ?? null,
          dueAt: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
          drawingReference: parsed.data.drawingReference ?? null,
          specificationReference: parsed.data.specificationReference ?? null,
          locationDescription: parsed.data.locationDescription ?? null,
          visibilityScope: "project_wide",
        })
        .returning();

      // Step 55 — pin photo / attachment documents to this RFI via
      // document_links. Fails closed if the document isn't visible to
      // the caller's tenant (RLS on documents).
      if (parsed.data.attachmentDocumentIds?.length) {
        await tx.insert(documentLinks).values(
          parsed.data.attachmentDocumentIds.map((docId) => ({
            documentId: docId,
            linkedObjectType: "rfi",
            linkedObjectId: row.id,
            linkRole: "attachment",
          })),
        );
      }

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "rfi",
          resourceId: row.id,
          details: {
            nextState: {
              status: row.rfiStatus,
              sequentialNumber: row.sequentialNumber,
              subject: row.subject,
              assignedToOrganizationId: row.assignedToOrganizationId,
              assignedToUserId: row.assignedToUserId,
            },
            metadata: parsed.data.clientUuid
              ? {
                  clientUuid: parsed.data.clientUuid,
                  quickCapture: isQuickCapture,
                  attachmentCount:
                    parsed.data.attachmentDocumentIds?.length ?? 0,
                }
              : {
                  quickCapture: isQuickCapture,
                  attachmentCount:
                    parsed.data.attachmentDocumentIds?.length ?? 0,
                },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "approval_requested",
          summary: `RFI-${String(row.sequentialNumber).padStart(3, "0")}: ${row.subject}`,
          body: parsed.data.body ?? null,
          relatedObjectType: "rfi",
          relatedObjectId: row.id,
          visibilityScope: "project_wide",
        },
        tx,
      );

      return row;
    });

    const rfiVars = {
      title: `RFI-${String(result.sequentialNumber).padStart(3, "0")}: ${result.subject}`,
      actorName: ctx.user.displayName ?? ctx.user.email,
    };
    const emitBase = {
      actorUserId: ctx.user.id,
      projectId: ctx.project.id,
      relatedObjectType: "rfi",
      relatedObjectId: result.id,
      vars: rfiVars,
    };
    await Promise.all([
      emitNotifications({ ...emitBase, eventId: "rfi_new" }),
      emitNotifications({
        ...emitBase,
        eventId: "rfi_assigned",
        targetOrganizationId:
          parsed.data.assignedToOrganizationId ?? undefined,
      }),
    ]);

    return NextResponse.json({
      id: result.id,
      sequentialNumber: result.sequentialNumber,
      status: result.rfiStatus,
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
