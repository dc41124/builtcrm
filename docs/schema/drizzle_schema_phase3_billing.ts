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
 * Phase 3 — AIA G702/G703 Billing Schema
 *
 * This is the most complex domain model in the system. It implements the
 * industry-standard AIA billing structure used on virtually every commercial
 * construction project:
 *
 *   G702 = Application and Certificate for Payment (the cover sheet)
 *   G703 = Continuation Sheet (the line-item detail)
 *
 * Key relationships:
 *   Project → Schedule of Values → SOV Line Items
 *   Project → Draw Requests → Draw Line Items (referencing SOV Line Items)
 *   Draw Requests → Lien Waivers
 *   Draw Line Items → Retainage calculations
 *
 * Critical invariant:
 *   G702 totals MUST tie to G703 totals. The sum of all draw line items
 *   must equal the draw request header amounts. Mismatches are the #1 cause
 *   of pay application rejections in real construction.
 *
 * All monetary values are stored as integers in cents to avoid floating-point
 * precision issues.
 */

// =============================================================================
// Enums
// =============================================================================

export const sovStatusEnum = pgEnum("sov_status", [
  "draft",
  "active",
  "locked",     // locked during an open draw request
  "archived",
]);

export const sovLineItemTypeEnum = pgEnum("sov_line_item_type", [
  "original",       // part of the original contract
  "change_order",   // added via approved change order
]);

export const drawRequestStatusEnum = pgEnum("draw_request_status", [
  "draft",
  "ready_for_review",
  "submitted",         // sent to client for review
  "under_review",      // client has opened it
  "approved",
  "approved_with_note",
  "returned",          // sent back for clarification
  "revised",           // contractor revised after return
  "paid",
  "closed",
]);

export const lienWaiverTypeEnum = pgEnum("lien_waiver_type", [
  "conditional_progress",    // before payment, for partial work
  "unconditional_progress",  // after payment clears, for partial work
  "conditional_final",       // before final payment
  "unconditional_final",     // after final payment clears
]);

export const lienWaiverStatusEnum = pgEnum("lien_waiver_status", [
  "requested",
  "submitted",
  "accepted",
  "rejected",
  "waived",    // waiver requirement waived by GC
]);

export const retainageReleaseStatusEnum = pgEnum("retainage_release_status", [
  "held",
  "release_requested",
  "released",
  "forfeited",
]);

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
// Schedule of Values (SOV)
//
// One active SOV per project. This is the master list of all contract line
// items against which progress billing is measured.
//
// The SOV establishes the "scheduled value" for each cost code / work item.
// The sum of all SOV line item scheduled values = total contract value.
//
// When a change order is approved, a new SOV line item is added with
// type='change_order' and a reference to the change order.
// =============================================================================

export const scheduleOfValues = pgTable(
  "schedule_of_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),

    /**
     * Version number — incremented when the SOV is modified (e.g., after a
     * change order adds new line items). Allows historical reference.
     */
    version: integer("version").default(1).notNull(),
    sovStatus: sovStatusEnum("sov_status").default("draft").notNull(),

    /**
     * Denormalized totals for efficient querying. These MUST equal the sum
     * of their respective columns across all SOV line items.
     * Recalculated on every line item mutation.
     */
    totalScheduledValueCents: integer("total_scheduled_value_cents").default(0).notNull(),
    totalOriginalContractCents: integer("total_original_contract_cents").default(0).notNull(),
    totalChangeOrdersCents: integer("total_change_orders_cents").default(0).notNull(),

    /**
     * Default retainage percentage for new line items. Individual line items
     * can override this (e.g., materials-only items at 5% vs labor at 10%).
     */
    defaultRetainagePercent: integer("default_retainage_percent").default(10).notNull(),

    approvedByUserId: uuid("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    ...timestamps,
  },
  (table) => ({
    projectIdx: index("sov_project_idx").on(table.projectId),
    /**
     * Only one active SOV per project at a time.
     * Enforce via partial unique index on (project_id) WHERE sov_status = 'active'.
     */
    // Note: Drizzle doesn't natively support partial unique indexes.
    // Implement via raw SQL migration:
    // CREATE UNIQUE INDEX sov_active_per_project ON schedule_of_values (project_id) WHERE sov_status = 'active';
  }),
);

