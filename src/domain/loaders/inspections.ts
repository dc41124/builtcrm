import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  type InspectionLineItemDef,
  inspectionResultPhotos,
  inspectionResults,
  inspectionTemplates,
  inspections,
  organizations,
  punchItems,
  users,
} from "@/db/schema";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// Shared derived status for a single line item — present in the snapshot
// but with an optional matched result. Used by the detail + walkthrough UIs.
export type InspectionOutcome = "pass" | "fail" | "conditional" | "na";

export type InspectionStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

// -----------------------------------------------------------------------------
// Common row shapes
// -----------------------------------------------------------------------------

export type InspectionListRow = {
  id: string;
  sequentialNumber: number;
  numberLabel: string; // INS-0001
  templateId: string;
  templateName: string;
  templateTradeCategory: string;
  templatePhase: "rough" | "final";
  zone: string;
  status: InspectionStatus;
  assignedOrgId: string | null;
  assignedOrgName: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  scheduledDate: string | null;
  completedAt: string | null;
  notes: string | null;
  itemCount: number;
  recordedCount: number;
  passCount: number;
  failCount: number;
  conditionalCount: number;
  naCount: number;
  passRate: number | null; // null when nothing recorded or all N/A
  punchCount: number;
  createdAt: string;
};

export type InspectionLineItemRow = InspectionLineItemDef & {
  result: {
    id: string;
    outcome: InspectionOutcome;
    notes: string | null;
    recordedByUserId: string | null;
    recordedAt: string;
    photoCount: number;
    linkedPunchId: string | null;
    linkedPunchLabel: string | null; // PI-0034
  } | null;
};

export type InspectionDetail = InspectionListRow & {
  project: { id: string; name: string };
  lineItems: InspectionLineItemRow[];
  linkedPunches: Array<{
    id: string;
    sequentialNumber: number;
    label: string;
    title: string;
    status: string;
    priority: string;
    assigneeOrgName: string | null;
    dueDate: string | null;
  }>;
  timeline: Array<{
    kind: "created" | "assigned" | "started" | "completed" | "punch_created";
    when: string;
    actorName: string | null;
    body: string;
    targetLabel?: string | null;
  }>;
  canEdit: boolean;
  canComplete: boolean;
};

