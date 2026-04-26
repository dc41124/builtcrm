import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { db } from "@/db/client";
import {
  activityFeedItems,
  documents,
  organizations,
  transmittalAccessEvents,
  transmittalDocuments,
  transmittalRecipients,
  transmittals,
  projects,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";
import { getEffectiveContext, type SessionLike } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// -----------------------------------------------------------------------------
// Shared types
// -----------------------------------------------------------------------------

export type TransmittalStatus = "draft" | "sent";

export type TransmittalListRow = {
  id: string;
  numberLabel: string; // "TM-0007" or "DRAFT"
  sequentialNumber: number | null;
  subject: string;
  message: string;
  status: TransmittalStatus;
  sentAt: string | null;
  sentByUserId: string | null;
  sentByName: string | null;
  sentByOrgName: string | null;
  createdAt: string;
  updatedAt: string;
  recipientCount: number;
  downloadedCount: number;
  pendingCount: number;
  totalDownloads: number;
  docCount: number;
  totalSizeBytes: number;
};

export type TransmittalRecipientRow = {
  id: string;
  email: string;
  name: string;
  orgLabel: string | null;
  // Derived: "downloaded" | "pending" | "revoked" for the UI.
  status: "downloaded" | "pending" | "revoked";
  firstDownloadedAt: string | null;
  lastDownloadedAt: string | null;
  totalDownloads: number;
  revokedAt: string | null;
  expiresAt: string | null;
};

export type TransmittalDocumentRow = {
  id: string;
  documentId: string;
  name: string;
  sizeBytes: number;
  category: string | null;
  sortOrder: number;
};

export type TransmittalAccessEventRow = {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  orgLabel: string | null;
  downloadedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export type TransmittalDetail = TransmittalListRow & {
  project: { id: string; name: string };
  recipients: TransmittalRecipientRow[];
  documents: TransmittalDocumentRow[];
  accessEvents: TransmittalAccessEventRow[];
  canEdit: boolean; // only drafts
  canSend: boolean; // draft with >= 1 recipient + >= 1 doc + subject
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function padTransmittalNumber(n: number | null): string {
  if (n === null) return "DRAFT";
  return `TM-${String(n).padStart(4, "0")}`;
}

function recipientDerivedStatus(row: {
  revokedAt: Date | null;
  firstDownloadedAt: Date | null;
}): "downloaded" | "pending" | "revoked" {
  if (row.revokedAt) return "revoked";
  if (row.firstDownloadedAt) return "downloaded";
  return "pending";
}

// -----------------------------------------------------------------------------
// getTransmittals — list view for the workspace.
//
// Contractor-only. Subs/clients have no visibility into the outbox;
// they'd receive the share URL via email and use the anonymous path.
// -----------------------------------------------------------------------------

export async function getTransmittals(input: {
  session: SessionLike | null | undefined;
  projectId: string;
}): Promise<{ rows: TransmittalListRow[] }> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Transmittals are contractor-only",
      "forbidden",
    );
  }

  const { contractorOrg, base, recipientAgg, documentAgg } = await withTenant(
    ctx.organization.id,
    async (tx) => {
      const [contractorOrg] = await tx
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, ctx.project.contractorOrganizationId))
        .limit(1);

      const base = await tx
        .select({
          id: transmittals.id,
          sequentialNumber: transmittals.sequentialNumber,
          subject: transmittals.subject,
          message: transmittals.message,
          status: transmittals.status,
          sentAt: transmittals.sentAt,
          sentByUserId: transmittals.sentByUserId,
          sentByName: users.displayName,
          createdAt: transmittals.createdAt,
          updatedAt: transmittals.updatedAt,
        })
        .from(transmittals)
        .leftJoin(users, eq(users.id, transmittals.sentByUserId))
        .where(eq(transmittals.projectId, input.projectId))
        .orderBy(desc(transmittals.createdAt));

      if (base.length === 0) {
        return { contractorOrg, base, recipientAgg: [], documentAgg: [] };
      }

      const ids = base.map((b) => b.id);

      // Per-transmittal aggregates: recipients, downloaded count, total
      // downloads, docs, bundle size. Two aggregate queries in parallel.
      const [recipientAgg, documentAgg] = await Promise.all([
        tx
          .select({
            transmittalId: transmittalRecipients.transmittalId,
            total: sql<number>`count(*)::int`,
            downloaded: sql<number>`count(*) filter (where ${transmittalRecipients.firstDownloadedAt} is not null and ${transmittalRecipients.revokedAt} is null)::int`,
            revoked: sql<number>`count(*) filter (where ${transmittalRecipients.revokedAt} is not null)::int`,
            totalDownloads: sql<number>`coalesce(sum(${transmittalRecipients.totalDownloads}), 0)::int`,
          })
          .from(transmittalRecipients)
          .where(inArray(transmittalRecipients.transmittalId, ids))
          .groupBy(transmittalRecipients.transmittalId),
        tx
          .select({
            transmittalId: transmittalDocuments.transmittalId,
            count: sql<number>`count(*)::int`,
            bytes: sql<number>`coalesce(sum(${documents.fileSizeBytes}), 0)::bigint`,
          })
          .from(transmittalDocuments)
          .innerJoin(documents, eq(documents.id, transmittalDocuments.documentId))
          .where(inArray(transmittalDocuments.transmittalId, ids))
          .groupBy(transmittalDocuments.transmittalId),
      ]);

      return { contractorOrg, base, recipientAgg, documentAgg };
    },
  );

  if (base.length === 0) return { rows: [] };

  const recByTx = new Map<
    string,
    { total: number; downloaded: number; revoked: number; totalDownloads: number }
  >();
  for (const r of recipientAgg) {
    recByTx.set(r.transmittalId, {
      total: r.total,
      downloaded: r.downloaded,
      revoked: r.revoked,
      totalDownloads: r.totalDownloads,
    });
  }
  const docByTx = new Map<string, { count: number; bytes: number }>();
  for (const d of documentAgg) {
    docByTx.set(d.transmittalId, {
      count: d.count,
      bytes: Number(d.bytes ?? 0),
    });
  }

  return {
    rows: base.map((r) => {
      const rec = recByTx.get(r.id) ?? {
        total: 0,
        downloaded: 0,
        revoked: 0,
        totalDownloads: 0,
      };
      const doc = docByTx.get(r.id) ?? { count: 0, bytes: 0 };
      return {
        id: r.id,
        numberLabel: padTransmittalNumber(r.sequentialNumber),
        sequentialNumber: r.sequentialNumber,
        subject: r.subject,
        message: r.message,
        status: r.status as TransmittalStatus,
        sentAt: r.sentAt ? r.sentAt.toISOString() : null,
        sentByUserId: r.sentByUserId,
        sentByName: r.sentByName,
        sentByOrgName: contractorOrg?.name ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        recipientCount: rec.total,
        downloadedCount: rec.downloaded,
        pendingCount: Math.max(0, rec.total - rec.downloaded - rec.revoked),
        totalDownloads: rec.totalDownloads,
        docCount: doc.count,
        totalSizeBytes: doc.bytes,
      };
    }),
  };
}

