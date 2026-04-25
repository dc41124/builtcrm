import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  meetingActionItems,
  meetingAgendaItems,
  meetingAttendees,
  meetings,
  projects,
} from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { padMeetingNumber } from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";
import { emitMeetingInvite } from "@/lib/meetings/notify";

// POST /api/meetings — contractor creates a meeting. Does two things in
// addition to the INSERT:
//
//   1. Atomic per-project sequence: `UPDATE projects SET meeting_counter
//      = meeting_counter + 1 RETURNING meeting_counter` inside the same
//      transaction. Avoids the SELECT MAX+1 race two concurrent creates
//      would lose.
//
//   2. Carry-forward, scoped by meeting TYPE: when the prior most-recent
//      completed meeting of the same type exists, clone its OPEN action
//      items AND its un-carried agenda items into the new meeting,
//      stamping carriedFromMeetingId. Skipped entirely for `internal`
//      (catch-all meeting type — no carry semantics).
//
// Initial attendee list (optional, accepts either internal userIds or
// external {email, displayName, orgId, roleLabel} rows) is inserted
// alongside the meeting. Invited users get a notification via
// emitMeetingInvite. The creator is auto-added as chair.

const AttendeeInputSchema = z.union([
  z.object({
    userId: z.string().uuid(),
    orgId: z.string().uuid().nullable().optional(),
    roleLabel: z.string().max(120).nullable().optional(),
    scope: z.enum(["internal", "sub", "external"]),
  }),
  z.object({
    email: z.string().email().max(255),
    displayName: z.string().max(160),
    orgId: z.string().uuid().nullable().optional(),
    roleLabel: z.string().max(120).nullable().optional(),
    scope: z.enum(["internal", "sub", "external"]),
  }),
]);

const BodySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  type: z.enum([
    "oac",
    "preconstruction",
    "coordination",
    "progress",
    "safety",
    "closeout",
    "internal",
  ]),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(600).default(60),
  attendees: z.array(AttendeeInputSchema).max(100).default([]),
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
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create meetings",
        "forbidden",
      );
    }

    const scheduledAt = new Date(input.scheduledAt);

    const result = await db.transaction(async (tx) => {
      // Atomic sequence bump on the project row.
      const [bumped] = await tx
        .update(projects)
        .set({
          meetingCounter: sql`${projects.meetingCounter} + 1`,
        })
        .where(eq(projects.id, input.projectId))
        .returning({ n: projects.meetingCounter });
      const sequentialNumber = bumped.n;

      const [meetingRow] = await tx
        .insert(meetings)
        .values({
          projectId: input.projectId,
          sequentialNumber,
          title: input.title,
          type: input.type,
          scheduledAt,
          durationMinutes: input.durationMinutes,
          status: "scheduled",
          chairUserId: ctx.user.id,
          createdByUserId: ctx.user.id,
        })
        .returning();

      // Insert chair as the first attendee (internal, accepted, isChair).
      await tx.insert(meetingAttendees).values({
        meetingId: meetingRow.id,
        userId: ctx.user.id,
        orgId: ctx.organization.id,
        scope: "internal",
        attendedStatus: "accepted",
        isChair: 1,
        respondedAt: new Date(),
      });

      // Rest of the attendees. We tag the chair slot so we don't
      // duplicate if the caller also passes their own user id in.
      const invitedUserIds: string[] = [];
      for (const a of input.attendees) {
        if ("userId" in a) {
          if (a.userId === ctx.user.id) continue;
          await tx.insert(meetingAttendees).values({
            meetingId: meetingRow.id,
            userId: a.userId,
            orgId: a.orgId ?? null,
            roleLabel: a.roleLabel ?? null,
            scope: a.scope,
            attendedStatus: "invited",
            isChair: 0,
          });
          invitedUserIds.push(a.userId);
        } else {
          await tx.insert(meetingAttendees).values({
            meetingId: meetingRow.id,
            email: a.email,
            displayName: a.displayName,
            orgId: a.orgId ?? null,
            roleLabel: a.roleLabel ?? null,
            scope: a.scope,
            attendedStatus: "invited",
            isChair: 0,
          });
        }
      }

      // Carry-forward: scope to the SAME type + status=completed, take
      // the most recent, clone open actions + un-carried agenda. Skip
      // internal meetings entirely.
      let carriedAgendaCount = 0;
      let carriedActionCount = 0;
      let carryFromLabel: string | null = null;

      if (input.type !== "internal") {
        const [source] = await tx
          .select({
            id: meetings.id,
            n: meetings.sequentialNumber,
          })
          .from(meetings)
          .where(
            and(
              eq(meetings.projectId, input.projectId),
              eq(meetings.type, input.type),
              eq(meetings.status, "completed"),
            ),
          )
          .orderBy(desc(meetings.completedAt))
          .limit(1);

        if (source) {
          carryFromLabel = padMeetingNumber(source.n);

          // Clone agenda items that weren't themselves carry-overs —
          // prevents chains from accumulating stale items forever.
          const sourceAgenda = await tx
            .select({
              title: meetingAgendaItems.title,
              description: meetingAgendaItems.description,
              assignedUserId: meetingAgendaItems.assignedUserId,
              estimatedMinutes: meetingAgendaItems.estimatedMinutes,
            })
            .from(meetingAgendaItems)
            .where(
              and(
                eq(meetingAgendaItems.meetingId, source.id),
                isNull(meetingAgendaItems.carriedFromMeetingId),
              ),
            )
            .orderBy(asc(meetingAgendaItems.orderIndex));

          if (sourceAgenda.length > 0) {
            const clones = sourceAgenda.map((a, idx) => ({
              meetingId: meetingRow.id,
              orderIndex: idx + 1,
              title: a.title,
              description: a.description,
              assignedUserId: a.assignedUserId,
              estimatedMinutes: a.estimatedMinutes,
              carriedFromMeetingId: source.id,
            }));
            await tx.insert(meetingAgendaItems).values(clones);
            carriedAgendaCount = clones.length;
          }

          // Clone only OPEN action items (in_progress + open). `done`
          // actions stay behind on their source meeting.
          const sourceActions = await tx
            .select({
              description: meetingActionItems.description,
              assignedUserId: meetingActionItems.assignedUserId,
              assignedOrgId: meetingActionItems.assignedOrgId,
              dueDate: meetingActionItems.dueDate,
              status: meetingActionItems.status,
            })
            .from(meetingActionItems)
            .where(
              and(
                eq(meetingActionItems.meetingId, source.id),
                sql`${meetingActionItems.status} <> 'done'`,
              ),
            );

          if (sourceActions.length > 0) {
            const actionClones = sourceActions.map((a) => ({
              meetingId: meetingRow.id,
              description: a.description,
              assignedUserId: a.assignedUserId,
              assignedOrgId: a.assignedOrgId,
              dueDate: a.dueDate,
              status: a.status,
              carriedFromMeetingId: source.id,
              createdByUserId: ctx.user.id,
            }));
            await tx.insert(meetingActionItems).values(actionClones);
            carriedActionCount = actionClones.length;
          }
        }
      }

      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "meeting",
          resourceId: meetingRow.id,
          details: {
            nextState: {
              sequentialNumber,
              type: input.type,
              scheduledAt: scheduledAt.toISOString(),
              attendeeCount: 1 + input.attendees.length,
              carriedAgendaCount,
              carriedActionCount,
              carryFromLabel,
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `${padMeetingNumber(sequentialNumber)}: ${input.title}`,
          body: carryFromLabel
            ? `Scheduled — carried forward ${carriedAgendaCount + carriedActionCount} item${carriedAgendaCount + carriedActionCount === 1 ? "" : "s"} from ${carryFromLabel}.`
            : "Meeting scheduled.",
          relatedObjectType: "meeting",
          relatedObjectId: meetingRow.id,
          visibilityScope: "internal_only",
        },
        tx,
      );

      await emitMeetingInvite(tx, {
        actorUserId: ctx.user.id,
        projectId: input.projectId,
        meetingId: meetingRow.id,
        meetingNumberLabel: padMeetingNumber(sequentialNumber),
        meetingTitle: input.title,
        scheduledAtLabel: scheduledAt.toUTCString(),
        inviteeUserIds: invitedUserIds,
      });

      return {
        meeting: meetingRow,
        carriedAgendaCount,
        carriedActionCount,
        carryFromLabel,
      };
    });

    return NextResponse.json({
      id: result.meeting.id,
      sequentialNumber: result.meeting.sequentialNumber,
      numberLabel: padMeetingNumber(result.meeting.sequentialNumber),
      status: result.meeting.status,
      carriedAgendaCount: result.carriedAgendaCount,
      carriedActionCount: result.carriedActionCount,
      carryFromLabel: result.carryFromLabel,
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
