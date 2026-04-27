import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import {
  auditEvents,
  conversationParticipants,
  messages,
  notifications,
  organizationUsers,
  roleAssignments,
  userNotificationPreferences,
  users,
} from "@/db/schema";

// Builds the GDPR Article 15 export bundle for a single user. Returns
// a single JSON manifest (no per-table CSVs in v1 — that would
// require a zip dependency; deferred). Sections cover the user's
// OWNED rows (profile, preferences) and APPEARS-IN rows (audit
// events, messages they sent, notifications they received,
// memberships).
//
// Scope decision (per docs/specs/user_deletion_and_export_plan.md
// §6 q3): include all data we hold on the user, regardless of which
// org owns the surrounding context. Not filtered by current
// memberships — the export bundle is a "what we hold on you" view,
// not a "what you can currently see in the app" view.
//
// Table coverage is intentionally a subset for v1 — the high-signal,
// privacy-relevant rows. Add more tables to this builder when a new
// gap is identified; each addition is a new section in the JSON
// manifest's `sections` map.

export type UserExportManifest = {
  schemaVersion: "1.0";
  generatedAt: string;
  userId: string;
  exportId: string;
  sections: {
    profile: Record<string, unknown> | null;
    notificationPreferences: Record<string, unknown>[];
    roleAssignments: Record<string, unknown>[];
    organizationUsers: Record<string, unknown>[];
    auditEventsAsActor: Record<string, unknown>[];
    messagesSent: Record<string, unknown>[];
    conversationParticipations: Record<string, unknown>[];
    notificationsReceived: Record<string, unknown>[];
  };
  notes: {
    coverage: string;
    omitted: string[];
  };
};

export async function buildUserExportManifest(
  userId: string,
  exportId: string,
): Promise<UserExportManifest> {
  const [profile] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  // userNotificationPreferences is user-scoped RLS'd. The GDPR export runs
  // outside any session context (called from a worker/API route on the
  // user's behalf, possibly cross-org), so dbAdmin matches the same
  // rationale as roleAssignments / organizationUsers below.
  const prefs = await dbAdmin
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId));

  // Cross-org by design — same rationale as `organizationUsers` below.
  // The user's role rows can span every org they've ever been a member
  // of; RLS would silently restrict the bundle.
  const roles = await dbAdmin
    .select()
    .from(roleAssignments)
    .where(eq(roleAssignments.userId, userId));

  // Cross-org by design — the GDPR bundle is a "what we hold on you"
  // view spanning every org the user has ever been a member of. RLS
  // would silently restrict this to the current GUC's org, breaking
  // the contract. Use admin pool.
  const orgMemberships = await dbAdmin
    .select()
    .from(organizationUsers)
    .where(eq(organizationUsers.userId, userId));

  const audits = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.actorUserId, userId));

  const sentMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.senderUserId, userId));

  const participations = await db
    .select()
    .from(conversationParticipants)
    .where(eq(conversationParticipants.userId, userId));

  // notifications is user-scoped RLS'd via app.current_user_id. The GDPR
  // export runs outside any session context, so dbAdmin matches the
  // rationale used for roleAssignments / organizationUsers above.
  const notifs = await dbAdmin
    .select()
    .from(notifications)
    .where(eq(notifications.recipientUserId, userId));

  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    userId,
    exportId,
    sections: {
      profile: profile ? normalize(profile) : null,
      notificationPreferences: prefs.map(normalize),
      roleAssignments: roles.map(normalize),
      organizationUsers: orgMemberships.map(normalize),
      auditEventsAsActor: audits.map(normalize),
      messagesSent: sentMessages.map(normalize),
      conversationParticipations: participations.map(normalize),
      notificationsReceived: notifs.map(normalize),
    },
    notes: {
      coverage:
        "v1 of the GDPR Article 15 export covers: profile, notification preferences, role assignments and org memberships, audit events you initiated, messages you sent, conversations you participated in, and notifications you received. Construction-PM authorship rows (RFI/CO/lien-waiver creators, daily-log submissions, meeting minutes, etc.) are not included in this version — those are planned in a follow-up sprint that adds per-table CSV bundling.",
      omitted: [
        "documents.uploadedByUserId",
        "rfis.createdByUserId / responseUserId",
        "changeOrders.createdByUserId / approvedByUserId",
        "approvals.requestedByUserId / decidedByUserId",
        "submittals.createdByUserId",
        "dailyLogs.reportedByUserId / submittedByUserId / uploadedByUserId",
        "meetings.organizerUserId + minutes / agenda / action items",
        "billing tables (sov, drawRequests, retainageReleases, lienWaivers) author fields",
        "closeoutPackages, punchItems author fields",
        "drawingMarkups, drawingMeasurements, transmittals, savedReports",
      ],
    },
  };
}

// Normalize Drizzle row dates to ISO strings so the JSON output is
// stable + machine-parseable. Drizzle returns Date objects; default
// JSON.stringify on Date works, but explicit normalization here
// future-proofs against any Drizzle behavior change.
function normalize(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else {
      out[k] = v;
    }
  }
  return out;
}