// =============================================================================
// SOV Line Items (G703 rows)
//
// Each line item represents a cost code, trade, or scope of work.
// The "scheduled value" is the budgeted amount for that line item.
//
// G703 column mapping:
//   A = Item Number (sortOrder)
//   B = Description of Work (description)
//   C = Scheduled Value (scheduledValueCents)
//   D = Work Completed from Previous Application (computed from prior draws)
//   E = Work Completed This Period (from draw line items)
//   F = Materials Presently Stored (from draw line items)
//   G = Total Completed and Stored to Date (D + E + F)
//   H = % Complete (G / C)
//   I = Balance to Finish (C - G)
//   J = Retainage (computed from G * retainage %)
//
// Columns D through J are NOT stored here — they are computed per draw request
// from the draw_line_items table. This avoids data duplication and ensures
// the SOV always reflects the latest approved draw state.
// =============================================================================

export const sovLineItems = pgTable(
  "sov_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sovId: uuid("sov_id").notNull(),
      // .references(() => scheduleOfValues.id, { onDelete: "cascade" }),

    /**
     * Item number for display ordering (e.g., 1, 2, 3... or 1.1, 1.2).
     * Stored as string to support hierarchical numbering.
     */
    itemNumber: varchar("item_number", { length: 40 }).notNull(),

    /**
     * Cost code from the estimating system (e.g., "03-3000" for cast-in-place
     * concrete). Optional but recommended for integration with accounting.
     */
    costCode: varchar("cost_code", { length: 40 }),

    description: varchar("description", { length: 500 }).notNull(),
    lineItemType: sovLineItemTypeEnum("line_item_type").default("original").notNull(),

    /**
     * The budgeted amount for this line item. This is the "Scheduled Value"
     * column in the G703 continuation sheet.
     */
    scheduledValueCents: integer("scheduled_value_cents").notNull(),

    /**
     * If this line item was added via change order, reference it.
     * Null for original contract line items.
     */
    changeOrderId: uuid("change_order_id"),
      // .references(() => changeOrders.id, { onDelete: "set null" }),

    /**
     * Override retainage percentage for this specific line item.
     * If null, uses the SOV default.
     */
    retainagePercentOverride: integer("retainage_percent_override"),

    /**
     * Display order within the SOV
     */
    sortOrder: integer("sort_order").default(0).notNull(),

    /**
     * Soft flag — when an approved CO adjusts an existing line item rather
     * than adding a new one, the original is marked superseded and a new
     * adjusted line item is created.
     */
    isActive: boolean("is_active").default(true).notNull(),

    ...timestamps,
  },
  (table) => ({
    sovIdx: index("sov_line_items_sov_idx").on(table.sovId),
    sovNumberUnique: unique("sov_line_items_sov_number_unique").on(
      table.sovId,
      table.itemNumber,
    ),
    costCodeIdx: index("sov_line_items_cost_code_idx").on(table.costCode),
    changeOrderIdx: index("sov_line_items_co_idx").on(table.changeOrderId),
    activeIdx: index("sov_line_items_active_idx").on(table.isActive),
  }),
);

// =============================================================================
// Draw Requests (G702 — Application for Payment)
//
// Each draw request is one billing period's application for payment.
// The G702 is the cover sheet that summarizes:
//   1. Original contract sum
//   2. Net change by change orders
//   3. Contract sum to date (1 + 2)
//   4. Total completed & stored to date (sum of G703 column G)
//   5. Retainage (sum of G703 column J)
//   6. Total earned less retainage (4 - 5)
//   7. Less previous certificates for payment
//   8. Current payment due (6 - 7)
//   9. Balance to finish including retainage (3 - 6)
//
// Items 1-9 are denormalized on the draw request for efficient display,
// but the authoritative source is always the draw line items.
// =============================================================================