export type InspectionTemplateRow = {
  id: string;
  name: string;
  tradeCategory: string;
  phase: "rough" | "final";
  description: string | null;
  isCustom: boolean;
  isArchived: boolean;
  itemCount: number;
  timesUsed: number;
  lastUsedAt: string | null;
  updatedAt: string;
  createdByUserId: string | null;
  lineItems: InspectionLineItemDef[];
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function padInspectionNumber(n: number): string {
  return `INS-${String(n).padStart(4, "0")}`;
}

export function padPunchNumber(n: number): string {
  return `PI-${String(n).padStart(3, "0")}`;
}

function computePassRate(counts: {
  pass: number;
  fail: number;
  conditional: number;
}): number | null {
  const denom = counts.pass + counts.fail + counts.conditional;
  if (denom === 0) return null;
  return Math.round((counts.pass / denom) * 100);
}

// -----------------------------------------------------------------------------
// getInspections — list view for contractor or sub.
//
// Contractor sees every inspection on the project. Sub sees only the ones
// assigned to their org. Clients get no access in V1 (residential walk-
// throughs live in the punch list; QA/QC inspections are internal).
// -----------------------------------------------------------------------------

export type GetInspectionsInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

export async function getInspections(
  input: GetInspectionsInput,
): Promise<{ rows: InspectionListRow[]; viewerRole: "contractor" | "subcontractor" }> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  const isContractor =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const isSub = ctx.role === "subcontractor_user";
  if (!isContractor && !isSub) {
    throw new AuthorizationError(
      "Inspections are contractor + subcontractor only in Phase 4+",
      "forbidden",
    );
  }

  const where = isSub
    ? and(
        eq(inspections.projectId, input.projectId),
        eq(inspections.assignedOrgId, ctx.organization.id),
      )
    : eq(inspections.projectId, input.projectId);

  const rows = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select({
        id: inspections.id,
        sequentialNumber: inspections.sequentialNumber,
        templateId: inspections.templateId,
        templateName: inspectionTemplates.name,
        templateTradeCategory: inspectionTemplates.tradeCategory,
        templatePhase: inspectionTemplates.phase,
        templateSnapshotJson: inspections.templateSnapshotJson,
        zone: inspections.zone,
        status: inspections.status,
        assignedOrgId: inspections.assignedOrgId,
        assignedOrgName: organizations.name,
        assignedUserId: inspections.assignedUserId,
        scheduledDate: inspections.scheduledDate,
        completedAt: inspections.completedAt,
        notes: inspections.notes,
        createdAt: inspections.createdAt,
      })
      .from(inspections)
      .innerJoin(
        inspectionTemplates,
        eq(inspectionTemplates.id, inspections.templateId),
      )
      .leftJoin(
        organizations,
        eq(organizations.id, inspections.assignedOrgId),
      )
      .where(where)
      .orderBy(desc(inspections.createdAt)),
  );

  if (rows.length === 0) {
    return { rows: [], viewerRole: isSub ? "subcontractor" : "contractor" };
  }

  const insIds = rows.map((r) => r.id);

  // Assigned user display names.
  const userIds = Array.from(
    new Set(
      rows
        .map((r) => r.assignedUserId)
        .filter((v): v is string => !!v),
    ),
  );
  const userNameById = new Map<string, string | null>();
  if (userIds.length) {
    const userRows = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const u of userRows) userNameById.set(u.id, u.displayName);
  }

  // Outcome counts per inspection.
  const outcomeRows = await db
    .select({
      inspectionId: inspectionResults.inspectionId,
      outcome: inspectionResults.outcome,
      c: sql<number>`count(*)::int`,
    })
    .from(inspectionResults)
    .where(inArray(inspectionResults.inspectionId, insIds))
    .groupBy(inspectionResults.inspectionId, inspectionResults.outcome);
  const countsBy = new Map<
    string,
    { pass: number; fail: number; conditional: number; na: number }
  >();
  for (const id of insIds) {
    countsBy.set(id, { pass: 0, fail: 0, conditional: 0, na: 0 });
  }
  for (const o of outcomeRows) {
    const bucket = countsBy.get(o.inspectionId)!;
    if (o.outcome === "pass") bucket.pass = o.c;
    else if (o.outcome === "fail") bucket.fail = o.c;
    else if (o.outcome === "conditional") bucket.conditional = o.c;
    else if (o.outcome === "na") bucket.na = o.c;
  }

  // Punch count per inspection (auto-spawned).
  const punchRows = await db
    .select({
      inspectionId: punchItems.sourceInspectionId,
      c: sql<number>`count(*)::int`,
    })
    .from(punchItems)
    .where(inArray(punchItems.sourceInspectionId, insIds))
    .groupBy(punchItems.sourceInspectionId);
  const punchBy = new Map<string, number>();
  for (const p of punchRows) {
    if (p.inspectionId) punchBy.set(p.inspectionId, p.c);
  }

  return {
    viewerRole: isSub ? "subcontractor" : "contractor",
    rows: rows.map((r) => {
      const snapshot = (r.templateSnapshotJson as InspectionLineItemDef[]) ?? [];
      const counts = countsBy.get(r.id) ?? { pass: 0, fail: 0, conditional: 0, na: 0 };
      const recordedCount = counts.pass + counts.fail + counts.conditional + counts.na;
      return {
        id: r.id,
        sequentialNumber: r.sequentialNumber,
        numberLabel: padInspectionNumber(r.sequentialNumber),
        templateId: r.templateId,
        templateName: r.templateName,
        templateTradeCategory: r.templateTradeCategory,
        templatePhase: r.templatePhase,
        zone: r.zone,
        status: r.status,
        assignedOrgId: r.assignedOrgId,
        assignedOrgName: r.assignedOrgName,
        assignedUserId: r.assignedUserId,
        assignedUserName: r.assignedUserId
          ? userNameById.get(r.assignedUserId) ?? null
          : null,
        scheduledDate: r.scheduledDate,
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        notes: r.notes,
        itemCount: snapshot.length,
        recordedCount,
        passCount: counts.pass,
        failCount: counts.fail,
        conditionalCount: counts.conditional,
        naCount: counts.na,
        passRate:
          r.status === "completed"
            ? computePassRate({
                pass: counts.pass,
                fail: counts.fail,
                conditional: counts.conditional,
              })
            : null,
        punchCount: punchBy.get(r.id) ?? 0,
        createdAt: r.createdAt.toISOString(),
      };
    }),
  };
}

// -----------------------------------------------------------------------------
// getInspection — single-inspection detail view.
// -----------------------------------------------------------------------------

export type GetInspectionInput = {
  session: SessionLike | null | undefined;
  inspectionId: string;
};

