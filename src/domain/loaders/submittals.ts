import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  documents,
  organizations,
  submittalDocuments,
  submittalTransmittals,
  submittals,
  users,
} from "@/db/schema";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import type {
  SubmittalDocumentRole,
  SubmittalStatus,
  SubmittalTransmittalDirection,
  SubmittalType,
} from "@/lib/submittals/config";
import { formatNumber } from "@/lib/submittals/config";
import { presignDownloadUrl } from "@/lib/storage";

// Role-aware submittal loaders. Two access tiers for Step 20:
//   - Contractor (admin/pm): sees all submittals on their projects.
//   - Subcontractor (user): sees only submittals their org submitted.
// Clients have no access in Step 20 (Phase 5+ may add a read-only
// commercial client view).

export type SubmittalListRow = {
  id: string;
  sequentialNumber: number;
  number: string; // formatted "S-001"
  specSection: string;
  title: string;
  submittalType: SubmittalType;
  submittedByOrgId: string;
  submittedByOrgName: string | null;
  routedToOrgId: string | null;
  routedToOrgName: string | null;
  reviewerName: string | null;
  reviewerOrg: string | null;
  reviewerEmail: string | null;
  status: SubmittalStatus;
  submittedAt: string | null;
  returnedAt: string | null;
  revisionOfId: string | null;
  revisionOfNumber: string | null;
  dueDate: string | null;
  createdByUserId: string;
  createdByName: string | null;
  rejectionReason: string | null;
  lastTransitionAt: string;
  createdAt: string;
  ageDays: number;
  documentCount: number;
  transmittalCount: number;
};

export type SubmittalDocumentRow = {
  id: string;
  documentId: string;
  role: SubmittalDocumentRole;
  sortOrder: number;
  title: string;
  url: string;
  fileSizeBytes: number | null;
  attachedAt: string;
  attachedByName: string | null;
};

export type SubmittalTransmittalRow = {
  id: string;
  direction: SubmittalTransmittalDirection;
  transmittedAt: string;
  transmittedByUserId: string;
  transmittedByName: string | null;
  documentId: string | null;
  documentTitle: string | null;
  documentUrl: string | null;
  notes: string | null;
};

export type SubmittalDetail = SubmittalListRow & {
  mode: "full";
  documents: SubmittalDocumentRow[];
  transmittals: SubmittalTransmittalRow[];
};

// -----------------------------------------------------------------
// getSubmittals — list view.
// -----------------------------------------------------------------

export type GetSubmittalsInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

