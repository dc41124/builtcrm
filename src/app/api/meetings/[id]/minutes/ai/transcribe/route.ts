import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { meetingMinutes, meetings } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import {
  type MeetingMinutesAiPayload,
  type meetingMinutesAiTask,
} from "@/jobs/meeting-minutes-ai";
import { getObjectSize } from "@/lib/storage";

// POST /api/meetings/:id/minutes/ai/transcribe
//
// Kicks off the meeting-minutes-ai Trigger.dev task. Validates the
// uploaded audio key exists in R2, refuses if minutes are already
// finalized, fires the task, returns {runId} for client polling.

const BodySchema = z.object({
  audioR2Key: z.string().min(1).max(500),
  audioFilename: z.string().min(1).max(200),
  audioMimeType: z.string().min(1).max(100),
  keepAudio: z.boolean().default(false),
});

// Soft cap on file size for the API gate. Whisper accepts up to 25 MB
// per file but we allow larger uploads since the Whisper SDK handles
// chunking. The hard duration cap (2 hours) lives in the task itself
// since duration isn't known until Whisper returns.
const MAX_AUDIO_BYTES = 200 * 1024 * 1024; // 200 MB

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
  const { audioR2Key, audioFilename, audioMimeType, keepAudio } = parsed.data;

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

    // Refuse if minutes are already finalized — the AI overwrite path
    // is for drafts only.
    const [existingMinutes] = await dbAdmin
      .select({
        finalizedAt: meetingMinutes.finalizedAt,
      })
      .from(meetingMinutes)
      .where(eq(meetingMinutes.meetingId, id))
      .limit(1);
    if (existingMinutes?.finalizedAt) {
      return NextResponse.json(
        {
          error: "already_finalized",
          message:
            "Cannot regenerate AI minutes — these minutes have been finalized.",
        },
        { status: 409 },
      );
    }

    // Verify the audio actually landed in R2. Catches a stale key from
    // a failed PUT before we waste a Trigger.dev run on it.
    const size = await getObjectSize(audioR2Key);
    if (size === null) {
      return NextResponse.json(
        {
          error: "audio_missing",
          message: "Audio not found in storage. Re-upload and try again.",
        },
        { status: 400 },
      );
    }
    if (size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        {
          error: "audio_too_large",
          message: `Audio is ${Math.round(size / 1024 / 1024)}MB, max is ${MAX_AUDIO_BYTES / 1024 / 1024}MB.`,
        },
        { status: 413 },
      );
    }

    const payload: MeetingMinutesAiPayload = {
      meetingId: id,
      audioR2Key,
      audioFilename,
      audioMimeType,
      keepAudio,
      triggeredByUserId: ctx.user.id,
    };

    const handle = await tasks.trigger<typeof meetingMinutesAiTask>(
      "meeting-minutes-ai",
      payload,
    );

    await writeAuditEvent(ctx, {
      action: "meeting.minutes.ai_triggered",
      resourceType: "meeting_minutes",
      resourceId: id,
      details: {
        metadata: {
          runId: handle.id,
          audioBytes: size,
          keepAudio,
        },
      },
    });

    return NextResponse.json({
      runId: handle.id,
      publicAccessToken: handle.publicAccessToken,
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
