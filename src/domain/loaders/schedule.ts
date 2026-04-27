import { and, asc, eq, inArray, or } from "drizzle-orm";

import { withTenant } from "@/db/with-tenant";
import {
  milestoneDependencies,
  milestones,
  organizations,
  users,
} from "@/db/schema";

import {
  getEffectiveContext,
  type SessionLike,
} from "../context";
import { assertCan } from "../permissions";

// Re-export everything from shared so existing server-side imports
// (e.g. `import { ScheduleView } from "@/domain/loaders/schedule"`)
// continue to work without changes.
export * from "./schedule.shared";

import type {
  MilestoneDependency,
  MilestoneKind,
  MilestoneRow,
  MilestoneStatus,
  MilestoneType,
  MilestoneVisibility,
  PhaseGroup,
  ScheduleStats,
  ScheduleView,
} from "./schedule.shared";

type LoaderInput = { session: SessionLike | null | undefined; projectId: string };

// ---- Loader -------------------------------------------------------------

export async function getScheduleView(
  input: LoaderInput,
): Promise<ScheduleView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  assertCan(context.permissions, "milestone", "read");

  const projectId = context.project.id;
  const role = context.role;

  const baseWhere = eq(milestones.projectId, projectId);

  let whereClause = baseWhere;
  if (role === "subcontractor_user") {
    whereClause = and(
      baseWhere,
      or(
        eq(milestones.assignedToOrganizationId, context.organization.id),
        inArray(milestones.visibilityScope, [
          "project_wide",
          "subcontractor_scoped",
        ]),
      ),
    )!;
  } else if (role === "commercial_client" || role === "residential_client") {
    whereClause = and(
      baseWhere,
      inArray(milestones.visibilityScope, ["project_wide", "client_visible"]),
    )!;
  }

  const rows = await withTenant(context.organization.id, (tx) =>
    tx
      .select({
        id: milestones.id,
        title: milestones.title,
        description: milestones.description,
        milestoneType: milestones.milestoneType,
        milestoneStatus: milestones.milestoneStatus,
        kind: milestones.kind,
        startDate: milestones.startDate,
        scheduledDate: milestones.scheduledDate,
        completedDate: milestones.completedDate,
        phase: milestones.phase,
        assignedToUserId: milestones.assignedToUserId,
        assignedToUserName: users.displayName,
        assignedToOrganizationId: milestones.assignedToOrganizationId,
        assignedToOrganizationName: organizations.name,
        sortOrder: milestones.sortOrder,
        visibilityScope: milestones.visibilityScope,
      })
      .from(milestones)
      .leftJoin(users, eq(users.id, milestones.assignedToUserId))
      .leftJoin(
        organizations,
        eq(organizations.id, milestones.assignedToOrganizationId),
      )
      .where(whereClause)
      .orderBy(
        asc(milestones.phase),
        asc(milestones.sortOrder),
        asc(milestones.scheduledDate),
      ),
  );

  const milestoneRows: MilestoneRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    milestoneType: r.milestoneType as MilestoneType,
    milestoneStatus: r.milestoneStatus as MilestoneStatus,
    kind: r.kind as MilestoneKind,
    startDate: r.startDate,
    scheduledDate: r.scheduledDate,
    completedDate: r.completedDate,
    phase: r.phase,
    assignedToUserId: r.assignedToUserId,
    assignedToUserName: r.assignedToUserName,
    assignedToOrganizationId: r.assignedToOrganizationId,
    assignedToOrganizationName: r.assignedToOrganizationName,
    sortOrder: r.sortOrder,
    visibilityScope: r.visibilityScope as MilestoneVisibility,
  }));

  // Dependency edges scoped to the milestones we're returning. Even
  // if a user can't see the predecessor (role filter), we don't leak
  // it — the edge only surfaces if BOTH endpoints are in the visible
  // set. Without this, subs would see dangling arrows to unknown
  // predecessors in the Gantt.
  const visibleIds = milestoneRows.map((r) => r.id);
  const dependencies: MilestoneDependency[] =
    visibleIds.length === 0
      ? []
      : await loadScopedDependencies(visibleIds, context.organization.id);

  const phases = groupByPhase(milestoneRows);
  const stats = computeStats(milestoneRows);
  const overallProgressPct =
    stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100);

  return {
    context,
    project: context.project,
    role,
    canWrite: context.permissions.can("milestone", "write"),
    milestones: milestoneRows,
    dependencies,
    phases,
    stats,
    overallProgressPct,
  };
}

// Edges where BOTH endpoints are in the provided id set. An edge
// dangles visually if one endpoint is filtered out by role, so we
// intersect here. Called inline from the loader above.
async function loadScopedDependencies(
  visibleIds: string[],
  orgId: string,
): Promise<MilestoneDependency[]> {
  // milestone_dependencies is RLS'd nested-via-parent on milestones —
  // the parent's project-scoped policy filters edges to the caller's
  // accessible projects.
  const rows = await withTenant(orgId, (tx) =>
    tx
      .select({
        predecessorId: milestoneDependencies.predecessorId,
        successorId: milestoneDependencies.successorId,
      })
      .from(milestoneDependencies)
      .where(
        and(
          inArray(milestoneDependencies.predecessorId, visibleIds),
          inArray(milestoneDependencies.successorId, visibleIds),
        ),
      ),
  );
  return rows;
}

// ---- Grouping & stats ---------------------------------------------------

function groupByPhase(rows: MilestoneRow[]): PhaseGroup[] {
  const byPhase = new Map<string, MilestoneRow[]>();
  for (const row of rows) {
    const key = row.phase ?? "Unphased";
    const arr = byPhase.get(key) ?? [];
    arr.push(row);
    byPhase.set(key, arr);
  }

  const groups: PhaseGroup[] = [];
  for (const [name, items] of byPhase) {
    const completedCount = items.filter(
      (m) => m.milestoneStatus === "completed",
    ).length;
    const dates = items
      .map((m) => m.scheduledDate)
      .sort((a, b) => a.getTime() - b.getTime());
    const firstDate = dates[0] ?? null;
    const lastDate = dates[dates.length - 1] ?? null;

    let state: PhaseGroup["state"];
    if (completedCount === items.length) {
      state = "completed";
    } else if (items.some((m) => m.milestoneStatus !== "scheduled")) {
      state = "active";
    } else {
      state = "upcoming";
    }

    groups.push({
      name,
      milestones: items,
      completedCount,
      totalCount: items.length,
      firstDate,
      lastDate,
      state,
    });
  }

  groups.sort((a, b) => {
    const at = a.firstDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bt = b.firstDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return at - bt;
  });
  return groups;
}

function computeStats(rows: MilestoneRow[]): ScheduleStats {
  const now = Date.now();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
  let completed = 0;
  let inProgress = 0;
  let upcoming = 0;
  let missed = 0;
  for (const m of rows) {
    switch (m.milestoneStatus) {
      case "completed":
        completed++;
        break;
      case "in_progress":
        inProgress++;
        break;
      case "missed":
        missed++;
        break;
      case "scheduled": {
        const delta = m.scheduledDate.getTime() - now;
        if (delta >= 0 && delta <= twoWeeksMs) upcoming++;
        break;
      }
      default:
        break;
    }
  }
  return { total: rows.length, completed, inProgress, upcoming, missed };
}
