import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import {
  getUnreadNotificationCount,
  listNotifications,
  type ListNotificationsInput,
} from "@/domain/loaders/notifications";
import { withErrorHandler } from "@/lib/api/error-handler";

// Bounded query-param schema. coerce.number() handles missing/string
// values uniformly so a missing param falls back to its default rather
// than producing NaN downstream.
const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  unread: z.enum(["1"]).optional(),
  projectId: z.string().uuid().optional(),
  eventId: z.string().min(1).max(120).optional(),
  portalType: z
    .enum(["contractor", "subcontractor", "commercial", "residential"])
    .optional(),
});

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
  return withErrorHandler(
    async () => {
  const { session } = await requireServerSession();
      const appUserId = session.appUserId;
      const orgId = session.organizationId;
      if (!appUserId || !orgId) {
        return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
      }

      const url = new URL(req.url);
      const parsed = QuerySchema.safeParse(
        Object.fromEntries(url.searchParams.entries()),
      );
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_query", issues: parsed.error.issues },
          { status: 400 },
        );
      }

      const input: ListNotificationsInput = {
        limit: parsed.data.limit,
        offset: parsed.data.offset,
        unreadOnly: parsed.data.unread === "1",
        projectId: parsed.data.projectId,
        eventId: parsed.data.eventId,
        portalType: parsed.data.portalType,
      };

      const [rows, unreadCount] = await Promise.all([
        listNotifications(orgId, appUserId, input),
        getUnreadNotificationCount(orgId, appUserId, parsed.data.portalType),
      ]);

      return NextResponse.json({
        notifications: rows,
        unreadCount,
      });
    },
    { path: "/api/notifications", method: "GET" },
  );
}
