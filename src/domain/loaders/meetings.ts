import { and, asc, desc, eq, inArray, isNull, isNotNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  activityFeedItems,
  meetingActionItems,
  meetingAgendaItems,
  meetingAttendees,
  meetingMinutes,
  meetings,
  organizations,
  projects,
  users,
} from "@/db/schema";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// -----------------------------------------------------------------------------
// Shared types
// -----------------------------------------------------------------------------

export type MeetingType =
  | "oac"
  | "preconstruction"
  | "coordination"
  | "progress"
  | "safety"
  | "closeout"
  | "internal";

export type MeetingStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type AttendedStatus =
  | "invited"
  | "accepted"
  | "tentative"
  | "declined"
  | "attended"
  | "absent";

export type AttendeeScope = "internal" | "sub" | "external";

export type ActionItemStatus = "open" | "in_progress" | "done";

export type MeetingListRow = {
  id: string;
  sequentialNumber: number;
  numberLabel: string;
  title: string;
  type: MeetingType;
  scheduledAt: string;
  durationMinutes: number;
  status: MeetingStatus;
  chairUserId: string;
  chairName: string | null;
  chairOrgName: string | null;
  cancelledReason: string | null;
  completedAt: string | null;
  attendeeCount: number;
  agendaCount: number;
  actionOpenCount: number;
  carriedForwardCount: number;
};

export type AgendaItem = {
  id: string;
  orderIndex: number;
  title: string;
  description: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedUserOrgName: string | null;
  estimatedMinutes: number;
  carriedFromMeetingId: string | null;
  carriedFromLabel: string | null;
};

export type Attendee = {
  id: string;
  userId: string | null;
  orgId: string | null;
  orgName: string | null;
  email: string | null;
  displayName: string;
  roleLabel: string | null;
  scope: AttendeeScope;
  attendedStatus: AttendedStatus;
  isChair: boolean;
  declineReason: string | null;
  respondedAt: string | null;
};

export type ActionItem = {
  id: string;
  description: string;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedOrgId: string | null;
  assignedOrgName: string | null;
  dueDate: string | null;
  status: ActionItemStatus;
  originAgendaItemId: string | null;
  carriedFromMeetingId: string | null;
  carriedFromLabel: string | null;
  createdAt: string;
};

export type MeetingMinutesRow = {
  content: string;
  draftedByUserId: string | null;
  draftedByName: string | null;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
  updatedAt: string;
};

