import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Phase 5 — Subcontractor Prequalification (Step 49 / item 5.3 #49)
 *
 * Revision: v2 (post Claude Code audit, 2026-04-25).
 *
 * Changes from v1:
 *  - prequal_documents: dropped FK to documents.id (documents.project_id is
 *    NOT NULL; prequal docs have no project at upload time). Added
 *    self-contained storage columns (storage_key, title, file_size_bytes,
 *    mime_type, uploaded_by_user_id).
 *  - prequal_submissions: added reminders_sent_json for sweep idempotency.
 *  - new table prequal_project_exemptions for block-mode escape hatch.
 *  - removed db:push references; this repo uses db:generate + db:migrate.
 *  - removed "hand-rolled SQL" hedge for partial unique indexes; Drizzle's
 *    uniqueIndex(...).where(...) builder works (precedent: closeoutPackages.ts).
 *
 * White-space feature. Contractors require subs to complete a prequalification
 * before being awarded work: intake form with weighted scoring, gating questions
 * for auto-fail conditions, supporting documents (bond, insurance, safety manual,
 * references, financials), human review, expiry, and an assignment-time check
 * that warns or blocks adding an unqualified sub to a project.
 *
 * New tables (4):
 *  1. prequal_templates           — contractor-defined intake forms
 *  2. prequal_submissions         — sub-completed answers + decision state
 *  3. prequal_documents           — typed file attachments per submission
 *                                   (self-contained storage; no FK to documents)
 *  4. prequal_project_exemptions  — block-mode escape: per-project, per-sub
 *                                   exemption granted by contractor
 *
 * Modifications to existing tables:
 *  - organizations: add `prequal_enforcement_mode` column for warn/block/off.
 *
 * New enums:
 *  - prequal_submission_status
 *  - prequal_document_type
 *  - prequal_enforcement_mode
 *
 * Design decisions are documented in
 *   docs/specs/step_49_subcontractor_prequalification_design_proposal.md (v2)
 *
 * --- Why prequal_documents has its own storage columns (audit item B4) ---
 *
 * The existing `documents` table requires `project_id NOT NULL`. Prequal
 * happens once per (sub, contractor) and is NOT scoped to a project at upload
 * time. Rather than make `documents.project_id` nullable (wide blast radius
 * across every document loader, visibility check, and the documents UI),
 * prequal_documents carries its own minimal storage row. Prequal docs are
 * one-shot attachments — they don't need supersedes-chain, audience scoping,
 * or the documents-table category system. The transmittal_recipients table
 * sets a similar precedent of keeping isolated storage close to home.
 *
 * --- Why prequal_project_exemptions is its own table (audit item S8) ---
 *
 * In `block` enforcement mode, the contractor can grant an exemption that lets
 * a specific sub be assigned to a specific project despite no active approved
 * prequal. We could derive the current exemption set by querying audit_events,
 * but that's fragile (filter logic in every read path, no FK protection,
 * lookups slow without specialized indexes). A dedicated table is cleaner.
 *
 * Conventions followed:
 *  - UUID PKs with defaultRandom()
 *  - Long-form FK constraint naming: {srcTable}_{srcCol}_{refTable}_{refCol}_fk
 *  - Indexes named {table}_{col}_idx
 *  - jsonb for flexible structures
 *  - Score values are plain integers (ordinal, not currency)
 *  - Schema workflow: edit → npm run db:generate → npm run db:migrate
 *  - Partial unique indexes use Drizzle's uniqueIndex(...).where(sql`...`)
 *    builder (proven path — see closeoutPackages.ts).
 *
 * In production this file lands at src/db/schema/prequal.ts and the stub
 * imports below are replaced with real imports from ./identity, ./projects,
 * and ./_shared.
 */

// =============================================================================
// References to existing tables (replaced with real imports in production)
// =============================================================================

// import { organizations, users } from "./identity";
// import { projects } from "./projects";
// import { timestamps } from "./_shared";

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

/**
 * off   — feature is on for the org but assignment never checks.
 * warn  — show a non-blocking warning when assigning a sub without an active
 *         approved prequal. Override is audit-logged.
 * block — hard block. Contractor must approve a prequal or grant a per-project
 *         exemption (prequal_project_exemptions) before the sub can be assigned.
 *
 * Migration default for existing rows is 'off'. New contractor orgs created
 * after this migration default to 'warn' (set in app code at org-creation,
 * not at the schema default level).
 */
export const prequalEnforcementModeEnum = pgEnum("prequal_enforcement_mode", [
  "off",
  "warn",
  "block",
]);