// -----------------------------------------------------------------------------
// getTransmittal — detail view.
// -----------------------------------------------------------------------------

export async function getTransmittal(input: {
  session: SessionLike | null | undefined;
  transmittalId: string;
}): Promise<TransmittalDetail> {
  // Pre-tenant head lookup: tenant unknown until project resolves.
  const [head] = await dbAdmin
    .select({
      id: transmittals.id,
      projectId: transmittals.projectId,
    })
    .from(transmittals)
    .where(eq(transmittals.id, input.transmittalId))
    .limit(1);
  if (!head) {
    throw new AuthorizationError("Transmittal not found", "not_found");
  }

  const ctx = await getEffectiveContext(input.session, head.projectId);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Transmittals are contractor-only",
      "forbidden",
    );
  }

  // Reuse the list loader for head aggregates — filter to this row.
  const list = await getTransmittals({
    session: input.session,
    projectId: head.projectId,
  });
  const listRow = list.rows.find((r) => r.id === head.id);
  if (!listRow) {
    throw new AuthorizationError("Transmittal not visible", "forbidden");
  }

  const { project, recipientRows, documentRows, eventRows } = await withTenant(
    ctx.organization.id,
    async (tx) => {
      const [project] = await tx
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.id, head.projectId))
        .limit(1);

      const recipientRows = await tx
        .select({
          id: transmittalRecipients.id,
          email: transmittalRecipients.email,
          name: transmittalRecipients.name,
          orgLabel: transmittalRecipients.orgLabel,
          firstDownloadedAt: transmittalRecipients.firstDownloadedAt,
          lastDownloadedAt: transmittalRecipients.lastDownloadedAt,
          totalDownloads: transmittalRecipients.totalDownloads,
          revokedAt: transmittalRecipients.revokedAt,
          expiresAt: transmittalRecipients.expiresAt,
        })
        .from(transmittalRecipients)
        .where(eq(transmittalRecipients.transmittalId, head.id))
        .orderBy(asc(transmittalRecipients.createdAt));

      const documentRows = await tx
        .select({
          id: transmittalDocuments.id,
          documentId: transmittalDocuments.documentId,
          name: documents.title,
          sizeBytes: documents.fileSizeBytes,
          category: documents.category,
          sortOrder: transmittalDocuments.sortOrder,
        })
        .from(transmittalDocuments)
        .innerJoin(documents, eq(documents.id, transmittalDocuments.documentId))
        .where(eq(transmittalDocuments.transmittalId, head.id))
        .orderBy(
          asc(transmittalDocuments.sortOrder),
          asc(transmittalDocuments.createdAt),
        );

      // Access events join against recipients for name/email display.
      const recipientIds = recipientRows.map((r) => r.id);
      const eventRows =
        recipientIds.length === 0
          ? []
          : await tx
              .select({
                id: transmittalAccessEvents.id,
                recipientId: transmittalAccessEvents.recipientId,
                recipientName: transmittalRecipients.name,
                recipientEmail: transmittalRecipients.email,
                orgLabel: transmittalRecipients.orgLabel,
                downloadedAt: transmittalAccessEvents.downloadedAt,
                ipAddress: transmittalAccessEvents.ipAddress,
                userAgent: transmittalAccessEvents.userAgent,
              })
              .from(transmittalAccessEvents)
              .innerJoin(
                transmittalRecipients,
                eq(
                  transmittalRecipients.id,
                  transmittalAccessEvents.recipientId,
                ),
              )
              .where(
                inArray(transmittalAccessEvents.recipientId, recipientIds),
              )
              .orderBy(desc(transmittalAccessEvents.downloadedAt));

      return { project, recipientRows, documentRows, eventRows };
    },
  );

  const recipients: TransmittalRecipientRow[] = recipientRows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    orgLabel: r.orgLabel,
    status: recipientDerivedStatus(r),
    firstDownloadedAt: r.firstDownloadedAt
      ? r.firstDownloadedAt.toISOString()
      : null,
    lastDownloadedAt: r.lastDownloadedAt
      ? r.lastDownloadedAt.toISOString()
      : null,
    totalDownloads: r.totalDownloads,
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
  }));

  const docs: TransmittalDocumentRow[] = documentRows.map((d) => ({
    id: d.id,
    documentId: d.documentId,
    name: d.name,
    sizeBytes: Number(d.sizeBytes ?? 0),
    category: d.category,
    sortOrder: d.sortOrder,
  }));

  const events: TransmittalAccessEventRow[] = eventRows.map((e) => ({
    id: e.id,
    recipientId: e.recipientId,
    recipientName: e.recipientName,
    recipientEmail: e.recipientEmail,
    orgLabel: e.orgLabel,
    downloadedAt: e.downloadedAt.toISOString(),
    ipAddress: e.ipAddress,
    userAgent: e.userAgent,
  }));

  const canEdit = listRow.status === "draft";
  const canSend =
    canEdit &&
    listRow.subject.trim().length > 0 &&
    recipients.length > 0 &&
    docs.length > 0;

  return {
    ...listRow,
    project: project ?? { id: head.projectId, name: "" },
    recipients,
    documents: docs,
    accessEvents: events,
    canEdit,
    canSend,
  };
}