export async function getInspection(
  input: GetInspectionInput,
): Promise<InspectionDetail> {
  // Pre-tenant: inspection id only — admin pool head lookup, then ctx.
  const [head] = await dbAdmin
    .select({
      id: inspections.id,
      projectId: inspections.projectId,
      assignedOrgId: inspections.assignedOrgId,
    })
    .from(inspections)
    .where(eq(inspections.id, input.inspectionId))
    .limit(1);
  if (!head) {
    throw new AuthorizationError("Inspection not found", "not_found");
  }

  const ctx = await getEffectiveContext(input.session, head.projectId);
  const isContractor =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const isSub = ctx.role === "subcontractor_user";
  if (!isContractor && !isSub) {
    throw new AuthorizationError(
      "Inspections are contractor + subcontractor only in Phase 4+",
      "forbidden",
    );
  }
  if (isSub && head.assignedOrgId !== ctx.organization.id) {
    throw new AuthorizationError(
      "Not assigned to your organization",
      "forbidden",
    );
  }

  const { rows } = await getInspections({
    session: input.session,
    projectId: head.projectId,
  });
  const row = rows.find((r) => r.id === input.inspectionId);
  if (!row) {
    throw new AuthorizationError("Inspection not found", "not_found");
  }

  // Fetch the full inspection row for the snapshot (the list loader doesn't
  // surface it) and the project name.
  const [full] = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select({
        id: inspections.id,
        projectId: inspections.projectId,
        templateSnapshotJson: inspections.templateSnapshotJson,
      })
      .from(inspections)
      .where(eq(inspections.id, input.inspectionId))
      .limit(1),
  );
  const snapshot = (full?.templateSnapshotJson as InspectionLineItemDef[]) ?? [];

  // All results for this inspection.
  const resultRows = await db
    .select({
      id: inspectionResults.id,
      lineItemKey: inspectionResults.lineItemKey,
      outcome: inspectionResults.outcome,
      notes: inspectionResults.notes,
      recordedByUserId: inspectionResults.recordedByUserId,
      recordedAt: inspectionResults.recordedAt,
    })
    .from(inspectionResults)
    .where(eq(inspectionResults.inspectionId, input.inspectionId));
  const resultsByKey = new Map(resultRows.map((r) => [r.lineItemKey, r]));

  // Photo counts per result.
  const resultIds = resultRows.map((r) => r.id);
  const photoCountBy = new Map<string, number>();
  if (resultIds.length) {
    const phRows = await db
      .select({
        resultId: inspectionResultPhotos.inspectionResultId,
        c: sql<number>`count(*)::int`,
      })
      .from(inspectionResultPhotos)
      .where(inArray(inspectionResultPhotos.inspectionResultId, resultIds))
      .groupBy(inspectionResultPhotos.inspectionResultId);
    for (const r of phRows) photoCountBy.set(r.resultId, r.c);
  }

  // Punch items spawned from this inspection, keyed by source result id so
  // each line item can show its linked PI-#### pill.
  const punchRows = await db
    .select({
      id: punchItems.id,
      sequentialNumber: punchItems.sequentialNumber,
      title: punchItems.title,
      status: punchItems.status,
      priority: punchItems.priority,
      assigneeOrgId: punchItems.assigneeOrgId,
      assigneeOrgName: organizations.name,
      dueDate: punchItems.dueDate,
      sourceResultId: punchItems.sourceInspectionResultId,
    })
    .from(punchItems)
    .leftJoin(
      organizations,
      eq(organizations.id, punchItems.assigneeOrgId),
    )
    .where(eq(punchItems.sourceInspectionId, input.inspectionId))
    .orderBy(desc(punchItems.createdAt));
  const punchByResultId = new Map<
    string,
    { id: string; sequentialNumber: number }
  >();
  for (const p of punchRows) {
    if (p.sourceResultId)
      punchByResultId.set(p.sourceResultId, {
        id: p.id,
        sequentialNumber: p.sequentialNumber,
      });
  }

  // Project name for the crumb.
  const [projRow] = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select({ id: inspections.projectId })
      .from(inspections)
      .where(eq(inspections.id, input.inspectionId))
      .limit(1),
  );

  // Compose line items in snapshot order with their result (if any).
  const lineItems: InspectionLineItemRow[] = [...snapshot]
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((li) => {
      const res = resultsByKey.get(li.key) ?? null;
      const linkedPunch = res ? punchByResultId.get(res.id) ?? null : null;
      return {
        ...li,
        result: res
          ? {
              id: res.id,
              outcome: res.outcome as InspectionOutcome,
              notes: res.notes,
              recordedByUserId: res.recordedByUserId,
              recordedAt: res.recordedAt.toISOString(),
              photoCount: photoCountBy.get(res.id) ?? 0,
              linkedPunchId: linkedPunch?.id ?? null,
              linkedPunchLabel: linkedPunch
                ? padPunchNumber(linkedPunch.sequentialNumber)
                : null,
            }
          : null,
      };
    });

  // Timeline: created → (completed) → punch create bursts.
  const timeline: InspectionDetail["timeline"] = [];
  timeline.push({
    kind: "created",
    when: row.createdAt,
    actorName: null,
    body: `Inspection created from ${row.templateName} template`,
  });
  if (row.status === "in_progress" || row.status === "completed") {
    timeline.push({
      kind: "started",
      when: row.createdAt,
      actorName: row.assignedUserName,
      body: `${row.assignedUserName ?? "Assignee"} started inspection`,
    });
  }
  if (row.status === "completed" && row.completedAt) {
    timeline.push({
      kind: "completed",
      when: row.completedAt,
      actorName: row.assignedUserName,
      body: `${row.assignedUserName ?? "Assignee"} completed inspection`,
    });
    if (punchRows.length > 0) {
      timeline.push({
        kind: "punch_created",
        when: row.completedAt,
        actorName: null,
        body: `System auto-created ${punchRows.length} punch item${punchRows.length === 1 ? "" : "s"}`,
        targetLabel: punchRows
          .map((p) => padPunchNumber(p.sequentialNumber))
          .join(", "),
      });
    }
  }

  // Both contractor and the assigned sub can edit scheduled + in_progress
  // inspections. Recording the first result transitions scheduled →
  // in_progress server-side (see /api/inspection-results), so the sub
  // flow of "open a scheduled inspection and start checking items"
  // works without requiring a contractor round-trip to flip status.
  const canEdit = row.status !== "completed" && row.status !== "cancelled";
  const canComplete =
    row.status !== "completed" && row.status !== "cancelled";

  return {
    ...row,
    project: {
      id: projRow?.id ?? head.projectId,
      name: ctx.project.name,
    },
    lineItems,
    linkedPunches: punchRows.map((p) => ({
      id: p.id,
      sequentialNumber: p.sequentialNumber,
      label: padPunchNumber(p.sequentialNumber),
      title: p.title,
      status: p.status,
      priority: p.priority,
      assigneeOrgName: p.assigneeOrgName,
      dueDate: p.dueDate,
    })),
    timeline,
    canEdit,
    canComplete,
  };
}

