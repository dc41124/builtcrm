// Step 65 Session C — consent record helpers.
//
// Every grant or revocation writes a NEW row in `consent_records`
// (history is append-only; we never UPDATE an existing row). The end-user
// UI shows the timeline derived from the row stream; the admin register
// shows the latest row per (subject, consent_type) via a window function.

import { and, desc, eq, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { consentRecords } from "@/db/schema";
import {
  ALL_CONSENT_KEYS,
  CONSENT_CATALOG,
  type ConsentTypeKey,
  getConsentMeta,
} from "@/lib/privacy/consent-catalog";

type DbOrTx =
  | typeof dbAdmin
  | Parameters<Parameters<typeof dbAdmin.transaction>[0]>[0];

export type ConsentSubject =
  | { kind: "user"; userId: string }
  | { kind: "email"; email: string };

export type RecordedConsent = {
  id: string;
  consentType: ConsentTypeKey;
  granted: boolean;
  grantedAt: Date;
  revokedAt: Date | null;
  source: string;
};

// Write a single consent decision. Use this for individual toggles from
// the end-user preferences page. `source` is a short label like
// "preferences_page" or "cookie_banner" — kept verbatim in the row.
export async function recordConsent(input: {
  organizationId: string;
  subject: ConsentSubject;
  consentType: ConsentTypeKey;
  granted: boolean;
  source: string;
  tx?: DbOrTx;
}): Promise<{ id: string }> {
  const meta = getConsentMeta(input.consentType);
  if (meta.required && !input.granted) {
    throw new Error(
      `Cannot revoke required consent: ${input.consentType}. Required consents are tied to the account lifecycle.`,
    );
  }

  const tx = input.tx ?? dbAdmin;
  const now = new Date();
  const [row] = await tx
    .insert(consentRecords)
    .values({
      organizationId: input.organizationId,
      subjectUserId: input.subject.kind === "user" ? input.subject.userId : null,
      subjectEmail: input.subject.kind === "email" ? input.subject.email : null,
      consentType: input.consentType,
      granted: input.granted,
      grantedAt: input.granted ? now : now,
      revokedAt: input.granted ? null : now,
      source: input.source,
    })
    .returning({ id: consentRecords.id });
  return { id: row.id };
}

// Bulk-write the initial consent set at signup. Required consents are
// always granted; optional consents respect the user's selection (or
// fall back to the catalog default). One row per consent type.
export async function recordSignupConsents(input: {
  organizationId: string;
  userId: string;
  acceptedOptional: Partial<Record<ConsentTypeKey, boolean>>;
  source?: string;
  tx?: DbOrTx;
}): Promise<void> {
  const tx = input.tx ?? dbAdmin;
  const now = new Date();
  const rows = CONSENT_CATALOG.map((meta) => {
    const granted = meta.required
      ? true
      : (input.acceptedOptional[meta.id] ?? meta.defaultGranted);
    return {
      organizationId: input.organizationId,
      subjectUserId: input.userId,
      subjectEmail: null,
      consentType: meta.id,
      granted,
      grantedAt: now,
      revokedAt: granted ? null : now,
      source: input.source ?? "signup_form",
    };
  });
  await tx.insert(consentRecords).values(rows);
}

// Latest row per (subject, consent_type) for an authenticated user.
// Used by the end-user preferences page to render the current toggle
// state, and by the admin register filter on per-subject status.
export async function getLatestConsentsForUser(input: {
  organizationId: string;
  userId: string;
  tx?: DbOrTx;
}): Promise<Record<ConsentTypeKey, RecordedConsent | null>> {
  const tx = input.tx ?? dbAdmin;
  const result: Record<ConsentTypeKey, RecordedConsent | null> = Object.fromEntries(
    ALL_CONSENT_KEYS.map((k) => [k, null]),
  ) as Record<ConsentTypeKey, RecordedConsent | null>;

  // DISTINCT ON gets the latest row per consent_type without a window join.
  // Order by created_at DESC inside the partition.
  const rows = await tx
    .selectDistinctOn([consentRecords.consentType], {
      id: consentRecords.id,
      consentType: consentRecords.consentType,
      granted: consentRecords.granted,
      grantedAt: consentRecords.grantedAt,
      revokedAt: consentRecords.revokedAt,
      source: consentRecords.source,
    })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.organizationId, input.organizationId),
        eq(consentRecords.subjectUserId, input.userId),
      ),
    )
    .orderBy(consentRecords.consentType, desc(consentRecords.createdAt));

  for (const row of rows) {
    result[row.consentType as ConsentTypeKey] = row;
  }
  return result;
}

