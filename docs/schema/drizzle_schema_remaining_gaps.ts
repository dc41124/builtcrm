import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Remaining Schema Gaps
 *
 * This file covers all schema gaps identified across the design phases:
 *
 * 1. Invitations — the onboarding trigger for all portal types
 * 2. Selections — residential selection categories, items, options, decisions
 * 3. Projects table modifications — contractValueCents, address fields
 * 4. ActivityFeedItems modification — actorUserId
 *
 * After this file, the schema should support every data point shown
 * across all designed pages.
 */

// =============================================================================
// Shared columns
// =============================================================================

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// =============================================================================
// New Enums
// =============================================================================

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const selectionItemStatusEnum = pgEnum("selection_item_status", [
  "not_started",    // published but homeowner hasn't engaged
  "exploring",      // homeowner has opened it
  "provisional",    // homeowner picked an option but hasn't confirmed
  "confirmed",      // homeowner confirmed their choice
  "revision_open",  // contractor reopened for revision
  "locked",         // past revision window, choice is final
]);

export const selectionOptionTierEnum = pgEnum("selection_option_tier", [
  "included",        // no additional cost — within allowance
  "upgrade",         // costs more than allowance
  "premium_upgrade", // significantly more than allowance
]);

// =============================================================================
// 1. INVITATIONS
//
// Powers the onboarding flow for all portal types. When a contractor invites
// a client, subcontractor, or team member, an invitation record is created
// with a unique token. The email link contains this token, and the landing
// page resolves the invitation to show project context.
//
// Acceptance flow:
//   1. Validate token (not expired, not revoked, not already accepted)
//   2. Create user record (or link to existing if email matches)
//   3. Create organization_user membership
//   4. Create role_assignment with correct portalType + clientSubtype
//   5. Create project_user_membership with accessState='active'
//   6. Mark invitation as accepted
//   7. Redirect to welcome screen
//
// The token is a cryptographically random string (e.g., nanoid or uuid).
// Token expiry is configurable per invitation (default 7 days).
// =============================================================================

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * The email address the invitation was sent to.
     * This becomes the user's email on acceptance unless they already have an account.
     */
    invitedEmail: varchar("invited_email", { length: 320 }).notNull(),
    invitedName: varchar("invited_name", { length: 200 }),

    /**
     * Who sent the invitation
     */
    invitedByUserId: uuid("invited_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),

    /**
     * What organization and project the person is being invited into
     */
    organizationId: uuid("organization_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"),
      // .references(() => projects.id, { onDelete: "cascade" }),

    /**
     * What portal and role the person will get on acceptance.
     * portalType determines which shell variant they see.
     * clientSubtype determines commercial vs residential experience.
     * roleKey maps to the permission level (e.g., 'approver', 'viewer', 'coordinator').
     */
    portalType: varchar("portal_type", { length: 40 }).notNull(),
    clientSubtype: varchar("client_subtype", { length: 40 }),
    roleKey: varchar("role_key", { length: 120 }).notNull(),

    /**
     * Cryptographic token for the email link.
     * URL format: https://app.builtcrm.com/invite/{token}
     */
    token: varchar("token", { length: 255 }).notNull(),

    invitationStatus: invitationStatusEnum("invitation_status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),

    /**
     * After acceptance, reference the created user for audit trail
     */
    acceptedByUserId: uuid("accepted_by_user_id"),

    /**
     * Optional personal message from the inviter
     */
    personalMessage: text("personal_message"),

    ...timestamps,
  },
  (table) => ({
    tokenUnique: unique("invitations_token_unique").on(table.token),
    emailIdx: index("invitations_email_idx").on(table.invitedEmail),
    projectIdx: index("invitations_project_idx").on(table.projectId),
    statusIdx: index("invitations_status_idx").on(table.invitationStatus),
    /**
     * Prevent duplicate pending invitations to the same email for the same project
     */
    // Implement via partial unique index in raw SQL:
    // CREATE UNIQUE INDEX invitations_pending_email_project
    //   ON invitations (invited_email, project_id)
    //   WHERE invitation_status = 'pending';
  }),
);

// =============================================================================
// 2. SELECTIONS
//
// Three-tier hierarchy:
//   Selection Categories → Selection Items → Selection Options
//
// Plus a decision layer:
//   Selection Decisions (the homeowner's choice per item)
//
// The contractor creates categories and publishes items with curated options.
// The homeowner browses, compares, selects provisionally, then confirms.
//
// Schema supports:
//   - Allowance-based pricing (included vs upgrade vs premium)
//   - Lead time impact per option
//   - Recommendation tagging
//   - Provisional → confirmed decision flow
//   - Revision window after confirmation
//   - Cost/timing impact summary
//
// Dashboard references:
//   Residential project home: "3 selections ready" badge
//   Selection cards: option swatches, included/upgrade pricing, timing impact
//   Budget card: "Selections upgrades +$3,200"
// =============================================================================