// -----------------------------------------------------------------------------
// getInspectionTemplates — org-scoped template library.
// -----------------------------------------------------------------------------

export type GetInspectionTemplatesInput = {
  session: SessionLike | null | undefined;
  projectId?: string;
};

export async function getInspectionTemplates(
  input: GetInspectionTemplatesInput,
): Promise<InspectionTemplateRow[]> {
  if (!input.session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }

  // Template library is org-scoped, not project-scoped. We still require
  // the session owner to be a contractor-side user. When called with a
  // projectId we use getEffectiveContext to pin the org; when called
  // without (/contractor/settings), we derive the org from the user's
  // contractor role assignment.
  let orgId: string;
  if (input.projectId) {
    const ctx = await getEffectiveContext(input.session, input.projectId);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors manage inspection templates",
        "forbidden",
      );
    }
    orgId = ctx.organization.id;
  } else {
    // Pull the user's contractor org assignment directly.
    const [row] = await db
      .select({ organizationId: users.id })
      .from(users)
      .where(eq(users.id, input.session.appUserId))
      .limit(1);
    if (!row) throw new AuthorizationError("User not found", "unauthenticated");
    // Pre-tenant role lookup — RLS-enabled role_assignments needs admin pool.
    const [ra] = await dbAdmin.execute(
      sql`select organization_id as "organizationId"
          from role_assignments
          where user_id = ${input.session.appUserId}
            and portal_type = 'contractor'
          limit 1`,
    );
    if (!ra) {
      throw new AuthorizationError(
        "Only contractors manage inspection templates",
        "forbidden",
      );
    }
    orgId = (ra as { organizationId: string }).organizationId;
  }

  const tplRows = await db
    .select({
      id: inspectionTemplates.id,
      name: inspectionTemplates.name,
      tradeCategory: inspectionTemplates.tradeCategory,
      phase: inspectionTemplates.phase,
      description: inspectionTemplates.description,
      isCustom: inspectionTemplates.isCustom,
      isArchived: inspectionTemplates.isArchived,
      lineItemsJson: inspectionTemplates.lineItemsJson,
      createdByUserId: inspectionTemplates.createdByUserId,
      updatedAt: inspectionTemplates.updatedAt,
    })
    .from(inspectionTemplates)
    .where(eq(inspectionTemplates.orgId, orgId))
    .orderBy(inspectionTemplates.name);

  if (tplRows.length === 0) return [];

  // Usage counts.
  const tplIds = tplRows.map((t) => t.id);
  const usageRows = await withTenant(orgId, (tx) =>
    tx
      .select({
        templateId: inspections.templateId,
        c: sql<number>`count(*)::int`,
        lastUsed: sql<Date | null>`max(${inspections.createdAt})`,
      })
      .from(inspections)
      .where(inArray(inspections.templateId, tplIds))
      .groupBy(inspections.templateId),
  );
  const usageBy = new Map(
    usageRows.map((u) => [u.templateId, { c: u.c, lastUsed: u.lastUsed }]),
  );

  return tplRows.map((t) => {
    const items = (t.lineItemsJson as InspectionLineItemDef[]) ?? [];
    const usage = usageBy.get(t.id);
    return {
      id: t.id,
      name: t.name,
      tradeCategory: t.tradeCategory,
      phase: t.phase,
      description: t.description,
      isCustom: t.isCustom,
      isArchived: t.isArchived,
      itemCount: items.length,
      timesUsed: usage?.c ?? 0,
      lastUsedAt: usage?.lastUsed ? new Date(usage.lastUsed).toISOString() : null,
      updatedAt: t.updatedAt.toISOString(),
      createdByUserId: t.createdByUserId,
      lineItems: items,
    };
  });
}

