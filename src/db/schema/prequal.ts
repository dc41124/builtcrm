import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { retention, timestamps } from "./_shared";
import {
  organizations,
  prequalEnforcementModeEnum,
  users,
} from "./identity";
import { projects } from "./projects";

// Re-export the enum from identity.ts where it's declared (it's referenced
// by both `organizations.prequal_enforcement_mode` and the prequal action
// layer; declared in identity to avoid a circular import).
export { prequalEnforcementModeEnum };

/**
 * Phase 5 — Subcontractor Prequalification (Step 49 / item 5.3 #49)
 *
 * White-space feature. Contractors require subs to complete a prequalification
 * before being awarded work: intake form with weighted scoring, gating
 * questions for auto-fail conditions, supporting documents (bond, insurance,
 * safety manual, references, financials), human review, expiry, and an
 * assignment-time check that warns or blocks adding an unqualified sub to a
 * project.
 *
 * Schema source of truth: docs/specs/Step 49/drizzle_schema_phase5_prequal.ts
 * (v2, 2026-04-25). This file is the production copy with real cross-schema
 * imports and `...timestamps` spread per repo convention.
 *
 * --- Why prequal_documents has its own storage columns (audit B4) ---
 * The existing `documents` table requires `project_id NOT NULL`. Prequal
 * happens once per (sub, contractor) and isn't scoped to a project at upload
 * time. Rather than make `documents.project_id` nullable (wide blast radius),
 * `prequal_documents` carries its own minimal storage row.
 *
 * --- Why prequal_project_exemptions is its own table (audit S8) ---
 * Block-mode escape. Deriving the current exemption set from `audit_events`
 * is fragile (no FK protection, slow lookups). A dedicated table is cleaner.
 */

// =============================================================================
// Enums
// =============================================================================

export const prequalSubmissionStatusEnum = pgEnum("prequal_submission_status", [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "expired",
]);

export const prequalDocumentTypeEnum = pgEnum("prequal_document_type", [
  "bond",
  "insurance",
  "safety_manual",
  "references",
  "financial_statements",
]);

// prequalEnforcementModeEnum lives in ./identity.ts (declared next to the
// `organizations.prequal_enforcement_mode` column to break a circular import).
// Re-exported above for callers that import it from this module.

// =============================================================================
// prequal_templates
// =============================================================================

