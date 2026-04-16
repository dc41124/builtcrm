import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { documentLinks, documents } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { getObjectSize, objectExists } from "@/lib/storage";

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

const BodySchema = z.object({
  projectId: z.string().uuid(),
  storageKey: z.string().min(1),
  title: z.string().min(1).max(255),
  documentType: z.string().min(1).max(120).default("general"),
  visibilityScope: z.enum(VISIBILITY_VALUES).default("project_wide"),
  audienceScope: z.enum(AUDIENCE_VALUES).default("internal"),
  sourceObject: z
    .object({
      type: z.string().min(1).max(120),
      id: z.string().uuid(),
      linkRole: z.string().min(1).max(120).default("attachment"),
    })
    .optional(),
});

export async function POST(req: Request) {
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
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      parsed.data.projectId,
    );
    assertCan(ctx.permissions, "document", "write");

    // Storage keys must live under this project's folder — refuse to
    // finalize a row that points at someone else's path.
    const expectedPrefix = `${ctx.project.contractorOrganizationId}/${ctx.project.id}/`;
    if (!parsed.data.storageKey.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "invalid_storage_key" },
        { status: 400 },
      );
    }

    const fileSize = await getObjectSize(parsed.data.storageKey);
    if (fileSize === null) {
      // getObjectSize returns null if the object doesn't exist
      if (!(await objectExists(parsed.data.storageKey))) {
        return NextResponse.json(
          { error: "object_not_found_in_storage" },
          { status: 404 },
        );
      }
    }

    const result = await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(documents)
        .values({
          projectId: ctx.project.id,
          documentType: parsed.data.documentType,
          title: parsed.data.title,
          storageKey: parsed.data.storageKey,
          uploadedByUserId: ctx.user.id,
          visibilityScope: parsed.data.visibilityScope,
          audienceScope: parsed.data.audienceScope,
          fileSizeBytes: fileSize,
        })
        .returning();

      await tx.insert(documentLinks).values({
        documentId: doc.id,
        linkedObjectType: "project",
        linkedObjectId: ctx.project.id,
        linkRole: "primary",
      });

      if (parsed.data.sourceObject) {
        await tx.insert(documentLinks).values({
          documentId: doc.id,
          linkedObjectType: parsed.data.sourceObject.type,
          linkedObjectId: parsed.data.sourceObject.id,
          linkRole: parsed.data.sourceObject.linkRole,
        });
      }

      await writeAuditEvent(
        ctx,
        {
          action: "uploaded",
          resourceType: "document",
          resourceId: doc.id,
          details: {
            nextState: {
              storageKey: doc.storageKey,
              documentType: doc.documentType,
              title: doc.title,
            },
          },
        },
        tx,
      );

      return doc;
    });

    return NextResponse.json({
      documentId: result.id,
      storageKey: result.storageKey,
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
