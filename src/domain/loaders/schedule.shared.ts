// schedule.shared.ts
// ------------------------------------------------------------------
// Types, const arrays, and pure helpers used by both the server-side
// loader (schedule.ts) and the "use client" UI (schedule-ui.tsx).
//
// This file has ZERO server dependencies — no db, no auth, no context.
// Safe to import from client components.
// ------------------------------------------------------------------

import type { EffectiveContext } from "../context";

// ---- Const value arrays (used in forms / selects) -------------------

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

export const MILESTONE_KIND_VALUES = ["marker", "task"] as const;
export type MilestoneKind = (typeof MILESTONE_KIND_VALUES)[number];

export const MILESTONE_VISIBILITY_VALUES = [
  "internal_only",
  "client_visible",
  "subcontractor_scoped",
  "project_wide",
  "phase_scoped",
  "scope_scoped",
] as const;
export type MilestoneVisibility = (typeof MILESTONE_VISIBILITY_VALUES)[number];

// ---- Domain types ---------------------------------------------------

export type MilestoneRow = {
  id: string;
  title: string;
  description: string | null;
  milestoneType: MilestoneType;
  milestoneStatus: MilestoneStatus;
  kind: MilestoneKind;
  // startDate is non-null iff kind === 'task' — the DB CHECK enforces this.
  startDate: Date | null;
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

// Directed edge in the dependency graph. Step 23 addition.
export type MilestoneDependency = {
  predecessorId: string;
  successorId: string;
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
  // Step 23: directed dep edges scoped to the returned milestones.
  // Loaded alongside for Gantt tab + critical-path computation.
  dependencies: MilestoneDependency[];
  phases: PhaseGroup[];
  stats: ScheduleStats;
  overallProgressPct: number;
};

// ---- Pure helpers (countdown / formatting) --------------------------

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
