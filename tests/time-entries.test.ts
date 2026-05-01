import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import {
  authAccount,
  authUser,
  organizationUsers,
  projectOrganizationMemberships,
  projectUserMemberships,
  roleAssignments,
  timeEntries,
  timeEntryAmendments,
  users,
} from "@/db/schema";

import { POST as createEntry } from "@/app/api/time-entries/route";
import { POST as clockOutEntry } from "@/app/api/time-entries/clock-out/route";
import { POST as submitWeekEndpoint } from "@/app/api/time-entries/submit-week/route";
import { POST as approveEndpoint } from "@/app/api/time-entries/[id]/approve/route";
import { POST as amendEndpoint } from "@/app/api/time-entries/[id]/amend/route";
import { PATCH as patchEntry } from "@/app/api/time-entries/[id]/route";

import { IDS } from "./fixtures/seed";
import { jsonRequest, jsonRequestWithMethod } from "./helpers/request";
import { ASSUME, asUser } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;
const PROJECT_B = IDS.projects.projectB;
const SUB_ORG = IDS.orgs.subcontractor;
const SUB_WORKER = IDS.users.subcontractor; // roleKey "lead" → worker
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

// Add a second sub user with admin role for the gate tests. Using fixed
// IDs in the tests' own range so we don't collide with the global fixture.
const SUB_ADMIN_USER = "22222222-0000-0000-0000-000000000099";
const SUB_ADMIN_ROLE = "33333333-0000-0000-0000-000000000099";
const SUB_ADMIN_AUTH_ID = "auth-sub-admin-99";

