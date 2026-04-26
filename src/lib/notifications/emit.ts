import { and, eq, inArray } from "drizzle-orm";

import { type DB } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { notifications, userNotificationPreferences } from "@/db/schema";
import { validEventIdsFor } from "@/lib/notification-catalog";
import {
  getEventRecipients,
  type Recipient,
  type RecipientResolveOptions,
} from "@/lib/notifications/recipients";
import {
  renderNotification,
  type NotificationRenderInput,
} from "@/lib/notifications/routing";

// Same pattern as writeAuditEvent — accept a drizzle tx OR the base db.
type DbOrTx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

export type EmitNotificationsInput = RecipientResolveOptions & {
  eventId: string;
  relatedObjectType: string | null;
  relatedObjectId: string | null;
  sourceAuditEventId?: string | null;
  // Variables interpolated into the per-portal copy. See
  // src/lib/notifications/routing.ts for the fields each event reads.
  vars?: Record<string, string | number | null | undefined>;
  // Override the resolver — used by reminders and other non-event-driven
  // emissions that already know the target list.
  recipientsOverride?: Recipient[];
};

// Write one notification row per eligible recipient. Non-throwing: any
// failure is logged and swallowed so the primary state transition stays
// durable even if the notification side-effect fails. The emit helper
// wraps its own work in a single-insert batch for efficiency.
//
// SYSTEM WRITER: Notifications are user-scoped and RLS-enforced via
// `app.current_user_id`. Fan-out from a state transition writes rows
// for OTHER users (recipients), so the WITH CHECK clause would deny
// every insert if we routed through the user's tenant context. The
// default pool here is `dbAdmin` (BYPASSRLS) — emit is a system effect.
// Callers can still pass their own `tx` (e.g. when emit must be atomic
// with the parent state change); in that case the caller is responsible
// for ensuring the tx runs in a context that can write the rows.
export async function emitNotifications(
  input: EmitNotificationsInput,
  dbOrTx: DbOrTx = dbAdmin,
): Promise<{ inserted: number; skipped: number }> {
  try {
    const recipients =
      input.recipientsOverride ??
      (await getEventRecipients(input.eventId, {
        actorUserId: input.actorUserId,
        projectId: input.projectId,
        conversationId: input.conversationId,
        targetOrganizationId: input.targetOrganizationId,
      }));
    if (recipients.length === 0) return { inserted: 0, skipped: 0 };

    // Pull every recipient's inApp preference for this event in one query
    // so we don't fan out N preference lookups. Missing rows default to
    // the catalog's defaults (inApp: true) — don't silently drop.
    const userIds = recipients.map((r) => r.userId);
    const prefs = await dbOrTx
      .select({
        userId: userNotificationPreferences.userId,
        portalType: userNotificationPreferences.portalType,
        eventId: userNotificationPreferences.eventId,
        inApp: userNotificationPreferences.inApp,
      })
      .from(userNotificationPreferences)
      .where(
        and(
          inArray(userNotificationPreferences.userId, userIds),
          eq(userNotificationPreferences.eventId, input.eventId),
        ),
      );
    const prefKey = (u: string, p: string) => `${u}:${p}`;
    const prefByKey = new Map<string, boolean>();
    for (const p of prefs) {
      prefByKey.set(prefKey(p.userId, p.portalType), p.inApp);
    }

    let skipped = 0;
    const rows: Array<typeof notifications.$inferInsert> = [];

    for (const r of recipients) {
      // Gate: catalog must list this event for the recipient's portal.
      // Prevents the emit layer from writing rows the UI can't render.
      const valid = validEventIdsFor(r.portalType);
      if (!valid.has(input.eventId)) {
        skipped += 1;
        continue;
      }

      // Preference: respect an explicit off-toggle. Missing pref row
      // means user hasn't customized — fall through to emit.
      const pref = prefByKey.get(prefKey(r.userId, r.portalType));
      if (pref === false) {
        skipped += 1;
        continue;
      }

      const rendered = renderNotificationFor(input, r);
      rows.push({
        recipientUserId: r.userId,
        portalType: r.portalType,
        eventId: input.eventId,
        title: rendered.title,
        body: rendered.body,
        linkUrl: rendered.linkUrl,
        projectId: input.projectId,
        relatedObjectType: input.relatedObjectType,
        relatedObjectId: input.relatedObjectId,
        sourceAuditEventId: input.sourceAuditEventId ?? null,
      });
    }

    if (rows.length === 0) return { inserted: 0, skipped };

    await dbOrTx.insert(notifications).values(rows);
    return { inserted: rows.length, skipped };
  } catch (err) {
    // Notification emit is best-effort: never block the primary state
    // change over a broken inbox row.
    console.error("emitNotifications failed", {
      eventId: input.eventId,
      projectId: input.projectId,
      err,
    });
    return { inserted: 0, skipped: 0 };
  }
}

function renderNotificationFor(
  input: EmitNotificationsInput,
  recipient: Recipient,
) {
  const ri: NotificationRenderInput = {
    eventId: input.eventId,
    portalType: recipient.portalType,
    projectId: input.projectId,
    relatedObjectId: input.relatedObjectId,
    vars: input.vars,
  };
  return renderNotification(ri);
}
