import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  breachNotificationDrafts,
  breachRegister,
  dsarRequests,
  organizationUsers,
  privacyOfficers,
  roleAssignments,
  users,
} from "@/db/schema";
import {
  getConsentHistoryForUser,
  getLatestConsentsForUser,
  listConsentRegister,
} from "@/domain/privacy/consents";
import type { ConsentRegisterRow } from "@/domain/privacy/consents";
import type { ConsentTypeKey } from "@/lib/privacy/consent-catalog";

// Step 65 Session B — privacy admin loader.
//
// Returns the data the contractor `/settings/privacy` page needs:
//   - currently designated Privacy Officer (or null)
//   - the DSAR queue for this org
//   - the candidate users who could be designated officer (active org
//     admins / members with a contractor role)
//
// `dsar_requests` is intentionally not RLS'd (see security_posture.md
// §6); we scope reads by organization_id explicitly. `privacy_officers`
// IS RLS'd, so we use withTenant for that read so the policy enforces
// the same constraint as the WHERE clause does — defense in depth.

export type PrivacyOfficerView = {
  id: string;
  userId: string;
  name: string;
  email: string;
  initials: string;
  designatedAt: Date;
  designatedByName: string | null;
};

export type PrivacyOfficerCandidate = {
  userId: string;
  name: string;
  email: string;
  roleKey: string;
  initials: string;
};

export type DsarRequestRow = {
  id: string;
  referenceCode: string;
  requesterName: string;
  requesterEmail: string;
  accountEmail: string | null;
  province: string;
  requestType: "access" | "deletion" | "rectification" | "portability";
  description: string;
  status: "received" | "in_progress" | "completed" | "rejected";
  receivedAt: Date;
  slaDueAt: Date;
  completedAt: Date | null;
  notes: string | null;
  projectContext: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  subjectUserId: string | null;
  daysRemaining: number;
};

export type BreachRegisterRow = {
  id: string;
  referenceCode: string;
  discoveredAt: Date;
  occurredAt: Date | null;
  occurredAtNote: string | null;
  severity: "low" | "medium" | "high" | "critical";
  affectedCount: number | null;
  affectedDescription: string;
  dataTypesAffected: string[];
  containmentActions: string | null;
  notifyUsersDecision: "pending" | "notify" | "no_notify";
  notifiedUsersAt: Date | null;
  reportedToCaiAt: Date | null;
  status: "open" | "closed";
  closedAt: Date | null;
  loggedByName: string | null;
  draftCount: number;
  draftsSent: number;
};

export type PrivacyAdminView = {
  organizationId: string;
  organizationName: string;
  officer: PrivacyOfficerView | null;
  candidates: PrivacyOfficerCandidate[];
  dsars: DsarRequestRow[];
  consents: ConsentRegisterRow[];
  breaches: BreachRegisterRow[];
  nowMs: number;
};

