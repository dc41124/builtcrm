import { and, asc, desc, eq, gte, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  activityFeedItems,
  approvals,
  complianceRecords,
  conversations,
  drawRequests,
  milestones,
  projects,
  rfis,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";

export type ContractorDashboardKpis = {
  activeProjects: number;
  projectsInConstruction: number;
  projectsInPrecon: number;
  openRfis: number;
  overdueRfis: number;
  pendingApprovals: number;
  approvalsOverdue: number;
  drawsInReview: number;
  openPaymentCents: number;
  complianceAlerts: number;
  complianceAlertLabel: string | null;
};

export type ContractorDashboardPriority = {
  id: string;
  title: string;
  description: string;
  pillLabel: string;
  pillColor: "red" | "amber" | "blue" | "purple" | "gray" | "green";
  time: string;
  urgent: boolean;
  href: string;
};

export type ContractorDashboardProjectHealth = {
  id: string;
  name: string;
  phaseLabel: string;
  description: string;
  pillLabel: string;
  pillColor: "green" | "amber" | "red" | "gray";
  barColor: "green" | "amber" | "blue" | "gray";
  pct: number;
};

export type ContractorDashboardUpcoming = {
  id: string;
  title: string;
  detail: string;
  day: string;
  month: string;
};

export type ContractorDashboardActivity = {
  id: string;
  title: string;
  detail: string;
  actor: string;
  time: string;
  dot: "ok" | "wr" | "dg" | "ac" | "in";
};

export type ContractorDashboardFinancialHealth = {
  totalContractCents: number;
  paidCents: number;
  unpaidCents: number;
  retainageCents: number;
  remainingCents: number;
};

export type ContractorDashboardApprovalWaiting = {
  id: string;
  title: string;
  description: string;
  pillLabel: string;
  pillColor: "red" | "amber" | "blue" | "purple" | "gray" | "green";
  href: string;
};

export type ContractorDashboardMessage = {
  id: string;
  from: string;
  text: string;
  time: string;
  href: string;
};

export type ContractorDashboardData = {
  kpis: ContractorDashboardKpis;
  priorities: ContractorDashboardPriority[];
  approvalsAsPriorities: ContractorDashboardPriority[];
  projectHealth: ContractorDashboardProjectHealth[];
  upcoming: ContractorDashboardUpcoming[];
  activity: ContractorDashboardActivity[];
  financialHealth: ContractorDashboardFinancialHealth;
  approvalsWaiting: ContractorDashboardApprovalWaiting[];
  recentMessages: ContractorDashboardMessage[];
};

type LoaderInput = { contractorOrganizationId: string };

const OPEN_RFI_STATUSES = ["open", "pending_response"] as const;
const COMPLIANCE_ALERT_STATUSES = ["expired", "rejected"] as const;

export async function getContractorDashboardData(
  input: LoaderInput,
): Promise<ContractorDashboardData> {
  const orgId = input.contractorOrganizationId;

  const orgProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.projectStatus,
      phase: projects.currentPhase,
      startDate: projects.startDate,
      targetCompletionDate: projects.targetCompletionDate,
      contractValueCents: projects.contractValueCents,
    })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));

  const projectIds = orgProjects.map((p) => p.id);
  const activeProjects = orgProjects.filter((p) => p.status === "active");
  const projectsInConstruction = activeProjects.filter(
    (p) => p.phase !== "preconstruction" && p.phase !== "closeout",
  ).length;
  const projectsInPrecon = activeProjects.filter(
    (p) => p.phase === "preconstruction",
  ).length;

  if (projectIds.length === 0) {
    return {
      kpis: {
        activeProjects: 0,
        projectsInConstruction: 0,
        projectsInPrecon: 0,
        openRfis: 0,
        overdueRfis: 0,
        pendingApprovals: 0,
        approvalsOverdue: 0,
        drawsInReview: 0,
        openPaymentCents: 0,
        complianceAlerts: 0,
        complianceAlertLabel: null,
      },
      priorities: [],
      approvalsAsPriorities: [],
      projectHealth: [],
      upcoming: [],
      activity: [],
      financialHealth: {
        totalContractCents: 0,
        paidCents: 0,
        unpaidCents: 0,
        retainageCents: 0,
        remainingCents: 0,
      },
      approvalsWaiting: [],
      recentMessages: [],
    };
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const [rfiAgg] = await db
    .select({
      open: sql<number>`count(*) filter (where ${rfis.rfiStatus} in ('open','pending_response'))::int`,
      overdue: sql<number>`count(*) filter (where ${rfis.rfiStatus} in ('open','pending_response') and ${rfis.dueAt} < now())::int`,
    })
    .from(rfis)
    .where(inArray(rfis.projectId, projectIds));

  const [approvalAgg] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${approvals.approvalStatus} in ('pending_review','needs_revision'))::int`,
    })
    .from(approvals)
    .where(inArray(approvals.projectId, projectIds));

  const [drawAgg] = await db
    .select({
      inReview: sql<number>`count(*) filter (where ${drawRequests.drawRequestStatus} in ('ready_for_review','submitted','under_review','returned','revised'))::int`,
      openPaymentCents: sql<number>`coalesce(sum(${drawRequests.currentPaymentDueCents}) filter (where ${drawRequests.drawRequestStatus} in ('approved','approved_with_note','submitted','under_review')), 0)::int`,
    })
    .from(drawRequests)
    .where(inArray(drawRequests.projectId, projectIds));

  // Project-scoped read on contractor's projects — multi-org policy
  // clause B (project ownership) returns sub records too.
  const complianceRows = await withTenant(orgId, (tx) =>
    tx
      .select({
        id: complianceRecords.id,
        status: complianceRecords.complianceStatus,
        expiresAt: complianceRecords.expiresAt,
        recordType: complianceRecords.complianceType,
      })
      .from(complianceRecords)
      .where(
        and(
          inArray(complianceRecords.projectId, projectIds),
          or(
            inArray(complianceRecords.complianceStatus, [
              ...COMPLIANCE_ALERT_STATUSES,
            ]),
            and(
              isNotNull(complianceRecords.expiresAt),
              lt(complianceRecords.expiresAt, soon),
            ),
          ),
        ),
      ),
  );

  const complianceAlertLabel = (() => {
    const expiring = complianceRows.find(
      (r) => r.expiresAt && r.expiresAt < soon && r.status !== "waived",
    );
    if (expiring) {
      const expiresAt = expiring.expiresAt as Date;
      const days = Math.round((expiresAt.getTime() - now.getTime()) / 86400000);
      const when =
        days <= 0 ? "expiring today" : days === 1 ? "expires tomorrow" : `expires in ${days}d`;
      return `${expiring.recordType ?? "Certificate"} ${when}`;
    }
    const rejected = complianceRows.find((r) => r.status === "rejected");
    if (rejected) return `${rejected.recordType ?? "Record"} rejected`;
    return null;
  })();

  const kpis: ContractorDashboardKpis = {
    activeProjects: activeProjects.length,
    projectsInConstruction,
    projectsInPrecon,
    openRfis: Number(rfiAgg?.open ?? 0),
    overdueRfis: Number(rfiAgg?.overdue ?? 0),
    pendingApprovals: Number(approvalAgg?.pending ?? 0),
    approvalsOverdue: 0,
    drawsInReview: Number(drawAgg?.inReview ?? 0),
    openPaymentCents: Number(drawAgg?.openPaymentCents ?? 0),
    complianceAlerts: complianceRows.length,
    complianceAlertLabel,
  };

  const priorityRfis = await db
    .select({
      id: rfis.id,
      subject: rfis.subject,
      sequentialNumber: rfis.sequentialNumber,
      status: rfis.rfiStatus,
      dueAt: rfis.dueAt,
      projectId: rfis.projectId,
      projectName: projects.name,
    })
    .from(rfis)
    .innerJoin(projects, eq(projects.id, rfis.projectId))
    .where(
      and(
        eq(projects.contractorOrganizationId, orgId),
        inArray(rfis.rfiStatus, [...OPEN_RFI_STATUSES]),
      ),
    )
    .orderBy(asc(rfis.dueAt))
    .limit(4);

  const priorities: ContractorDashboardPriority[] = priorityRfis.map((r) => {
    const overdue = r.dueAt && r.dueAt < now;
    const days = r.dueAt
      ? Math.round((r.dueAt.getTime() - now.getTime()) / 86400000)
      : null;
    return {
      id: r.id,
      title: `RFI-${String(r.sequentialNumber).padStart(3, "0")} — ${r.subject}`,
      description: `${r.projectName} · RFI awaiting response`,
      pillLabel: overdue ? "Overdue" : "Open",
      pillColor: overdue ? "red" : "amber",
      time:
        days === null
          ? "No due date"
          : overdue
            ? `${Math.abs(days)}d overdue`
            : days === 0
              ? "Due today"
              : `Due in ${days}d`,
      urgent: !!overdue,
      href: `/contractor/project/${r.projectId}/rfis`,
    };
  });

  const projectHealth: ContractorDashboardProjectHealth[] = orgProjects
    .filter((p) => p.status === "active" || p.status === "draft")
    .slice(0, 6)
    .map((p) => {
      const pct = computeProgressPct(p.startDate, p.targetCompletionDate, now);
      const phaseLabel = phaseToLabel(p.phase);
      return {
        id: p.id,
        name: p.name,
        phaseLabel,
        description: `${phaseLabel} — ${p.status === "active" ? "Active" : "Draft"}`,
        pillLabel: p.status === "active" ? "On track" : "Draft",
        pillColor: p.status === "active" ? "green" : "gray",
        barColor: p.status === "active" ? "green" : "gray",
        pct,
      };
    });

  const milestoneRows = await db
    .select({
      id: milestones.id,
      title: milestones.title,
      description: milestones.description,
      scheduledDate: milestones.scheduledDate,
      projectName: projects.name,
    })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(
      and(
        eq(projects.contractorOrganizationId, orgId),
        gte(milestones.scheduledDate, now),
        eq(milestones.milestoneStatus, "scheduled"),
      ),
    )
    .orderBy(milestones.scheduledDate)
    .limit(4);

  const upcoming: ContractorDashboardUpcoming[] = milestoneRows.map((m) => ({
    id: m.id,
    title: m.title,
    detail: `${m.projectName}${m.description ? ` · ${m.description}` : ""}`,
    day: m.scheduledDate.getDate().toString().padStart(2, "0"),
    month: m.scheduledDate
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase(),
  }));

  const activityRows = await db
    .select({
      id: activityFeedItems.id,
      title: activityFeedItems.title,
      body: activityFeedItems.body,
      type: activityFeedItems.activityType,
      createdAt: activityFeedItems.createdAt,
      actorName: users.displayName,
    })
    .from(activityFeedItems)
    .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
    .innerJoin(projects, eq(projects.id, activityFeedItems.projectId))
    .where(eq(projects.contractorOrganizationId, orgId))
    .orderBy(desc(activityFeedItems.createdAt))
    .limit(6);

  const activity: ContractorDashboardActivity[] = activityRows.map((a) => ({
    id: a.id,
    title: a.title,
    detail: a.body ?? "",
    actor: a.actorName ?? "System",
    time: formatRelative(a.createdAt, now),
    dot: activityDot(a.type),
  }));

  // ---- Financial health strip ----------------------------------------------
  const totalContractCents = orgProjects.reduce(
    (sum, p) => sum + (p.contractValueCents ?? 0),
    0,
  );
  const [finAgg] = await db
    .select({
      paid: sql<number>`coalesce(sum(${drawRequests.currentPaymentDueCents}) filter (where ${drawRequests.paidAt} is not null), 0)::bigint`,
      unpaid: sql<number>`coalesce(sum(${drawRequests.currentPaymentDueCents}) filter (where ${drawRequests.paidAt} is null and ${drawRequests.drawRequestStatus} in ('submitted','under_review','approved','approved_with_note')), 0)::bigint`,
      retainage: sql<number>`coalesce(sum(${drawRequests.totalRetainageCents} - ${drawRequests.retainageReleasedCents}), 0)::bigint`,
    })
    .from(drawRequests)
    .where(inArray(drawRequests.projectId, projectIds));

  const paidCents = Number(finAgg?.paid ?? 0);
  const unpaidCents = Number(finAgg?.unpaid ?? 0);
  const retainageCents = Number(finAgg?.retainage ?? 0);
  const remainingCents = Math.max(
    0,
    totalContractCents - paidCents - unpaidCents - retainageCents,
  );
  const financialHealth: ContractorDashboardFinancialHealth = {
    totalContractCents,
    paidCents,
    unpaidCents,
    retainageCents,
    remainingCents,
  };

  // ---- Approvals waiting + approvals priorities tab ------------------------
  const approvalRows = await db
    .select({
      id: approvals.id,
      title: approvals.title,
      description: approvals.description,
      status: approvals.approvalStatus,
      projectId: approvals.projectId,
      projectName: projects.name,
      submittedAt: approvals.submittedAt,
    })
    .from(approvals)
    .innerJoin(projects, eq(projects.id, approvals.projectId))
    .where(
      and(
        eq(projects.contractorOrganizationId, orgId),
        inArray(approvals.approvalStatus, [
          "pending_review",
          "needs_revision",
        ]),
      ),
    )
    .orderBy(asc(approvals.submittedAt))
    .limit(6);

  const approvalsWaiting: ContractorDashboardApprovalWaiting[] = approvalRows
    .slice(0, 4)
    .map((a) => {
      const { label, color } = approvalPill(a.status);
      return {
        id: a.id,
        title: a.title,
        description: a.description
          ? `${a.projectName} · ${truncate(a.description, 80)}`
          : `${a.projectName} · Awaiting decision`,
        pillLabel: label,
        pillColor: color,
        href: `/contractor/project/${a.projectId}/approvals`,
      };
    });

  const approvalsAsPriorities: ContractorDashboardPriority[] = approvalRows.map(
    (a) => {
      const { label, color } = approvalPill(a.status);
      const ageDays = a.submittedAt
        ? Math.max(
            0,
            Math.round((now.getTime() - a.submittedAt.getTime()) / 86400000),
          )
        : null;
      return {
        id: a.id,
        title: a.title,
        description: a.description
          ? `${a.projectName} · ${truncate(a.description, 100)}`
          : `${a.projectName} · Awaiting decision`,
        pillLabel: label,
        pillColor: color,
        time: ageDays === null ? "Just submitted" : `${ageDays}d open`,
        urgent: a.status === "needs_revision",
        href: `/contractor/project/${a.projectId}/approvals`,
      };
    },
  );

  // ---- Recent messages -----------------------------------------------------
  const conversationRows = await db
    .select({
      id: conversations.id,
      projectId: conversations.projectId,
      title: conversations.title,
      preview: conversations.lastMessagePreview,
      lastAt: conversations.lastMessageAt,
      projectName: projects.name,
    })
    .from(conversations)
    .innerJoin(projects, eq(projects.id, conversations.projectId))
    .where(
      and(
        eq(projects.contractorOrganizationId, orgId),
        isNotNull(conversations.lastMessageAt),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(3);

  const recentMessages: ContractorDashboardMessage[] = conversationRows.map(
    (c) => ({
      id: c.id,
      from: c.title ?? c.projectName,
      text: c.preview ?? "(no preview)",
      time: c.lastAt ? formatRelative(c.lastAt, now) : "",
      href: `/contractor/project/${c.projectId}/messages`,
    }),
  );

  return {
    kpis,
    priorities,
    approvalsAsPriorities,
    projectHealth,
    upcoming,
    activity,
    financialHealth,
    approvalsWaiting,
    recentMessages,
  };
}

function approvalPill(
  status: "draft" | "pending_review" | "needs_revision" | "approved" | "rejected",
): { label: string; color: ContractorDashboardPriority["pillColor"] } {
  switch (status) {
    case "needs_revision":
      return { label: "Needs revision", color: "red" };
    case "pending_review":
      return { label: "In review", color: "amber" };
    default:
      return { label: "Open", color: "gray" };
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function phaseToLabel(
  phase: "preconstruction" | "phase_1" | "phase_2" | "phase_3" | "closeout",
): string {
  switch (phase) {
    case "preconstruction":
      return "Precon";
    case "phase_1":
      return "Phase 1";
    case "phase_2":
      return "Phase 2";
    case "phase_3":
      return "Phase 3";
    case "closeout":
      return "Closeout";
  }
}

function computeProgressPct(
  start: Date | null,
  end: Date | null,
  now: Date,
): number {
  if (!start || !end) return 0;
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  const pct = Math.round(((now.getTime() - start.getTime()) / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

function activityDot(
  type:
    | "project_update"
    | "milestone_update"
    | "approval_requested"
    | "approval_completed"
    | "file_uploaded"
    | "selection_ready"
    | "payment_update"
    | "comment_added",
): ContractorDashboardActivity["dot"] {
  switch (type) {
    case "approval_completed":
    case "payment_update":
      return "ok";
    case "approval_requested":
      return "ac";
    case "file_uploaded":
    case "comment_added":
    case "selection_ready":
      return "in";
    case "milestone_update":
      return "wr";
    default:
      return "in";
  }
}

function formatRelative(then: Date, now: Date): string {
  const diffMs = now.getTime() - then.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

void OPEN_RFI_STATUSES;
void COMPLIANCE_ALERT_STATUSES;