export async function getSubmittals(
  input: GetSubmittalsInput,
): Promise<SubmittalListRow[]> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  const isContractor =
    ctx.role === "contractor_admin" || ctx.role === "contractor_pm";
  const isSub = ctx.role === "subcontractor_user";
  if (!isContractor && !isSub) {
    throw new AuthorizationError(
      "Only contractors and subcontractors use this loader",
      "forbidden",
    );
  }

  const whereParts = [eq(submittals.projectId, input.projectId)];
  if (isSub) {
    whereParts.push(eq(submittals.submittedByOrgId, ctx.organization.id));
  }

  const rows = await db
    .select({
      id: submittals.id,
      sequentialNumber: submittals.sequentialNumber,
      specSection: submittals.specSection,
      title: submittals.title,
      submittalType: submittals.submittalType,
      submittedByOrgId: submittals.submittedByOrgId,
      submittedByOrgName: organizations.name,
      routedToOrgId: submittals.routedToOrgId,
      reviewerName: submittals.reviewerName,
      reviewerOrg: submittals.reviewerOrg,
      reviewerEmail: submittals.reviewerEmail,
      status: submittals.status,
      submittedAt: submittals.submittedAt,
      returnedAt: submittals.returnedAt,
      revisionOfId: submittals.revisionOfId,
      dueDate: submittals.dueDate,
      createdByUserId: submittals.createdByUserId,
      rejectionReason: submittals.rejectionReason,
      lastTransitionAt: submittals.lastTransitionAt,
      createdAt: submittals.createdAt,
    })
    .from(submittals)
    .leftJoin(
      organizations,
      eq(organizations.id, submittals.submittedByOrgId),
    )
    .where(and(...whereParts))
    .orderBy(desc(submittals.lastTransitionAt));

  if (rows.length === 0) return [];

  // Batch lookups: routed-to org names, creator names, revision-of numbers,
  // doc counts, transmittal counts.
  const routedOrgIds = new Set<string>();
  const userIds = new Set<string>();
  const revisionOfIds = new Set<string>();
  for (const r of rows) {
    if (r.routedToOrgId) routedOrgIds.add(r.routedToOrgId);
    userIds.add(r.createdByUserId);
    if (r.revisionOfId) revisionOfIds.add(r.revisionOfId);
  }

  const [routedOrgs, userRows, revisionOfRows, docCounts, transCounts] =
    await Promise.all([
      routedOrgIds.size > 0
        ? db
            .select({ id: organizations.id, name: organizations.name })
            .from(organizations)
            .where(inArray(organizations.id, Array.from(routedOrgIds)))
        : Promise.resolve([] as { id: string; name: string }[]),
      db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, Array.from(userIds))),
      revisionOfIds.size > 0
        ? db
            .select({
              id: submittals.id,
              sequentialNumber: submittals.sequentialNumber,
            })
            .from(submittals)
            .where(inArray(submittals.id, Array.from(revisionOfIds)))
        : Promise.resolve([] as { id: string; sequentialNumber: number }[]),
      db
        .select({
          submittalId: submittalDocuments.submittalId,
          c: sql<number>`count(*)::int`,
        })
        .from(submittalDocuments)
        .where(
          inArray(
            submittalDocuments.submittalId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(submittalDocuments.submittalId),
      db
        .select({
          submittalId: submittalTransmittals.submittalId,
          c: sql<number>`count(*)::int`,
        })
        .from(submittalTransmittals)
        .where(
          inArray(
            submittalTransmittals.submittalId,
            rows.map((r) => r.id),
          ),
        )
        .groupBy(submittalTransmittals.submittalId),
    ]);

  const orgNameById = new Map(routedOrgs.map((o) => [o.id, o.name]));
  const userNameById = new Map(userRows.map((u) => [u.id, u.displayName]));
  const revisionNumberById = new Map(
    revisionOfRows.map((r) => [r.id, formatNumber(r.sequentialNumber)]),
  );
  const docCountById = new Map(docCounts.map((r) => [r.submittalId, r.c]));
  const transCountById = new Map(transCounts.map((r) => [r.submittalId, r.c]));

  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    sequentialNumber: r.sequentialNumber,
    number: formatNumber(r.sequentialNumber),
    specSection: r.specSection,
    title: r.title,
    submittalType: r.submittalType,
    submittedByOrgId: r.submittedByOrgId,
    submittedByOrgName: r.submittedByOrgName,
    routedToOrgId: r.routedToOrgId,
    routedToOrgName: r.routedToOrgId
      ? orgNameById.get(r.routedToOrgId) ?? null
      : null,
    reviewerName: r.reviewerName,
    reviewerOrg: r.reviewerOrg,
    reviewerEmail: r.reviewerEmail,
    status: r.status,
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    returnedAt: r.returnedAt ? r.returnedAt.toISOString() : null,
    revisionOfId: r.revisionOfId,
    revisionOfNumber: r.revisionOfId
      ? revisionNumberById.get(r.revisionOfId) ?? null
      : null,
    dueDate: r.dueDate,
    createdByUserId: r.createdByUserId,
    createdByName: userNameById.get(r.createdByUserId) ?? null,
    rejectionReason: r.rejectionReason,
    lastTransitionAt: r.lastTransitionAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    ageDays: Math.max(
      0,
      Math.floor((now.getTime() - r.createdAt.getTime()) / 86400000),
    ),
    documentCount: docCountById.get(r.id) ?? 0,
    transmittalCount: transCountById.get(r.id) ?? 0,
  }));
}

// -----------------------------------------------------------------
// getSubmittal — detail view with documents + transmittal timeline.
// -----------------------------------------------------------------