beforeAll(async () => {
  // The global fixture purges projectOrganizationMemberships but doesn't
  // re-seed it (no other test relies on it). Time-entry actions gate on
  // sub-org-on-project via that table, so we plant the link here for both
  // PROJECT_A. PROJECT_B is intentionally left without a row so we can
  // assert the negative case.
  await db
    .insert(projectOrganizationMemberships)
    .values({
      projectId: PROJECT_A,
      organizationId: SUB_ORG,
      membershipType: "subcontractor",
      membershipStatus: "active",
    })
    .onConflictDoNothing();

  // Plant the sub-admin user. We mirror the columns the fixture uses for
  // the worker user.
  await db
    .insert(authUser)
    .values({
      id: SUB_ADMIN_AUTH_ID,
      email: "sub-admin@example.com",
      name: "Sub Admin",
      emailVerified: true,
    })
    .onConflictDoNothing();
  await db
    .insert(authAccount)
    .values({
      id: "auth-acct-sub-admin-99",
      userId: SUB_ADMIN_AUTH_ID,
      providerId: "credential",
      accountId: SUB_ADMIN_AUTH_ID,
    })
    .onConflictDoNothing();
  await db
    .insert(users)
    .values({
      id: SUB_ADMIN_USER,
      email: "sub-admin@example.com",
      displayName: "Sub Admin",
      isActive: true,
      authUserId: SUB_ADMIN_AUTH_ID,
    })
    .onConflictDoNothing();
  await db
    .insert(organizationUsers)
    .values({
      organizationId: SUB_ORG,
      userId: SUB_ADMIN_USER,
    })
    .onConflictDoNothing();
  await db
    .insert(roleAssignments)
    .values({
      id: SUB_ADMIN_ROLE,
      userId: SUB_ADMIN_USER,
      organizationId: SUB_ORG,
      portalType: "subcontractor",
      roleKey: "owner",
    })
    .onConflictDoNothing();
  // Project A membership so the admin can also clock in / amend on that
  // project's entries.
  await db
    .insert(projectUserMemberships)
    .values({
      projectId: PROJECT_A,
      organizationId: SUB_ORG,
      userId: SUB_ADMIN_USER,
      roleAssignmentId: SUB_ADMIN_ROLE,
      accessState: "active",
      membershipStatus: "active",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db
    .delete(timeEntryAmendments)
    .where(
      inArray(
        timeEntryAmendments.actorUserId,
        [SUB_WORKER, SUB_ADMIN_USER],
      ),
    );
  await db
    .delete(timeEntries)
    .where(eq(timeEntries.organizationId, SUB_ORG));
  await db
    .delete(projectUserMemberships)
    .where(eq(projectUserMemberships.userId, SUB_ADMIN_USER));
  await db.delete(roleAssignments).where(eq(roleAssignments.id, SUB_ADMIN_ROLE));
  await db
    .delete(organizationUsers)
    .where(eq(organizationUsers.userId, SUB_ADMIN_USER));
  await db.delete(users).where(eq(users.id, SUB_ADMIN_USER));
  await db.delete(authAccount).where(eq(authAccount.userId, SUB_ADMIN_AUTH_ID));
  await db.delete(authUser).where(eq(authUser.id, SUB_ADMIN_AUTH_ID));
  await db
    .delete(projectOrganizationMemberships)
    .where(eq(projectOrganizationMemberships.projectId, PROJECT_A));
});

beforeEach(async () => {
  await db
    .delete(timeEntryAmendments)
    .where(
      inArray(
        timeEntryAmendments.actorUserId,
        [SUB_WORKER, SUB_ADMIN_USER],
      ),
    );
  await db
    .delete(timeEntries)
    .where(eq(timeEntries.organizationId, SUB_ORG));
});

const clockInBody = (overrides?: Record<string, unknown>) => ({
  mode: "clock-in" as const,
  projectId: PROJECT_A,
  taskLabel: "Floor 4 deck install",
  notes: null,
  ...overrides,
});

describe("POST /api/time-entries — clock in", () => {
  it("rejects unauthenticated", async () => {
    ASSUME.none();
    const r = await createEntry(jsonRequest(clockInBody()));
    expect(r.status).toBe(401);
  });

  it("rejects clients", async () => {
    ASSUME.commercial();
    const r = await createEntry(jsonRequest(clockInBody()));
    expect([401, 403]).toContain(r.status);
  });

  it("rejects contractor users (only subs clock in)", async () => {
    ASSUME.contractor();
    const r = await createEntry(jsonRequest(clockInBody()));
    expect([401, 403]).toContain(r.status);
  });

  it("sub worker clocks in successfully", async () => {
    ASSUME.subcontractor();
    const r = await createEntry(jsonRequest(clockInBody()));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { id: string };
    expect(j.id).toMatch(/[0-9a-f-]{36}/);

    const [row] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, j.id));
    expect(row.status).toBe("running");
    expect(row.userId).toBe(SUB_WORKER);
    expect(row.organizationId).toBe(SUB_ORG);
    expect(row.taskLabel).toBe("Floor 4 deck install");
  });

  it("rejects clock-in on a project the sub isn't a member of", async () => {
    ASSUME.subcontractor();
    const r = await createEntry(
      jsonRequest(clockInBody({ projectId: PROJECT_B })),
    );
    expect(r.status).toBe(403);
  });

  it("rejects a second concurrent clock-in", async () => {
    ASSUME.subcontractor();
    const r1 = await createEntry(jsonRequest(clockInBody()));
    expect(r1.status).toBe(200);
    const r2 = await createEntry(jsonRequest(clockInBody()));
    expect(r2.status).toBe(409);
    const j = (await r2.json()) as { error: string };
    expect(j.error).toBe("state_error");
  });
});

describe("POST /api/time-entries/clock-out", () => {
  it("clocks out → flips to draft + computes duration", async () => {
    ASSUME.subcontractor();
    const r1 = await createEntry(jsonRequest(clockInBody()));
    const j1 = (await r1.json()) as { id: string };
    // Backdate clock-in by 90 min so duration > 0.
    await db
      .update(timeEntries)
      .set({ clockInAt: new Date(Date.now() - 90 * 60 * 1000) })
      .where(eq(timeEntries.id, j1.id));

    const r2 = await clockOutEntry(jsonRequest({ notes: "Wrap-up" }));
    expect(r2.status).toBe(200);
    const [row] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, j1.id));
    expect(row.status).toBe("draft");
    expect(row.clockOutAt).not.toBeNull();
    expect(row.durationMinutes).toBeGreaterThanOrEqual(85);
    expect(row.notes).toBe("Wrap-up");
  });

  it("returns 409 when nothing is running", async () => {
    ASSUME.subcontractor();
    const r = await clockOutEntry(jsonRequest({}));
    expect(r.status).toBe(409);
  });
});