// Full append-only timeline for one user's consents. Powers the
// end-user "history" tab.
export async function getConsentHistoryForUser(input: {
  organizationId: string;
  userId: string;
  tx?: DbOrTx;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    consentType: ConsentTypeKey;
    granted: boolean;
    occurredAt: Date;
    source: string;
  }>
> {
  const tx = input.tx ?? dbAdmin;
  const rows = await tx
    .select({
      id: consentRecords.id,
      consentType: consentRecords.consentType,
      granted: consentRecords.granted,
      grantedAt: consentRecords.grantedAt,
      revokedAt: consentRecords.revokedAt,
      source: consentRecords.source,
      createdAt: consentRecords.createdAt,
    })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.organizationId, input.organizationId),
        eq(consentRecords.subjectUserId, input.userId),
      ),
    )
    .orderBy(desc(consentRecords.createdAt))
    .limit(input.limit ?? 200);

  return rows.map((r) => ({
    id: r.id,
    consentType: r.consentType as ConsentTypeKey,
    granted: r.granted,
    occurredAt: r.granted ? r.grantedAt : r.revokedAt ?? r.createdAt,
    source: r.source,
  }));
}

// Admin-side: latest row per (subject, consent_type) across the whole org,
// flattened for the consent-register table. Subject is identified by user
// id when available, falling back to email-only rows.
export type ConsentRegisterRow = {
  subjectKey: string;
  subjectName: string | null;
  subjectEmail: string;
  consentType: ConsentTypeKey;
  granted: boolean;
  grantedAt: Date;
  revokedAt: Date | null;
  source: string;
};

export async function listConsentRegister(input: {
  organizationId: string;
  tx?: DbOrTx;
}): Promise<ConsentRegisterRow[]> {
  const tx = input.tx ?? dbAdmin;
  // Latest row per (subject, consent_type). DISTINCT ON over (subject_user_id,
  // subject_email, consent_type) — at least one of subject_user_id /
  // subject_email is non-null (CHECK constraint), so the partition key is
  // stable. We coalesce to a string for the partition.
  const rows = await tx.execute<{
    id: string;
    subject_user_id: string | null;
    subject_email: string | null;
    user_display_name: string | null;
    user_email: string | null;
    consent_type: ConsentTypeKey;
    granted: boolean;
    granted_at: Date;
    revoked_at: Date | null;
    source: string;
  }>(sql`
    SELECT DISTINCT ON (
      COALESCE(cr.subject_user_id::text, cr.subject_email),
      cr.consent_type
    )
      cr.id,
      cr.subject_user_id,
      cr.subject_email,
      u.display_name AS user_display_name,
      u.email AS user_email,
      cr.consent_type,
      cr.granted,
      cr.granted_at,
      cr.revoked_at,
      cr.source
    FROM ${consentRecords} cr
    LEFT JOIN users u ON u.id = cr.subject_user_id
    WHERE cr.organization_id = ${input.organizationId}
    ORDER BY
      COALESCE(cr.subject_user_id::text, cr.subject_email),
      cr.consent_type,
      cr.created_at DESC
  `);

  return rows.map((r) => ({
    subjectKey: r.subject_user_id ?? `email:${r.subject_email}`,
    subjectName: r.user_display_name,
    subjectEmail: r.user_email ?? r.subject_email ?? "",
    consentType: r.consent_type,
    granted: r.granted,
    grantedAt: r.granted_at,
    revokedAt: r.revoked_at,
    source: r.source,
  }));
}