// -----------------------------------------------------------------------------
// getTransmittalActivity — activity feed rail for the workspace.
// -----------------------------------------------------------------------------

export type TransmittalActivityRow = {
  actorUserId: string | null;
  actorName: string | null;
  title: string;
  body: string | null;
  relatedTransmittalId: string | null;
  createdAt: string;
};

export async function getTransmittalActivity(input: {
  session: SessionLike | null | undefined;
  projectId: string;
  limit?: number;
}): Promise<TransmittalActivityRow[]> {
  const ctx = await getEffectiveContext(input.session, input.projectId);
  if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
    throw new AuthorizationError(
      "Transmittals are contractor-only",
      "forbidden",
    );
  }

  const rows = await db
    .select({
      actorUserId: activityFeedItems.actorUserId,
      actorName: users.displayName,
      title: activityFeedItems.title,
      body: activityFeedItems.body,
      relatedTransmittalId: activityFeedItems.relatedObjectId,
      createdAt: activityFeedItems.createdAt,
    })
    .from(activityFeedItems)
    .leftJoin(users, eq(users.id, activityFeedItems.actorUserId))
    .where(
      and(
        eq(activityFeedItems.projectId, input.projectId),
        eq(activityFeedItems.relatedObjectType, "transmittal"),
      ),
    )
    .orderBy(desc(activityFeedItems.createdAt))
    .limit(input.limit ?? 10);

  return rows.map((r) => ({
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    title: r.title,
    body: r.body,
    relatedTransmittalId: r.relatedTransmittalId,
    createdAt: r.createdAt.toISOString(),
  }));
}