export const drawRequests = pgTable(
  "draw_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),
    sovId: uuid("sov_id").notNull(),
      // .references(() => scheduleOfValues.id, { onDelete: "restrict" }),

    /**
     * Sequential draw number per project (Draw #1, Draw #2, etc.)
     * This is the "Application No." on the G702 form.
     */
    drawNumber: integer("draw_number").notNull(),

    /**
     * Billing period this draw covers
     */
    periodFrom: timestamp("period_from", { withTimezone: true }).notNull(),
    periodTo: timestamp("period_to", { withTimezone: true }).notNull(),

    drawRequestStatus: drawRequestStatusEnum("draw_request_status").default("draft").notNull(),

    // =========================================================================
    // G702 summary fields — denormalized from draw line items
    // These are recalculated whenever line items change.
    // =========================================================================

    /** Line 1: Original contract sum (snapshot at time of draw) */
    originalContractSumCents: integer("original_contract_sum_cents").default(0).notNull(),

    /** Line 2: Net change by change orders (snapshot at time of draw) */
    netChangeOrdersCents: integer("net_change_orders_cents").default(0).notNull(),

    /** Line 3: Contract sum to date = Line 1 + Line 2 */
    contractSumToDateCents: integer("contract_sum_to_date_cents").default(0).notNull(),

    /** Line 4: Total completed and stored to date (sum of draw line items) */
    totalCompletedToDateCents: integer("total_completed_to_date_cents").default(0).notNull(),

    /** Line 5a: Retainage on completed work */
    retainageOnCompletedCents: integer("retainage_on_completed_cents").default(0).notNull(),

    /** Line 5b: Retainage on stored materials */
    retainageOnStoredCents: integer("retainage_on_stored_cents").default(0).notNull(),

    /** Line 5c: Total retainage = 5a + 5b */
    totalRetainageCents: integer("total_retainage_cents").default(0).notNull(),

    /** Line 6: Total earned less retainage = Line 4 - Line 5c */
    totalEarnedLessRetainageCents: integer("total_earned_less_retainage_cents").default(0).notNull(),

    /** Line 7: Less previous certificates for payment */
    previousCertificatesCents: integer("previous_certificates_cents").default(0).notNull(),

    /** Line 8: Current payment due = Line 6 - Line 7 */
    currentPaymentDueCents: integer("current_payment_due_cents").default(0).notNull(),

    /** Line 9: Balance to finish including retainage = Line 3 - Line 6 */
    balanceToFinishCents: integer("balance_to_finish_cents").default(0).notNull(),

    // =========================================================================
    // Workflow fields
    // =========================================================================

    createdByUserId: uuid("created_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),

    /**
     * If returned for revision, track the reason
     */
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    returnReason: text("return_reason"),

    /**
     * Payment tracking
     */
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentReferenceName: varchar("payment_reference_name", { length: 255 }),

    ...timestamps,
  },
  (table) => ({
    projectDrawUnique: unique("draw_requests_project_draw_unique").on(
      table.projectId,
      table.drawNumber,
    ),
    projectIdx: index("draw_requests_project_idx").on(table.projectId),
    statusIdx: index("draw_requests_status_idx").on(table.drawRequestStatus),
    sovIdx: index("draw_requests_sov_idx").on(table.sovId),
    /**
     * Critical integrity check: contract_sum_to_date must equal
     * original_contract_sum + net_change_orders.
     */
    contractSumCheck: check(
      "draw_requests_contract_sum_check",
      sql`contract_sum_to_date_cents = original_contract_sum_cents + net_change_orders_cents`,
    ),
  }),
);

// =============================================================================
// Draw Line Items (G703 Continuation Sheet rows)
//
// Each row corresponds to one SOV line item and tracks the work billed
// in this specific draw period.
//
// G703 column mapping per line item:
//   D = workCompletedPreviousCents (carried forward from prior approved draw)
//   E = workCompletedThisPeriodCents (entered by contractor for this draw)
//   F = materialsPresentlyStoredCents (materials on site, not yet installed)
//   G = totalCompletedStoredToDateCents (D + E + F)
//   H = percentComplete (G / scheduledValue * 100)
//   I = balanceToFinishCents (scheduledValue - G)
//   J = retainageCents (G * retainage% / 100)
// =============================================================================

