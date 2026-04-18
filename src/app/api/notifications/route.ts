import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth/config";
import {
  getUnreadNotificationCount,
  listNotifications,
  type ListNotificationsInput,
} from "@/domain/loaders/notifications";

// GET /api/notifications — list the caller's notifications.
//
// Query params:
//   limit       max rows (default 20, cap 200)
//   offset      pagination offset (default 0)
//   unread      "1" to filter to unread only
//   projectId   scope to a single project
//   eventId     scope to a single event type
//   portalType  scope to a single portal (useful when a user has multiple)
//
// Returns { notifications: NotificationRow[], unreadCount: number }.
// unreadCount is the *total* unread (not limited by filter) so callers
// can poll this endpoint and update the bell badge in one round trip.

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const appUserId = (session.session as unknown as { appUserId?: string | null })
    .appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const portalParam = url.searchParams.get("portalType");
  const portalType =
    portalParam === "contractor" ||
    portalParam === "subcontractor" ||
    portalParam === "commercial" ||
    portalParam === "residential"
      ? portalParam
      : undefined;

  const input: ListNotificationsInput = {
    limit: Number(url.searchParams.get("limit") ?? 20),
    offset: Number(url.searchParams.get("offset") ?? 0),
    unreadOnly: url.searchParams.get("unread") === "1",
    projectId: url.searchParams.get("projectId") ?? undefined,
    eventId: url.searchParams.get("eventId") ?? undefined,
    portalType,
  };

  const [rows, unreadCount] = await Promise.all([
    listNotifications(appUserId, input),
    getUnreadNotificationCount(appUserId, portalType),
  ]);

  return NextResponse.json({
    notifications: rows,
    unreadCount,
  });
}