export type MeetingDetail = MeetingListRow & {
  project: { id: string; name: string };
  agenda: AgendaItem[];
  attendees: Attendee[];
  actionItems: ActionItem[];
  minutes: MeetingMinutesRow | null;
  canEdit: boolean;
  canFinalize: boolean;
  isAttendee: boolean;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function padMeetingNumber(n: number): string {
  return `MTG-${String(n).padStart(4, "0")}`;
}

function fmtScheduled(d: Date): string {
  return d.toISOString();
}

// -----------------------------------------------------------------------------
// Visibility
// -----------------------------------------------------------------------------

// A subcontractor sees a meeting on a project when any attendee row on
// that meeting references either their userId or their orgId. Org-level
// matching is the common case — someone invited "Steel Frame Co." but
// it was materialized as attendee rows for specific people at that org.
// See meeting_attendees schema comment: orgId is informational only,
// but for visibility it's the pragmatic key.
async function meetingsVisibleToSub(
  projectId: string,
  userId: string,
  orgId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({ meetingId: meetingAttendees.meetingId })
    .from(meetingAttendees)
    .innerJoin(meetings, eq(meetings.id, meetingAttendees.meetingId))
    .where(
      and(
        eq(meetings.projectId, projectId),
        or(
          eq(meetingAttendees.userId, userId),
          eq(meetingAttendees.orgId, orgId),
        ),
      ),
    );
  const ids = new Set<string>();
  for (const r of rows) ids.add(r.meetingId);
  return ids;
}

// -----------------------------------------------------------------------------
// getMeetings — list view
// -----------------------------------------------------------------------------

export type GetMeetingsInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

export async function getMeetings(input: GetMeetingsInput): Promise<{
  rows: MeetingListRow[];
  viewerRole: "contractor" | "subcontractor";
}> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  const isContractor =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const isSub = ctx.role === "subcontractor_user";
  if (!isContractor && !isSub) {
    throw new AuthorizationError(
      "Meetings are contractor + subcontractor only in Phase 5",
      "forbidden",
    );
  }

  let visibleIds: Set<string> | null = null;
  if (isSub) {
    visibleIds = await meetingsVisibleToSub(
      input.projectId,
      ctx.user.id,
      ctx.organization.id,
    );
  }

  // Join chair user + their organization via role_assignments would be
  // nice but the org is informational display only; fall back to the
  // user's displayName and synthesize "Hammerline Build" from the
  // project's contractor org since the chair is always contractor-side.
  const [contractorOrg] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, ctx.project.contractorOrganizationId))
    .limit(1);

  const baseRows = await db
    .select({
      id: meetings.id,
      sequentialNumber: meetings.sequentialNumber,
      title: meetings.title,
      type: meetings.type,
      scheduledAt: meetings.scheduledAt,
      durationMinutes: meetings.durationMinutes,
      status: meetings.status,
      chairUserId: meetings.chairUserId,
      chairName: users.displayName,
      cancelledReason: meetings.cancelledReason,
      completedAt: meetings.completedAt,
    })
    .from(meetings)
    .leftJoin(users, eq(users.id, meetings.chairUserId))
    .where(eq(meetings.projectId, input.projectId))
    .orderBy(desc(meetings.scheduledAt));

  const scoped = isSub && visibleIds
    ? baseRows.filter((r) => visibleIds!.has(r.id))
    : baseRows;
  if (scoped.length === 0) {
    return { rows: [], viewerRole: isSub ? "subcontractor" : "contractor" };
  }

  const meetingIds = scoped.map((r) => r.id);

  // Per-meeting aggregates: attendee count, agenda count, open-action
  // count, carried-forward-agenda count.
  const [attendeeCounts, agendaCounts, actionOpenCounts, carryAgendaCounts] =
    await Promise.all([
      db
        .select({
          meetingId: meetingAttendees.meetingId,
          c: sql<number>`count(*)::int`,
        })
        .from(meetingAttendees)
        .where(inArray(meetingAttendees.meetingId, meetingIds))
        .groupBy(meetingAttendees.meetingId),
      db
        .select({
          meetingId: meetingAgendaItems.meetingId,
          c: sql<number>`count(*)::int`,
        })
        .from(meetingAgendaItems)
        .where(inArray(meetingAgendaItems.meetingId, meetingIds))
        .groupBy(meetingAgendaItems.meetingId),
      db
        .select({
          meetingId: meetingActionItems.meetingId,
          c: sql<number>`count(*)::int`,
        })
        .from(meetingActionItems)
        .where(
          and(
            inArray(meetingActionItems.meetingId, meetingIds),
            sql`${meetingActionItems.status} <> 'done'`,
          ),
        )
        .groupBy(meetingActionItems.meetingId),
      db
        .select({
          meetingId: meetingAgendaItems.meetingId,
          c: sql<number>`count(*)::int`,
        })
        .from(meetingAgendaItems)
        .where(
          and(
            inArray(meetingAgendaItems.meetingId, meetingIds),
            sql`${meetingAgendaItems.carriedFromMeetingId} IS NOT NULL`,
          ),
        )
        .groupBy(meetingAgendaItems.meetingId),
    ]);

  const bucket = (rows: { meetingId: string; c: number }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.meetingId, r.c);
    return m;
  };
  const attBy = bucket(attendeeCounts);
  const agBy = bucket(agendaCounts);
  const actOpenBy = bucket(actionOpenCounts);
  const carryBy = bucket(carryAgendaCounts);

  return {
    viewerRole: isSub ? "subcontractor" : "contractor",
    rows: scoped.map((r) => ({
      id: r.id,
      sequentialNumber: r.sequentialNumber,
      numberLabel: padMeetingNumber(r.sequentialNumber),
      title: r.title,
      type: r.type as MeetingType,
      scheduledAt: fmtScheduled(r.scheduledAt),
      durationMinutes: r.durationMinutes,
      status: r.status as MeetingStatus,
      chairUserId: r.chairUserId,
      chairName: r.chairName,
      chairOrgName: contractorOrg?.name ?? null,
      cancelledReason: r.cancelledReason,
      completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      attendeeCount: attBy.get(r.id) ?? 0,
      agendaCount: agBy.get(r.id) ?? 0,
      actionOpenCount: actOpenBy.get(r.id) ?? 0,
      carriedForwardCount: carryBy.get(r.id) ?? 0,
    })),
  };
}