export const drawLineItems = pgTable(
  "draw_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    drawRequestId: uuid("draw_request_id").notNull(),
      // .references(() => drawRequests.id, { onDelete: "cascade" }),
    sovLineItemId: uuid("sov_line_item_id").notNull(),
      // .references(() => sovLineItems.id, { onDelete: "restrict" }),

    /**
     * Column D: Work completed from previous applications.
     * Auto-populated from the prior approved draw's totalCompletedStoredToDateCents
     * for this SOV line item.
     */
    workCompletedPreviousCents: integer("work_completed_previous_cents").default(0).notNull(),

    /**
     * Column E: Work completed this period.
     * This is the primary value the contractor enters during draw preparation.
     */
    workCompletedThisPeriodCents: integer("work_completed_this_period_cents").default(0).notNull(),

    /**
     * Column F: Materials presently stored.
     * Materials delivered to site but not yet installed.
     */
    materialsPresentlyStoredCents: integer("materials_presently_stored_cents").default(0).notNull(),

    /**
     * Column G: Total completed and stored to date = D + E + F.
     * Denormalized for query efficiency, but must always equal the sum.
     */
    totalCompletedStoredToDateCents: integer("total_completed_stored_to_date_cents").default(0).notNull(),

    /**
     * Column H: Percent complete = G / scheduled_value * 100.
     * Stored as integer basis points (e.g., 6250 = 62.50%).
     * This avoids floating point while preserving two decimal places.
     */
    percentCompleteBasisPoints: integer("percent_complete_basis_points").default(0).notNull(),

    /**
     * Column I: Balance to finish = scheduled_value - G.
     */
    balanceToFinishCents: integer("balance_to_finish_cents").default(0).notNull(),

    /**
     * Column J: Retainage for this line item.
     * Calculated as totalCompletedStoredToDate * retainage% / 100.
     */
    retainageCents: integer("retainage_cents").default(0).notNull(),

    /**
     * The retainage percentage applied to this line item.
     * Snapshot from SOV line item (or SOV default) at time of draw creation.
     */
    retainagePercentApplied: integer("retainage_percent_applied").default(10).notNull(),

    ...timestamps,
  },
  (table) => ({
    drawSovUnique: unique("draw_line_items_draw_sov_unique").on(
      table.drawRequestId,
      table.sovLineItemId,
    ),
    drawIdx: index("draw_line_items_draw_idx").on(table.drawRequestId),
    sovLineIdx: index("draw_line_items_sov_line_idx").on(table.sovLineItemId),
    /**
     * Critical integrity: total must equal previous + this period + stored.
     */
    totalCheck: check(
      "draw_line_items_total_check",
      sql`total_completed_stored_to_date_cents = work_completed_previous_cents + work_completed_this_period_cents + materials_presently_stored_cents`,
    ),
  }),
);

// =============================================================================
// Lien Waivers
//
// Four industry-standard types:
//   1. Conditional Progress  — collected BEFORE progress payment
//   2. Unconditional Progress — collected AFTER progress payment clears
//   3. Conditional Final     — collected BEFORE final payment
//   4. Unconditional Final   — collected AFTER final payment clears
//
// The workflow: contractor collects conditional waiver from sub → payment is
// issued → contractor collects unconditional waiver after payment clears.
//
// Lien waivers are required per subcontractor per draw request. A draw
// cannot be fully closed until all required lien waivers are collected.
//
// State-specific forms are legally required in many jurisdictions (CA, TX, GA).
// The templateId field allows configuring jurisdiction-specific templates.
// =============================================================================

