// POST /api/drawings/sets
//
// Creates a new drawing_sets row in 'pending' processing status and
// returns a presigned R2 PUT URL the client can upload the source PDF
// to directly. The set starts as status='current' — if the family has an
// existing current set, the processDrawingSet step (called from finalize)
// demotes the older one to 'superseded' once extraction succeeds.
//
// Version + supersedes are computed server-side based on the
// (projectId, family) tuple; the client shouldn't be guessing version
// numbers.

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { db } from "@/db/client";
import { drawingSets } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";
import { buildSourcePdfKey } from "@/lib/drawings/storage";
import { nextVersionFor } from "@/lib/drawings/process";
import { presignUploadUrl } from "@/lib/storage";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  family: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/i, "family must be alphanumeric"),
  name: z.string().min(1).max(160),
  filename: z.string().min(1).max(255),
  fileSize: z.number().int().min(0).max(250 * 1024 * 1024),
  contentType: z.string().min(1).max(160),
  note: z.string().max(2000).optional(),
  asBuilt: z.boolean().optional(),
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

  try {
    const ctx = await getEffectiveContext(
      session,
      parsed.data.projectId,
    );
    assertCan(ctx.permissions, "drawing", "write");

    const { nextVersion, currentSetId } = await nextVersionFor(
      ctx.project.id,
      parsed.data.family,
    );

    const [set] = await db
      .insert(drawingSets)
      .values({
        projectId: ctx.project.id,
        family: parsed.data.family,
        name: parsed.data.name,
        version: nextVersion,
        status: "current",
        asBuilt: parsed.data.asBuilt ?? false,
        supersedesId: currentSetId,
        uploadedByUserId: ctx.user.id,
        processingStatus: "pending",
        fileSizeBytes: parsed.data.fileSize,
        note: parsed.data.note ?? null,
      })
      .returning({ id: drawingSets.id });

    const storageKey = buildSourcePdfKey({
      orgId: ctx.project.contractorOrganizationId,
      projectId: ctx.project.id,
      setId: set.id,
      filename: parsed.data.filename,
    });

    await db
      .update(drawingSets)
      .set({ sourceFileKey: storageKey })
      .where(eq(drawingSets.id, set.id));

    const uploadUrl = await presignUploadUrl({
      key: storageKey,
      contentType: parsed.data.contentType,
    });

    return NextResponse.json({
      setId: set.id,
      version: nextVersion,
      supersedesId: currentSetId,
      uploadUrl,
      storageKey,
      method: "PUT",
      headers: { "Content-Type": parsed.data.contentType },
      expiresInSeconds: 300,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    throw err;
  }
}