export const prequalTemplates = pgTable(
  "prequal_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    // NULL = general / applies to any trade.
    tradeCategory: varchar("trade_category", { length: 120 }),

    // One default per (orgId, tradeCategory) tuple — see partial unique below.
    isDefault: boolean("is_default").default(false).notNull(),

    // NULL = never expires. Default 12.
    validityMonths: integer("validity_months").default(12),

    // questions_json shape — see proposal §2.2.
    questionsJson: jsonb("questions_json").default(sql`'[]'::jsonb`).notNull(),

    // scoring_rules shape — see proposal §2.3.
    scoringRules: jsonb("scoring_rules")
      .default(sql`'{"passThreshold": 0, "gatingFailValues": {}}'::jsonb`)
      .notNull(),

    // Soft-archive: archived templates can't accept new invitations but
    // existing submissions still reference them. Hard-delete is forbidden.
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    ...timestamps,
  },
  (table) => ({
    orgIdx: index("prequal_templates_org_idx").on(table.orgId),
    tradeIdx: index("prequal_templates_trade_idx").on(
      table.orgId,
      table.tradeCategory,
    ),
    archivedIdx: index("prequal_templates_archived_idx").on(table.archivedAt),
    // One default per (org, trade) tuple — partial unique. Drizzle's
    // uniqueIndex(...).where(...) builder works (precedent: closeoutPackages.ts).
    defaultUnique: uniqueIndex("prequal_templates_default_unique")
      .on(table.orgId, table.tradeCategory)
      .where(sql`${table.isDefault} = true`),
    // Phase 4 prequal cluster — Pattern A (single-org strict). Templates
    // are contractor-owned; subs only see template questions inlined into
    // their invitation, never query this table directly.
    tenantIsolation: pgPolicy("prequal_templates_tenant_isolation", {
      for: "all",
      using: sql`${table.orgId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.orgId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// =============================================================================
// prequal_submissions
//
// "Active" submission = the most recent row for (subOrgId, contractorOrgId)
// where status NOT IN ('rejected', 'expired'). Computed in the loader.
// =============================================================================

export const prequalSubmissions = pgTable(
  "prequal_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Required even after the template is archived — historical submissions
    // stay readable.
    templateId: uuid("template_id")
      .notNull()
      .references(() => prequalTemplates.id, { onDelete: "restrict" }),

    submittedByOrgId: uuid("submitted_by_org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Denormalized from template.org_id so the active-submission lookup
    // for a (sub, contractor) pair is a single-table query.
    contractorOrgId: uuid("contractor_org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    answersJson: jsonb("answers_json").default(sql`'{}'::jsonb`).notNull(),

    // Internal to the contractor; subs never see this value.
    scoreTotal: integer("score_total"),

    // jsonb string[] of question keys that failed gating. Empty = no fails.
    gatingFailures: jsonb("gating_failures")
      .default(sql`'[]'::jsonb`)
      .notNull(),

    status: prequalSubmissionStatusEnum("status").default("draft").notNull(),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewerNotes: text("reviewer_notes"),

    // expires_at = reviewedAt + template.validityMonths. NULL = no expiry
    // (template.validityMonths NULL) or not yet approved.
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Idempotency map for the daily expiry-sweep Trigger.dev v3 task.
    // Shape: { "30": "2026-04-12T02:00:00Z", "14": null, "7": null }.
    // Prevents duplicate emails when the sweep runs more than once per day.
    remindersSentJson: jsonb("reminders_sent_json")
      .default(sql`'{}'::jsonb`)
      .notNull(),

    ...timestamps,
    ...retention("statutory_construction"),
  },
  (table) => ({
    pairIdx: index("prequal_submissions_pair_idx").on(
      table.submittedByOrgId,
      table.contractorOrgId,
    ),
    contractorStatusIdx: index("prequal_submissions_contractor_status_idx").on(
      table.contractorOrgId,
      table.status,
    ),
    subIdx: index("prequal_submissions_sub_idx").on(table.submittedByOrgId),
    templateIdx: index("prequal_submissions_template_idx").on(table.templateId),
    statusIdx: index("prequal_submissions_status_idx").on(table.status),
    // Index for the daily expiry sweep: find approved submissions whose
    // expires_at has passed.
    expiryIdx: index("prequal_submissions_expiry_idx").on(
      table.status,
      table.expiresAt,
    ),
    // Phase 4 prequal cluster — NEW SHAPE: 2-clause own-side multi-org.
    // A submission is a contract between exactly two orgs (the sub who
    // submitted, the contractor reviewing). No project_id exists — subs
    // do prequal ONCE per contractor, before any project assignment, so
    // the project-scoped 2-clause hybrid doesn't fit. No POM clause
    // either — POM is project membership and prequal predates it.
    // Both clauses are equality on the (submittedByOrgId, contractorOrgId)
    // indexed columns; fast even at scale.
    tenantIsolation: pgPolicy("prequal_submissions_tenant_isolation", {
      for: "all",
      using: sql`
        ${table.submittedByOrgId} = current_setting('app.current_org_id', true)::uuid
        OR ${table.contractorOrgId} = current_setting('app.current_org_id', true)::uuid
      `,
      withCheck: sql`
        ${table.submittedByOrgId} = current_setting('app.current_org_id', true)::uuid
        OR ${table.contractorOrgId} = current_setting('app.current_org_id', true)::uuid
      `,
    }),
  }),
).enableRLS();

// =============================================================================
// prequal_documents
//
// SELF-CONTAINED storage. Does NOT reference the documents table (which
// requires a project_id; prequal docs have no project at upload time).
// Multiple rows per (submissionId, documentType) are allowed.
//
// Storage:
//   - storage_key: R2 object key. App layer mediates retrieval via signed URLs.
//   - title / file_size_bytes / mime_type / uploaded_by_user_id captured at
//     upload time; immutable thereafter.
//
// Cascade: when a submission is hard-deleted (rare; only spam/abuse),
// prequal_documents rows go with it. R2 objects must be cleaned up by an
// out-of-band job listening on the cascade.
// =============================================================================

export const prequalDocuments = pgTable(
  "prequal_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    submissionId: uuid("submission_id")
      .notNull()
      .references(() => prequalSubmissions.id, { onDelete: "cascade" }),

    documentType: prequalDocumentTypeEnum("document_type").notNull(),

    storageKey: text("storage_key").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),

    uploadedByUserId: uuid("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    label: varchar("label", { length: 255 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    ...retention("statutory_construction"),
  },
  (table) => ({
    submissionIdx: index("prequal_documents_submission_idx").on(
      table.submissionId,
    ),
    typeIdx: index("prequal_documents_type_idx").on(table.documentType),
    submissionTypeIdx: index("prequal_documents_submission_type_idx").on(
      table.submissionId,
      table.documentType,
    ),
    // Phase 4 prequal cluster — nested-via-parent on prequal_submissions.
    // Inherits the 2-clause own-side multi-org policy via the parent SELECT.
    tenantIsolation: pgPolicy("prequal_documents_tenant_isolation", {
      for: "all",
      using: sql`${table.submissionId} IN (SELECT id FROM prequal_submissions)`,
      withCheck: sql`${table.submissionId} IN (SELECT id FROM prequal_submissions)`,
    }),
  }),
).enableRLS();

// =============================================================================
// prequal_project_exemptions
//
// Block-mode escape hatch. When a contractor org has prequal_enforcement_mode
// = 'block' and needs to add a sub to a project despite no active approved
// prequal, an authorized contractor user grants an exemption scoped to that
// (project, sub_org) pair.
//
// One ACTIVE exemption per (projectId, subOrgId) — partial unique where
// revoked_at IS NULL. Re-granting after revoke is allowed and creates a new
// row.
//
// In 'warn' mode there's no exemption row — the override is captured in
// audit_events when the inviter clicks "Proceed anyway". Exemptions are a
// 'block'-mode-only construct.
// =============================================================================

export const prequalProjectExemptions = pgTable(
  "prequal_project_exemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),

    subOrgId: uuid("sub_org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    // Denormalized for the common query "what exemptions has my org granted?".
    // FK declared explicitly below — auto-name
    // (prequal_project_exemptions_contractor_org_id_organizations_id_fk) is
    // 64 chars and Postgres silently truncates to 63, which drizzle-kit
    // re-proposes on every introspection. Per CLAUDE.md, declare a short
    // stable name when the auto-name exceeds the limit.
    contractorOrgId: uuid("contractor_org_id").notNull(),

    grantedByUserId: uuid("granted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    reason: text("reason").notNull(),

    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Optional time-bound exemption. NULL = exemption stands until manually
    // revoked or until an active approved prequal lands.
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Soft-revoke. Kept for audit.
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...retention("statutory_construction"),
  },
  (table) => ({
    projectSubIdx: index("prequal_project_exemptions_project_sub_idx").on(
      table.projectId,
      table.subOrgId,
    ),
    contractorIdx: index("prequal_project_exemptions_contractor_idx").on(
      table.contractorOrgId,
    ),
    // One ACTIVE exemption per (project, sub) pair.
    activeUnique: uniqueIndex("prequal_project_exemptions_active_unique")
      .on(table.projectId, table.subOrgId)
      .where(sql`${table.revokedAt} IS NULL`),
    // Explicit short-form FK — auto-name is 64 chars (Postgres limit 63).
    contractorOrgFk: foreignKey({
      columns: [table.contractorOrgId],
      foreignColumns: [organizations.id],
      name: "prequal_project_exemptions_contractor_org_id_fk",
    }).onDelete("cascade"),
    // Phase 4 wave 1 — same project-scoped multi-org template as milestones.
    // Note: contractorOrgId is denormalized for query convenience; the
    // policy goes through projects (single source of truth) per the
    // template, so a contractor-org desync wouldn't widen access.
    tenantIsolation: pgPolicy("prequal_project_exemptions_tenant_isolation", {
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
