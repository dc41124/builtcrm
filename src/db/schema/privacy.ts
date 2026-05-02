import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { retention, timestamps } from "./_shared";
import { organizations, users } from "./identity";

// -----------------------------------------------------------------------------
// Step 65 — Quebec Law 25 / Privacy Officer surface.
//
// Session B batch (already shipped):
//   - privacy_officers: one designated officer per organization (Law 25 §3.1).
//   - dsar_requests:    public + authenticated DSAR queue. NOT RLS'd —
//     see security_posture.md §6 for the exemption rationale.
//
// Session C batch (this update):
//   - consent_records: per-subject consent toggles + history. Subject is
//     either an authenticated user (subject_user_id) or an email-only
//     identifier (subject_email) — at least one must be set. Org-scoped,
//     RLS'd.
//   - breach_register: incident log. Severity, affected counts, decision
//     to notify users. CAI report flag is informational only — see the
//     compliance boundary doc.
//   - breach_notification_drafts: per-subject email drafts the Privacy
//     Officer reviews before sending. NEVER auto-sent.
//
// Real Law 25 compliance lives in organizational processes, not in this
// schema — see docs/specs/privacy_compliance_boundary.md. CAI notification
// is a flag on dsar_requests / breach_register, not a transmission. The
// product never reports to the Commission directly.
// -----------------------------------------------------------------------------

export const dsarRequestTypeEnum = pgEnum("dsar_request_type", [
  "access",
  "deletion",
  "rectification",
  "portability",
]);

export const dsarStatusEnum = pgEnum("dsar_status", [
  "received",
  "in_progress",
  "completed",
  "rejected",
]);

export const dsarProvinceEnum = pgEnum("dsar_province", [
  "QC",
  "ON",
  "BC",
  "AB",
  "OTHER",
]);

// -----------------------------------------------------------------------------
// privacy_officers — one designated officer per org. Listed publicly on
// /privacy/officer to satisfy Law 25 §3.1.
// -----------------------------------------------------------------------------

