import { and, eq, inArray } from "drizzle-orm";

import { type DB } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { roleAssignments, users } from "@/db/schema";
import { emitNotifications } from "@/lib/notifications/emit";
import type { Recipient } from "@/lib/notifications/recipients";
import type { SettingsPortalType } from "@/lib/notification-catalog";

type DbOrTx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

// Per-recipient payload the "sender" receives. `shareUrl` is plaintext
// and only exists in memory for the duration of the send request —
// the DB stores only the digest.
export type TransmittalEmailPayload = {
  recipientId: string;
  email: string;
  name: string;
  shareUrl: string;
};

export type SendTransmittalEmailsResult = {
  attempted: number;
  delivered: number;
  // One log line per intended send. Structured so production wiring
  // can pipe to a real provider without changing call sites.
  deliveries: Array<{
    recipientId: string;
    email: string;
    status: "logged" | "notified-internal" | "failed";
    note: string;
  }>;
};

// Option C from the design survey: the sender is stubbed. Every send
// is logged with structured metadata, and when a recipient's email
// matches an internal user, we also write an in-app notification so
// the bell icon surfaces the delivery. When a real provider (Resend,
// Postmark) is wired later, only the body of this function changes —
// the call sites on the create/send API don't.
export async function sendTransmittalEmails(
  dbc: DbOrTx,
  input: {
    projectId: string;
    transmittalId: string;
    transmittalNumberLabel: string; // TM-0004
    subject: string;
    message: string;
    senderName: string;
    senderOrgName: string | null;
    actorUserId: string;
    recipients: TransmittalEmailPayload[];
  },
): Promise<SendTransmittalEmailsResult> {
  const deliveries: SendTransmittalEmailsResult["deliveries"] = [];
  let delivered = 0;

  // Internal-user matches: any recipient email that maps to an active
  // user gets an in-app "meeting_invite"-shaped notification. Event id
  // is dedicated (`transmittal_received`) so users can toggle it in
  // their prefs without noise from other inbox channels.
  const internalLookup = await resolveInternalUsers(
    dbc,
    input.recipients.map((r) => r.email),
  );

  for (const recipient of input.recipients) {
    // Log the send — production would call resend/postmark here. The
    // console output is structured JSON so pipelining to a provider
    // later is mechanical.
    const payload = {
      kind: "transmittal_email_stub",
      transmittalId: input.transmittalId,
      transmittalNumber: input.transmittalNumberLabel,
      recipientId: recipient.recipientId,
      to: recipient.email,
      name: recipient.name,
      subject: `[${input.transmittalNumberLabel}] ${input.subject}`,
      shareUrl: recipient.shareUrl,
      projectId: input.projectId,
      senderName: input.senderName,
      senderOrgName: input.senderOrgName,
    };
    // Intentional — this is the stub's "send". A real provider swap
    // replaces this single line.
    console.log("[transmittals.email]", JSON.stringify(payload));

    const internalUser = internalLookup.get(recipient.email.toLowerCase());
    if (internalUser) {
      await emitNotifications(
        {
          eventId: "transmittal_received",
          actorUserId: input.actorUserId,
          projectId: input.projectId,
          relatedObjectType: "transmittal",
          relatedObjectId: input.transmittalId,
          recipientsOverride: [internalUser],
          vars: {
            number: input.transmittalNumberLabel,
            subject: input.subject,
            actorName: input.senderName,
            // Share URL embedded in the notification body so the
            // internal user can click straight through. External
            // recipients get the URL via email only (stubbed here).
            shareUrl: recipient.shareUrl,
          },
        },
        dbc,
      );
      deliveries.push({
        recipientId: recipient.recipientId,
        email: recipient.email,
        status: "notified-internal",
        note: "In-app notification posted; email stubbed",
      });
    } else {
      deliveries.push({
        recipientId: recipient.recipientId,
        email: recipient.email,
        status: "logged",
        note: "Email stubbed — share URL surfaced in sender UI",
      });
    }
    delivered += 1;
  }

  return {
    attempted: input.recipients.length,
    delivered,
    deliveries,
  };
}

// Map {lowercased-email → Recipient shape} for the subset of incoming
// emails that correspond to an active user with a role assignment.
// Returned map is keyed by lowercased email for case-insensitive
// lookup.
async function resolveInternalUsers(
  dbc: DbOrTx,
  emails: string[],
): Promise<Map<string, Recipient>> {
  if (emails.length === 0) return new Map();
  const normalized = emails.map((e) => e.toLowerCase());
  const userRows = await dbc
    .select({
      userId: users.id,
      email: users.email,
      isActive: users.isActive,
    })
    .from(users)
    .where(inArray(users.email, normalized));
  const activeUsers = userRows.filter((u) => u.isActive);
  if (activeUsers.length === 0) return new Map();

  const userIds = activeUsers.map((u) => u.userId);
  // Cross-org by design: transmittal recipients are arbitrary users
  // (different orgs from the sender). RLS-enabled `role_assignments`
  // reads route through `dbAdmin`.
  const assignments = await dbAdmin
    .select({
      userId: roleAssignments.userId,
      portalType: roleAssignments.portalType,
      clientSubtype: roleAssignments.clientSubtype,
    })
    .from(roleAssignments)
    .where(
      and(
        inArray(roleAssignments.userId, userIds),
        eq(roleAssignments.portalType, roleAssignments.portalType),
      ),
    );

  const portalByUser = new Map<string, SettingsPortalType>();
  for (const a of assignments) {
    if (portalByUser.has(a.userId)) continue;
    const resolved: SettingsPortalType =
      a.portalType === "contractor"
        ? "contractor"
        : a.portalType === "subcontractor"
          ? "subcontractor"
          : a.clientSubtype === "residential"
            ? "residential"
            : "commercial";
    portalByUser.set(a.userId, resolved);
  }

  const out = new Map<string, Recipient>();
  for (const u of activeUsers) {
    const portal = portalByUser.get(u.userId);
    if (!portal) continue;
    out.set(u.email.toLowerCase(), {
      userId: u.userId,
      portalType: portal,
    });
  }
  return out;
}