// -----------------------------------------------------------------------------
// getMeeting — detail view
// -----------------------------------------------------------------------------

export type GetMeetingInput = {
  session: SessionLike | null | undefined;
  meetingId: string;
};

export async function getMeeting(input: GetMeetingInput): Promise<MeetingDetail> {
  const [head] = await db
    .select({ id: meetings.id, projectId: meetings.projectId })
    .from(meetings)
    .where(eq(meetings.id, input.meetingId))
    .limit(1);
  if (!head) {
    throw new AuthorizationError("Meeting not found", "not_found");
  }

  const ctx = await getEffectiveContext(input.session, head.projectId);
  const isContractor =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const isSub = ctx.role === "subcontractor_user";
  if (!isContractor && !isSub) {
    throw new AuthorizationError(
      "Meetings are contractor + subcontractor only in Phase 5",
      "forbidden",
    );
  }

  if (isSub) {
    const visible = await meetingsVisibleToSub(
      head.projectId,
      ctx.user.id,
      ctx.organization.id,
    );
    if (!visible.has(head.id)) {
      throw new AuthorizationError(
        "Your organization is not invited to this meeting",
        "forbidden",
      );
    }
  }

  const { rows } = await getMeetings({
    session: input.session,
    projectId: head.projectId,
  });
  const listRow = rows.find((r) => r.id === head.id);
  if (!listRow) {
    throw new AuthorizationError("Meeting not visible", "forbidden");
  }

  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.id, head.projectId))
    .limit(1);

  // Agenda items
  const agendaRows = await db
    .select({
      id: meetingAgendaItems.id,
      orderIndex: meetingAgendaItems.orderIndex,
      title: meetingAgendaItems.title,
      description: meetingAgendaItems.description,
      assignedUserId: meetingAgendaItems.assignedUserId,
      assignedUserName: users.displayName,
      estimatedMinutes: meetingAgendaItems.estimatedMinutes,
      carriedFromMeetingId: meetingAgendaItems.carriedFromMeetingId,
    })
    .from(meetingAgendaItems)
    .leftJoin(users, eq(users.id, meetingAgendaItems.assignedUserId))
    .where(eq(meetingAgendaItems.meetingId, head.id))
    .orderBy(asc(meetingAgendaItems.orderIndex));

  // Resolve carriedFrom labels (MTG-XXXX) in one query
  const carriedFromIds = Array.from(
    new Set(
      agendaRows
        .map((r) => r.carriedFromMeetingId)
        .filter((v): v is string => !!v),
    ),
  );
  const carriedLabels = new Map<string, string>();
  if (carriedFromIds.length) {
    const labelRows = await db
      .select({ id: meetings.id, n: meetings.sequentialNumber })
      .from(meetings)
      .where(inArray(meetings.id, carriedFromIds));
    for (const l of labelRows)
      carriedLabels.set(l.id, padMeetingNumber(l.n));
  }

  const agenda: AgendaItem[] = agendaRows.map((r) => ({
    id: r.id,
    orderIndex: r.orderIndex,
    title: r.title,
    description: r.description,
    assignedUserId: r.assignedUserId,
    assignedUserName: r.assignedUserName,
    assignedUserOrgName: null,
    estimatedMinutes: r.estimatedMinutes,
    carriedFromMeetingId: r.carriedFromMeetingId,
    carriedFromLabel: r.carriedFromMeetingId
      ? carriedLabels.get(r.carriedFromMeetingId) ?? null
      : null,
  }));

  // Attendees
  const attendeeRows = await db
    .select({
      id: meetingAttendees.id,
      userId: meetingAttendees.userId,
      userName: users.displayName,
      userEmail: users.email,
      orgId: meetingAttendees.orgId,
      orgName: organizations.name,
      email: meetingAttendees.email,
      displayName: meetingAttendees.displayName,
      roleLabel: meetingAttendees.roleLabel,
      scope: meetingAttendees.scope,
      attendedStatus: meetingAttendees.attendedStatus,
      isChair: meetingAttendees.isChair,
      declineReason: meetingAttendees.declineReason,
      respondedAt: meetingAttendees.respondedAt,
    })
    .from(meetingAttendees)
    .leftJoin(users, eq(users.id, meetingAttendees.userId))
    .leftJoin(organizations, eq(organizations.id, meetingAttendees.orgId))
    .where(eq(meetingAttendees.meetingId, head.id))
    .orderBy(desc(meetingAttendees.isChair), asc(meetingAttendees.createdAt));

  const attendees: Attendee[] = attendeeRows.map((r) => ({
    id: r.id,
    userId: r.userId,
    orgId: r.orgId,
    orgName: r.orgName,
    email: r.userEmail ?? r.email,
    displayName: r.displayName ?? r.userName ?? r.email ?? "Invitee",
    roleLabel: r.roleLabel,
    scope: r.scope as AttendeeScope,
    attendedStatus: r.attendedStatus as AttendedStatus,
    isChair: r.isChair > 0,
    declineReason: r.declineReason,
    respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
  }));

  const isAttendee = attendees.some(
    (a) => a.userId === ctx.user.id || a.orgId === ctx.organization.id,
  );

  // Action items
  const actionRows = await db
    .select({
      id: meetingActionItems.id,
      description: meetingActionItems.description,
      assignedUserId: meetingActionItems.assignedUserId,
      assignedUserName: users.displayName,
      assignedOrgId: meetingActionItems.assignedOrgId,
      assignedOrgName: organizations.name,
      dueDate: meetingActionItems.dueDate,
      status: meetingActionItems.status,
      originAgendaItemId: meetingActionItems.originAgendaItemId,
      carriedFromMeetingId: meetingActionItems.carriedFromMeetingId,
      createdAt: meetingActionItems.createdAt,
    })
    .from(meetingActionItems)
    .leftJoin(users, eq(users.id, meetingActionItems.assignedUserId))
    .leftJoin(
      organizations,
      eq(organizations.id, meetingActionItems.assignedOrgId),
    )
    .where(eq(meetingActionItems.meetingId, head.id))
    .orderBy(asc(meetingActionItems.createdAt));

  const actionCarriedIds = Array.from(
    new Set(
      actionRows
        .map((r) => r.carriedFromMeetingId)
        .filter((v): v is string => !!v),
    ),
  );
  if (actionCarriedIds.length) {
    const missing = actionCarriedIds.filter((id) => !carriedLabels.has(id));
    if (missing.length) {
      const more = await db
        .select({ id: meetings.id, n: meetings.sequentialNumber })
        .from(meetings)
        .where(inArray(meetings.id, missing));
      for (const l of more) carriedLabels.set(l.id, padMeetingNumber(l.n));
    }
  }

  const actionItems: ActionItem[] = actionRows.map((r) => ({
    id: r.id,
    description: r.description,
    assignedUserId: r.assignedUserId,
    assignedUserName: r.assignedUserName,
    assignedOrgId: r.assignedOrgId,
    assignedOrgName: r.assignedOrgName,
    dueDate: r.dueDate,
    status: r.status as ActionItemStatus,
    originAgendaItemId: r.originAgendaItemId,
    carriedFromMeetingId: r.carriedFromMeetingId,
    carriedFromLabel: r.carriedFromMeetingId
      ? carriedLabels.get(r.carriedFromMeetingId) ?? null
      : null,
    createdAt: r.createdAt.toISOString(),
  }));

  // Minutes (lazy — may not exist)
  const [minRow] = await db
    .select({
      content: meetingMinutes.content,
      draftedByUserId: meetingMinutes.draftedByUserId,
      draftedByName: users.displayName,
      finalizedAt: meetingMinutes.finalizedAt,
      finalizedByUserId: meetingMinutes.finalizedByUserId,
      updatedAt: meetingMinutes.updatedAt,
    })
    .from(meetingMinutes)
    .leftJoin(users, eq(users.id, meetingMinutes.draftedByUserId))
    .where(eq(meetingMinutes.meetingId, head.id))
    .limit(1);

  const minutes: MeetingMinutesRow | null = minRow
    ? {
        content: minRow.content,
        draftedByUserId: minRow.draftedByUserId,
        draftedByName: minRow.draftedByName,
        finalizedAt: minRow.finalizedAt
          ? minRow.finalizedAt.toISOString()
          : null,
        finalizedByUserId: minRow.finalizedByUserId,
        updatedAt: minRow.updatedAt.toISOString(),
      }
    : null;

  // For subs, minutes are only visible once published (finalizedAt set).
  const visibleMinutes =
    isSub && minutes && !minutes.finalizedAt ? null : minutes;

  const canEdit =
    isContractor &&
    listRow.status !== "cancelled" &&
    listRow.status !== "completed";
  const canFinalize =
    isContractor &&
    listRow.status === "completed" &&
    !(minutes && minutes.finalizedAt);

  return {
    ...listRow,
    project: project ?? { id: head.projectId, name: "" },
    agenda,
    attendees,
    actionItems,
    minutes: visibleMinutes,
    canEdit,
    canFinalize,
    isAttendee,
  };
}

