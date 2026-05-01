import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { meetings } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { buildStorageKey, presignUploadUrl } from "@/lib/storage";

// POST /api/meetings/:id/minutes/ai/upload
//
// Returns a presigned PUT URL the browser uses to upload meeting
// audio directly to R2. The browser then POSTs the resulting key to
// /transcribe to kick off the Trigger.dev job.
//
// Why presigned PUT and not a route that streams the upload through
// Next.js: audio files run 5-50 MB; pushing them through Render's
// request body cap is wasteful. R2 presigned URLs are the same chain
// daily-log photos and document uploads use.

const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/webm",
  "audio/ogg",
]);

const BodySchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(1).max(100),
  // Soft client-reported size (browser File.size). Used only for an
  // early reject — the in-task hard cap is the real backstop.
  sizeBytes: z.number().int().positive().max(500 * 1024 * 1024),
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
  const { filename, contentType, sizeBytes } = parsed.data;

  if (!ALLOWED_MIME_TYPES.has(contentType.toLowerCase())) {
    return NextResponse.json(
      {
        error: "unsupported_media_type",
        message: `Content type ${contentType} not accepted. Use MP3, WAV, M4A, WebM, or OGG.`,
      },
      { status: 415 },
    );
  }

  try {
    const [head] = await dbAdmin
      .select({ id: meetings.id, projectId: meetings.projectId })
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(session, head.projectId);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can transcribe meeting audio",
        "forbidden",
      );
    }

    const key = buildStorageKey({
      orgId: ctx.organization.id,
      projectId: head.projectId,
      documentType: `meeting-audio/${id}`,
      filename,
    });

    const uploadUrl = await presignUploadUrl({
      key,
      contentType,
      expiresInSeconds: 60 * 10, // 10 minutes — covers slow uploads
    });

    return NextResponse.json({
      key,
      uploadUrl,
      sizeBytes,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
