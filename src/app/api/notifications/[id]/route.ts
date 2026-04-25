import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";

import { db } from "@/db/client";
import { notifications } from "@/db/schema";

// PATCH /api/notifications/[id] — mark read.
//
// Ownership: only the recipient can mark their own notifications read.
// Body is irrelevant (we always set read_at = now()); idempotent, so
// calling it on an already-read row is a no-op not an error.

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const appUserId = (session)
    .appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.recipientUserId, appUserId),
      ),
    )
    .returning({ id: notifications.id });

  if (result.length === 0) {
    // Either the row doesn't exist or belongs to someone else. Return
    // 404 in both cases to avoid leaking existence across users.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id: result[0].id });
}
