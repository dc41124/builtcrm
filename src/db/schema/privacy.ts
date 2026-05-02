import {
  index,
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

import { timestamps } from "./_shared";
import { organizations, users } from "./identity";

// -----------------------------------------------------------------------------
// Step 65 — Quebec Law 25 / Privacy Officer surface (Session B batch).
//
// Two tables in this batch:
//   - privacy_officers: one designated officer per organization (Law 25 §3.1).
//     Org-scoped, RLS'd via the standard `current_org_id` GUC.
//   - dsar_requests:    public + authenticated DSAR queue. INTENTIONALLY NOT
//     RLS'd — see security_posture.md §6 for the exemption rationale and the
//     app-layer scoping contract that replaces it.
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