export const selectionCategories = pgTable(
  "selection_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),

    /**
     * Display name (e.g., "Kitchen", "Master Bathroom", "Living Room")
     */
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    /**
     * Display order for categories
     */
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),

    ...timestamps,
  },
  (table) => ({
    projectIdx: index("selection_categories_project_idx").on(table.projectId),
  }),
);

export const selectionItems = pgTable(
  "selection_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").notNull(),
      // .references(() => selectionCategories.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),

    /**
     * What is being selected (e.g., "Flooring Finish", "Cabinet Paint Color")
     */
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),

    selectionItemStatus: selectionItemStatusEnum("selection_item_status")
      .default("not_started")
      .notNull(),

    /**
     * The allowance amount for this selection in cents.
     * Options priced at or below this are "included."
     * Options priced above this are "upgrades" with a delta.
     */
    allowanceCents: integer("allowance_cents").default(0).notNull(),

    /**
     * Decision deadline — when the homeowner needs to decide by.
     * Null means no hard deadline, but the contractor may set one
     * if the selection affects material ordering or scheduling.
     */
    decisionDeadline: timestamp("decision_deadline", { withTimezone: true }),

    /**
     * Why this selection matters — shown to homeowner for context.
     * e.g., "Needed before material ordering can proceed"
     */
    urgencyNote: text("urgency_note"),

    /**
     * Whether this selection has timing implications
     */
    affectsSchedule: boolean("affects_schedule").default(false).notNull(),
    scheduleImpactNote: text("schedule_impact_note"),

    /**
     * The recommended option ID (set by contractor/designer)
     */
    recommendedOptionId: uuid("recommended_option_id"),

    /**
     * After confirmation, how long the homeowner can still revise (in hours).
     * Default 48 hours. Set to 0 for immediate lock.
     */
    revisionWindowHours: integer("revision_window_hours").default(48).notNull(),

    /**
     * Published by contractor — not visible to homeowner until published
     */
    isPublished: boolean("is_published").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedByUserId: uuid("published_by_user_id"),

    sortOrder: integer("sort_order").default(0).notNull(),

    ...timestamps,
  },
  (table) => ({
    categoryIdx: index("selection_items_category_idx").on(table.categoryId),
    projectIdx: index("selection_items_project_idx").on(table.projectId),
    statusIdx: index("selection_items_status_idx").on(table.selectionItemStatus),
  }),
);

export const selectionOptions = pgTable(
  "selection_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    selectionItemId: uuid("selection_item_id").notNull(),
      // .references(() => selectionItems.id, { onDelete: "cascade" }),

    /**
     * Option display name (e.g., "Oak", "Walnut", "Soft White")
     */
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),

    /**
     * Pricing tier determines the label shown to homeowner
     */
    optionTier: selectionOptionTierEnum("option_tier").default("included").notNull(),

    /**
     * The price of this option in cents.
     * The delta from the allowance (selectionItem.allowanceCents) determines
     * the upgrade cost shown to the homeowner.
     * If priceCents <= allowanceCents → "Included"
     * If priceCents > allowanceCents → "Upgrade +${delta}"
     */
    priceCents: integer("price_cents").default(0).notNull(),

    /**
     * Lead time in business days from order to delivery.
     * Used to calculate schedule impact vs other options.
     */
    leadTimeDays: integer("lead_time_days"),

    /**
     * Additional schedule days this option adds vs the baseline/recommended.
     * Null means no schedule impact.
     */
    additionalScheduleDays: integer("additional_schedule_days"),

    /**
     * Visual reference — document ID for the option image/swatch.
     * The image itself lives in the documents table.
     */
    imageDocumentId: uuid("image_document_id"),
      // .references(() => documents.id, { onDelete: "set null" }),

    /**
     * Color hex for generating swatch previews when no image is available
     */
    swatchColor: varchar("swatch_color", { length: 7 }),

    /**
     * Spec sheet or reference document
     */
    specDocumentId: uuid("spec_document_id"),
      // .references(() => documents.id, { onDelete: "set null" }),

    /**
     * Product details for the contractor's reference
     */
    supplierName: varchar("supplier_name", { length: 255 }),
    productSku: varchar("product_sku", { length: 120 }),
    productUrl: text("product_url"),

    /**
     * Tags for filtering and display (e.g., "Most popular", "Warm look")
     */
    tags: jsonb("tags").$type<string[]>(),

    /**
     * Availability status
     */
    isAvailable: boolean("is_available").default(true).notNull(),
    unavailableReason: text("unavailable_reason"),

    sortOrder: integer("sort_order").default(0).notNull(),

    ...timestamps,
  },
  (table) => ({
    selectionItemIdx: index("selection_options_item_idx").on(table.selectionItemId),
  }),
);