export type GetSubmittalInput = {
  session: SessionLike | null | undefined;
  submittalId: string;
};

export async function getSubmittal(
  input: GetSubmittalInput,
): Promise<SubmittalDetail> {
  const [head] = await db
    .select({ id: submittals.id, projectId: submittals.projectId })
    .from(submittals)
    .where(eq(submittals.id, input.submittalId))
    .limit(1);
  if (!head) {
    throw new AuthorizationError("Submittal not found", "not_found");
  }

  const list = await getSubmittals({
    session: input.session,
    projectId: head.projectId,
  });
  const row = list.find((r) => r.id === input.submittalId);
  if (!row) {
    // getSubmittals filters by role — if the row isn't here the actor
    // doesn't have access.
    throw new AuthorizationError("Not accessible", "forbidden");
  }

  const [docs, transmittals] = await Promise.all([
    queryDocuments(input.submittalId),
    queryTransmittals(input.submittalId),
  ]);

  return { ...row, mode: "full", documents: docs, transmittals };
}

// -----------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------

async function queryDocuments(
  submittalId: string,
): Promise<SubmittalDocumentRow[]> {
  const rows = await db
    .select({
      id: submittalDocuments.id,
      documentId: submittalDocuments.documentId,
      role: submittalDocuments.role,
      sortOrder: submittalDocuments.sortOrder,
      attachedByUserId: submittalDocuments.attachedByUserId,
      attachedByName: users.displayName,
      createdAt: submittalDocuments.createdAt,
      title: documents.title,
      storageKey: documents.storageKey,
      fileSizeBytes: documents.fileSizeBytes,
    })
    .from(submittalDocuments)
    .innerJoin(documents, eq(documents.id, submittalDocuments.documentId))
    .leftJoin(users, eq(users.id, submittalDocuments.attachedByUserId))
    .where(eq(submittalDocuments.submittalId, submittalId))
    .orderBy(asc(submittalDocuments.sortOrder), asc(submittalDocuments.createdAt));

  const urls = await Promise.all(
    rows.map((r) =>
      presignDownloadUrl({ key: r.storageKey, expiresInSeconds: 600 }).catch(
        () => "",
      ),
    ),
  );
  return rows.map((r, i) => ({
    id: r.id,
    documentId: r.documentId,
    role: r.role,
    sortOrder: r.sortOrder,
    title: r.title,
    url: urls[i],
    fileSizeBytes: r.fileSizeBytes,
    attachedAt: r.createdAt.toISOString(),
    attachedByName: r.attachedByName,
  }));
}

async function queryTransmittals(
  submittalId: string,
): Promise<SubmittalTransmittalRow[]> {
  const rows = await db
    .select({
      id: submittalTransmittals.id,
      direction: submittalTransmittals.direction,
      transmittedAt: submittalTransmittals.transmittedAt,
      transmittedByUserId: submittalTransmittals.transmittedByUserId,
      transmittedByName: users.displayName,
      documentId: submittalTransmittals.documentId,
      notes: submittalTransmittals.notes,
      docTitle: documents.title,
      docStorageKey: documents.storageKey,
    })
    .from(submittalTransmittals)
    .leftJoin(users, eq(users.id, submittalTransmittals.transmittedByUserId))
    .leftJoin(documents, eq(documents.id, submittalTransmittals.documentId))
    .where(eq(submittalTransmittals.submittalId, submittalId))
    .orderBy(asc(submittalTransmittals.transmittedAt));

  const urls = await Promise.all(
    rows.map((r) =>
      r.docStorageKey
        ? presignDownloadUrl({
            key: r.docStorageKey,
            expiresInSeconds: 600,
          }).catch(() => "")
        : Promise.resolve(null),
    ),
  );

  return rows.map((r, i) => ({
    id: r.id,
    direction: r.direction,
    transmittedAt: r.transmittedAt.toISOString(),
    transmittedByUserId: r.transmittedByUserId,
    transmittedByName: r.transmittedByName,
    documentId: r.documentId,
    documentTitle: r.docTitle,
    documentUrl: urls[i],
    notes: r.notes,
  }));
}
