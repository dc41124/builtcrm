import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import {
  meetingActionItems,
  meetingAgendaItems,
  meetingAttendees,
  meetingMinutes,
  meetings,
  notifications,
  projects,
} from "@/db/schema";

import { POST as createMeeting } from "@/app/api/meetings/route";
import { POST as transitionMeeting } from "@/app/api/meetings/[id]/transition/route";
import { POST as rsvp } from "@/app/api/meetings/[id]/rsvp/route";
import { PUT as saveMinutes } from "@/app/api/meetings/[id]/minutes/route";
import { POST as finalizeMinutes } from "@/app/api/meetings/[id]/minutes/finalize/route";
import { POST as createActionItem } from "@/app/api/meetings/[id]/action-items/route";
import { PATCH as patchActionItem } from "@/app/api/meetings/[id]/action-items/[itemId]/route";
import { POST as addAgenda } from "@/app/api/meetings/[id]/agenda/route";

import { IDS } from "./fixtures/seed";
import { jsonRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;
const PROJECT_B = IDS.projects.projectB;

// Shape-match helper for the promise params next 14 passes to route handlers.
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

async function cleanupMeetings(projectId: string): Promise<void> {
  // ON DELETE CASCADE from meetings → agenda/attendees/minutes/actions
  // removes everything. We also reset the counter so each test starts
  // at MTG-0001.
  await db.delete(meetings).where(eq(meetings.projectId, projectId));
  await db
    .update(projects)
    .set({ meetingCounter: 0 })
    .where(eq(projects.id, projectId));
}

beforeEach(async () => {
  await cleanupMeetings(PROJECT_A);
  await cleanupMeetings(PROJECT_B);
});

describe("POST /api/meetings — create", () => {
  it("contractor can create a meeting; sequential number starts at 1", async () => {
    ASSUME.contractor();
    const res = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC Weekly — Week 1",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
        durationMinutes: 60,
        attendees: [],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      sequentialNumber: number;
      numberLabel: string;
    };
    expect(body.sequentialNumber).toBe(1);
    expect(body.numberLabel).toBe("MTG-0001");
  });

  it("second meeting gets MTG-0002 (atomic counter, not MAX+1)", async () => {
    ASSUME.contractor();
    await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC Weekly — Week 1",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
      }),
    );
    const res = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC Weekly — Week 2",
        type: "oac",
        scheduledAt: new Date("2026-05-02T10:00:00Z").toISOString(),
      }),
    );
    const body = (await res.json()) as { numberLabel: string };
    expect(body.numberLabel).toBe("MTG-0002");
  });

  it("subcontractor cannot create meetings (403)", async () => {
    ASSUME.subcontractor();
    const res = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "Sneaky sub meeting",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("cross-project write blocked: contractor on Project B is fine, but sub on Project B is not", async () => {
    ASSUME.subcontractor();
    const res = await createMeeting(
      jsonRequest({
        projectId: PROJECT_B,
        title: "Wrong project",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
      }),
    );
    // The sub has no membership on B, so getEffectiveContext throws
    // forbidden before the role check.
    expect(res.status).toBe(403);
  });

  it("unauthenticated create is rejected", async () => {
    ASSUME.none();
    const res = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "Anon",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("invalid body yields 400 with issues", async () => {
    ASSUME.contractor();
    const res = await createMeeting(jsonRequest({ projectId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });
});

describe("carry-forward — scoped by type", () => {
  it("new same-type meeting inherits open action items + un-carried agenda", async () => {
    ASSUME.contractor();
    // First meeting with an agenda item + an open action
    const r1 = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC W1",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
      }),
    );
    const first = (await r1.json()) as { id: string };

    await addAgenda(
      jsonRequest({
        items: [
          {
            title: "Review structural drawings",
            estimatedMinutes: 10,
            description: "Clarify C-4 attachment",
          },
        ],
      }),
      params({ id: first.id }),
    );
    await createActionItem(
      jsonRequest({
        description: "Chase architect on curtain wall clarification",
        assignedUserId: IDS.users.contractorAdmin,
        dueDate: "2026-04-28",
      }),
      params({ id: first.id }),
    );

    // Complete the first meeting
    await transitionMeeting(
      jsonRequest({ action: "start" }),
      params({ id: first.id }),
    );
    await transitionMeeting(
      jsonRequest({ action: "complete" }),
      params({ id: first.id }),
    );

    // Create the second same-type meeting
    const r2 = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC W2",
        type: "oac",
        scheduledAt: new Date("2026-05-02T10:00:00Z").toISOString(),
      }),
    );
    const second = (await r2.json()) as {
      id: string;
      carriedAgendaCount: number;
      carriedActionCount: number;
      carryFromLabel: string | null;
    };
    expect(second.carriedAgendaCount).toBe(1);
    expect(second.carriedActionCount).toBe(1);
    expect(second.carryFromLabel).toBe("MTG-0001");

    const carriedAgenda = await db
      .select()
      .from(meetingAgendaItems)
      .where(eq(meetingAgendaItems.meetingId, second.id));
    expect(carriedAgenda).toHaveLength(1);
    expect(carriedAgenda[0].carriedFromMeetingId).toBe(first.id);

    const carriedActions = await db
      .select()
      .from(meetingActionItems)
      .where(eq(meetingActionItems.meetingId, second.id));
    expect(carriedActions).toHaveLength(1);
    expect(carriedActions[0].carriedFromMeetingId).toBe(first.id);
  });

  it("different-type meeting does NOT carry forward items from an OAC", async () => {
    ASSUME.contractor();
    const r1 = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC W1",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
      }),
    );
    const first = (await r1.json()) as { id: string };
    await createActionItem(
      jsonRequest({
        description: "OAC-only item",
      }),
      params({ id: first.id }),
    );
    await transitionMeeting(
      jsonRequest({ action: "start" }),
      params({ id: first.id }),
    );
    await transitionMeeting(
      jsonRequest({ action: "complete" }),
      params({ id: first.id }),
    );

    const r2 = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "Safety stand-down",
        type: "safety",
        scheduledAt: new Date("2026-04-30T09:00:00Z").toISOString(),
      }),
    );
    const second = (await r2.json()) as {
      carriedActionCount: number;
      carriedAgendaCount: number;
    };
    expect(second.carriedActionCount).toBe(0);
    expect(second.carriedAgendaCount).toBe(0);
  });

  it("internal meeting type never carries forward even if prior same-type exists", async () => {
    ASSUME.contractor();
    const r1 = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "PM sync",
        type: "internal",
        scheduledAt: new Date("2026-04-25T15:00:00Z").toISOString(),
      }),
    );
    const first = (await r1.json()) as { id: string };
    await createActionItem(
      jsonRequest({ description: "Note to self" }),
      params({ id: first.id }),
    );
    await transitionMeeting(
      jsonRequest({ action: "start" }),
      params({ id: first.id }),
    );
    await transitionMeeting(
      jsonRequest({ action: "complete" }),
      params({ id: first.id }),
    );

    const r2 = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "PM sync 2",
        type: "internal",
        scheduledAt: new Date("2026-05-02T15:00:00Z").toISOString(),
      }),
    );
    const second = (await r2.json()) as { carriedActionCount: number };
    expect(second.carriedActionCount).toBe(0);
  });
});