export const selectionDecisions = pgTable(
  "selection_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    selectionItemId: uuid("selection_item_id").notNull(),
      // .references(() => selectionItems.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),

    /**
     * The option the homeowner chose
     */
    selectedOptionId: uuid("selected_option_id").notNull(),
      // .references(() => selectionOptions.id, { onDelete: "restrict" }),

    /**
     * Who made the decision (the homeowner user)
     */
    decidedByUserId: uuid("decided_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),

    /**
     * Decision lifecycle:
     * provisional → confirmed → locked (after revision window)
     * OR: provisional → confirmed → revision_open → confirmed → locked
     */
    isProvisional: boolean("is_provisional").default(true).notNull(),
    isConfirmed: boolean("is_confirmed").default(false).notNull(),
    isLocked: boolean("is_locked").default(false).notNull(),

    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),

    /**
     * Revision window — when the homeowner can no longer change their mind.
     * Computed at confirmation: confirmedAt + selectionItem.revisionWindowHours
     */
    revisionExpiresAt: timestamp("revision_expires_at", { withTimezone: true }),

    /**
     * If the decision was revised, track the previous option
     */
    previousOptionId: uuid("previous_option_id"),
    revisionNote: text("revision_note"),

    /**
     * Snapshot of the financial impact at time of decision.
     * Stored for audit — if pricing changes later, we know what the
     * homeowner agreed to.
     */
    priceDeltaCents: integer("price_delta_cents").default(0).notNull(),
    scheduleDeltaDays: integer("schedule_delta_days").default(0).notNull(),

    ...timestamps,
  },
  (table) => ({
    /**
     * One active decision per selection item.
     * If revised, the old decision is soft-superseded (isLocked=true on old,
     * new row created), or updated in place if within revision window.
     */
    selectionItemIdx: index("selection_decisions_item_idx").on(table.selectionItemId),
    projectIdx: index("selection_decisions_project_idx").on(table.projectId),
    optionIdx: index("selection_decisions_option_idx").on(table.selectedOptionId),
  }),
);

// =============================================================================
// 3. PROJECTS TABLE MODIFICATIONS
//
// ALTER TABLE projects ADD COLUMN contract_value_cents INTEGER;
// ALTER TABLE projects ADD COLUMN address_line_1 VARCHAR(255);
// ALTER TABLE projects ADD COLUMN address_line_2 VARCHAR(255);
// ALTER TABLE projects ADD COLUMN city VARCHAR(120);
// ALTER TABLE projects ADD COLUMN state_province VARCHAR(120);
// ALTER TABLE projects ADD COLUMN postal_code VARCHAR(20);
// ALTER TABLE projects ADD COLUMN country VARCHAR(3) DEFAULT 'CA';
//
// contract_value_cents:
//   Used by the financial health strip on the contractor dashboard,
//   the G702 summary on draw requests, and the client financial summary.
//   For residential projects, this is the base contract price before
//   selection upgrades.
//
// Address fields:
//   Used in project headers, inspection scheduling, and reports.
//   Residential projects display the address as the project name
//   ("14 Maple Lane Renovation") while commercial projects use the
//   project name ("Riverside Tower Fit-Out") with address as metadata.
// =============================================================================

// =============================================================================
// 4. ACTIVITY_FEED_ITEMS MODIFICATION
//
// ALTER TABLE activity_feed_items ADD COLUMN actor_user_id UUID
//   REFERENCES users(id) ON DELETE SET NULL;
//
// CREATE INDEX activity_feed_items_actor_idx
//   ON activity_feed_items (actor_user_id);
//
// This allows the activity feed to show "Daniel Chen · 45 min ago"
// by joining to the users table.
// =============================================================================

// =============================================================================
// Complete Schema Summary — All Tables
// =============================================================================

/**
 * IDENTITY & ACCESS (First Pass):
 *  1. users
 *  2. organizations
 *  3. organization_users
 *  4. role_assignments
 *
 * PROJECTS & MEMBERSHIPS (First Pass):
 *  5. projects (+ v2 modifications: contract_value_cents, address fields)
 *  6. project_organization_memberships
 *  7. project_user_memberships
 *
 * DOCUMENTS (First Pass):
 *  8. documents
 *  9. document_links
 *
 * WORKFLOWS (First Pass):
 * 10. upload_requests
 *
 * BILLING — First Pass:
 * 11. billing_packages
 *
 * COMPLIANCE (First Pass):
 * 12. compliance_records
 *
 * DERIVED & AUDIT (First Pass + v2 modification):
 * 13. activity_feed_items (+ actor_user_id)
 * 14. audit_events
 *
 * V2 ADDITIONS — Dashboard Support:
 * 15. rfis
 * 16. rfi_responses
 * 17. change_orders
 * 18. milestones
 * 19. conversations
 * 20. conversation_participants
 * 21. messages
 *
 * PHASE 3 — AIA Billing:
 * 22. schedule_of_values
 * 23. sov_line_items
 * 24. draw_requests
 * 25. draw_line_items
 * 26. lien_waivers
 * 27. retainage_releases
 *
 * REMAINING GAPS (This File):
 * 28. invitations
 * 29. selection_categories
 * 30. selection_items
 * 31. selection_options
 * 32. selection_decisions
 *
 * TOTAL: 32 tables + 2 table modifications
 *
 * This covers every data point displayed across:
 * - Contractor dashboard
 * - Contractor billing draw workspace
 * - Commercial client project home
 * - Residential client project home
 * - Client onboarding flow
 * - Residential selections (pending UI design)
 */