// -----------------------------------------------------------------------------
// getInspectionTemplate — single template detail for CRUD view.
// -----------------------------------------------------------------------------

export async function getInspectionTemplate(input: {
  session: SessionLike | null | undefined;
  templateId: string;
}): Promise<InspectionTemplateRow> {
  if (!input.session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  const [t] = await db
    .select({
      id: inspectionTemplates.id,
      orgId: inspectionTemplates.orgId,
      name: inspectionTemplates.name,
      tradeCategory: inspectionTemplates.tradeCategory,
      phase: inspectionTemplates.phase,
      description: inspectionTemplates.description,
      isCustom: inspectionTemplates.isCustom,
      isArchived: inspectionTemplates.isArchived,
      lineItemsJson: inspectionTemplates.lineItemsJson,
      createdByUserId: inspectionTemplates.createdByUserId,
      updatedAt: inspectionTemplates.updatedAt,
    })
    .from(inspectionTemplates)
    .where(eq(inspectionTemplates.id, input.templateId))
    .limit(1);
  if (!t) {
    throw new AuthorizationError("Template not found", "not_found");
  }

  // Verify the viewer is a contractor in the template's org.
  // Pre-tenant role lookup — admin pool.
  const [ra] = await dbAdmin.execute(
    sql`select organization_id as "organizationId"
        from role_assignments
        where user_id = ${input.session.appUserId}
          and organization_id = ${t.orgId}
          and portal_type = 'contractor'
        limit 1`,
  );
  if (!ra) {
    throw new AuthorizationError(
      "Only contractors in the owning org manage this template",
      "forbidden",
    );
  }

  // Usage. Caller is verified-contractor in t.orgId — wrap in withTenant
  // for RLS on inspections.
  const [usage] = await withTenant(t.orgId, (tx) =>
    tx
      .select({
        c: sql<number>`count(*)::int`,
        lastUsed: sql<Date | null>`max(${inspections.createdAt})`,
      })
      .from(inspections)
      .where(eq(inspections.templateId, t.id)),
  );

  const items = (t.lineItemsJson as InspectionLineItemDef[]) ?? [];
  return {
    id: t.id,
    name: t.name,
    tradeCategory: t.tradeCategory,
    phase: t.phase,
    description: t.description,
    isCustom: t.isCustom,
    isArchived: t.isArchived,
    itemCount: items.length,
    timesUsed: usage?.c ?? 0,
    lastUsedAt: usage?.lastUsed ? new Date(usage.lastUsed).toISOString() : null,
    updatedAt: t.updatedAt.toISOString(),
    createdByUserId: t.createdByUserId,
    lineItems: items,
  };
}
