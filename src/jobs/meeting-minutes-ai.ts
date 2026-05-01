import { logger, task } from "@trigger.dev/sdk/v3";
import { eq, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  aiUsage,
  meetingActionItems,
  meetingAttendees,
  meetingMinutes,
  meetings,
  organizations,
  users,
} from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { extractMinutesAndActionItems, type Attendee } from "@/lib/ai/extractMinutes";
import {
  estimateClaudeCostCents,
  estimateWhisperCostCents,
} from "@/lib/ai/pricing";
import { transcribeAudio } from "@/lib/ai/transcribe";
import { deleteObject, getObjectBytes } from "@/lib/storage";

// Step 56 (Phase 7.1) — Meeting Minutes AI background job.
//
// Pipeline: pull audio bytes from R2 → Whisper transcribes → Claude
// extracts a minutes paragraph + structured action items → write
// minutes + action items + ai_usage rows → discard audio (unless the
// user opted in to keep it).
//
// Why a Trigger.dev task and not an inline server action: Whisper on
// a 30-minute meeting takes 30-60s, which exceeds Render free-tier
// HTTP request budget. The schema comment on meeting_minutes already
// committed to this design.
//
// Idempotency: the API route inserts an `ai_usage` row tagged
// `whisper_transcribe` BEFORE triggering, with a deterministic
// subjectId. The task does NOT attempt re-entrancy guards beyond
// Trigger.dev's own dedupe — a second .trigger() with the same
// idempotency key won't fire twice. UI prevents double-submit by
// disabling the button while a run is in-flight.

export type MeetingMinutesAiPayload = {
  meetingId: string;
  audioR2Key: string;
  audioFilename: string;
  audioMimeType: string;
  // True when the user explicitly opts in to keep the audio in R2
  // post-transcription. Default false — discard.
  keepAudio: boolean;
  triggeredByUserId: string;
};

