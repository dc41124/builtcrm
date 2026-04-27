import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  complianceRecords,
  conversationParticipants,
  conversations,
  documents,
  messages,
  projectOrganizationMemberships,
  projects,
  rfis,
  uploadRequests,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getSubPendingFinancialsCents } from "./financial";

export type SubTodayKpis = {
  activeProjects: number;
  openRfis: number;
  overdueRfis: number;
  openUploadRequests: number;
  uploadRequestsDueToday: number;
  complianceIssues: number;
  complianceLabel: string | null;
};

export type SubTodayProject = {
  id: string;
  name: string;
  phaseLabel: string;
  pillLabel: string;
  pillColor: "green" | "amber" | "red" | "gray";
  description: string;
};

export type SubTodayAttention = {
  id: string;
  kind: "rfi" | "upload" | "compliance";
  title: string;
  description: string;
  projectId: string;
  projectName: string;
  pillLabel: string;
  pillColor: "red" | "amber" | "blue" | "green" | "gray";
  urgent: boolean;
  href: string;
};

export type SubTodayCompliance = {
  id: string;
  label: string;
  detail: string;
  statusLabel: string;
  statusColor: "red" | "amber" | "green" | "gray";
};

export type SubTodayQuickAccessCounts = {
  unreadMessages: number;
  documentCount: number;
  pendingFinancialsCents: number;
};

export type SubTodayDocument = {
  id: string;
  title: string;
  documentType: string;
  projectId: string;
  projectName: string;
  uploaderName: string | null;
  createdAt: string;
};

