import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { userNotificationPreferences } from "@/db/schema";
import {
  validEventIdsFor,
  type SettingsPortalType,
} from "@/lib/notification-catalog";

const PortalEnum = z.enum([
  "contractor",
  "subcontractor",
  "commercial",
  "residential",
]);

const PrefSchema = z.object({
  eventId: z.string().min(1).max(120),
  email: z.boolean(),
  inApp: z.boolean(),
});

const UpsertBody = z.object({
  portalType: PortalEnum,
  preferences: z.array(PrefSchema).min(1).max(200),
});

const ResetBody = z.object({
  portalType: PortalEnum,
  reset: z.literal(true),
});

// PUT replaces (upsert) the user's prefs for the given portal.
export async function PUT(req: Request) {
  const { session } = await requireServerSession();
  const appUserId = (session)
    .appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);

  // Reset branch: wipe saved prefs so defaults apply on next read.
  const reset = ResetBody.safeParse(raw);
  if (reset.success) {
    const portalType: SettingsPortalType = reset.data.portalType;
    await db
      .delete(userNotificationPreferences)
      .where(
        and(
          eq(userNotificationPreferences.userId, appUserId),
          eq(userNotificationPreferences.portalType, portalType),
        ),
      );
    return NextResponse.json({ ok: true, reset: true });
  }

  const parsed = UpsertBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const portalType: SettingsPortalType = parsed.data.portalType;
  const validIds = validEventIdsFor(portalType);
  const accepted = parsed.data.preferences.filter((p) =>
    validIds.has(p.eventId),
  );
  if (accepted.length === 0) {
    return NextResponse.json(
      { error: "no_valid_events", message: "No preferences matched the portal's event taxonomy" },
      { status: 400 },
    );
  }

  await db.transaction(async (tx) => {
    const eventIds = accepted.map((p) => p.eventId);
    await tx
      .delete(userNotificationPreferences)
      .where(
        and(
          eq(userNotificationPreferences.userId, appUserId),
          eq(userNotificationPreferences.portalType, portalType),
          inArray(userNotificationPreferences.eventId, eventIds),
        ),
      );
    await tx.insert(userNotificationPreferences).values(
      accepted.map((p) => ({
        userId: appUserId,
        portalType,
        eventId: p.eventId,
        email: p.email,
        inApp: p.inApp,
      })),
    );
  });

  return NextResponse.json({ ok: true, count: accepted.length });
}