describe("attendees + RSVP", () => {
  it("sub can RSVP when invited; chair gets a notification with decline reason", async () => {
    ASSUME.contractor();
    const r = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC with sub",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
        attendees: [
          {
            userId: IDS.users.subcontractor,
            orgId: IDS.orgs.subcontractor,
            scope: "sub",
          },
        ],
      }),
    );
    const meeting = (await r.json()) as { id: string };

    ASSUME.subcontractor();
    const res = await rsvp(
      jsonRequest({ status: "declined", declineReason: "On another site" }),
      params({ id: meeting.id }),
    );
    expect(res.status).toBe(200);

    const attRow = await db
      .select()
      .from(meetingAttendees)
      .where(
        and(
          eq(meetingAttendees.meetingId, meeting.id),
          eq(meetingAttendees.userId, IDS.users.subcontractor),
        ),
      );
    expect(attRow[0].attendedStatus).toBe("declined");
    expect(attRow[0].declineReason).toBe("On another site");

    // Chair (contractor) should have a notification with the rsvp change.
    const notifs = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, IDS.users.contractorAdmin),
          eq(notifications.eventId, "meeting_rsvp_change"),
          eq(notifications.relatedObjectId, meeting.id),
        ),
      );
    expect(notifs.length).toBeGreaterThanOrEqual(1);
  });

  it("sub cannot RSVP on a meeting they're not invited to", async () => {
    ASSUME.contractor();
    const r = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "No subs",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
      }),
    );
    const meeting = (await r.json()) as { id: string };

    ASSUME.subcontractor();
    const res = await rsvp(
      jsonRequest({ status: "accepted" }),
      params({ id: meeting.id }),
    );
    expect(res.status).toBe(403);
  });
});