// =============================================================================
// prequal_templates
//
// One contractor org owns 0..N templates. Each template is either trade-scoped
// (tradeCategory set) or general (tradeCategory NULL). One default per (org,
// trade) tuple, enforced by a partial unique index where is_default = true.
//
// questions_json shape (array of question objects):
//   [
//     {
//       "key": "years_in_business",
//       "label": "How many years has your company been in business?",
//       "type": "number",
//       "required": true,
//       "weight": 10,
//       "scoreBands": [
//         { "min": 0,  "max": 2,  "points": 0 },
//         { "min": 3,  "max": 5,  "points": 5 },
//         { "min": 6,  "max": 999,"points": 10 }
//       ]
//     },
//     {
//       "key": "bankruptcy_history",
//       "label": "Has your company filed for bankruptcy in the last 5 years?",
//       "type": "yes_no",
//       "required": true,
//       "weight": 0,
//       "gating": true
//     }
//   ]
//
// scoring_rules shape:
//   {
//     "passThreshold": 60,
//     "gatingFailValues": {
//       "bankruptcy_history": true,
//       "active_litigation":  true
//     }
//   }
// =============================================================================

export const prequalTemplates = pgTable(
  "prequal_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    orgId: uuid("org_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    /**
     * Optional trade scope. NULL = general / applies to any trade.
     */
    tradeCategory: varchar("trade_category", { length: 120 }),

    /**
     * Whether this template is the default for its (orgId, tradeCategory)
     * combination. Enforced via partial unique index below.
     */
    isDefault: boolean("is_default").default(false).notNull(),

    /**
     * How many months an approved submission against this template stays
     * valid. NULL = never expires. Default 12.
     */
    validityMonths: integer("validity_months").default(12),

    questionsJson: jsonb("questions_json").default(sql`'[]'::jsonb`).notNull(),

    scoringRules: jsonb("scoring_rules")
      .default(sql`'{"passThreshold": 0, "gatingFailValues": {}}'::jsonb`)
      .notNull(),

    /**
     * Soft-archive: archived templates can't be used for new invitations but
     * existing submissions still reference them. Hard-delete is forbidden.
     */
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdByUserId: uuid("created_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),

    // ...timestamps spread when in src/db/schema/prequal.ts
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("prequal_templates_org_idx").on(table.orgId),
    tradeIdx: index("prequal_templates_trade_idx").on(table.orgId, table.tradeCategory),
    archivedIdx: index("prequal_templates_archived_idx").on(table.archivedAt),
    /**
     * One default per (org, trade) tuple. Allows multiple non-defaults to
     * coexist. Drizzle's partial-unique-index builder handles this directly.
     */
    defaultUnique: uniqueIndex("prequal_templates_default_unique")
      .on(table.orgId, table.tradeCategory)
      .where(sql`${table.isDefault} = true`),
  }),
);

// =============================================================================
// prequal_submissions
//
// A sub fills a contractor's template. Resubmission creates a NEW row — old
// rows are preserved for history/audit.
//
// "Active" submission = the most recent row for a (subOrgId, contractorOrgId)
// pair where status NOT IN ('rejected', 'expired'). Computed in the loader,
// not stored, to avoid update churn.
//
// answers_json shape (object keyed by questionKey):
//   {
//     "years_in_business":   8,
//     "bankruptcy_history":  false,
//     "trade_certifications": ["c10", "c45"],
//     "safety_program_size":  "comprehensive"
//   }
//
// reminders_sent_json shape (idempotency for the daily expiry sweep):
//   { "30": "2026-04-12T02:00:00Z", "14": null, "7": null }
//   Keys are the day-thresholds; values are timestamps of when the reminder
//   was sent (or null = not yet sent). Prevents duplicate emails.
// =============================================================================

export const prequalSubmissions = pgTable(
  "prequal_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * The template this submission is filling. Required even after the
     * template is archived — historical submissions stay readable.
     */
    templateId: uuid("template_id").notNull(),
      // .references(() => prequalTemplates.id, { onDelete: "restrict" }),

    submittedByOrgId: uuid("submitted_by_org_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),

    /**
     * Denormalized from template.org_id so the active-submission lookup for
     * a (sub, contractor) pair is a single-table query.
     */
    contractorOrgId: uuid("contractor_org_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),

    answersJson: jsonb("answers_json").default(sql`'{}'::jsonb`).notNull(),

    /**
     * Computed at submission time. Score is internal to the contractor;
     * subs never see this value.
     */
    scoreTotal: integer("score_total"),

    /**
     * Subset of gating question keys that the submission failed. Empty array
     * means no gating fails.
     */
    gatingFailures: jsonb("gating_failures")
      .default(sql`'[]'::jsonb`)
      .notNull(),

    status: prequalSubmissionStatusEnum("status").default("draft").notNull(),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    reviewedByUserId: uuid("reviewed_by_user_id"),
      // .references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewerNotes: text("reviewer_notes"),

    /**
     * Set on approval. expires_at = reviewedAt + template.validityMonths.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /**
     * Idempotency map for the daily expiry-sweep Trigger.dev v3 task.
     * Prevents duplicate emails when the sweep runs more than once per day.
     */
    remindersSentJson: jsonb("reminders_sent_json")
      .default(sql`'{}'::jsonb`)
      .notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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
    /**
     * Index for the daily expiry sweep: find approved submissions whose
     * expires_at has passed.
     */
    expiryIdx: index("prequal_submissions_expiry_idx").on(table.status, table.expiresAt),
  }),
);

