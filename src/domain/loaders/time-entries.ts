import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  organizations,
  projects,
  projectOrganizationMemberships,
  roleAssignments,
  timeEntries,
  timeEntryAmendments,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getSubcontractorOrgContext } from "@/domain/loaders/subcontractor-compliance";
import {
  getOrgContext,
  type OrgContext,
  type SessionLike,
} from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { minutesBetween } from "@/lib/time-tracking/format";
import { getWeekDays, getWeekEnd, getWeekStart } from "@/lib/time-tracking/week";

// ─────────────────────────────────────────────────────────────────────────
// Shared row shape — the DTO every page eventually renders. Loaders below
// return arrays of these so the client shells don't have to re-derive.
// ─────────────────────────────────────────────────────────────────────────

export type TimeEntryStatus =
  | "running"
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "amended";

export interface TimeEntryRow {
  id: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  taskLabel: string | null;
  taskCode: string | null;
  clockInAt: Date;
  clockOutAt: Date | null;
  // Computed at clock-out (durationMinutes). For running rows, the loader
  // fills in the rolling minutes-since-clock-in based on the current server
  // time so the client doesn't have to know the system clock.
  minutes: number | null;
  liveMinutes: number | null;
  status: TimeEntryStatus;
  notes: string | null;
  hasGps: boolean;
  isoDate: string; // yyyy-mm-dd of clock-in
}

