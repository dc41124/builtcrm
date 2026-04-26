import { and, eq } from "drizzle-orm";

import { type DB } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import {
  meetingAttendees,
  meetings,
  roleAssignments,
} from "@/db/schema";
import { emitNotifications } from "@/lib/notifications/emit";
import type { Recipient } from "@/lib/notifications/recipients";
import type { SettingsPortalType } from "@/lib/notification-catalog";

type DbOrTx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

// Resolve a single user's default portal by looking up their first
// role assignment. Meetings recipients often don't fit one of the
// project-wide role fan-outs in recipients.ts (an invite goes to
// specific people, not to "all subs"), so we bypass the recipient
// resolver via the emit helper's `recipientsOverride`.
//
// Cross-org by design: an invitee may belong to a different org than
// the caller (contractor invites a sub user; sub's role_assignment
// row lives in the sub's own org). Reads against RLS-enabled
// `role_assignments` route through `dbAdmin`.
async function portalForUserId(
  userId: string,
): Promise<SettingsPortalType | null> {
  const [row] = await dbAdmin
    .select({
      portalType: roleAssignments.portalType,
      clientSubtype: roleAssignments.clientSubtype,
    })
    .from(roleAssignments)
    .where(eq(roleAssignments.userId, userId))
    .limit(1);
  if (!row) return null;
  if (row.portalType === "contractor") return "contractor";
  if (row.portalType === "subcontractor") return "subcontractor";
  if (row.clientSubtype === "residential") return "residential";
  return "commercial";
}

async function recipientsFromUserIds(
  userIds: string[],
): Promise<Recipient[]> {
  const out: Recipient[] = [];
  const seen = new Set<string>();
  for (const uid of userIds) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    const portal = await portalForUserId(uid);
    if (portal) out.push({ userId: uid, portalType: portal });
  }
  return out;
}

// Fan-out: notify an invited user that they're on a meeting.
export async function emitMeetingInvite(
  dbc: DbOrTx,
  input: {
    actorUserId: string;
    projectId: string;
    meetingId: string;
    meetingNumberLabel: string;
    meetingTitle: string;
    scheduledAtLabel: string;
    inviteeUserIds: string[];
  },
): Promise<void> {
  const recipients = (
    await recipientsFromUserIds(input.inviteeUserIds)
  ).filter((r) => r.userId !== input.actorUserId);
  if (recipients.length === 0) return;
  await emitNotifications(
    {
      eventId: "meeting_invite",
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      relatedObjectType: "meeting",
      relatedObjectId: input.meetingId,
      recipientsOverride: recipients,
      vars: {
        number: input.meetingNumberLabel,
        title: input.meetingTitle,
        when: input.scheduledAtLabel,
      },
    },
    dbc,
  );
}

// Fan-out: notify the chair that an attendee's RSVP changed. Decline
// reason (if any) is embedded in the body so the chair sees the context
// without clicking through.
export async function emitMeetingRsvpChange(
  dbc: DbOrTx,
  input: {
    actorUserId: string;
    projectId: string;
    meetingId: string;
    meetingNumberLabel: string;
    meetingTitle: string;
    chairUserId: string;
    actorName: string;
    rsvp: "accepted" | "declined" | "tentative";
    declineReason?: string | null;
  },
): Promise<void> {
  if (input.chairUserId === input.actorUserId) return;
  const recipients = await recipientsFromUserIds([input.chairUserId]);
  if (recipients.length === 0) return;
  await emitNotifications(
    {
      eventId: "meeting_rsvp_change",
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      relatedObjectType: "meeting",
      relatedObjectId: input.meetingId,
      recipientsOverride: recipients,
      vars: {
        number: input.meetingNumberLabel,
        title: input.meetingTitle,
        actorName: input.actorName,
        rsvp: input.rsvp,
        declineReason: input.declineReason ?? "",
      },
    },
    dbc,
  );
}

// Fan-out: notify an assignee that they got a new action item.
export async function emitMeetingActionAssigned(
  dbc: DbOrTx,
  input: {
    actorUserId: string;
    projectId: string;
    meetingId: string;
    meetingNumberLabel: string;
    assignedUserId: string;
    description: string;
    dueDate: string | null;
  },
): Promise<void> {
  if (input.assignedUserId === input.actorUserId) return;
  const recipients = await recipientsFromUserIds([input.assignedUserId]);
  if (recipients.length === 0) return;
  await emitNotifications(
    {
      eventId: "meeting_action_assigned",
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      relatedObjectType: "meeting",
      relatedObjectId: input.meetingId,
      recipientsOverride: recipients,
      vars: {
        number: input.meetingNumberLabel,
        description: input.description,
        dueDate: input.dueDate ?? "",
      },
    },
    dbc,
  );
}

// Fan-out: notify the chair of the source meeting when an action item's
// status changes. Looks up the chair via the meetings table, so callers
// only pass the meetingId.
export async function emitMeetingActionStatusChange(
  dbc: DbOrTx,
  input: {
    actorUserId: string;
    projectId: string;
    meetingId: string;
    description: string;
    status: "open" | "in_progress" | "done";
    actorName: string;
  },
): Promise<void> {
  const [mtg] = await dbc
    .select({
      chairUserId: meetings.chairUserId,
    })
    .from(meetings)
    .where(eq(meetings.id, input.meetingId))
    .limit(1);
  if (!mtg || mtg.chairUserId === input.actorUserId) return;
  const recipients = await recipientsFromUserIds([mtg.chairUserId]);
  if (recipients.length === 0) return;
  await emitNotifications(
    {
      eventId: "meeting_action_status_change",
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      relatedObjectType: "meeting",
      relatedObjectId: input.meetingId,
      recipientsOverride: recipients,
      vars: {
        description: input.description,
        status: input.status,
        actorName: input.actorName,
      },
    },
    dbc,
  );
}

// Fan-out: notify every attendee (with a userId) that minutes were
// finalized. External email-only invitees are skipped — email delivery
// for those is handled by the generic "email all attendees" path when
// email delivery is wired up.
export async function emitMeetingMinutesPublished(
  dbc: DbOrTx,
  input: {
    actorUserId: string;
    projectId: string;
    meetingId: string;
    meetingNumberLabel: string;
    meetingTitle: string;
    actorName: string;
  },
): Promise<void> {
  const attRows = await dbc
    .select({ userId: meetingAttendees.userId })
    .from(meetingAttendees)
    .where(
      and(
        eq(meetingAttendees.meetingId, input.meetingId),
      ),
    );
  const userIds = attRows
    .map((r) => r.userId)
    .filter((v): v is string => !!v);
  if (userIds.length === 0) return;
  const recipients = (await recipientsFromUserIds(userIds)).filter(
    (r) => r.userId !== input.actorUserId,
  );
  if (recipients.length === 0) return;
  await emitNotifications(
    {
      eventId: "meeting_minutes_published",
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      relatedObjectType: "meeting",
      relatedObjectId: input.meetingId,
      recipientsOverride: recipients,
      vars: {
        number: input.meetingNumberLabel,
        title: input.meetingTitle,
        actorName: input.actorName,
      },
    },
    dbc,
  );
}
