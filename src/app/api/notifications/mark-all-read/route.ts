import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";

import { withTenantUser } from "@/db/with-tenant";
import { notifications } from "@/db/schema";

// POST /api/notifications/mark-all-read
//
// Batch-marks every unread notification for the caller as read.
// Optional body { portalType } scopes the batch to one portal — useful
// when a user has multi-portal access and only wants to clear the
// current portal's backlog.

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const appUserId = session.appUserId;
  const orgId = session.organizationId;
  if (!appUserId || !orgId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const portalType =
    body?.portalType === "contractor" ||
    body?.portalType === "subcontractor" ||
    body?.portalType === "commercial" ||
    body?.portalType === "residential"
      ? body.portalType
      : null;

  const clauses = [
    eq(notifications.recipientUserId, appUserId),
    isNull(notifications.readAt),
  ];
  if (portalType) clauses.push(eq(notifications.portalType, portalType));

  const result = await withTenantUser(orgId, appUserId, (tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(...clauses))
      .returning({ id: notifications.id }),
  );

  return NextResponse.json({ ok: true, updated: result.length });
}