export const meetingMinutesAiTask = task({
  id: "meeting-minutes-ai",
  maxDuration: 600, // 10 minutes — comfortable headroom for a 1-hour audio
  run: async (payload: MeetingMinutesAiPayload) => {
    const startedAt = Date.now();
    logger.info("meeting-minutes-ai start", { meetingId: payload.meetingId });

    // ── Look up meeting + org + attendees ────────────────────────────
    const [head] = await dbAdmin
      .select({
        id: meetings.id,
        title: meetings.title,
        scheduledAt: meetings.scheduledAt,
        projectId: meetings.projectId,
      })
      .from(meetings)
      .where(eq(meetings.id, payload.meetingId))
      .limit(1);
    if (!head) {
      throw new Error(`meeting not found: ${payload.meetingId}`);
    }

    // Org for ai_usage attribution = the project's contractor org. Read
    // straight off projects since the task runs without RLS context.
    const [org] = await dbAdmin.execute<{ contractor_organization_id: string }>(
      sql`SELECT contractor_organization_id FROM projects WHERE id = ${head.projectId} LIMIT 1`,
    );
    const orgId = (org as unknown as { contractor_organization_id: string })
      .contractor_organization_id;
    if (!orgId) {
      throw new Error(`project ${head.projectId} has no contractor org`);
    }

    // Roster: attendees joined with users + organizations for display.
    // External (email-only) attendees are skipped — Whisper might
    // mention them but we have no userId to assign.
    const roster = await dbAdmin
      .select({
        userId: meetingAttendees.userId,
        displayName: users.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
        userEmail: users.email,
        roleLabel: meetingAttendees.roleLabel,
        orgName: organizations.name,
      })
      .from(meetingAttendees)
      .leftJoin(users, eq(meetingAttendees.userId, users.id))
      .leftJoin(organizations, eq(meetingAttendees.orgId, organizations.id))
      .where(eq(meetingAttendees.meetingId, payload.meetingId));

    const attendees: Attendee[] = roster
      .filter((r) => r.userId !== null)
      .map((r) => {
        const composed = [r.firstName, r.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        return {
          userId: r.userId!,
          name: r.displayName ?? composed ?? r.userEmail ?? "Unknown",
          roleLabel: r.roleLabel,
          orgName: r.orgName ?? "Unknown",
        };
      });

    // ── Fetch audio + transcribe ─────────────────────────────────────
    const audioBytes = await getObjectBytes(payload.audioR2Key);
    logger.info("audio fetched", {
      meetingId: payload.meetingId,
      bytes: audioBytes.byteLength,
    });

    let whisper;
    try {
      whisper = await transcribeAudio({
        audio: audioBytes,
        filename: payload.audioFilename,
        mimeType: payload.audioMimeType,
      });
    } catch (err) {
      await dbAdmin.insert(aiUsage).values({
        orgId,
        triggeredByUserId: payload.triggeredByUserId,
        provider: "openai",
        operation: "whisper_transcribe",
        subjectId: payload.meetingId,
        costEstimateCents: 0,
        errorMessage: (err as Error).message.slice(0, 500),
      });
      throw err;
    }

    await dbAdmin.insert(aiUsage).values({
      orgId,
      triggeredByUserId: payload.triggeredByUserId,
      provider: "openai",
      operation: "whisper_transcribe",
      subjectId: payload.meetingId,
      audioSeconds: Math.ceil(whisper.durationSeconds),
      costEstimateCents: estimateWhisperCostCents(whisper.durationSeconds),
    });
    logger.info("whisper done", {
      meetingId: payload.meetingId,
      durationSeconds: whisper.durationSeconds,
      transcriptChars: whisper.text.length,
    });

    // ── Claude extraction ────────────────────────────────────────────
    const meetingDate = head.scheduledAt.toISOString().slice(0, 10);
    let extracted;
    try {
      extracted = await extractMinutesAndActionItems({
        transcript: whisper.text,
        meetingTitle: head.title,
        meetingDate,
        attendees,
      });
    } catch (err) {
      await dbAdmin.insert(aiUsage).values({
        orgId,
        triggeredByUserId: payload.triggeredByUserId,
        provider: "anthropic",
        operation: "claude_extract",
        subjectId: payload.meetingId,
        costEstimateCents: 0,
        errorMessage: (err as Error).message.slice(0, 500),
      });
      throw err;
    }

    await dbAdmin.insert(aiUsage).values({
      orgId,
      triggeredByUserId: payload.triggeredByUserId,
      provider: "anthropic",
      operation: "claude_extract",
      subjectId: payload.meetingId,
      tokensUsed: extracted.inputTokens + extracted.outputTokens,
      costEstimateCents: estimateClaudeCostCents(
        extracted.inputTokens,
        extracted.outputTokens,
      ),
    });
    logger.info("claude done", {
      meetingId: payload.meetingId,
      actionItems: extracted.actionItems.length,
      inputTokens: extracted.inputTokens,
      outputTokens: extracted.outputTokens,
    });

    // ── Persist minutes + action items ───────────────────────────────
    // Background job → writes via dbAdmin (bypasses RLS). The audit
    // trail still records the triggering user via system audit event
    // metadata so the UI can attribute the draft.
    await dbAdmin.transaction(async (tx) => {
      // Upsert minutes.content. Don't clobber a finalized record —
      // the API route guards against this, but defense-in-depth here
      // avoids overwriting human work if something raced.
      const [existing] = await tx
        .select({
          id: meetingMinutes.id,
          finalizedAt: meetingMinutes.finalizedAt,
        })
        .from(meetingMinutes)
        .where(eq(meetingMinutes.meetingId, payload.meetingId))
        .limit(1);

      if (existing?.finalizedAt) {
        logger.warn("minutes already finalized; skipping AI overwrite", {
          meetingId: payload.meetingId,
        });
      } else if (existing) {
        await tx
          .update(meetingMinutes)
          .set({
            content: extracted.minutes,
            draftedByUserId: payload.triggeredByUserId,
          })
          .where(eq(meetingMinutes.id, existing.id));
      } else {
        await tx.insert(meetingMinutes).values({
          meetingId: payload.meetingId,
          content: extracted.minutes,
          draftedByUserId: payload.triggeredByUserId,
        });
      }

      // Insert action items. Idempotency: don't dedupe — re-running the
      // job is a deliberate "regenerate" action by the user, and they
      // can delete unwanted rows in the UI before finalizing.
      if (extracted.actionItems.length > 0) {
        await tx.insert(meetingActionItems).values(
          extracted.actionItems.map((item) => ({
            meetingId: payload.meetingId,
            description:
              item.confidence === "low"
                ? `[review] ${item.description}\n\nQuote: "${item.context}"`
                : `${item.description}\n\nQuote: "${item.context}"`,
            assignedUserId: item.assignedUserId,
            dueDate: item.dueDate,
            status: "open" as const,
            createdByUserId: payload.triggeredByUserId,
          })),
        );
      }
    });

    // ── Audit + cleanup ──────────────────────────────────────────────
    await writeSystemAuditEvent({
      action: "meeting.minutes.ai_generated",
      resourceType: "meeting_minutes",
      resourceId: payload.meetingId,
      projectId: head.projectId,
      organizationId: orgId,
      details: {
        metadata: {
          triggeredByUserId: payload.triggeredByUserId,
          transcriptChars: whisper.text.length,
          actionItemsCreated: extracted.actionItems.length,
          audioSeconds: Math.ceil(whisper.durationSeconds),
          claudeTokens: extracted.inputTokens + extracted.outputTokens,
          elapsedMs: Date.now() - startedAt,
        },
      },
    });

    if (!payload.keepAudio) {
      await deleteObject(payload.audioR2Key);
      logger.info("audio discarded post-extraction", {
        key: payload.audioR2Key,
      });
    }

    return {
      ok: true,
      actionItems: extracted.actionItems.length,
      transcriptChars: whisper.text.length,
    };
  },
});

