import { sql } from "drizzle-orm";
import {
  foreignKey,
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

import { timestamps } from "./_shared";
import { documents } from "./documents";
import { users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const transmittalStatusEnum = pgEnum("transmittal_status", [
  "draft",
  "sent",
]);

// -----------------------------------------------------------------------------
// transmittals — formal cover-letter record for sending a document bundle.
//
// Distinct from Submittals (which carry a reviewer workflow and stamps)
// and from Messages (conversational). A transmittal has one sender,
// many recipients, many attached documents, and a sent-once state
// machine: draft → sent (terminal; no "unsend").
//
// Sequential number (TM-NNNN) uses the atomic counter on projects —
// bumped on FIRST SEND, not on draft create. That means draft rows
// have `sequential_number = NULL`; they acquire a number the moment
// the contractor hits "Send". If a contractor abandons every third
// draft, the numbered series stays gap-free.
//
// State machine (enforced in action layer):
//   draft → sent     (terminal)
//   draft (delete)   (hard delete — no audit breadcrumb needed on a
//                     row that was never sent)
// -----------------------------------------------------------------------------

export const transmittals = pgTable(
  "transmittals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // Nullable until first send. `status = 'sent'` implies non-null.
    sequentialNumber: integer("sequential_number"),
    subject: varchar("subject", { length: 300 }).notNull(),
    message: text("message").default("").notNull(),
    status: transmittalStatusEnum("status").default("draft").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    projectNumberUnique: unique("transmittals_project_number_unique").on(
      table.projectId,
      table.sequentialNumber,
    ),
    projectStatusIdx: index("transmittals_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    sentAtIdx: index("transmittals_sent_at_idx").on(table.sentAt),
    // Phase 4 wave 6 — project-scoped 2-clause hybrid (same template
    // as milestones / daily_logs / wave-4 trio / documents).
    tenantIsolation: pgPolicy("transmittals_tenant_isolation", {
      for: "all",
      using: sql`
        ${table.projectId} IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR ${table.projectId} IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      `,
      withCheck: sql`
        ${table.projectId} IN (
          SELECT id FROM projects
          WHERE contractor_organization_id = current_setting('app.current_org_id', true)::uuid
        )
        OR ${table.projectId} IN (
          SELECT project_id FROM project_organization_memberships
          WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            AND membership_status = 'active'
        )
      `,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// transmittal_recipients — one row per invited email on a transmittal.
//
// SECURITY: the access token is stored as a SHA-256 DIGEST, never
// plaintext. The plaintext is generated at send-time, handed to the
// caller (embedded in the per-recipient share URL surfaced in the UI
// and/or the email body), then discarded. Validating the download
// route hashes the inbound URL token and compares against the stored
// digest. DB compromise does not enable download of past bundles.
// Matches the existing invitation-token pattern in
// src/lib/invitations/token.ts.
//
// `revoked_at` is a soft-revocation flag — GC can kill a single
// recipient's link without nuking the whole transmittal. `expires_at`
// is nullable (null = never expires) but leaves room for a future
// policy (e.g. "links expire 90 days after send") without another
// migration. Both are enforced on the download path.
//
// `first_downloaded_at` + `last_downloaded_at` + `total_downloads`
// are rollups maintained atomically by the download action — the
// authoritative per-download log lives in transmittal_access_events.
// -----------------------------------------------------------------------------

export const transmittalRecipients = pgTable(
  "transmittal_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transmittalId: uuid("transmittal_id")
      .notNull()
      .references(() => transmittals.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    // Optional informational org label ("Steel Frame Co.") — not a FK
    // to organizations because transmittals often go to contacts who
    // don't have an org record in the system (external architects,
    // city reviewers, etc.).
    orgLabel: varchar("org_label", { length: 160 }),
    // SHA-256 hex digest of the access token (64 chars). Nullable on
    // draft rows; populated on send.
    accessTokenDigest: varchar("access_token_digest", { length: 64 }),
    firstDownloadedAt: timestamp("first_downloaded_at", { withTimezone: true }),
    lastDownloadedAt: timestamp("last_downloaded_at", { withTimezone: true }),
    totalDownloads: integer("total_downloads").default(0).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    transmittalIdx: index("transmittal_recipients_transmittal_idx").on(
      table.transmittalId,
    ),
    // Unique per-transmittal email — prevents the same recipient being
    // added twice (which would also mean two tokens, two share URLs, a
    // confusing access log).
    emailUnique: unique("transmittal_recipients_email_unique").on(
      table.transmittalId,
      table.email,
    ),
    // Index on the digest — the anonymous download path looks up rows
    // by digest, so this is on the hot path.
    digestIdx: index("transmittal_recipients_digest_idx").on(
      table.accessTokenDigest,
    ),
    tenantIsolation: pgPolicy("transmittal_recipients_tenant_isolation", {
      for: "all",
      using: sql`${table.transmittalId} IN (SELECT id FROM transmittals)`,
      withCheck: sql`${table.transmittalId} IN (SELECT id FROM transmittals)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// transmittal_documents — join to documents. `sort_order` preserves the
// GC's chosen layout inside the generated ZIP. Unique on
// (transmittal_id, document_id) so the same doc can't be double-
// attached. No `pin_version` flag: the ZIP streamer reads whatever
// R2 object the document points to AT DOWNLOAD TIME. If a stricter
// point-in-time guarantee is needed later, copy the R2 object
// into a transmittal-owned prefix on send.
// -----------------------------------------------------------------------------

export const transmittalDocuments = pgTable(
  "transmittal_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transmittalId: uuid("transmittal_id")
      .notNull()
      .references(() => transmittals.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    attachedByUserId: uuid("attached_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    transmittalIdx: index("transmittal_documents_transmittal_idx").on(
      table.transmittalId,
    ),
    uniquePair: unique("transmittal_documents_unique").on(
      table.transmittalId,
      table.documentId,
    ),
    tenantIsolation: pgPolicy("transmittal_documents_tenant_isolation", {
      for: "all",
      using: sql`${table.transmittalId} IN (SELECT id FROM transmittals)`,
      withCheck: sql`${table.transmittalId} IN (SELECT id FROM transmittals)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// transmittal_access_events — per-download log. The detail view's
// access log tab renders from here, not from the rollup counters on
// the recipient row. Every successful download writes a row inside
// the same transaction that bumps the rollups. IP + user-agent are
// captured best-effort from request headers (nullable for edge cases
// like stripped CDN headers).
// -----------------------------------------------------------------------------

export const transmittalAccessEvents = pgTable(
  "transmittal_access_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientId: uuid("recipient_id").notNull(),
    downloadedAt: timestamp("downloaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    recipientIdx: index("transmittal_access_events_recipient_idx").on(
      table.recipientId,
    ),
    downloadedAtIdx: index("transmittal_access_events_downloaded_at_idx").on(
      table.downloadedAt,
    ),
    // Explicit short-form name: auto-name would run the 63-char limit.
    recipientFk: foreignKey({
      columns: [table.recipientId],
      foreignColumns: [transmittalRecipients.id],
      name: "transmittal_access_events_recipient_fk",
    }).onDelete("cascade"),
    // Depth-2 nested-via-parent: chain through recipients to
    // transmittals. Inner subquery inherits transmittal_recipients'
    // policy (which inherits transmittals'); the outer subquery
    // narrows by recipient.
    tenantIsolation: pgPolicy("transmittal_access_events_tenant_isolation", {
      for: "all",
      using: sql`${table.recipientId} IN (SELECT id FROM transmittal_recipients)`,
      withCheck: sql`${table.recipientId} IN (SELECT id FROM transmittal_recipients)`,
    }),
  }),
).enableRLS();
