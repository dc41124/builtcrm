import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { documentLinks, documents } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { objectExists } from "@/lib/storage";

const BodySchema = z.object({
  storageKey: z.string().min(1),
  title: z.string().min(1).max(255).optional(),
});

// Replace-and-archive supersession: create a new `documents` row pointing
// at the freshly uploaded R2 object, mark the prior row is_superseded +
// document_status='superseded', and write a document_links row from the
// NEW document back to the OLD one carrying link_role='supersedes'. Metadata
// (type/visibility/audience) is inherited from the prior row to keep scope
// consistent — callers who need to change those can PATCH the new row.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: priorId } = await params;
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

  const [prior] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, priorId))
    .limit(1);
  if (!prior) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      prior.projectId,
    );
    assertCan(ctx.permissions, "document", "write");

    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    if (!isContractor && prior.uploadedByUserId !== ctx.user.id) {
      throw new AuthorizationError(
        "Only the original uploader or a contractor can supersede this document",
        "forbidden",
      );
    }

    if (prior.isSuperseded) {
      return NextResponse.json(
        { error: "already_superseded" },
        { status: 409 },
      );
    }

    const expectedPrefix = `${ctx.project.contractorOrganizationId}/${ctx.project.id}/`;
    if (!parsed.data.storageKey.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "invalid_storage_key" },
        { status: 400 },
      );
    }
    if (!(await objectExists(parsed.data.storageKey))) {
      return NextResponse.json(
        { error: "object_not_found_in_storage" },
        { status: 404 },
      );
    }

    const result = await db.transaction(async (tx) => {
      const [next] = await tx
        .insert(documents)
        .values({
          projectId: prior.projectId,
          documentType: prior.documentType,
          title: parsed.data.title ?? prior.title,
          storageKey: parsed.data.storageKey,
          uploadedByUserId: ctx.user.id,
          visibilityScope: prior.visibilityScope,
          audienceScope: prior.audienceScope,
        })
        .returning();

      // Carry forward the project link so the new row is discoverable via
      // the same document_links pivot everything else uses.
      await tx.insert(documentLinks).values({
        documentId: next.id,
        linkedObjectType: "project",
        linkedObjectId: prior.projectId,
        linkRole: "primary",
      });

      // Supersede marker lives on the NEW document's link row.
      await tx.insert(documentLinks).values({
        documentId: next.id,
        linkedObjectType: "document",
        linkedObjectId: prior.id,
        linkRole: "supersedes",
      });

      await tx
        .update(documents)
        .set({
          isSuperseded: true,
          documentStatus: "superseded",
          updatedAt: new Date(),
        })
        .where(eq(documents.id, prior.id));

      await writeAuditEvent(
        ctx,
        {
          action: "superseded",
          resourceType: "document",
          resourceId: prior.id,
          details: {
            previousState: {
              storageKey: prior.storageKey,
              documentStatus: prior.documentStatus,
              isSuperseded: prior.isSuperseded,
            },
            nextState: {
              supersededByDocumentId: next.id,
              documentStatus: "superseded",
              isSuperseded: true,
            },
          },
        },
        tx,
      );
      await writeAuditEvent(
        ctx,
        {
          action: "uploaded",
          resourceType: "document",
          resourceId: next.id,
          details: {
            nextState: {
              storageKey: next.storageKey,
              documentType: next.documentType,
              title: next.title,
              supersedesDocumentId: prior.id,
            },
          },
        },
        tx,
      );

      return next;
    });

    return NextResponse.json({
      documentId: result.id,
      supersededDocumentId: priorId,
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
