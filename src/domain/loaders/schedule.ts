import { and, asc, eq, inArray, or } from "drizzle-orm";

import { db } from "@/db/client";
import { milestones, organizations, users } from "@/db/schema";

import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { assertCan } from "../permissions";

// ---- Types --------------------------------------------------------------

export const MILESTONE_STATUS_VALUES = [
  "scheduled",
  "in_progress",
  "completed",
  "missed",
  "cancelled",
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUS_VALUES)[number];

export const MILESTONE_TYPE_VALUES = [
  "inspection",
  "deadline",
  "submission",
  "walkthrough",
  "delivery",
  "payment",
  "completion",
  "custom",
] as const;
export type MilestoneType = (typeof MILESTONE_TYPE_VALUES)[number];

export const MILESTONE_VISIBILITY_VALUES = [
  "internal_only",
  "client_visible",
  "subcontractor_scoped",
  "project_wide",
  "phase_scoped",
  "scope_scoped",
] as const;
export type MilestoneVisibility = (typeof MILESTONE_VISIBILITY_VALUES)[number];

export type MilestoneRow = {
  id: string;
  title: string;
  description: string | null;
  milestoneType: MilestoneType;
  milestoneStatus: MilestoneStatus;
  scheduledDate: Date;
  completedDate: Date | null;
  phase: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  assignedToOrganizationId: string | null;
  assignedToOrganizationName: string | null;
  sortOrder: number;
  visibilityScope: MilestoneVisibility;
};

export type PhaseGroup = {
  name: string;
  milestones: MilestoneRow[];
  completedCount: number;
  totalCount: number;
  firstDate: Date | null;
  lastDate: Date | null;
  state: "completed" | "active" | "upcoming";
};

export type ScheduleStats = {
  total: number;
  completed: number;
  inProgress: number;
  upcoming: number;
  missed: number;
};

export type ScheduleView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  role: EffectiveContext["role"];
  canWrite: boolean;
  milestones: MilestoneRow[];
  phases: PhaseGroup[];
  stats: ScheduleStats;
  overallProgressPct: number;
};

type LoaderInput = { session: SessionLike | null | undefined; projectId: string };

// ---- Loader -------------------------------------------------------------

// Returns the schedule view for the calling user's effective role. Visibility
// is filtered at the query level: contractors see everything, subs see their
// own org's items plus anything explicitly scoped to subcontractors or the
// whole project, and clients only see project-wide / client-visible rows.
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
    // OR: rows assigned to the caller's org, OR rows visible to all subs /
    // everyone on the project. Subcontractors never see internal_only /
    // client_visible rows.
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

  const rows = await db
    .select({
      id: milestones.id,
      title: milestones.title,
      description: milestones.description,
      milestoneType: milestones.milestoneType,
      milestoneStatus: milestones.milestoneStatus,
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
    );

  const milestoneRows: MilestoneRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    milestoneType: r.milestoneType as MilestoneType,
    milestoneStatus: r.milestoneStatus as MilestoneStatus,
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
    phases,
    stats,
    overallProgressPct,
  };
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

  // Order phases by their earliest scheduled date so "Preconstruction" sorts
  // before "Phase 1" without requiring any numeric parsing hack.
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

// ---- Countdown helpers (pure, used by UI) -------------------------------

export function daysUntil(date: Date, now: Date = new Date()): number {
  const ms = date.getTime() - now.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export type CountdownLabel = {
  text: string;
  tone: "overdue" | "soon" | "done" | "neutral";
};

export function countdownLabel(
  m: Pick<MilestoneRow, "milestoneStatus" | "scheduledDate" | "completedDate">,
  now: Date = new Date(),
): CountdownLabel {
  if (m.milestoneStatus === "completed") {
    const when = m.completedDate ?? m.scheduledDate;
    return { text: `Completed ${formatShortDate(when)}`, tone: "done" };
  }
  if (m.milestoneStatus === "cancelled") {
    return { text: "Cancelled", tone: "neutral" };
  }
  const days = daysUntil(m.scheduledDate, now);
  if (m.milestoneStatus === "missed" || days < 0) {
    const overdueDays = Math.abs(days);
    return {
      text:
        overdueDays === 0
          ? "Overdue today"
          : `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
      tone: "overdue",
    };
  }
  if (days <= 7) {
    return {
      text: days === 0 ? "Today" : `In ${days} day${days === 1 ? "" : "s"}`,
      tone: "soon",
    };
  }
  return { text: `In ${days} days`, tone: "neutral" };
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Residential language transform — softens construction-speak for the
// residential client timeline. Commercial clients keep the contractor terms.
const RESIDENTIAL_TYPE_LABELS: Record<MilestoneType, string> = {
  inspection: "Inspection",
  deadline: "Important Date",
  submission: "Submittal",
  walkthrough: "Site Visit",
  delivery: "Delivery",
  payment: "Payment",
  completion: "Milestone",
  custom: "Update",
};

export function residentialTypeLabel(t: MilestoneType): string {
  return RESIDENTIAL_TYPE_LABELS[t];
}