describe("POST /api/time-entries — manual entry", () => {
  it("creates a draft entry with reason", async () => {
    ASSUME.subcontractor();
    const r = await createEntry(
      jsonRequest({
        mode: "manual",
        projectId: PROJECT_A,
        clockInAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        clockOutAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        reason: "Phone died",
        taskLabel: "Floor 4",
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { id: string };
    const [row] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, j.id));
    expect(row.status).toBe("draft");
    expect(row.notes).toContain("Manual entry");
    expect(row.notes).toContain("Phone died");
    expect(row.durationMinutes).toBeGreaterThan(0);
  });

  it("rejects overlapping manual entries", async () => {
    ASSUME.subcontractor();
    const start = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const end = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const r1 = await createEntry(
      jsonRequest({
        mode: "manual",
        projectId: PROJECT_A,
        clockInAt: start.toISOString(),
        clockOutAt: end.toISOString(),
        reason: "first",
      }),
    );
    expect(r1.status).toBe(200);
    // Overlapping range — start in the middle of the first.
    const overlapStart = new Date(start.getTime() + 60 * 60 * 1000);
    const overlapEnd = new Date(end.getTime() + 60 * 60 * 1000);
    const r2 = await createEntry(
      jsonRequest({
        mode: "manual",
        projectId: PROJECT_A,
        clockInAt: overlapStart.toISOString(),
        clockOutAt: overlapEnd.toISOString(),
        reason: "overlap",
      }),
    );
    expect(r2.status).toBe(409);
    const j = (await r2.json()) as { error: string };
    expect(j.error).toBe("overlap");
  });
});

describe("PATCH /api/time-entries/[id] — worker edit", () => {
  it("blocks edits on submitted entries (worker can't change submitted)", async () => {
    ASSUME.subcontractor();
    // Plant a submitted row directly.
    const submitted = (
      await db
        .insert(timeEntries)
        .values({
          userId: SUB_WORKER,
          organizationId: SUB_ORG,
          projectId: PROJECT_A,
          clockInAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          clockOutAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          durationMinutes: 240,
          status: "submitted",
          taskLabel: "Old task",
        })
        .returning()
    )[0];
    const r = await patchEntry(
      jsonRequestWithMethod("PATCH", { taskLabel: "New task" }),
      params({ id: submitted.id }),
    );
    expect(r.status).toBe(409);
    const j = (await r.json()) as { error: string };
    expect(j.error).toBe("state_error");
  });

  it("allows editing draft entries", async () => {
    ASSUME.subcontractor();
    const draft = (
      await db
        .insert(timeEntries)
        .values({
          userId: SUB_WORKER,
          organizationId: SUB_ORG,
          projectId: PROJECT_A,
          clockInAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          clockOutAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          durationMinutes: 240,
          status: "draft",
          taskLabel: "Original",
        })
        .returning()
    )[0];
    const r = await patchEntry(
      jsonRequestWithMethod("PATCH", { taskLabel: "Edited" }),
      params({ id: draft.id }),
    );
    expect(r.status).toBe(200);
    const [row] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, draft.id));
    expect(row.taskLabel).toBe("Edited");
  });
});

