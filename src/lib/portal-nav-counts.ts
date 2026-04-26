import {
  and,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db/client";
import { withTenant } from "@/db/with-tenant";
import {
  approvals,
  changeOrders,
  complianceRecords,
  conversationParticipants,
  conversations,
  drawRequests,
  rfis,
  selectionItems,
  uploadRequests,
} from "@/db/schema";

import type { PortalType } from "@/components/shell/AppShell";

export type NavCounts = Record<string, number>;

export type NavCountsInput = {
  portalType: PortalType;
  userId: string;
  orgId: string;
  /** Every project the caller has access to — used for cross-project scoping. */
  projectIds: string[];
  /**
   * The current project the caller is inside, if any. Only client portals
   * (commercial + residential) use this — their nav is project-scoped, so
   * counts only make sense against a single project.
   */
  activeProjectId?: string;
};

// Return an empty map when the portal has nothing useful to count (e.g.
// contractor in project mode, or client viewing the portal root). The
// layouts render badges only for keys with count > 0, so {} means no badges.
export async function getPortalNavCounts(
  input: NavCountsInput,
): Promise<NavCounts> {
  const { portalType, userId, orgId, projectIds, activeProjectId } = input;

  // Contractor + subcontractor badges attach to their *global* nav items.
  // Inside a project, the sidebar shows project-scoped items that would
  // disagree with cross-project aggregate counts — return {} so no stale
  // badges render.
  if (portalType === "contractor") {
    if (activeProjectId || projectIds.length === 0) return {};
    return contractorGlobalCounts({ userId, orgId, projectIds });
  }
  if (portalType === "subcontractor") {
    if (activeProjectId || projectIds.length === 0) return {};
    return subcontractorGlobalCounts({ userId, orgId, projectIds });
  }

  // Client portals are project-scoped: nothing to show until the user
  // opens a project.
  if (!activeProjectId) return {};
  return clientProjectCounts({
    userId,
    orgId,
    portalType,
    projectId: activeProjectId,
  });
}

// ─── Contractor ────────────────────────────────────────────────────────────

async function contractorGlobalCounts({
  userId,
  orgId,
  projectIds,
}: {
  userId: string;
  orgId: string;
  projectIds: string[];
}): Promise<NavCounts> {
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

  const [
    openRfis,
    pendingApprovals,
    pendingCOs,
    complianceAlerts,
    drawsInReview,
    openUploads,
    unreadMessages,
  ] = await Promise.all([
    countOf(
      withTenant(orgId, (tx) =>
        tx
          .select({ c: COUNT })
          .from(rfis)
          .where(
            and(
              inArray(rfis.projectId, projectIds),
              inArray(rfis.rfiStatus, ["open", "pending_response"]),
            ),
          ),
      ),
    ),
    countOf(
      db
        .select({ c: COUNT })
        .from(approvals)
        .where(
          and(
            inArray(approvals.projectId, projectIds),
            eq(approvals.approvalStatus, "pending_review"),
          ),
        ),
    ),
    countOf(
      withTenant(orgId, (tx) =>
        tx
          .select({ c: COUNT })
          .from(changeOrders)
          .where(
            and(
              inArray(changeOrders.projectId, projectIds),
              inArray(changeOrders.changeOrderStatus, [
                "pending_review",
                "pending_client_approval",
              ]),
            ),
          ),
      ),
    ),
    // Contractor compliance count — multi-org policy clause B
    // (project ownership) returns sub records too.
    countOf(
      withTenant(orgId, (tx) =>
        tx
          .select({ c: COUNT })
          .from(complianceRecords)
          .where(
            and(
              inArray(complianceRecords.projectId, projectIds),
              eq(complianceRecords.complianceStatus, "active"),
              lte(complianceRecords.expiresAt, thirtyDaysOut),
            ),
          ),
      ),
    ),
    countOf(
      db
        .select({ c: COUNT })
        .from(drawRequests)
        .where(
          and(
            inArray(drawRequests.projectId, projectIds),
            inArray(drawRequests.drawRequestStatus, [
              "submitted",
              "under_review",
            ]),
          ),
        ),
    ),
    countOf(
      db
        .select({ c: COUNT })
        .from(uploadRequests)
        .where(
          and(
            inArray(uploadRequests.projectId, projectIds),
            inArray(uploadRequests.requestStatus, [
              "open",
              "revision_requested",
              "submitted",
            ]),
          ),
        ),
    ),
    countUnreadMessages(userId, projectIds),
  ]);

  return stripZeros({
    "/contractor/rfis": openRfis,
    // The approvals queue is the contractor's single combined inbox —
    // general approvals + any CO currently in review. Change Orders nav
    // intentionally does not get its own badge (would double-count).
    "/contractor/approvals": pendingApprovals + pendingCOs,
    "/contractor/compliance": complianceAlerts,
    "/contractor/billing": drawsInReview,
    "/contractor/upload-requests": openUploads,
    "/contractor/messages": unreadMessages,
  });
}

// ─── Subcontractor ─────────────────────────────────────────────────────────

async function subcontractorGlobalCounts({
  userId,
  orgId,
  projectIds,
}: {
  userId: string;
  orgId: string;
  projectIds: string[];
}): Promise<NavCounts> {
  const [rfisAwaiting, openUploads, complianceToDo, unreadMessages] =
    await Promise.all([
      countOf(
        withTenant(orgId, (tx) =>
          tx
            .select({ c: COUNT })
            .from(rfis)
            .where(
              and(
                eq(rfis.assignedToOrganizationId, orgId),
                eq(rfis.rfiStatus, "pending_response"),
              ),
            ),
        ),
      ),
      countOf(
        db
          .select({ c: COUNT })
          .from(uploadRequests)
          .where(
            and(
              eq(uploadRequests.requestedFromOrganizationId, orgId),
              inArray(uploadRequests.requestStatus, [
                "open",
                "revision_requested",
              ]),
            ),
          ),
      ),
      // Sub compliance count — own org records, multi-org policy
      // clause A satisfies.
      countOf(
        withTenant(orgId, (tx) =>
          tx
            .select({ c: COUNT })
            .from(complianceRecords)
            .where(
              and(
                eq(complianceRecords.organizationId, orgId),
                eq(complianceRecords.complianceStatus, "pending"),
              ),
            ),
        ),
      ),
      countUnreadMessages(userId, projectIds),
    ]);

  return stripZeros({
    "/subcontractor/rfis": rfisAwaiting,
    "/subcontractor/upload-requests": openUploads,
    "/subcontractor/compliance": complianceToDo,
    "/subcontractor/messages": unreadMessages,
  });
}

// ─── Client (commercial + residential) ─────────────────────────────────────

async function clientProjectCounts({
  userId,
  orgId,
  portalType,
  projectId,
}: {
  userId: string;
  orgId: string;
  portalType: "commercial" | "residential";
  projectId: string;
}): Promise<NavCounts> {
  const isResidential = portalType === "residential";
  const base = `/${portalType}/project/${projectId}`;

  const [
    pendingApprovals,
    pendingCOs,
    pendingSelections,
    drawsInReview,
    unreadMessages,
  ] = await Promise.all([
    countOf(
      db
        .select({ c: COUNT })
        .from(approvals)
        .where(
          and(
            eq(approvals.projectId, projectId),
            eq(approvals.approvalStatus, "pending_review"),
          ),
        ),
    ),
    countOf(
      withTenant(orgId, (tx) =>
        tx
          .select({ c: COUNT })
          .from(changeOrders)
          .where(
            and(
              eq(changeOrders.projectId, projectId),
              eq(changeOrders.changeOrderStatus, "pending_client_approval"),
            ),
          ),
      ),
    ),
    // Selections only appear in the residential portal; skip the query
    // entirely for commercial to save a roundtrip.
    isResidential
      ? countOf(
          db
            .select({ c: COUNT })
            .from(selectionItems)
            .where(
              and(
                eq(selectionItems.projectId, projectId),
                eq(selectionItems.selectionItemStatus, "provisional"),
              ),
            ),
        )
      : Promise.resolve(0),
    countOf(
      db
        .select({ c: COUNT })
        .from(drawRequests)
        .where(
          and(
            eq(drawRequests.projectId, projectId),
            inArray(drawRequests.drawRequestStatus, [
              "submitted",
              "under_review",
            ]),
          ),
        ),
    ),
    countUnreadMessages(userId, [projectId]),
  ]);

  const decisionTotal = pendingApprovals + pendingCOs;

  if (isResidential) {
    // Residential uses different nav labels — "Decisions" instead of
    // "Approvals", plus a Selections item for design choices.
    return stripZeros({
      [`${base}/decisions`]: decisionTotal,
      [`${base}/selections`]: pendingSelections,
      [`${base}/billing`]: drawsInReview,
      [`${base}/messages`]: unreadMessages,
    });
  }

  return stripZeros({
    [`${base}/approvals`]: decisionTotal,
    [`${base}/billing`]: drawsInReview,
    [`${base}/messages`]: unreadMessages,
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Postgres returns count(*) as a bigint — ::int narrows it to a JS number
// we can add/compare safely. All count queries in this file share this
// projection, aliased as `c` (for "count") to keep the result rows tiny.
const COUNT = sql<number>`count(*)::int`;

async function countOf(
  query: Promise<Array<{ c: number }>>,
): Promise<number> {
  const rows = await query;
  return rows[0]?.c ?? 0;
}

async function countUnreadMessages(
  userId: string,
  projectIds: string[],
): Promise<number> {
  if (projectIds.length === 0) return 0;
  const rows = await db
    .select({ c: COUNT })
    .from(conversationParticipants)
    .innerJoin(
      conversations,
      eq(conversations.id, conversationParticipants.conversationId),
    )
    .where(
      and(
        eq(conversationParticipants.userId, userId),
        inArray(conversations.projectId, projectIds),
        isNotNull(conversations.lastMessageAt),
        or(
          isNull(conversationParticipants.lastReadAt),
          sql`${conversations.lastMessageAt} > ${conversationParticipants.lastReadAt}`,
        ),
      ),
    );
  return rows[0]?.c ?? 0;
}

function stripZeros(counts: NavCounts): NavCounts {
  const out: NavCounts = {};
  for (const [k, v] of Object.entries(counts)) {
    if (v > 0) out[k] = v;
  }
  return out;
}
