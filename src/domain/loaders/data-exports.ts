import { desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { dataExports, users } from "@/db/schema";

// Read-only audit trail view of past exports for the Data tab's "Recent
// exports" panel. Currently every export is synchronous + inline-delivered
// (storage_key IS NULL), so there is no re-download affordance — the list
// is pure history. Future R2-backed async exports will have storage_key
// populated and the UI will surface a "Download again" button for those
// rows while they remain inside expires_at.

export type RecentDataExportView = {
  id: string;
  exportKind: string;
  status: string;
  storageKey: string | null;
  expiresAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  requestedBy: { id: string; name: string };
};

export async function listRecentDataExports(
  organizationId: string,
  opts: { limit?: number } = {},
): Promise<RecentDataExportView[]> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const rows = await db
    .select({
      id: dataExports.id,
      exportKind: dataExports.exportKind,
      status: dataExports.status,
      storageKey: dataExports.storageKey,
      expiresAt: dataExports.expiresAt,
      completedAt: dataExports.completedAt,
      createdAt: dataExports.createdAt,
      requesterId: users.id,
      requesterName: users.displayName,
      requesterEmail: users.email,
    })
    .from(dataExports)
    .innerJoin(users, eq(users.id, dataExports.requestedByUserId))
    .where(eq(dataExports.organizationId, organizationId))
    .orderBy(desc(dataExports.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    exportKind: r.exportKind,
    status: r.status,
    storageKey: r.storageKey,
    expiresAt: r.expiresAt,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
    requestedBy: {
      id: r.requesterId,
      name: r.requesterName ?? r.requesterEmail,
    },
  }));
}