describe("submit week + admin approval flow", () => {
  it("worker submits drafts → status=submitted + audit row written", async () => {
    ASSUME.subcontractor();
    const planted = (
      await db
        .insert(timeEntries)
        .values({
          userId: SUB_WORKER,
          organizationId: SUB_ORG,
          projectId: PROJECT_A,
          clockInAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
          clockOutAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          durationMinutes: 420,
          status: "draft",
          taskLabel: "Today",
        })
        .returning()
    )[0];
    const r = await submitWeekEndpoint(jsonRequest({ weekOffset: 0 }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { submitted: number };
    expect(j.submitted).toBeGreaterThanOrEqual(1);
    const [row] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, planted.id));
    expect(row.status).toBe("submitted");
    expect(row.submittedAt).not.toBeNull();

    const audits = await db
      .select()
      .from(timeEntryAmendments)
      .where(eq(timeEntryAmendments.timeEntryId, planted.id));
    const submittedAudit = audits.find((a) => a.action === "submitted");
    expect(submittedAudit).toBeTruthy();
  });

  it("worker (non-admin) cannot approve", async () => {
    ASSUME.subcontractor();
    const submitted = (
      await db
        .insert(timeEntries)
        .values({
          userId: SUB_WORKER,
          organizationId: SUB_ORG,
          projectId: PROJECT_A,
          clockInAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          clockOutAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          durationMinutes: 240,
          status: "submitted",
        })
        .returning()
    )[0];
    const r = await approveEndpoint(
      jsonRequest({}),
      params({ id: submitted.id }),
    );
    expect(r.status).toBe(403);
  });

  it("admin approves → status flips to approved + audit row", async () => {
    asUser(SUB_ADMIN_USER);
    const submitted = (
      await db
        .insert(timeEntries)
        .values({
          userId: SUB_WORKER,
          organizationId: SUB_ORG,
          projectId: PROJECT_A,
          clockInAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          clockOutAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          durationMinutes: 240,
          status: "submitted",
        })
        .returning()
    )[0];
    const r = await approveEndpoint(
      jsonRequest({}),
      params({ id: submitted.id }),
    );
    expect(r.status).toBe(200);
    const [row] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, submitted.id));
    expect(row.status).toBe("approved");
    expect(row.decidedByUserId).toBe(SUB_ADMIN_USER);

    const audits = await db
      .select()
      .from(timeEntryAmendments)
      .where(eq(timeEntryAmendments.timeEntryId, submitted.id));
    expect(audits.find((a) => a.action === "approved")).toBeTruthy();
  });

  it("admin amends → status=amended + before/after snapshot in audit", async () => {
    asUser(SUB_ADMIN_USER);
    const submitted = (
      await db
        .insert(timeEntries)
        .values({
          userId: SUB_WORKER,
          organizationId: SUB_ORG,
          projectId: PROJECT_A,
          clockInAt: new Date("2026-04-22T07:00:00Z"),
          clockOutAt: new Date("2026-04-22T16:30:00Z"),
          durationMinutes: 570,
          status: "submitted",
          taskLabel: "Old task",
        })
        .returning()
    )[0];
    const r = await amendEndpoint(
      jsonRequest({
        clockInAt: "2026-04-22T07:00:00Z",
        clockOutAt: "2026-04-22T16:00:00Z",
        reason: "Forgot to clock out, corrected.",
      }),
      params({ id: submitted.id }),
    );
    expect(r.status).toBe(200);
    const [row] = await db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.id, submitted.id));
    expect(row.status).toBe("amended");
    expect(row.durationMinutes).toBe(540);

    const [audit] = await db
      .select()
      .from(timeEntryAmendments)
      .where(eq(timeEntryAmendments.timeEntryId, submitted.id));
    expect(audit.action).toBe("amended");
    expect(audit.reason).toContain("Forgot");
    const before = audit.beforeJson as { durationMinutes: number | null };
    const after = audit.afterJson as { durationMinutes: number | null };
    expect(before.durationMinutes).toBe(570);
    expect(after.durationMinutes).toBe(540);
  });

  it("amend without reason is rejected", async () => {
    asUser(SUB_ADMIN_USER);
    const submitted = (
      await db
        .insert(timeEntries)
        .values({
          userId: SUB_WORKER,
          organizationId: SUB_ORG,
          projectId: PROJECT_A,
          clockInAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
          clockOutAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          durationMinutes: 240,
          status: "submitted",
        })
        .returning()
    )[0];
    // Zod requires reason min length, so it's a 400 invalid_body.
    const r = await amendEndpoint(
      jsonRequest({ reason: "" }),
      params({ id: submitted.id }),
    );
    expect([400, 409]).toContain(r.status);
  });
});

describe("partial unique index — only one running entry per user", () => {
  it("Postgres rejects two running rows for the same user", async () => {
    // Plant a running row directly.
    await db.insert(timeEntries).values({
      userId: SUB_WORKER,
      organizationId: SUB_ORG,
      projectId: PROJECT_A,
      clockInAt: new Date(),
      status: "running",
    });
    let threw = false;
    try {
      await db.insert(timeEntries).values({
        userId: SUB_WORKER,
        organizationId: SUB_ORG,
        projectId: PROJECT_A,
        clockInAt: new Date(),
        status: "running",
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