// =============================================================================
// prequal_documents
//
// SELF-CONTAINED storage. Does NOT reference the documents table (which
// requires a project_id; prequal docs have no project at upload time).
//
// Multiple rows per (submissionId, documentType) are allowed.
//
// Storage:
//  - storage_key: R2 object key. The application layer mediates retrieval
//    via signed URLs (same R2 strategy as the documents table).
//  - title / file_size_bytes / mime_type / uploaded_by_user_id captured at
//    upload time; immutable thereafter.
//
// Cascade: when a submission is hard-deleted (rare; only for spam/abuse
// cleanup), prequal_documents rows go with it. R2 objects must be cleaned
// up by an out-of-band job listening on the cascade.
// =============================================================================

export const prequalDocuments = pgTable(
  "prequal_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    submissionId: uuid("submission_id").notNull(),
      // .references(() => prequalSubmissions.id, { onDelete: "cascade" }),

    documentType: prequalDocumentTypeEnum("document_type").notNull(),

    /**
     * R2 object key. Application layer signs presigned GET URLs at access time.
     */
    storageKey: text("storage_key").notNull(),

    /**
     * Display title (typically the original filename, but editable on upload).
     */
    title: varchar("title", { length: 255 }).notNull(),

    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),

    uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),

    /**
     * Optional human-friendly note (e.g. "Q3 2025 financials" on a financial
     * statement upload).
     */
    label: varchar("label", { length: 255 }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    submissionIdx: index("prequal_documents_submission_idx").on(table.submissionId),
    typeIdx: index("prequal_documents_type_idx").on(table.documentType),
    submissionTypeIdx: index("prequal_documents_submission_type_idx").on(
      table.submissionId,
      table.documentType,
    ),
  }),
);

// =============================================================================
// prequal_project_exemptions
//
// Block-mode escape hatch. When a contractor org has prequal_enforcement_mode
// = 'block' and needs to add a sub to a project despite no active approved
// prequal, an authorized contractor user grants an exemption scoped to that
// (project, sub_org) pair.
//
// One ACTIVE exemption per (projectId, subOrgId) — enforced by partial unique
// index where revoked_at IS NULL. Re-granting after revoke is allowed and
// creates a new row.
//
// Note: in 'warn' mode there's no need for an exemption row — the override
// is captured directly in audit_events when the inviter clicks "Proceed
// anyway". Exemptions are a 'block'-mode-only construct.
// =============================================================================

export const prequalProjectExemptions = pgTable(
  "prequal_project_exemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),

    subOrgId: uuid("sub_org_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),

    /**
     * Denormalized for the common query "what exemptions has my org granted?".
     */
    contractorOrgId: uuid("contractor_org_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),

    grantedByUserId: uuid("granted_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),

    reason: text("reason").notNull(),

    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),

    /**
     * Optional time-bound exemption. NULL = exemption stands until manually
     * revoked or until an active approved prequal lands.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /**
     * Soft-revoke: when set, exemption is no longer active. Kept for audit.
     */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id"),
      // .references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    projectSubIdx: index("prequal_project_exemptions_project_sub_idx").on(
      table.projectId,
      table.subOrgId,
    ),
    contractorIdx: index("prequal_project_exemptions_contractor_idx").on(
      table.contractorOrgId,
    ),
    /**
     * One ACTIVE exemption per (project, sub) pair. Active = revokedAt IS NULL.
     */
    activeUnique: uniqueIndex("prequal_project_exemptions_active_unique")
      .on(table.projectId, table.subOrgId)
      .where(sql`${table.revokedAt} IS NULL`),
  }),
);

// =============================================================================
// MODIFICATION — organizations
//
// In src/db/schema/identity.ts (or wherever organizations lives), add:
//
//   prequalEnforcementMode: prequalEnforcementModeEnum("prequal_enforcement_mode")
//     .default("off")
//     .notNull(),
//
// db:generate will produce:
//
//   ALTER TABLE organizations
//     ADD COLUMN prequal_enforcement_mode prequal_enforcement_mode
//       NOT NULL DEFAULT 'off';
//
// Default 'off' for existing rows. New contractor orgs get 'warn' assigned by
// the org-creation server action.
// =============================================================================

// =============================================================================
// Migration workflow (this repo: db:generate + db:migrate)
// =============================================================================

/**
 * Standard Drizzle workflow:
 *
 *   1. Edit schema files (this file → src/db/schema/prequal.ts).
 *   2. Wire into src/db/schema/index.ts barrel.
 *   3. npm run db:generate     // produces migration SQL
 *   4. Review the generated SQL.
 *   5. npm run db:migrate      // applies it.
 *
 * Generated migration object order will be:
 *   1. CREATE TYPE prequal_submission_status
 *   2. CREATE TYPE prequal_document_type
 *   3. CREATE TYPE prequal_enforcement_mode
 *   4. CREATE TABLE prequal_templates (+ indexes including partial unique)
 *   5. CREATE TABLE prequal_submissions (+ indexes)
 *   6. CREATE TABLE prequal_documents (+ indexes)
 *   7. CREATE TABLE prequal_project_exemptions (+ indexes including partial unique)
 *   8. ALTER TABLE organizations ADD COLUMN prequal_enforcement_mode
 */