export type SubTodayConversation = {
  id: string;
  title: string | null;
  projectId: string;
  projectName: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type SubTodayCurrentFocus = {
  projectId: string;
  name: string;
  description: string;
} | null;

export type SubTodayData = {
  kpis: SubTodayKpis;
  projectList: SubTodayProject[];
  attention: SubTodayAttention[];
  compliance: SubTodayCompliance[];
  recentDocuments: SubTodayDocument[];
  recentConversations: SubTodayConversation[];
  quickAccessCounts: SubTodayQuickAccessCounts;
  currentFocus: SubTodayCurrentFocus;
};

const OPEN_RFI_STATUSES = ["open", "pending_response"] as const;
const OPEN_UPLOAD_STATUSES = ["open", "revision_requested"] as const;

function phaseLabel(phase: string): string {
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
    default:
      return phase;
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export async function getSubcontractorTodayData(input: {
  subOrganizationId: string;
  userId?: string | null;
}): Promise<SubTodayData> {
  const subOrgId = input.subOrganizationId;
  const userId = input.userId ?? null;
  const now = new Date();

  const memberProjects = await withTenant(subOrgId, (tx) =>
    tx
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.projectStatus,
        phase: projects.currentPhase,
      })
      .from(projectOrganizationMemberships)
      .innerJoin(projects, eq(projects.id, projectOrganizationMemberships.projectId))
      .where(
        and(
          eq(projectOrganizationMemberships.organizationId, subOrgId),
          eq(projectOrganizationMemberships.membershipStatus, "active"),
        ),
      ),
  );

  const activeProjects = memberProjects.filter((p) => p.status === "active");
  const projectIds = activeProjects.map((p) => p.id);
  const projectNameById = new Map(activeProjects.map((p) => [p.id, p.name]));

  if (projectIds.length === 0) {
    // A sub with no *active* memberships may still have pending waivers
    // from historical projects (membership became inactive while a draw
    // was still in flight). Cross-project helper covers that case
    // correctly.
    const pendingFinancialsCents = await getSubPendingFinancialsCents({
      subOrgId,
    });
    return {
      kpis: {
        activeProjects: 0,
        openRfis: 0,
        overdueRfis: 0,
        openUploadRequests: 0,
        uploadRequestsDueToday: 0,
        complianceIssues: 0,
        complianceLabel: null,
      },
      projectList: [],
      attention: [],
      compliance: [],
      quickAccessCounts: {
        unreadMessages: 0,
        documentCount: 0,
        pendingFinancialsCents,
      },
      recentDocuments: [],
      recentConversations: [],
      currentFocus: null,
    };
  }

  const [rfiRows, uploadRows, complianceRows] = await Promise.all([
    withTenant(subOrgId, (tx) =>
      tx
        .select({
          id: rfis.id,
          projectId: rfis.projectId,
          subject: rfis.subject,
          body: rfis.body,
          status: rfis.rfiStatus,
          dueAt: rfis.dueAt,
          sequentialNumber: rfis.sequentialNumber,
        })
        .from(rfis)
        .where(
          and(
            inArray(rfis.projectId, projectIds),
            eq(rfis.assignedToOrganizationId, subOrgId),
            inArray(rfis.rfiStatus, [...OPEN_RFI_STATUSES]),
          ),
        )
        .orderBy(desc(rfis.createdAt)),
    ),
    withTenant(subOrgId, (tx) =>
      tx
        .select({
          id: uploadRequests.id,
          projectId: uploadRequests.projectId,
          title: uploadRequests.title,
          description: uploadRequests.description,
          status: uploadRequests.requestStatus,
          dueAt: uploadRequests.dueAt,
          revisionNote: uploadRequests.revisionNote,
        })
        .from(uploadRequests)
        .where(
          and(
            inArray(uploadRequests.projectId, projectIds),
            eq(uploadRequests.requestedFromOrganizationId, subOrgId),
            inArray(uploadRequests.requestStatus, [...OPEN_UPLOAD_STATUSES]),
          ),
        )
        .orderBy(desc(uploadRequests.createdAt)),
    ),
    // Sub viewing own compliance — multi-org policy clause A
    // (organization_id = GUC) satisfies.
    withTenant(subOrgId, (tx) =>
      tx
        .select({
          id: complianceRecords.id,
          projectId: complianceRecords.projectId,
          complianceType: complianceRecords.complianceType,
          complianceStatus: complianceRecords.complianceStatus,
          expiresAt: complianceRecords.expiresAt,
        })
        .from(complianceRecords)
        .where(eq(complianceRecords.organizationId, subOrgId))
        .orderBy(desc(complianceRecords.createdAt)),
    ),
  ]);

  // KPIs
  const overdueRfis = rfiRows.filter(
    (r) => r.dueAt && r.dueAt.getTime() < now.getTime(),
  ).length;
  const uploadDueToday = uploadRows.filter(
    (u) => u.dueAt && isSameDay(u.dueAt, now),
  ).length;
  const complianceIssues = complianceRows.filter(
    (c) =>
      c.complianceStatus === "expired" ||
      c.complianceStatus === "rejected" ||
      (c.expiresAt && c.expiresAt.getTime() - now.getTime() < 7 * 86400_000),
  ).length;

  const firstIssue = complianceRows.find(
    (c) =>
      c.complianceStatus === "expired" ||
      c.complianceStatus === "rejected" ||
      (c.expiresAt && c.expiresAt.getTime() - now.getTime() < 7 * 86400_000),
  );
  const complianceLabel = firstIssue
    ? firstIssue.complianceStatus === "expired"
      ? `${firstIssue.complianceType} expired`
      : firstIssue.complianceStatus === "rejected"
        ? `${firstIssue.complianceType} rejected`
        : `${firstIssue.complianceType} expiring soon`
    : null;

  const kpis: SubTodayKpis = {
    activeProjects: activeProjects.length,
    openRfis: rfiRows.length,
    overdueRfis,
    openUploadRequests: uploadRows.length,
    uploadRequestsDueToday: uploadDueToday,
    complianceIssues,
    complianceLabel,
  };

  // Attention list
  const attention: SubTodayAttention[] = [];

  for (const u of uploadRows) {
    const projectName = projectNameById.get(u.projectId) ?? "Project";
    const dueToday = u.dueAt ? isSameDay(u.dueAt, now) : false;
    const overdue = u.dueAt ? u.dueAt.getTime() < now.getTime() && !dueToday : false;
    attention.push({
      id: `upload-${u.id}`,
      kind: "upload",
      title: u.title,
      description:
        u.status === "revision_requested"
          ? (u.revisionNote ?? "GC requested revision — re-upload required.")
          : (u.description ?? "GC requested upload."),
      projectId: u.projectId,
      projectName,
      pillLabel: overdue ? "Overdue" : dueToday ? "Due today" : "Open",
      pillColor: overdue ? "red" : dueToday ? "amber" : "blue",
      urgent: overdue || dueToday,
      href: `/subcontractor/project/${u.projectId}/upload-requests`,
    });
  }

  for (const r of rfiRows) {
    const projectName = projectNameById.get(r.projectId) ?? "Project";
    const overdue = r.dueAt ? r.dueAt.getTime() < now.getTime() : false;
    attention.push({
      id: `rfi-${r.id}`,
      kind: "rfi",
      title: `RFI-${String(r.sequentialNumber).padStart(3, "0")} — ${r.subject}`,
      description: r.body?.slice(0, 140) ?? "Response needed from your team.",
      projectId: r.projectId,
      projectName,
      pillLabel: overdue ? "Overdue" : "Needs reply",
      pillColor: overdue ? "red" : "amber",
      urgent: overdue,
      href: `/subcontractor/project/${r.projectId}/rfis`,
    });
  }

  if (firstIssue && firstIssue.projectId) {
    const projectName = projectNameById.get(firstIssue.projectId) ?? "Compliance";
    attention.push({
      id: `compliance-${firstIssue.id}`,
      kind: "compliance",
      title: `${firstIssue.complianceType} — action required`,
      description: complianceLabel ?? "Compliance record needs attention.",
      projectId: firstIssue.projectId,
      projectName,
      pillLabel: firstIssue.complianceStatus === "expired" ? "Expired" : "Due",
      pillColor: "red",
      urgent: true,
      href: `/subcontractor/project/${firstIssue.projectId}/compliance`,
    });
  }

  attention.sort((a, b) => Number(b.urgent) - Number(a.urgent));

  // Project list
  const rfiByProject = new Map<string, number>();
  for (const r of rfiRows) {
    rfiByProject.set(r.projectId, (rfiByProject.get(r.projectId) ?? 0) + 1);
  }
  const uploadByProject = new Map<string, number>();
  for (const u of uploadRows) {
    uploadByProject.set(u.projectId, (uploadByProject.get(u.projectId) ?? 0) + 1);
  }

  const projectList: SubTodayProject[] = activeProjects.map((p) => {
    const rfiCount = rfiByProject.get(p.id) ?? 0;
    const uploadCount = uploadByProject.get(p.id) ?? 0;
    const blockers = rfiCount + uploadCount;
    const pillColor: SubTodayProject["pillColor"] =
      blockers === 0 ? "green" : blockers > 2 ? "red" : "amber";
    const pillLabel =
      blockers === 0
        ? "On track"
        : `${blockers} ${blockers === 1 ? "item" : "items"}`;
    const description =
      blockers === 0
        ? "No open requests or RFIs."
        : `${uploadCount} upload ${uploadCount === 1 ? "request" : "requests"}, ${rfiCount} ${rfiCount === 1 ? "RFI" : "RFIs"}.`;
    return {
      id: p.id,
      name: p.name,
      phaseLabel: phaseLabel(p.phase),
      pillLabel,
      pillColor,
      description,
    };
  });

  // Compliance panel rows
  const compliance: SubTodayCompliance[] = complianceRows.slice(0, 6).map((c) => {
    const expiring =
      c.expiresAt && c.expiresAt.getTime() - now.getTime() < 7 * 86400_000;
    const expired = c.complianceStatus === "expired";
    const rejected = c.complianceStatus === "rejected";
    const statusColor: SubTodayCompliance["statusColor"] = expired || rejected
      ? "red"
      : expiring
        ? "amber"
        : c.complianceStatus === "active"
          ? "green"
          : "gray";
    const statusLabel = expired
      ? "Expired"
      : rejected
        ? "Rejected"
        : expiring
          ? "Expiring"
          : c.complianceStatus === "active"
            ? "Active"
            : c.complianceStatus === "waived"
              ? "Waived"
              : "Pending";
    const detail = c.expiresAt
      ? `${expired ? "Expired" : "Expires"} ${c.expiresAt.toISOString().slice(0, 10)}`
      : "No expiry on file";
    return {
      id: c.id,
      label: c.complianceType,
      detail,
      statusLabel,
      statusColor,
    };
  });

  // Quick access counts (cross-project)
  const [docCountRow, unreadRows] = await Promise.all([
    withTenant(subOrgId, (tx) =>
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(documents)
        .where(inArray(documents.projectId, projectIds)),
    ),
    userId
      ? db
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(messages)
          .innerJoin(conversations, eq(conversations.id, messages.conversationId))
          .innerJoin(
            conversationParticipants,
            and(
              eq(conversationParticipants.conversationId, conversations.id),
              eq(conversationParticipants.userId, userId),
            ),
          )
          .where(
            and(
              inArray(conversations.projectId, projectIds),
              sql`${messages.createdAt} > COALESCE(${conversationParticipants.lastReadAt}, '1970-01-01'::timestamptz)`,
              sql`${messages.senderUserId} <> ${userId}`,
            ),
          )
      : Promise.resolve([{ count: 0 }]),
  ]);

  // Cross-project sum: sum lien-waiver amounts for this sub across every
  // project whose parent draw is in submitted/under_review.
  const pendingFinancialsCents = await getSubPendingFinancialsCents({
    subOrgId,
  });

  const quickAccessCounts: SubTodayQuickAccessCounts = {
    unreadMessages: unreadRows[0]?.count ?? 0,
    documentCount: docCountRow[0]?.count ?? 0,
    pendingFinancialsCents,
  };

  // Recent documents across projects
  const recentDocRows = projectIds.length > 0
    ? await withTenant(subOrgId, (tx) =>
        tx
          .select({
            id: documents.id,
            title: documents.title,
            documentType: documents.documentType,
            projectId: documents.projectId,
            projectName: projects.name,
            uploaderName: users.displayName,
            createdAt: documents.createdAt,
          })
          .from(documents)
          .leftJoin(projects, eq(projects.id, documents.projectId))
          .leftJoin(users, eq(users.id, documents.uploadedByUserId))
          .where(inArray(documents.projectId, projectIds))
          .orderBy(desc(documents.createdAt))
          .limit(12),
      )
    : [];
  const recentDocuments: SubTodayDocument[] = recentDocRows.map((d) => ({
    id: d.id,
    title: d.title,
    documentType: d.documentType,
    projectId: d.projectId,
    projectName: d.projectName ?? "Unknown",
    uploaderName: d.uploaderName,
    createdAt: d.createdAt.toISOString(),
  }));

  // Recent conversations across projects
  const recentConvRows = projectIds.length > 0 && userId
    ? await db
        .select({
          id: conversations.id,
          title: conversations.title,
          projectId: conversations.projectId,
          projectName: projects.name,
          lastMessagePreview: conversations.lastMessagePreview,
          lastMessageAt: conversations.lastMessageAt,
          lastReadAt: conversationParticipants.lastReadAt,
          messageCount: conversations.messageCount,
        })
        .from(conversations)
        .innerJoin(
          conversationParticipants,
          and(
            eq(conversationParticipants.conversationId, conversations.id),
            eq(conversationParticipants.userId, userId),
          ),
        )
        .leftJoin(projects, eq(projects.id, conversations.projectId))
        .where(inArray(conversations.projectId, projectIds))
        .orderBy(desc(conversations.lastMessageAt))
        .limit(12)
    : [];
  const recentConversations: SubTodayConversation[] = recentConvRows.map((c) => {
    const unread = c.lastMessageAt && (!c.lastReadAt || c.lastReadAt.getTime() < c.lastMessageAt.getTime())
      ? 1 : 0;
    return {
      id: c.id,
      title: c.title,
      projectId: c.projectId,
      projectName: c.projectName ?? "Unknown",
      lastMessagePreview: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      unreadCount: unread,
    };
  });

  // Current focus: project with the most urgent attention items
  const urgentByProject = new Map<string, number>();
  for (const a of attention) {
    if (!a.urgent) continue;
    urgentByProject.set(a.projectId, (urgentByProject.get(a.projectId) ?? 0) + 1);
  }
  const focusEntry =
    [...urgentByProject.entries()].sort((a, b) => b[1] - a[1])[0] ??
    (projectList[0] ? ([projectList[0].id, 0] as const) : null);
  const currentFocus: SubTodayCurrentFocus = focusEntry
    ? (() => {
        const proj = projectList.find((p) => p.id === focusEntry[0]);
        if (!proj) return null;
        const urgentCount = focusEntry[1];
        const description =
          urgentCount > 0
            ? `${urgentCount} of today's urgent item${urgentCount === 1 ? " is" : "s are"} on this project.`
            : proj.description;
        return { projectId: proj.id, name: proj.name, description };
      })()
    : null;

  return {
    kpis,
    projectList,
    attention,
    compliance,
    recentDocuments,
    recentConversations,
    quickAccessCounts,
    currentFocus,
  };
}