export interface WorkerLite {
  id: string;
  name: string;
  email: string;
  initials: string;
  isAdmin: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Worker view — my week.
//   - List entries for the calling user across the requested week.
//   - Includes any running entry (status='running').
// ─────────────────────────────────────────────────────────────────────────

export interface WorkerWeekView {
  user: WorkerLite;
  org: { id: string; name: string };
  isAdmin: boolean;
  weekOffset: number;
  weekStart: Date;
  weekDays: ReturnType<typeof getWeekDays>;
  entries: TimeEntryRow[];
  myProjects: Array<{
    id: string;
    name: string;
    contractorName: string;
    color: string | null;
  }>;
  serverNow: string; // ISO; client uses this as the live timer anchor
}

export async function getWorkerWeekView(input: {
  session: SessionLike | null | undefined;
  weekOffset?: number;
}): Promise<WorkerWeekView> {
  const ctx = await getSubcontractorOrgContext(input.session);
  const offset = input.weekOffset ?? 0;
  const now = new Date();
  const weekStart = getWeekStart(now, offset);
  const weekEnd = getWeekEnd(now, offset);
  const weekDays = getWeekDays(now, offset);
  const isAdmin = ctx.role === "subcontractor_owner";

  const rows = await withTenant(ctx.organization.id, async (tx) => {
    const entries = await tx
      .select({
        id: timeEntries.id,
        userId: timeEntries.userId,
        projectId: timeEntries.projectId,
        projectName: projects.name,
        taskLabel: timeEntries.taskLabel,
        taskCode: timeEntries.taskCode,
        clockInAt: timeEntries.clockInAt,
        clockOutAt: timeEntries.clockOutAt,
        durationMinutes: timeEntries.durationMinutes,
        status: timeEntries.status,
        notes: timeEntries.notes,
        hasGps: sql<boolean>`${timeEntries.locationLat} IS NOT NULL`,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(projects.id, timeEntries.projectId))
      .where(
        and(
          eq(timeEntries.userId, ctx.user.id),
          gte(timeEntries.clockInAt, weekStart),
          lt(timeEntries.clockInAt, weekEnd),
        ),
      )
      .orderBy(asc(timeEntries.clockInAt));
    return entries;
  });

  const projectsForOrg = await loadProjectsForSubOrg(ctx.organization.id);

  return {
    user: {
      id: ctx.user.id,
      name: ctx.user.displayName ?? ctx.user.email,
      email: ctx.user.email,
      initials: initialsOf(ctx.user.displayName ?? ctx.user.email),
      isAdmin,
    },
    org: ctx.organization,
    isAdmin,
    weekOffset: offset,
    weekStart,
    weekDays,
    entries: rows.map((r) => toRow(r, ctx.user.displayName ?? ctx.user.email, now)),
    myProjects: projectsForOrg,
    serverNow: now.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Admin view — team week.
//   - Roster of every worker in the sub org with their week's entries.
//   - Aggregations (total/draft/submitted/etc) are derived on the client
//     from the entries array — keeps this loader to one query.
// ─────────────────────────────────────────────────────────────────────────

export interface AdminTeamView {
  org: { id: string; name: string };
  weekOffset: number;
  weekStart: Date;
  weekDays: ReturnType<typeof getWeekDays>;
  workers: WorkerLite[];
  entries: TimeEntryRow[];
  pendingApprovalCount: number;
  rejectedCount: number;
  serverNow: string;
}

export async function getAdminTeamView(input: {
  session: SessionLike | null | undefined;
  weekOffset?: number;
}): Promise<AdminTeamView> {
  const ctx = await getSubcontractorOrgContext(input.session);
  if (ctx.role !== "subcontractor_owner") {
    throw new AuthorizationError(
      "Only subcontractor admins can view team timesheets",
      "forbidden",
    );
  }
  const offset = input.weekOffset ?? 0;
  const now = new Date();
  const weekStart = getWeekStart(now, offset);
  const weekEnd = getWeekEnd(now, offset);
  const weekDays = getWeekDays(now, offset);

  const roster = await loadRoster(ctx.organization.id);

  const rows = await withTenant(ctx.organization.id, async (tx) => {
    const entries = await tx
      .select({
        id: timeEntries.id,
        userId: timeEntries.userId,
        projectId: timeEntries.projectId,
        projectName: projects.name,
        taskLabel: timeEntries.taskLabel,
        taskCode: timeEntries.taskCode,
        clockInAt: timeEntries.clockInAt,
        clockOutAt: timeEntries.clockOutAt,
        durationMinutes: timeEntries.durationMinutes,
        status: timeEntries.status,
        notes: timeEntries.notes,
        hasGps: sql<boolean>`${timeEntries.locationLat} IS NOT NULL`,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(projects.id, timeEntries.projectId))
      .where(
        and(
          gte(timeEntries.clockInAt, weekStart),
          lt(timeEntries.clockInAt, weekEnd),
        ),
      )
      .orderBy(asc(timeEntries.clockInAt));
    return entries;
  });

  const userNameById = new Map(roster.map((w) => [w.id, w.name]));
  const entries = rows.map((r) =>
    toRow(r, userNameById.get(r.userId) ?? "Unknown", now),
  );

  // Pending count is global to the org for the dashboard banner — not just
  // this week's. Run a tiny secondary query so the banner is accurate even
  // when paging through past weeks.
  const counts = await withTenant(ctx.organization.id, async (tx) => {
    const [pending] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(timeEntries)
      .where(eq(timeEntries.status, "submitted"));
    const [rejected] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(timeEntries)
      .where(eq(timeEntries.status, "rejected"));
    return { pending: pending?.n ?? 0, rejected: rejected?.n ?? 0 };
  });

  return {
    org: ctx.organization,
    weekOffset: offset,
    weekStart,
    weekDays,
    workers: roster,
    entries,
    pendingApprovalCount: counts.pending,
    rejectedCount: counts.rejected,
    serverNow: now.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Admin view — single worker drill-down.
//   - Returns the same week shape but scoped to one workerId, plus the
//     amendment audit trail for those entries.
// ─────────────────────────────────────────────────────────────────────────

export interface AmendmentRow {
  id: string;
  timeEntryId: string;
  actorName: string;
  action: "submitted" | "approved" | "rejected" | "amended";
  reason: string | null;
  createdAt: Date;
  beforeJson: unknown;
  afterJson: unknown;
}

export interface AdminWorkerDetailView {
  worker: WorkerLite;
  org: { id: string; name: string };
  weekOffset: number;
  weekStart: Date;
  weekDays: ReturnType<typeof getWeekDays>;
  entries: TimeEntryRow[];
  amendments: AmendmentRow[];
  serverNow: string;
}

export async function getAdminWorkerDetailView(input: {
  session: SessionLike | null | undefined;
  workerId: string;
  weekOffset?: number;
}): Promise<AdminWorkerDetailView> {
  const ctx = await getSubcontractorOrgContext(input.session);
  if (ctx.role !== "subcontractor_owner") {
    throw new AuthorizationError(
      "Only subcontractor admins can view team timesheets",
      "forbidden",
    );
  }
  const offset = input.weekOffset ?? 0;
  const now = new Date();
  const weekStart = getWeekStart(now, offset);
  const weekEnd = getWeekEnd(now, offset);
  const weekDays = getWeekDays(now, offset);

  // Worker must belong to the same sub org. Cheap pre-check via roster.
  const roster = await loadRoster(ctx.organization.id);
  const worker = roster.find((w) => w.id === input.workerId);
  if (!worker) {
    throw new AuthorizationError(
      "Worker not in this organization",
      "not_found",
    );
  }

  const { entries, amendments } = await withTenant(
    ctx.organization.id,
    async (tx) => {
      const entryRows = await tx
        .select({
          id: timeEntries.id,
          userId: timeEntries.userId,
          projectId: timeEntries.projectId,
          projectName: projects.name,
          taskLabel: timeEntries.taskLabel,
          taskCode: timeEntries.taskCode,
          clockInAt: timeEntries.clockInAt,
          clockOutAt: timeEntries.clockOutAt,
          durationMinutes: timeEntries.durationMinutes,
          status: timeEntries.status,
          notes: timeEntries.notes,
          hasGps: sql<boolean>`${timeEntries.locationLat} IS NOT NULL`,
        })
        .from(timeEntries)
        .innerJoin(projects, eq(projects.id, timeEntries.projectId))
        .where(
          and(
            eq(timeEntries.userId, input.workerId),
            gte(timeEntries.clockInAt, weekStart),
            lt(timeEntries.clockInAt, weekEnd),
          ),
        )
        .orderBy(asc(timeEntries.clockInAt));

      const ids = entryRows.map((e) => e.id);
      const audits = ids.length
        ? await tx
            .select({
              id: timeEntryAmendments.id,
              timeEntryId: timeEntryAmendments.timeEntryId,
              actorUserId: timeEntryAmendments.actorUserId,
              action: timeEntryAmendments.action,
              reason: timeEntryAmendments.reason,
              createdAt: timeEntryAmendments.createdAt,
              beforeJson: timeEntryAmendments.beforeJson,
              afterJson: timeEntryAmendments.afterJson,
              actorName: users.displayName,
              actorEmail: users.email,
            })
            .from(timeEntryAmendments)
            .innerJoin(users, eq(users.id, timeEntryAmendments.actorUserId))
            .where(inArray(timeEntryAmendments.timeEntryId, ids))
            .orderBy(desc(timeEntryAmendments.createdAt))
        : [];
      return { entries: entryRows, amendments: audits };
    },
  );

  return {
    worker,
    org: ctx.organization,
    weekOffset: offset,
    weekStart,
    weekDays,
    entries: entries.map((r) => toRow(r, worker.name, now)),
    amendments: amendments.map((a) => ({
      id: a.id,
      timeEntryId: a.timeEntryId,
      action: a.action,
      reason: a.reason,
      createdAt: a.createdAt,
      actorName: a.actorName ?? a.actorEmail,
      beforeJson: a.beforeJson,
      afterJson: a.afterJson,
    })),
    serverNow: now.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Contractor rollup — aggregated hours per project + per sub crew, no row-
// level access. Used by the "time" reports tile (Step 24.5 / Step 53 wire-up).
//
// Reads aggregated stats from time_entries scoped to projects the contractor
// owns. Sub orgs are visible by name via project_organization_memberships.
// Hours from approved + amended + (optionally) submitted entries are summed.
// ─────────────────────────────────────────────────────────────────────────

export interface ContractorTimeRollup {
  totalApprovedMinutes: number;
  totalSubmittedMinutes: number;
  byProject: Array<{
    projectId: string;
    projectName: string;
    approvedMinutes: number;
    submittedMinutes: number;
  }>;
  bySubOrg: Array<{
    organizationId: string;
    organizationName: string;
    approvedMinutes: number;
    submittedMinutes: number;
    workerCount: number;
  }>;
}

export async function getContractorTimeRollup(input: {
  session: SessionLike | null | undefined;
}): Promise<ContractorTimeRollup> {
  const ctx = await getOrgContext(input.session);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Only contractors can view the time rollup",
      "forbidden",
    );
  }

  // Reads cross-tenant data (sub orgs' time_entries on contractor's
  // projects). Use admin pool — we filter on the contractor's projects
  // explicitly. RLS won't help here because the contractor is not a member
  // of the sub orgs that own those rows; the auth gate is the projectId
  // filter on the contractor's own projects.
  const contractorOrgId = ctx.organization.id;

  const projectRows = await dbAdmin
    .select({
      projectId: timeEntries.projectId,
      projectName: projects.name,
      status: timeEntries.status,
      totalMinutes: sql<number>`COALESCE(SUM(${timeEntries.durationMinutes}), 0)::int`,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .where(eq(projects.contractorOrganizationId, contractorOrgId))
    .groupBy(timeEntries.projectId, projects.name, timeEntries.status);

  const subRows = await dbAdmin
    .select({
      organizationId: timeEntries.organizationId,
      organizationName: organizations.name,
      status: timeEntries.status,
      totalMinutes: sql<number>`COALESCE(SUM(${timeEntries.durationMinutes}), 0)::int`,
      workerCount: sql<number>`COUNT(DISTINCT ${timeEntries.userId})::int`,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .innerJoin(
      organizations,
      eq(organizations.id, timeEntries.organizationId),
    )
    .where(eq(projects.contractorOrganizationId, contractorOrgId))
    .groupBy(
      timeEntries.organizationId,
      organizations.name,
      timeEntries.status,
    );

  const byProject = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      approvedMinutes: number;
      submittedMinutes: number;
    }
  >();
  for (const r of projectRows) {
    const cur = byProject.get(r.projectId) ?? {
      projectId: r.projectId,
      projectName: r.projectName,
      approvedMinutes: 0,
      submittedMinutes: 0,
    };
    if (r.status === "approved" || r.status === "amended") {
      cur.approvedMinutes += r.totalMinutes ?? 0;
    } else if (r.status === "submitted") {
      cur.submittedMinutes += r.totalMinutes ?? 0;
    }
    byProject.set(r.projectId, cur);
  }

  const bySubOrg = new Map<
    string,
    {
      organizationId: string;
      organizationName: string;
      approvedMinutes: number;
      submittedMinutes: number;
      workerCount: number;
    }
  >();
  for (const r of subRows) {
    const cur = bySubOrg.get(r.organizationId) ?? {
      organizationId: r.organizationId,
      organizationName: r.organizationName,
      approvedMinutes: 0,
      submittedMinutes: 0,
      workerCount: 0,
    };
    if (r.status === "approved" || r.status === "amended") {
      cur.approvedMinutes += r.totalMinutes ?? 0;
    } else if (r.status === "submitted") {
      cur.submittedMinutes += r.totalMinutes ?? 0;
    }
    cur.workerCount = Math.max(cur.workerCount, r.workerCount ?? 0);
    bySubOrg.set(r.organizationId, cur);
  }

  const totalApprovedMinutes = Array.from(byProject.values()).reduce(
    (a, p) => a + p.approvedMinutes,
    0,
  );
  const totalSubmittedMinutes = Array.from(byProject.values()).reduce(
    (a, p) => a + p.submittedMinutes,
    0,
  );

  return {
    totalApprovedMinutes,
    totalSubmittedMinutes,
    byProject: Array.from(byProject.values()).sort(
      (a, b) => b.approvedMinutes - a.approvedMinutes,
    ),
    bySubOrg: Array.from(bySubOrg.values()).sort(
      (a, b) => b.approvedMinutes - a.approvedMinutes,
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

function initialsOf(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    const at = trimmed.indexOf("@");
    const base = at > 0 ? trimmed.slice(0, at) : trimmed;
    return base.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function toRow(
  r: {
    id: string;
    userId: string;
    projectId: string;
    projectName: string;
    taskLabel: string | null;
    taskCode: string | null;
    clockInAt: Date;
    clockOutAt: Date | null;
    durationMinutes: number | null;
    status: TimeEntryStatus;
    notes: string | null;
    hasGps: boolean;
  },
  userName: string,
  now: Date,
): TimeEntryRow {
  const isRunning = r.status === "running";
  const liveMinutes = isRunning ? minutesBetween(r.clockInAt, now) : null;
  return {
    id: r.id,
    userId: r.userId,
    userName,
    projectId: r.projectId,
    projectName: r.projectName,
    taskLabel: r.taskLabel,
    taskCode: r.taskCode,
    clockInAt: r.clockInAt,
    clockOutAt: r.clockOutAt,
    minutes: r.durationMinutes,
    liveMinutes,
    status: r.status,
    notes: r.notes,
    hasGps: r.hasGps,
    isoDate: isoDateOf(r.clockInAt),
  };
}

function isoDateOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadRoster(orgId: string): Promise<WorkerLite[]> {
  const rows = await dbAdmin
    .select({
      userId: roleAssignments.userId,
      roleKey: roleAssignments.roleKey,
      displayName: users.displayName,
      email: users.email,
      isActive: users.isActive,
    })
    .from(roleAssignments)
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(
      and(
        eq(roleAssignments.organizationId, orgId),
        eq(roleAssignments.portalType, "subcontractor"),
      ),
    );
  return rows
    .filter((r) => r.isActive)
    .map((r) => ({
      id: r.userId,
      name: r.displayName ?? r.email,
      email: r.email,
      initials: initialsOf(r.displayName ?? r.email),
      isAdmin: /owner|admin/i.test(r.roleKey),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadProjectsForSubOrg(
  orgId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    contractorName: string;
    color: string | null;
  }>
> {
  // Sub orgs see the projects they're an active member of. Use admin pool —
  // RLS on projects is keyed to contractor org context, so a sub query under
  // sub tenant context wouldn't return rows; this lookup is the legitimate
  // pre-tenant join. Same shape as other "what projects am I on" loaders.
  const rows = await dbAdmin
    .select({
      projectId: projects.id,
      projectName: projects.name,
      contractorOrgId: projects.contractorOrganizationId,
      contractorName: organizations.name,
    })
    .from(projectOrganizationMemberships)
    .innerJoin(
      projects,
      eq(projects.id, projectOrganizationMemberships.projectId),
    )
    .innerJoin(
      organizations,
      eq(organizations.id, projects.contractorOrganizationId),
    )
    .where(
      and(
        eq(projectOrganizationMemberships.organizationId, orgId),
        eq(projectOrganizationMemberships.membershipStatus, "active"),
      ),
    );
  return rows.map((r) => ({
    id: r.projectId,
    name: r.projectName,
    contractorName: r.contractorName,
    color: null,
  }));
}

// Re-export so action code can call shared helpers without importing twice.
export { getSubcontractorOrgContext };
export type { OrgContext };
