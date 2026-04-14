import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { documents } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError, assertCan } from "@/domain/permissions";

const VISIBILITY_VALUES = [
  "internal_only",
  "client_visible",
  "subcontractor_scoped",
  "project_wide",
  "phase_scoped",
  "scope_scoped",
] as const;

const AUDIENCE_VALUES = [
  "internal",
  "contractor",
  "subcontractor",
  "client",
  "commercial_client",
  "residential_client",
  "mixed",
] as const;

const STATUS_VALUES = ["active", "pending_review", "archived"] as const;

const PatchSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    documentType: z.string().min(1).max(120).optional(),
    visibilityScope: z.enum(VISIBILITY_VALUES).optional(),
    audienceScope: z.enum(AUDIENCE_VALUES).optional(),
    documentStatus: z.enum(STATUS_VALUES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "no_fields" });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (!doc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      doc.projectId,
    );
    assertCan(ctx.permissions, "document", "write");

    // Contractors can edit any document on the project. Subs may only edit
    // documents they uploaded themselves. Clients never land here because
    // their role is not in the document.write policy.
    const isContractor =
      ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
    if (!isContractor && doc.uploadedByUserId !== ctx.user.id) {
      throw new AuthorizationError(
        "Only the original uploader or a contractor can edit this document",
        "forbidden",
      );
    }
    // Superseded rows are read-only — create a new version instead.
    if (doc.isSuperseded) {
      return NextResponse.json(
        { error: "document_is_superseded" },
        { status: 409 },
      );
    }

    const previousState = {
      title: doc.title,
      documentType: doc.documentType,
      visibilityScope: doc.visibilityScope,
      audienceScope: doc.audienceScope,
      documentStatus: doc.documentStatus,
    };
    const updates = parsed.data;

    const [updated] = await db
      .update(documents)
      .set({
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.documentType !== undefined && {
          documentType: updates.documentType,
        }),
        ...(updates.visibilityScope !== undefined && {
          visibilityScope: updates.visibilityScope,
        }),
        ...(updates.audienceScope !== undefined && {
          audienceScope: updates.audienceScope,
        }),
        ...(updates.documentStatus !== undefined && {
          documentStatus: updates.documentStatus,
        }),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();

    const action =
      updates.documentStatus === "archived"
        ? "archived"
        : updates.documentStatus === "active" &&
            previousState.documentStatus === "archived"
          ? "restored"
          : "updated";

    await writeAuditEvent(ctx, {
      action,
      resourceType: "document",
      resourceId: id,
      details: {
        previousState,
        nextState: {
          title: updated.title,
          documentType: updated.documentType,
          visibilityScope: updated.visibilityScope,
          audienceScope: updated.audienceScope,
          documentStatus: updated.documentStatus,
        },
      },
    });

    return NextResponse.json({ documentId: updated.id });
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