export const privacyOfficers = pgTable(
  "privacy_officers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // ON DELETE RESTRICT: an org cannot leave its Privacy Officer slot
    // dangling — re-designate before deleting the user. Matches Law 25's
    // "always have a designated officer" requirement.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    designatedAt: timestamp("designated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Audit fingerprint — who designated this officer? Nullable + SET NULL
    // because the designator might be deactivated / deleted later, and the
    // designation itself remains historically valid.
    designatedByUserId: uuid("designated_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => ({
    orgUnique: unique("privacy_officers_organization_id_unique").on(
      table.organizationId,
    ),
    tenantIsolation: pgPolicy("privacy_officers_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// dsar_requests — Data Subject Access Requests. Public POST is unauthenticated
// (Law 25 §32 mandates that anyone can request, including former users); reads
// happen in admin queries scoped explicitly by organization_id.
//
// NOT RLS'd. The exemption is documented in security_posture.md §6. The trade:
// public POST has no GUC to set, so RLS would block the insert. App-layer
// scoping (every read passes `where(eq(dsarRequests.organizationId, ctx.org))`)
// replaces RLS for this table.
//
// Reference codes are random base36 (`DSAR-{YYYY}-{6-char}`) — no monotonic
// counter table; collisions are checked at insert and retried.
// -----------------------------------------------------------------------------

export const dsarRequests = pgTable(
  "dsar_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceCode: varchar("reference_code", { length: 32 }).notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requesterName: varchar("requester_name", { length: 200 }).notNull(),
    requesterEmail: varchar("requester_email", { length: 320 }).notNull(),
    // "If you held a BuiltCRM account under a different email" — optional
    // fallback identifier. Not used for routing; helps the officer correlate.
    accountEmail: varchar("account_email", { length: 320 }),
    province: dsarProvinceEnum("province").default("QC").notNull(),
    // NULL on public submissions; set by the authenticated DSAR endpoint
    // (Session C) when a logged-in user files via Settings → Privacy. Lets
    // us correlate authenticated requests to the actual user record without
    // forcing the public flow to identify itself.
    subjectUserId: uuid("subject_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    requestType: dsarRequestTypeEnum("request_type").notNull(),
    description: text("description").notNull(),
    status: dsarStatusEnum("status").default("received").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // Computed at insert: receivedAt + 30 days. Law 25 §34 hard deadline.
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }).notNull(),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Internal officer notes — never surfaced to the requester.
    notes: text("notes"),
    // Free-form association to a project (e.g., "Maplewood Heights"). The
    // officer fills this during triage; we don't FK to projects because the
    // request may concern multiple projects or none at all.
    projectContext: varchar("project_context", { length: 200 }),
    ...timestamps,
    ...retention("privacy_fulfillment"),
  },
  (table) => ({
    referenceCodeUnique: unique("dsar_requests_reference_code_unique").on(
      table.referenceCode,
    ),
    orgIdx: index("dsar_requests_organization_id_idx").on(
      table.organizationId,
    ),
    statusIdx: index("dsar_requests_status_idx").on(table.status),
    slaIdx: index("dsar_requests_sla_due_at_idx").on(table.slaDueAt),
    // No pgPolicy — see file header for the RLS exemption rationale.
  }),
);

// -----------------------------------------------------------------------------
// Session C — consent register, breach register, breach-notification drafts.
// -----------------------------------------------------------------------------

export const consentTypeEnum = pgEnum("consent_type", [
  "data_processing",
  "marketing_email",
  "product_updates",
  "analytics",
  "third_party_integrations",
]);

export const breachSeverityEnum = pgEnum("breach_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const breachStatusEnum = pgEnum("breach_status", ["open", "closed"]);

export const breachNotifyDecisionEnum = pgEnum("breach_notify_decision", [
  "pending",
  "notify",
  "no_notify",
]);

export const breachNotificationStatusEnum = pgEnum(
  "breach_notification_status",
  ["draft", "sent", "withdrawn"],
);

// -----------------------------------------------------------------------------
// consent_records — per-subject consent toggles + revocations. Subject is
// either an authenticated user (subject_user_id) or an email-only identifier
// (subject_email); the CHECK constraint requires at least one. Both can be
// set when we know an email-only subject later signs up under that address —
// the application layer is responsible for stitching the records together.
//
// History is captured by inserting new rows on each toggle rather than
// mutating in place. The end-user UI shows a timeline derived from the row
// stream; the admin "consent register" view shows the latest row per
// (subject, consent_type) pair.
// -----------------------------------------------------------------------------

export const consentRecords = pgTable(
  "consent_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    subjectUserId: uuid("subject_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    subjectEmail: varchar("subject_email", { length: 320 }),
    consentType: consentTypeEnum("consent_type").notNull(),
    granted: boolean("granted").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // Free-form short label — e.g. `signup_form`, `preferences_page`,
    // `cookie_banner`, `employment_agreement`. Not enum'd because new
    // surfaces ship faster than we'd alter an enum, and the value is
    // displayed verbatim in the admin register.
    source: varchar("source", { length: 64 }).notNull(),
    ...timestamps,
    ...retention("privacy_fulfillment"),
  },
  (table) => ({
    subjectIdentifier: check(
      "consent_records_subject_identifier_check",
      sql`${table.subjectUserId} IS NOT NULL OR ${table.subjectEmail} IS NOT NULL`,
    ),
    orgUserIdx: index("consent_records_org_user_idx").on(
      table.organizationId,
      table.subjectUserId,
    ),
    orgEmailIdx: index("consent_records_org_email_idx").on(
      table.organizationId,
      table.subjectEmail,
    ),
    orgTypeGrantedIdx: index("consent_records_org_type_granted_idx").on(
      table.organizationId,
      table.consentType,
      table.granted,
    ),
    tenantIsolation: pgPolicy("consent_records_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// breach_register — incident log. CAI reporting (`reported_to_cai_at`) is a
// flag, NOT a transmission — see docs/specs/privacy_compliance_boundary.md.
// `notify_users_decision` records the officer's call on whether to draft
// per-subject emails; the actual drafts live in `breach_notification_drafts`.
// -----------------------------------------------------------------------------

export const breachRegister = pgTable(
  "breach_register",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referenceCode: varchar("reference_code", { length: 32 }).notNull(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    // Free-form qualifier on occurred_at — e.g. "(est.)", "approximate",
    // "first observed". Sits next to the timestamp in the admin UI.
    occurredAtNote: varchar("occurred_at_note", { length: 120 }),
    severity: breachSeverityEnum("severity").notNull(),
    affectedCount: integer("affected_count"),
    affectedDescription: text("affected_description").notNull(),
    // Postgres array. Indexed nominally; queries here are admin-only and
    // small N, so a GIN index would be overkill.
    dataTypesAffected: text("data_types_affected")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    containmentActions: text("containment_actions"),
    notifyUsersDecision: breachNotifyDecisionEnum("notify_users_decision")
      .default("pending")
      .notNull(),
    notifiedUsersAt: timestamp("notified_users_at", { withTimezone: true }),
    // CAI flag — INFORMATIONAL ONLY. Setting this column does NOT transmit
    // anything to the Commission. See compliance boundary doc.
    reportedToCaiAt: timestamp("reported_to_cai_at", { withTimezone: true }),
    status: breachStatusEnum("status").default("open").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedByUserId: uuid("closed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    loggedByUserId: uuid("logged_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
    ...retention("privacy_fulfillment"),
  },
  (table) => ({
    referenceCodeUnique: unique("breach_register_reference_code_unique").on(
      table.referenceCode,
    ),
    orgStatusIdx: index("breach_register_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    orgDiscoveredIdx: index("breach_register_org_discovered_idx").on(
      table.organizationId,
      table.discoveredAt,
    ),
    tenantIsolation: pgPolicy("breach_register_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// breach_notification_drafts — per-subject email drafts the Privacy Officer
// reviews before sending. The system NEVER auto-sends. Drafts can be edited,
// withdrawn, or marked sent; the `sent_at` and `sent_by_user_id` columns
// record the human attestation that an email was actually dispatched.
//
// `organization_id` is denormalized off `breach_register` so the RLS policy
// stays a single-clause `org_id = GUC` lookup instead of a join — same
// pattern as photo_pins / audit children.
// -----------------------------------------------------------------------------

export const breachNotificationDrafts = pgTable(
  "breach_notification_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    breachId: uuid("breach_id")
      .notNull()
      .references(() => breachRegister.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    subjectLine: varchar("subject_line", { length: 300 }).notNull(),
    bodyText: text("body_text").notNull(),
    status: breachNotificationStatusEnum("status").default("draft").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
    ...retention("privacy_fulfillment"),
  },
  (table) => ({
    breachIdx: index("breach_notification_drafts_breach_idx").on(
      table.breachId,
    ),
    orgStatusIdx: index("breach_notification_drafts_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    tenantIsolation: pgPolicy("breach_notification_drafts_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();
