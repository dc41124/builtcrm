import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { withTenantUser } from "@/db/with-tenant";
import { notifications } from "@/db/schema";

export type NotificationRow = {
  id: string;
  portalType: "contractor" | "subcontractor" | "commercial" | "residential";
  eventId: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  projectId: string | null;
  relatedObjectType: string | null;
  relatedObjectId: string | null;
  createdAt: Date;
  readAt: Date | null;
};

export type ListNotificationsInput = {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
  projectId?: string;
  eventId?: string;
  portalType?: "contractor" | "subcontractor" | "commercial" | "residential";
};

// Paginated notification list for a recipient. Newest first — both the
// bell dropdown and the persistent page sort chronologically.
//
// RLS: notifications is user-scoped. The `withTenantUser(orgId, userId)`
// wrapper sets app.current_user_id; the policy gates rows to
// recipient_user_id = current_user_id. The orgId is for the tenant GUC
// (not consulted by the notifications policy itself, but kept consistent
// with the rest of the codebase's withTenant pattern).
export async function listNotifications(
  orgId: string,
  recipientUserId: string,
  input: ListNotificationsInput = {},
): Promise<NotificationRow[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 200));
  const offset = Math.max(0, input.offset ?? 0);

  const clauses = [eq(notifications.recipientUserId, recipientUserId)];
  if (input.unreadOnly) clauses.push(isNull(notifications.readAt));
  if (input.projectId) clauses.push(eq(notifications.projectId, input.projectId));
  if (input.eventId) clauses.push(eq(notifications.eventId, input.eventId));
  if (input.portalType)
    clauses.push(eq(notifications.portalType, input.portalType));

  const rows = await withTenantUser(orgId, recipientUserId, (tx) =>
    tx
      .select({
        id: notifications.id,
        portalType: notifications.portalType,
        eventId: notifications.eventId,
        title: notifications.title,
        body: notifications.body,
        linkUrl: notifications.linkUrl,
        projectId: notifications.projectId,
        relatedObjectType: notifications.relatedObjectType,
        relatedObjectId: notifications.relatedObjectId,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(and(...clauses))
      .orderBy(desc(notifications.createdAt), asc(notifications.id))
      .limit(limit)
      .offset(offset),
  );
  return rows;
}

// Total unread for the bell badge. One query, counts only — no row data.
export async function getUnreadNotificationCount(
  orgId: string,
  recipientUserId: string,
  portalType?: "contractor" | "subcontractor" | "commercial" | "residential",
): Promise<number> {
  const clauses = [
    eq(notifications.recipientUserId, recipientUserId),
    isNull(notifications.readAt),
  ];
  if (portalType) clauses.push(eq(notifications.portalType, portalType));

  const [row] = await withTenantUser(orgId, recipientUserId, (tx) =>
    tx
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(...clauses)),
  );
  return Number(row?.count ?? 0);
}

// Unread notifications grouped by projectId. Powers per-project badges
// in the sidebar. Null projectId (notifications without a project
// context) bucket under a synthetic "__org__" key so callers can still
// render a top-level "Organization" count.
export async function getUnreadNotificationCountByProject(
  orgId: string,
  recipientUserId: string,
  portalType?: "contractor" | "subcontractor" | "commercial" | "residential",
): Promise<Record<string, number>> {
  const clauses = [
    eq(notifications.recipientUserId, recipientUserId),
    isNull(notifications.readAt),
  ];
  if (portalType) clauses.push(eq(notifications.portalType, portalType));

  const rows = await withTenantUser(orgId, recipientUserId, (tx) =>
    tx
      .select({
        projectId: notifications.projectId,
        count: sql<number>`count(*)::int`,
      })
      .from(notifications)
      .where(and(...clauses))
      .groupBy(notifications.projectId),
  );

  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.projectId ?? "__org__";
    out[key] = Number(r.count);
  }
  return out;
}