// -----------------------------------------------------------------------------
// Anonymous token → transmittal resolution (for the /t/[token] page).
//
// Takes a plaintext token, hashes it, looks up the recipient row by
// digest, and returns the render data for the recipient page. Returns
// `null` (not throws) on any failure — the caller renders a generic
// "not found" rather than leak whether a token ever existed.
// -----------------------------------------------------------------------------

export type AnonymousTransmittalView = {
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  transmittalId: string;
  numberLabel: string;
  subject: string;
  message: string;
  sentAt: string | null;
  sentByName: string | null;
  senderOrgName: string | null;
  projectName: string;
  documents: TransmittalDocumentRow[];
  revoked: boolean;
  expired: boolean;
};

export async function getAnonymousTransmittalByDigest(
  digest: string,
): Promise<AnonymousTransmittalView | null> {
  // Pre-tenant: anonymous token digest IS the credential. No org
  // context exists until we resolve through the recipient row.
  const [row] = await dbAdmin
    .select({
      recipientId: transmittalRecipients.id,
      recipientName: transmittalRecipients.name,
      recipientEmail: transmittalRecipients.email,
      revokedAt: transmittalRecipients.revokedAt,
      expiresAt: transmittalRecipients.expiresAt,
      transmittalId: transmittals.id,
      sequentialNumber: transmittals.sequentialNumber,
      subject: transmittals.subject,
      message: transmittals.message,
      status: transmittals.status,
      sentAt: transmittals.sentAt,
      sentByName: users.displayName,
      projectId: transmittals.projectId,
      projectName: projects.name,
      contractorOrgId: projects.contractorOrganizationId,
    })
    .from(transmittalRecipients)
    .innerJoin(
      transmittals,
      eq(transmittals.id, transmittalRecipients.transmittalId),
    )
    .innerJoin(projects, eq(projects.id, transmittals.projectId))
    .leftJoin(users, eq(users.id, transmittals.sentByUserId))
    .where(eq(transmittalRecipients.accessTokenDigest, digest))
    .limit(1);

  if (!row) return null;
  // Sent state only — a recipient row for a draft should never have a
  // digest (tokens aren't generated until send), but defend anyway.
  if (row.status !== "sent") return null;

  const [org] = await dbAdmin
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, row.contractorOrgId))
    .limit(1);

  const docs = await dbAdmin
    .select({
      id: transmittalDocuments.id,
      documentId: transmittalDocuments.documentId,
      name: documents.title,
      sizeBytes: documents.fileSizeBytes,
      category: documents.category,
      sortOrder: transmittalDocuments.sortOrder,
    })
    .from(transmittalDocuments)
    .innerJoin(documents, eq(documents.id, transmittalDocuments.documentId))
    .where(eq(transmittalDocuments.transmittalId, row.transmittalId))
    .orderBy(
      asc(transmittalDocuments.sortOrder),
      asc(transmittalDocuments.createdAt),
    );

  const revoked = !!row.revokedAt;
  const expired = !!(row.expiresAt && row.expiresAt.getTime() < Date.now());

  return {
    recipientId: row.recipientId,
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    transmittalId: row.transmittalId,
    numberLabel: padTransmittalNumber(row.sequentialNumber),
    subject: row.subject,
    message: row.message,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    sentByName: row.sentByName,
    senderOrgName: org?.name ?? null,
    projectName: row.projectName,
    documents: docs.map((d) => ({
      id: d.id,
      documentId: d.documentId,
      name: d.name,
      sizeBytes: Number(d.sizeBytes ?? 0),
      category: d.category,
      sortOrder: d.sortOrder,
    })),
    revoked,
    expired,
  };
}