describe("action items — status change authorization", () => {
  it("the assignee can change their own action item status", async () => {
    ASSUME.contractor();
    const r = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
        attendees: [
          {
            userId: IDS.users.subcontractor,
            orgId: IDS.orgs.subcontractor,
            scope: "sub",
          },
        ],
      }),
    );
    const meeting = (await r.json()) as { id: string };

    const actionRes = await createActionItem(
      jsonRequest({
        description: "Do the thing",
        assignedUserId: IDS.users.subcontractor,
        dueDate: "2026-04-30",
      }),
      params({ id: meeting.id }),
    );
    const action = (await actionRes.json()) as { id: string };

    ASSUME.subcontractor();
    const patched = await patchActionItem(
      jsonRequest({ status: "done" }),
      params({ id: meeting.id, itemId: action.id }),
    );
    expect(patched.status).toBe(200);

    const [row] = await db
      .select({ status: meetingActionItems.status })
      .from(meetingActionItems)
      .where(eq(meetingActionItems.id, action.id));
    expect(row.status).toBe("done");
  });

  it("a sub who is NOT the assignee cannot change status", async () => {
    ASSUME.contractor();
    const r = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
        attendees: [
          {
            userId: IDS.users.subcontractor,
            orgId: IDS.orgs.subcontractor,
            scope: "sub",
          },
        ],
      }),
    );
    const meeting = (await r.json()) as { id: string };
    const actionRes = await createActionItem(
      jsonRequest({
        description: "Assigned to GC",
        assignedUserId: IDS.users.contractorAdmin,
      }),
      params({ id: meeting.id }),
    );
    const action = (await actionRes.json()) as { id: string };

    ASSUME.subcontractor();
    const patched = await patchActionItem(
      jsonRequest({ status: "done" }),
      params({ id: meeting.id, itemId: action.id }),
    );
    expect(patched.status).toBe(403);
  });
});

describe("minutes — draft and finalize", () => {
  it("finalize fires a notification to the invited attendee", async () => {
    ASSUME.contractor();
    const r = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC with minutes",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
        attendees: [
          {
            userId: IDS.users.subcontractor,
            orgId: IDS.orgs.subcontractor,
            scope: "sub",
          },
        ],
      }),
    );
    const meeting = (await r.json()) as { id: string };

    await saveMinutes(
      jsonRequest({ content: "Minutes content here." }),
      params({ id: meeting.id }),
    );

    // Finalize requires meeting status = completed
    await transitionMeeting(
      jsonRequest({ action: "start" }),
      params({ id: meeting.id }),
    );
    await transitionMeeting(
      jsonRequest({ action: "complete" }),
      params({ id: meeting.id }),
    );

    const fin = await finalizeMinutes(
      jsonRequest({}),
      params({ id: meeting.id }),
    );
    expect(fin.status).toBe(200);

    const [minutesRow] = await db
      .select({ finalizedAt: meetingMinutes.finalizedAt })
      .from(meetingMinutes)
      .where(eq(meetingMinutes.meetingId, meeting.id));
    expect(minutesRow.finalizedAt).not.toBeNull();

    const notifs = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, IDS.users.subcontractor),
          eq(notifications.eventId, "meeting_minutes_published"),
          eq(notifications.relatedObjectId, meeting.id),
        ),
      );
    expect(notifs.length).toBe(1);
  });

  it("cannot finalize minutes on a meeting that isn't completed", async () => {
    ASSUME.contractor();
    const r = await createMeeting(
      jsonRequest({
        projectId: PROJECT_A,
        title: "OAC",
        type: "oac",
        scheduledAt: new Date("2026-04-25T10:00:00Z").toISOString(),
      }),
    );
    const meeting = (await r.json()) as { id: string };
    await saveMinutes(
      jsonRequest({ content: "Draft" }),
      params({ id: meeting.id }),
    );

    const res = await finalizeMinutes(
      jsonRequest({}),
      params({ id: meeting.id }),
    );
    expect(res.status).toBe(409);
  });
});
