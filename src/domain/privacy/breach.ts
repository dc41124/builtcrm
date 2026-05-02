// Step 65 Session C — breach register helpers.
//
// Two operations live here that the API routes orchestrate:
//   1. logBreach — insert a new row in `breach_register` with the
//      officer's classification + containment notes.
//   2. generateBreachNotificationDrafts — build per-subject draft email
//      rows in `breach_notification_drafts`. NEVER auto-sent. Officer
//      reviews each draft, optionally edits, then marks sent (which is
//      a manual attestation, not a real send).

import { and, desc, eq } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  breachNotificationDrafts,
  breachRegister,
  organizationUsers,
  users,
} from "@/db/schema";
import { generateBreachReferenceCode } from "@/lib/privacy/reference-code";

type DbOrTx =
  | typeof dbAdmin
  | Parameters<Parameters<typeof dbAdmin.transaction>[0]>[0];

export type BreachSeverity = "low" | "medium" | "high" | "critical";

export type LogBreachInput = {
  organizationId: string;
  loggedByUserId: string;
  discoveredAt: Date;
  occurredAt: Date | null;
  occurredAtNote: string | null;
  severity: BreachSeverity;
  affectedCount: number | null;
  affectedDescription: string;
  dataTypesAffected: string[];
  containmentActions: string | null;
  tx?: DbOrTx;
};

export async function logBreach(
  input: LogBreachInput,
): Promise<{ id: string; referenceCode: string }> {
  const tx = input.tx ?? dbAdmin;
  // Reference-code retry on collision — odds are negligible but cheap to
  // guard against.
  let referenceCode = generateBreachReferenceCode();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const [row] = await tx
        .insert(breachRegister)
        .values({
          referenceCode,
          organizationId: input.organizationId,
          discoveredAt: input.discoveredAt,
          occurredAt: input.occurredAt,
          occurredAtNote: input.occurredAtNote,
          severity: input.severity,
          affectedCount: input.affectedCount,
          affectedDescription: input.affectedDescription,
          dataTypesAffected: input.dataTypesAffected,
          containmentActions: input.containmentActions,
          loggedByUserId: input.loggedByUserId,
        })
        .returning({ id: breachRegister.id });
      return { id: row.id, referenceCode };
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "23505" && attempt === 0) {
        referenceCode = generateBreachReferenceCode();
        continue;
      }
      throw err;
    }
  }
  // Unreachable — the loop either returns or rethrows.
  throw new Error("logBreach: exhausted retries");
}

// Build per-subject draft email rows. Recipients are derived from the
// org's consented users (those with marketing_email or product_updates
// granted, since notification of a breach is a transactional override
// that goes to all active users by default — but the officer narrows
// the recipient list before sending).
//
// Recipients shape: caller passes either an explicit list OR we derive
// from "all active org members". Default subject + body are templates
// that include the breach reference code and severity; the officer is
// expected to edit them before sending.
//
// Returns the IDs of the new drafts. Drafts are inserted in `draft`
// status — `sent_at` and `sent_by_user_id` stay NULL until the officer
// marks them sent.
export async function generateBreachNotificationDrafts(input: {
  breachId: string;
  organizationId: string;
  recipients?: Array<{ email: string; userId?: string | null; displayName?: string | null }>;
  template?: { subjectLine?: string; bodyText?: string };
  tx?: DbOrTx;
}): Promise<{ draftIds: string[]; recipientCount: number }> {
  const tx = input.tx ?? dbAdmin;

  // Resolve recipients. Explicit list wins; otherwise pull active org
  // members. The officer can withdraw drafts they don't want to send.
  let recipients = input.recipients ?? [];
  if (recipients.length === 0) {
    const rows = await tx
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
      })
      .from(organizationUsers)
      .innerJoin(users, eq(users.id, organizationUsers.userId))
      .where(
        and(
          eq(organizationUsers.organizationId, input.organizationId),
          eq(organizationUsers.membershipStatus, "active"),
          eq(users.isActive, true),
        ),
      );
    recipients = rows.map((r) => ({ email: r.email, userId: r.userId, displayName: r.displayName }));
  }

  if (recipients.length === 0) {
    return { draftIds: [], recipientCount: 0 };
  }

  // Default template — verbose enough to be obviously a placeholder so
  // the officer doesn't accidentally send it unedited. Subject/body
  // overrides come from the API request when the officer wants to start
  // from a tighter template.
  const subjectLine =
    input.template?.subjectLine ??
    "[ACTION REQUIRED — DRAFT] Privacy notice from BuiltCRM";
  const defaultBody =
    input.template?.bodyText ??
    [
      "Hello,",
      "",
      "We're writing to let you know about a privacy incident at BuiltCRM that may have affected information about you. This is a draft — replace this paragraph with the specific details before sending: what happened, what data was involved, what we're doing in response, and what you can do.",
      "",
      "If you have any questions, please contact our Privacy Officer at privacy@builtcrm.ca.",
      "",
      "— The BuiltCRM team",
    ].join("\n");

  const values = recipients.map((r) => ({
    breachId: input.breachId,
    organizationId: input.organizationId,
    recipientEmail: r.email,
    recipientUserId: r.userId ?? null,
    subjectLine,
    bodyText: defaultBody,
  }));

  const inserted = await tx
    .insert(breachNotificationDrafts)
    .values(values)
    .returning({ id: breachNotificationDrafts.id });

  return {
    draftIds: inserted.map((r) => r.id),
    recipientCount: inserted.length,
  };
}

export async function listBreachDrafts(input: {
  organizationId: string;
  breachId: string;
  tx?: DbOrTx;
}) {
  const tx = input.tx ?? dbAdmin;
  return tx
    .select({
      id: breachNotificationDrafts.id,
      recipientEmail: breachNotificationDrafts.recipientEmail,
      recipientUserId: breachNotificationDrafts.recipientUserId,
      subjectLine: breachNotificationDrafts.subjectLine,
      bodyText: breachNotificationDrafts.bodyText,
      status: breachNotificationDrafts.status,
      sentAt: breachNotificationDrafts.sentAt,
      sentByUserId: breachNotificationDrafts.sentByUserId,
      createdAt: breachNotificationDrafts.createdAt,
    })
    .from(breachNotificationDrafts)
    .where(
      and(
        eq(breachNotificationDrafts.organizationId, input.organizationId),
        eq(breachNotificationDrafts.breachId, input.breachId),
      ),
    )
    .orderBy(desc(breachNotificationDrafts.createdAt));
}