function deriveInitials(name: string | null, email: string): string {
  const source = (name ?? email).trim();
  const parts = source.split(/\s+|@/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "??";
}

export async function loadPrivacyAdminView(input: {
  organizationId: string;
  organizationName: string;
}): Promise<PrivacyAdminView> {
  // Officer + designator name. RLS-scoped read so the policy enforces.
  const officerRows = await withTenant(input.organizationId, (tx) =>
    tx
      .select({
        id: privacyOfficers.id,
        userId: privacyOfficers.userId,
        userEmail: users.email,
        userDisplayName: users.displayName,
        designatedAt: privacyOfficers.designatedAt,
        designatedByUserId: privacyOfficers.designatedByUserId,
      })
      .from(privacyOfficers)
      .innerJoin(users, eq(users.id, privacyOfficers.userId))
      .where(eq(privacyOfficers.organizationId, input.organizationId))
      .limit(1),
  );
  const officerRow = officerRows[0] ?? null;

  let designatedByName: string | null = null;
  if (officerRow?.designatedByUserId) {
    const [designator] = await dbAdmin
      .select({ displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, officerRow.designatedByUserId))
      .limit(1);
    designatedByName = designator?.displayName ?? designator?.email ?? null;
  }

  const officer: PrivacyOfficerView | null = officerRow
    ? {
        id: officerRow.id,
        userId: officerRow.userId,
        name: officerRow.userDisplayName ?? officerRow.userEmail,
        email: officerRow.userEmail,
        initials: deriveInitials(officerRow.userDisplayName, officerRow.userEmail),
        designatedAt: officerRow.designatedAt,
        designatedByName,
      }
    : null;

  // Candidate pool: contractor org members with an active role assignment.
  // We don't restrict to admins because the prototype's picker shows all
  // active members; the calling endpoint enforces "designator must be admin",
  // not "candidate must be admin".
  const candidateRows = await withTenant(input.organizationId, (tx) =>
    tx
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        roleKey: roleAssignments.roleKey,
      })
      .from(organizationUsers)
      .innerJoin(users, eq(users.id, organizationUsers.userId))
      .innerJoin(
        roleAssignments,
        and(
          eq(roleAssignments.userId, organizationUsers.userId),
          eq(roleAssignments.organizationId, organizationUsers.organizationId),
          eq(roleAssignments.portalType, "contractor"),
        ),
      )
      .where(
        and(
          eq(organizationUsers.organizationId, input.organizationId),
          eq(organizationUsers.membershipStatus, "active"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .orderBy(asc(users.displayName)),
  );

  const candidates: PrivacyOfficerCandidate[] = candidateRows.map((r) => ({
    userId: r.userId,
    name: r.displayName ?? r.email,
    email: r.email,
    roleKey: r.roleKey,
    initials: deriveInitials(r.displayName, r.email),
  }));

  // DSAR queue. dbAdmin since the table is intentionally un-RLS'd; scope
  // by organization_id in the WHERE explicitly.
  const dsarRows = await dbAdmin
    .select({
      id: dsarRequests.id,
      referenceCode: dsarRequests.referenceCode,
      requesterName: dsarRequests.requesterName,
      requesterEmail: dsarRequests.requesterEmail,
      accountEmail: dsarRequests.accountEmail,
      province: dsarRequests.province,
      requestType: dsarRequests.requestType,
      description: dsarRequests.description,
      status: dsarRequests.status,
      receivedAt: dsarRequests.receivedAt,
      slaDueAt: dsarRequests.slaDueAt,
      completedAt: dsarRequests.completedAt,
      notes: dsarRequests.notes,
      projectContext: dsarRequests.projectContext,
      assignedToUserId: dsarRequests.assignedToUserId,
      assignedToName: users.displayName,
      assignedToEmail: users.email,
      subjectUserId: dsarRequests.subjectUserId,
    })
    .from(dsarRequests)
    .leftJoin(users, eq(users.id, dsarRequests.assignedToUserId))
    .where(eq(dsarRequests.organizationId, input.organizationId))
    .orderBy(desc(dsarRequests.receivedAt));

  const now = Date.now();
  const dsars: DsarRequestRow[] = dsarRows.map((r) => ({
    id: r.id,
    referenceCode: r.referenceCode,
    requesterName: r.requesterName,
    requesterEmail: r.requesterEmail,
    accountEmail: r.accountEmail,
    province: r.province,
    requestType: r.requestType,
    description: r.description,
    status: r.status,
    receivedAt: r.receivedAt,
    slaDueAt: r.slaDueAt,
    completedAt: r.completedAt,
    notes: r.notes,
    projectContext: r.projectContext,
    assignedToUserId: r.assignedToUserId,
    assignedToName: r.assignedToName ?? r.assignedToEmail ?? null,
    subjectUserId: r.subjectUserId,
    daysRemaining: Math.ceil((r.slaDueAt.getTime() - now) / (24 * 60 * 60 * 1000)),
  }));

  // Consent register — flattened latest row per (subject, consent_type).
  // RLS-scoped read via withTenant so the policy enforces alongside the
  // application-layer org filter inside the helper's SQL.
  const consents = await withTenant(input.organizationId, (tx) =>
    listConsentRegister({ organizationId: input.organizationId, tx }),
  );

  // Breach register + draft counters per breach.
  const breachRows = await withTenant(input.organizationId, (tx) =>
    tx
      .select({
        id: breachRegister.id,
        referenceCode: breachRegister.referenceCode,
        discoveredAt: breachRegister.discoveredAt,
        occurredAt: breachRegister.occurredAt,
        occurredAtNote: breachRegister.occurredAtNote,
        severity: breachRegister.severity,
        affectedCount: breachRegister.affectedCount,
        affectedDescription: breachRegister.affectedDescription,
        dataTypesAffected: breachRegister.dataTypesAffected,
        containmentActions: breachRegister.containmentActions,
        notifyUsersDecision: breachRegister.notifyUsersDecision,
        notifiedUsersAt: breachRegister.notifiedUsersAt,
        reportedToCaiAt: breachRegister.reportedToCaiAt,
        status: breachRegister.status,
        closedAt: breachRegister.closedAt,
        loggedByName: users.displayName,
        loggedByEmail: users.email,
      })
      .from(breachRegister)
      .leftJoin(users, eq(users.id, breachRegister.loggedByUserId))
      .where(eq(breachRegister.organizationId, input.organizationId))
      .orderBy(desc(breachRegister.discoveredAt)),
  );

  // One small follow-up query for draft counters — saves a heavy
  // GROUP BY join on the larger breach table.
  const draftCounts = await withTenant(input.organizationId, (tx) =>
    tx
      .select({
        breachId: breachNotificationDrafts.breachId,
        status: breachNotificationDrafts.status,
      })
      .from(breachNotificationDrafts)
      .where(eq(breachNotificationDrafts.organizationId, input.organizationId)),
  );
  const counts = new Map<string, { total: number; sent: number }>();
  for (const d of draftCounts) {
    const cur = counts.get(d.breachId) ?? { total: 0, sent: 0 };
    cur.total += 1;
    if (d.status === "sent") cur.sent += 1;
    counts.set(d.breachId, cur);
  }

  const breaches: BreachRegisterRow[] = breachRows.map((b) => {
    const c = counts.get(b.id) ?? { total: 0, sent: 0 };
    return {
      id: b.id,
      referenceCode: b.referenceCode,
      discoveredAt: b.discoveredAt,
      occurredAt: b.occurredAt,
      occurredAtNote: b.occurredAtNote,
      severity: b.severity,
      affectedCount: b.affectedCount,
      affectedDescription: b.affectedDescription,
      dataTypesAffected: b.dataTypesAffected,
      containmentActions: b.containmentActions,
      notifyUsersDecision: b.notifyUsersDecision,
      notifiedUsersAt: b.notifiedUsersAt,
      reportedToCaiAt: b.reportedToCaiAt,
      status: b.status,
      closedAt: b.closedAt,
      loggedByName: b.loggedByName ?? b.loggedByEmail ?? null,
      draftCount: c.total,
      draftsSent: c.sent,
    };
  });

  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    officer,
    candidates,
    dsars,
    consents,
    breaches,
    nowMs: now,
  };
}

// -----------------------------------------------------------------------------
// End-user consent manager view. Used by the per-portal Settings → Privacy
// & consents page. Returns the user's latest consent state, their history,
// and any DSARs they've submitted from this account.
// -----------------------------------------------------------------------------

export type EndUserConsentState = {
  consentType: ConsentTypeKey;
  granted: boolean;
  source: string;
  occurredAt: Date;
};

export type EndUserDsarRow = {
  id: string;
  referenceCode: string;
  requestType: "access" | "deletion" | "rectification" | "portability";
  status: "received" | "in_progress" | "completed" | "rejected";
  submittedAt: Date;
  slaDueAt: Date;
  completedAt: Date | null;
  daysRemaining: number;
};

export type EndUserPrivacyView = {
  organizationId: string;
  userId: string;
  userEmail: string;
  consents: Record<ConsentTypeKey, EndUserConsentState | null>;
  history: Array<{
    id: string;
    consentType: ConsentTypeKey;
    granted: boolean;
    occurredAt: Date;
    source: string;
  }>;
  dsars: EndUserDsarRow[];
};

export async function loadEndUserPrivacyView(input: {
  organizationId: string;
  userId: string;
  userEmail: string;
}): Promise<EndUserPrivacyView> {
  const latest = await withTenant(input.organizationId, (tx) =>
    getLatestConsentsForUser({
      organizationId: input.organizationId,
      userId: input.userId,
      tx,
    }),
  );

  const consentsState: Record<ConsentTypeKey, EndUserConsentState | null> =
    {} as Record<ConsentTypeKey, EndUserConsentState | null>;
  for (const [k, v] of Object.entries(latest)) {
    consentsState[k as ConsentTypeKey] = v
      ? {
          consentType: k as ConsentTypeKey,
          granted: v.granted,
          source: v.source,
          occurredAt: v.granted ? v.grantedAt : (v.revokedAt ?? v.grantedAt),
        }
      : null;
  }

  const history = await withTenant(input.organizationId, (tx) =>
    getConsentHistoryForUser({
      organizationId: input.organizationId,
      userId: input.userId,
      tx,
    }),
  );

  // DSARs the user has submitted via the authenticated path. Public
  // submissions don't carry a subject_user_id and stay invisible here
  // (by design — we don't try to correlate by email).
  const dsarRows = await dbAdmin
    .select({
      id: dsarRequests.id,
      referenceCode: dsarRequests.referenceCode,
      requestType: dsarRequests.requestType,
      status: dsarRequests.status,
      receivedAt: dsarRequests.receivedAt,
      slaDueAt: dsarRequests.slaDueAt,
      completedAt: dsarRequests.completedAt,
    })
    .from(dsarRequests)
    .where(
      and(
        eq(dsarRequests.organizationId, input.organizationId),
        eq(dsarRequests.subjectUserId, input.userId),
      ),
    )
    .orderBy(desc(dsarRequests.receivedAt));

  const now = Date.now();
  const dsars: EndUserDsarRow[] = dsarRows.map((r) => ({
    id: r.id,
    referenceCode: r.referenceCode,
    requestType: r.requestType,
    status: r.status,
    submittedAt: r.receivedAt,
    slaDueAt: r.slaDueAt,
    completedAt: r.completedAt,
    daysRemaining: Math.ceil((r.slaDueAt.getTime() - now) / (24 * 60 * 60 * 1000)),
  }));

  return {
    organizationId: input.organizationId,
    userId: input.userId,
    userEmail: input.userEmail,
    consents: consentsState,
    history,
    dsars,
  };
}