export const lienWaivers = pgTable(
  "lien_waivers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),
    drawRequestId: uuid("draw_request_id").notNull(),
      // .references(() => drawRequests.id, { onDelete: "cascade" }),

    /**
     * The subcontractor organization this waiver is from.
     */
    organizationId: uuid("organization_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),

    lienWaiverType: lienWaiverTypeEnum("lien_waiver_type").notNull(),
    lienWaiverStatus: lienWaiverStatusEnum("lien_waiver_status").default("requested").notNull(),

    /**
     * The amount this waiver covers. For progress waivers, this is the
     * draw amount attributed to this subcontractor. For final waivers,
     * this is the total contract amount with the sub.
     */
    amountCents: integer("amount_cents").notNull(),

    /**
     * Through date — the waiver covers work through this date.
     */
    throughDate: timestamp("through_date", { withTimezone: true }),

    /**
     * Reference to the uploaded waiver document
     */
    documentId: uuid("document_id"),
      // .references(() => documents.id, { onDelete: "set null" }),

    /**
     * Jurisdiction-specific template ID (e.g., "CA-statutory", "TX-statutory").
     * Null means use the default/generic form.
     */
    templateId: varchar("template_id", { length: 60 }),

    requestedAt: timestamp("requested_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id"),

    ...timestamps,
  },
  (table) => ({
    /**
     * One waiver of each type per sub per draw request.
     */
    drawOrgTypeUnique: unique("lien_waivers_draw_org_type_unique").on(
      table.drawRequestId,
      table.organizationId,
      table.lienWaiverType,
    ),
    projectIdx: index("lien_waivers_project_idx").on(table.projectId),
    drawIdx: index("lien_waivers_draw_idx").on(table.drawRequestId),
    orgIdx: index("lien_waivers_org_idx").on(table.organizationId),
    statusIdx: index("lien_waivers_status_idx").on(table.lienWaiverStatus),
  }),
);

// =============================================================================
// Retainage Release Records
//
// Retainage is typically held at 10% on each draw and released at substantial
// completion or final completion. This table tracks release requests and
// approvals separately from the draw process.
//
// At substantial completion, the GC requests release of accumulated retainage.
// The client/owner approves or partially approves the release.
// =============================================================================

export const retainageReleases = pgTable(
  "retainage_releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),

    /**
     * Optional: if releasing retainage for a specific SOV line item rather
     * than the project as a whole.
     */
    sovLineItemId: uuid("sov_line_item_id"),
      // .references(() => sovLineItems.id, { onDelete: "set null" }),

    releaseStatus: retainageReleaseStatusEnum("retainage_release_status").default("held").notNull(),

    /**
     * Amount of retainage being released. May be partial.
     */
    releaseAmountCents: integer("release_amount_cents").notNull(),

    /**
     * Total retainage accumulated for context.
     */
    totalRetainageHeldCents: integer("total_retainage_held_cents").notNull(),

    requestedByUserId: uuid("requested_by_user_id").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }),

    approvedByUserId: uuid("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalNote: text("approval_note"),

    ...timestamps,
  },
  (table) => ({
    projectIdx: index("retainage_releases_project_idx").on(table.projectId),
    statusIdx: index("retainage_releases_status_idx").on(table.releaseStatus),
    sovLineIdx: index("retainage_releases_sov_line_idx").on(table.sovLineItemId),
  }),
);

// =============================================================================
// Complete Phase 3 Migration Order
// =============================================================================

/**
 * Phase 3 tables (add after v2 table 22):
 *
 * 23. schedule_of_values
 * 24. sov_line_items
 * 25. draw_requests
 * 26. draw_line_items
 * 27. lien_waivers
 * 28. retainage_releases
 *
 * Required data integrity rules (enforce in application layer + DB checks):
 *
 * 1. SOV totals must equal sum of line item scheduled values
 * 2. Draw request G702 fields must tie to sum of draw line items
 * 3. Draw line item total must equal previous + this period + stored
 * 4. Contract sum to date must equal original + net change orders
 * 5. Only one active SOV per project
 * 6. Draw numbers must be sequential per project (no gaps)
 * 7. Work completed previous cents must match prior approved draw's total
 * 8. One lien waiver of each type per sub per draw
 *
 * Recommended application-layer services:
 *
 * - createDrawRequest(projectId)
 *     → snapshots SOV state, creates draw line items from SOV line items,
 *       auto-populates workCompletedPreviousCents from prior approved draw
 *
 * - recalculateDrawTotals(drawRequestId)
 *     → sums all draw line items, updates G702 header fields,
 *       validates all check constraints
 *
 * - approveDrawRequest(drawRequestId, reviewerId, note?)
 *     → sets status, records reviewer, updates previousCertificatesCents
 *       on the NEXT draw request when it's created
 *
 * - requestLienWaivers(drawRequestId)
 *     → creates lien waiver records for all subs with allocated amounts
 *       on this draw
 */