// -----------------------------------------------------------------------------
// getMyMeetingActionItems — sub's "My Actions" rail
//
// Reads from meeting_action_items directly (no tasks table). Matches
// the project scope + either the current user as assignee or their org
// as assignee. Used by the subcontractor list page + sub detail "my
// actions" tab.
// -----------------------------------------------------------------------------

export type MyActionItemRow = {
  id: string;
  meetingId: string;
  meetingNumberLabel: string;
  meetingTitle: string;
  description: string;
  dueDate: string | null;
  dueStatus: "overdue" | "soon" | "normal" | null;
  status: ActionItemStatus;
};

export async function getMyMeetingActionItems(input: {
  session: SessionLike | null | undefined;
  projectId: string;
}): Promise<MyActionItemRow[]> {
  const ctx = await getEffectiveContext(input.session, input.projectId);

  const rows = await db
    .select({
      id: meetingActionItems.id,
      meetingId: meetingActionItems.meetingId,
      meetingTitle: meetings.title,
      meetingNumber: meetings.sequentialNumber,
      description: meetingActionItems.description,
      dueDate: meetingActionItems.dueDate,
      status: meetingActionItems.status,
    })
    .from(meetingActionItems)
    .innerJoin(meetings, eq(meetings.id, meetingActionItems.meetingId))
    .where(
      and(
        eq(meetings.projectId, input.projectId),
        or(
          eq(meetingActionItems.assignedUserId, ctx.user.id),
          eq(meetingActionItems.assignedOrgId, ctx.organization.id),
        ),
      ),
    )
    .orderBy(asc(meetingActionItems.dueDate));

  const today = new Date();
  const soonThreshold = 3; // days
  return rows.map((r) => {
    let dueStatus: MyActionItemRow["dueStatus"] = null;
    if (r.dueDate) {
      const d = new Date(r.dueDate);
      const diffDays = Math.floor(
        (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays < 0 && r.status !== "done") dueStatus = "overdue";
      else if (diffDays <= soonThreshold) dueStatus = "soon";
      else dueStatus = "normal";
    }
    return {
      id: r.id,
      meetingId: r.meetingId,
      meetingNumberLabel: padMeetingNumber(r.meetingNumber),
      meetingTitle: r.meetingTitle,
      description: r.description,
      dueDate: r.dueDate,
      dueStatus,
      status: r.status as ActionItemStatus,
    };
  });
}

// -----------------------------------------------------------------------------
// getCarryForwardPreview — what the create-meeting modal shows before commit.
//
// Given a project + chosen meeting type, returns the prior same-type
// meeting that completed most recently, and counts of its open action
// items + un-covered agenda items that would be copied into the new
// meeting. `type === "internal"` always returns a zero-count preview
// — internal/one-off meetings don't carry forward.
// -----------------------------------------------------------------------------

export type CarryForwardPreview = {
  sourceMeetingId: string | null;
  sourceMeetingLabel: string | null;
  openActionItemCount: number;
  openAgendaItemCount: number;
};

export async function getCarryForwardPreview(input: {
  session: SessionLike | null | undefined;
  projectId: string;
  type: MeetingType;
}): Promise<CarryForwardPreview> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  const isContractor =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  if (!isContractor) {
    throw new AuthorizationError(
      "Only contractors can preview carry-forward",
      "forbidden",
    );
  }

  if (input.type === "internal") {
    return {
      sourceMeetingId: null,
      sourceMeetingLabel: null,
      openActionItemCount: 0,
      openAgendaItemCount: 0,
    };
  }

  const [source] = await db
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

  if (!source) {
    return {
      sourceMeetingId: null,
      sourceMeetingLabel: null,
      openActionItemCount: 0,
      openAgendaItemCount: 0,
    };
  }

  const [actionCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(meetingActionItems)
    .where(
      and(
        eq(meetingActionItems.meetingId, source.id),
        sql`${meetingActionItems.status} <> 'done'`,
      ),
    );

  // Un-covered agenda items: for portfolio scope we carry any agenda
  // item that was on the completed meeting and wasn't already
  // carried-forward (i.e. the item's own carriedFromMeetingId is null).
  // A future "mark agenda item as covered" flag would narrow this.
  const [agendaCount] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(meetingAgendaItems)
    .where(
      and(
        eq(meetingAgendaItems.meetingId, source.id),
        isNull(meetingAgendaItems.carriedFromMeetingId),
      ),
    );

  return {
    sourceMeetingId: source.id,
    sourceMeetingLabel: padMeetingNumber(source.n),
    openActionItemCount: actionCount?.c ?? 0,
    openAgendaItemCount: agendaCount?.c ?? 0,
  };
}

// -----------------------------------------------------------------------------
// getMeetingActivity — recent activity feed rows for the rail.
//
// Reads from activity_feed_items where relatedObjectType = 'meeting' and
// the project matches. The create/start/complete/finalize flows all
// write activity feed entries so the rail reflects every material
// state change. Limits to the most recent 10 rows.
// -----------------------------------------------------------------------------

export type MeetingActivityRow = {
  actorUserId: string | null;
  actorName: string | null;
  title: string;
  body: string | null;
  relatedMeetingId: string | null;
  createdAt: string;
};

export async function getMeetingActivity(input: {
  session: SessionLike | null | undefined;
  projectId: string;
  limit?: number;
}): Promise<MeetingActivityRow[]> {
  await getEffectiveContext(input.session, input.projectId);
  const rows = await db
    .select({
      actorUserId: activityFeedItems.actorUserId,
      actorName: users.displayName,
      title: activityFeedItems.title,
      body: activityFeedItems.body,
      relatedMeetingId: activityFeedItems.relatedObjectId,
      createdAt: activityFeedItems.createdAt,
    })
    .from(activityFeedItems)
    .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
    .where(
      and(
        eq(activityFeedItems.projectId, input.projectId),
        eq(activityFeedItems.relatedObjectType, "meeting"),
      ),
    )
    .orderBy(desc(activityFeedItems.createdAt))
    .limit(input.limit ?? 10);
  return rows.map((r) => ({
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    title: r.title,
    body: r.body,
    relatedMeetingId: r.relatedMeetingId,
    createdAt: r.createdAt.toISOString(),
  }));
}

// -----------------------------------------------------------------------------
// getRecentPublishedMinutes — sub-portal rail card listing the 3 most
// recent meetings with finalized minutes the sub can read. Ordered by
// finalizedAt desc. Respects sub visibility rules.
// -----------------------------------------------------------------------------

export type RecentPublishedMinutesRow = {
  meetingId: string;
  numberLabel: string;
  title: string;
  type: MeetingType;
  scheduledAt: string;
  finalizedAt: string;
};

export async function getRecentPublishedMinutes(input: {
  session: SessionLike | null | undefined;
  projectId: string;
  limit?: number;
}): Promise<RecentPublishedMinutesRow[]> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  const isSub = ctx.role === "subcontractor_user";

  let visibleIds: Set<string> | null = null;
  if (isSub) {
    visibleIds = await meetingsVisibleToSub(
      input.projectId,
      ctx.user.id,
      ctx.organization.id,
    );
    if (visibleIds.size === 0) return [];
  }

  const rows = await db
    .select({
      id: meetings.id,
      sequentialNumber: meetings.sequentialNumber,
      title: meetings.title,
      type: meetings.type,
      scheduledAt: meetings.scheduledAt,
      finalizedAt: meetingMinutes.finalizedAt,
    })
    .from(meetingMinutes)
    .innerJoin(meetings, eq(meetings.id, meetingMinutes.meetingId))
    .where(
      and(
        eq(meetings.projectId, input.projectId),
        isNotNull(meetingMinutes.finalizedAt),
      ),
    )
    .orderBy(desc(meetingMinutes.finalizedAt))
    .limit((input.limit ?? 3) * 4);

  const scoped =
    isSub && visibleIds
      ? rows.filter((r) => visibleIds!.has(r.id))
      : rows;

  return scoped.slice(0, input.limit ?? 3).map((r) => ({
    meetingId: r.id,
    numberLabel: padMeetingNumber(r.sequentialNumber),
    title: r.title,
    type: r.type as MeetingType,
    scheduledAt: r.scheduledAt.toISOString(),
    finalizedAt: r.finalizedAt!.toISOString(),
  }));
}
