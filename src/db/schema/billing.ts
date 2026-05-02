import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
import { retention, timestamps } from "./_shared";
import { organizations, users } from "./identity";
import { projects } from "./projects";
import { documents } from "./documents";
import { changeOrders } from "./workflows";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const billingPackageStatusEnum = pgEnum("billing_package_status", [
  "draft",
  "ready_for_review",
  "under_review",
  "approved",
  "rejected",
  "closed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "not_started",
  "pending",
  "in_review",
  "approved",
  "paid",
  "overdue",
  "cancelled",
]);

export const sovStatusEnum = pgEnum("sov_status", [
  "draft",
  "active",
  "locked",
  "archived",
]);

export const sovLineItemTypeEnum = pgEnum("sov_line_item_type", [
  "original",
  "change_order",
]);

export const drawRequestStatusEnum = pgEnum("draw_request_status", [
  "draft",
  "ready_for_review",
  "submitted",
  "under_review",
  "approved",
  "approved_with_note",
  "returned",
  "revised",
  "paid",
  "closed",
]);

export const lienWaiverTypeEnum = pgEnum("lien_waiver_type", [
  "conditional_progress",
  "unconditional_progress",
  "conditional_final",
  "unconditional_final",
]);

export const lienWaiverStatusEnum = pgEnum("lien_waiver_status", [
  "requested",
  "submitted",
  "accepted",
  "rejected",
  "waived",
]);

export const retainageReleaseStatusEnum = pgEnum("retainage_release_status", [
  "held",
  "release_requested",
  "released",
  "forfeited",
]);

// -----------------------------------------------------------------------------
// Billing packages
// -----------------------------------------------------------------------------

export const billingPackages = pgTable(
  "billing_packages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    billingPackageNumber: varchar("billing_package_number", { length: 80 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    billingPackageStatus: billingPackageStatusEnum("billing_package_status")
      .default("draft")
      .notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewDueAt: timestamp("review_due_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...timestamps,
    ...retention("statutory_tax"),
  },
  (table) => ({
    projectNumberUnique: unique("billing_packages_project_number_unique").on(
      table.projectId,
      table.billingPackageNumber,
    ),
    projectIdx: index("billing_packages_project_idx").on(table.projectId),
    statusIdx: index("billing_packages_status_idx").on(table.billingPackageStatus),
    // RLS Slice A bucket 4b — project-scoped 2-clause hybrid.
    tenantIsolation: pgPolicy("billing_packages_tenant_isolation", {
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
// Schedule of Values
// -----------------------------------------------------------------------------

export const scheduleOfValues = pgTable(
  "schedule_of_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: integer("version").default(1).notNull(),
    sovStatus: sovStatusEnum("sov_status").default("draft").notNull(),
    totalScheduledValueCents: integer("total_scheduled_value_cents").default(0).notNull(),
    totalOriginalContractCents: integer("total_original_contract_cents").default(0).notNull(),
    totalChangeOrdersCents: integer("total_change_orders_cents").default(0).notNull(),
    defaultRetainagePercent: integer("default_retainage_percent").default(10).notNull(),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    ...timestamps,
    ...retention("statutory_construction"),
  },
  (table) => ({
    projectIdx: index("sov_project_idx").on(table.projectId),
    // RLS Slice A bucket 4b — project-scoped 2-clause hybrid.
    tenantIsolation: pgPolicy("schedule_of_values_tenant_isolation", {
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

export const sovLineItems = pgTable(
  "sov_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sovId: uuid("sov_id")
      .notNull()
      .references(() => scheduleOfValues.id, { onDelete: "cascade" }),
    itemNumber: varchar("item_number", { length: 40 }).notNull(),
    costCode: varchar("cost_code", { length: 40 }),
    description: varchar("description", { length: 500 }).notNull(),
    lineItemType: sovLineItemTypeEnum("line_item_type").default("original").notNull(),
    scheduledValueCents: integer("scheduled_value_cents").notNull(),
    changeOrderId: uuid("change_order_id").references(() => changeOrders.id, {
      onDelete: "set null",
    }),
    retainagePercentOverride: integer("retainage_percent_override"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
    ...retention("statutory_construction"),
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
    // RLS Slice A bucket 4b — nested-via-parent on schedule_of_values.
    tenantIsolation: pgPolicy("sov_line_items_tenant_isolation", {
      for: "all",
      using: sql`${table.sovId} IN (SELECT id FROM schedule_of_values)`,
      withCheck: sql`${table.sovId} IN (SELECT id FROM schedule_of_values)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// Draw requests
// -----------------------------------------------------------------------------

export const drawRequests = pgTable(
  "draw_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sovId: uuid("sov_id")
      .notNull()
      .references(() => scheduleOfValues.id, { onDelete: "restrict" }),
    drawNumber: integer("draw_number").notNull(),
    periodFrom: timestamp("period_from", { withTimezone: true }).notNull(),
    periodTo: timestamp("period_to", { withTimezone: true }).notNull(),
    drawRequestStatus: drawRequestStatusEnum("draw_request_status").default("draft").notNull(),

    // G702 summary fields
    originalContractSumCents: integer("original_contract_sum_cents").default(0).notNull(),
    netChangeOrdersCents: integer("net_change_orders_cents").default(0).notNull(),
    contractSumToDateCents: integer("contract_sum_to_date_cents").default(0).notNull(),
    totalCompletedToDateCents: integer("total_completed_to_date_cents").default(0).notNull(),
    retainageOnCompletedCents: integer("retainage_on_completed_cents").default(0).notNull(),
    retainageOnStoredCents: integer("retainage_on_stored_cents").default(0).notNull(),
    totalRetainageCents: integer("total_retainage_cents").default(0).notNull(),
    totalEarnedLessRetainageCents: integer("total_earned_less_retainage_cents").default(0).notNull(),
    previousCertificatesCents: integer("previous_certificates_cents").default(0).notNull(),
    retainageReleasedCents: integer("retainage_released_cents").default(0).notNull(),
    currentPaymentDueCents: integer("current_payment_due_cents").default(0).notNull(),
    balanceToFinishCents: integer("balance_to_finish_cents").default(0).notNull(),

    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    returnReason: text("return_reason"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentReferenceName: varchar("payment_reference_name", { length: 255 }),

    ...timestamps,
    ...retention("statutory_tax"),
  },
  (table) => ({
    projectDrawUnique: unique("draw_requests_project_draw_unique").on(
      table.projectId,
      table.drawNumber,
    ),
    projectIdx: index("draw_requests_project_idx").on(table.projectId),
    statusIdx: index("draw_requests_status_idx").on(table.drawRequestStatus),
    sovIdx: index("draw_requests_sov_idx").on(table.sovId),
    contractSumCheck: check(
      "draw_requests_contract_sum_check",
      sql`contract_sum_to_date_cents = original_contract_sum_cents + net_change_orders_cents`,
    ),
    // RLS Slice A bucket 4b — project-scoped 2-clause hybrid. Clients
    // (clause B via active POM) need read access to pay draws; subs see
    // their lien_waivers attached to the draw via the existing lien_waivers
    // policy. Stripe webhook flow uses dbAdmin pre-tenant.
    tenantIsolation: pgPolicy("draw_requests_tenant_isolation", {
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

export const drawLineItems = pgTable(
  "draw_line_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    drawRequestId: uuid("draw_request_id")
      .notNull()
      .references(() => drawRequests.id, { onDelete: "cascade" }),
    sovLineItemId: uuid("sov_line_item_id")
      .notNull()
      .references(() => sovLineItems.id, { onDelete: "restrict" }),
    workCompletedPreviousCents: integer("work_completed_previous_cents").default(0).notNull(),
    workCompletedThisPeriodCents: integer("work_completed_this_period_cents").default(0).notNull(),
    materialsPresentlyStoredCents: integer("materials_presently_stored_cents").default(0).notNull(),
    totalCompletedStoredToDateCents: integer("total_completed_stored_to_date_cents").default(0).notNull(),
    percentCompleteBasisPoints: integer("percent_complete_basis_points").default(0).notNull(),
    balanceToFinishCents: integer("balance_to_finish_cents").default(0).notNull(),
    retainageCents: integer("retainage_cents").default(0).notNull(),
    retainagePercentApplied: integer("retainage_percent_applied").default(10).notNull(),
    ...timestamps,
    ...retention("statutory_tax"),
  },
  (table) => ({
    drawSovUnique: unique("draw_line_items_draw_sov_unique").on(
      table.drawRequestId,
      table.sovLineItemId,
    ),
    drawIdx: index("draw_line_items_draw_idx").on(table.drawRequestId),
    sovLineIdx: index("draw_line_items_sov_line_idx").on(table.sovLineItemId),
    totalCheck: check(
      "draw_line_items_total_check",
      sql`total_completed_stored_to_date_cents = work_completed_previous_cents + work_completed_this_period_cents + materials_presently_stored_cents`,
    ),
    // RLS Slice A bucket 4b — nested-via-parent on draw_requests.
    tenantIsolation: pgPolicy("draw_line_items_tenant_isolation", {
      for: "all",
      using: sql`${table.drawRequestId} IN (SELECT id FROM draw_requests)`,
      withCheck: sql`${table.drawRequestId} IN (SELECT id FROM draw_requests)`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// Lien waivers
// -----------------------------------------------------------------------------

// RLS Phase 3c — multi-org policy. Lien waivers are inherently
// cross-org: per draw, the contractor writes one row for themselves
// and one per active sub on the project. Clients accept/reject all of
// them. Pattern A alone doesn't work — sub viewing their own row uses
// Pattern A, but a contractor viewing the sub's row needs project
// ownership, and a client viewing either needs project membership.
// Three-clause policy per docs/specs/rls_sprint_plan.md §4.2 (Option A).
export const lienWaivers = pgTable(
  "lien_waivers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    drawRequestId: uuid("draw_request_id")
      .notNull()
      .references(() => drawRequests.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    lienWaiverType: lienWaiverTypeEnum("lien_waiver_type").notNull(),
    lienWaiverStatus: lienWaiverStatusEnum("lien_waiver_status").default("requested").notNull(),
    amountCents: integer("amount_cents").notNull(),
    throughDate: timestamp("through_date", { withTimezone: true }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    templateId: varchar("template_id", { length: 60 }),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps,
    ...retention("statutory_construction"),
  },
  (table) => ({
    drawOrgTypeUnique: unique("lien_waivers_draw_org_type_unique").on(
      table.drawRequestId,
      table.organizationId,
      table.lienWaiverType,
    ),
    projectIdx: index("lien_waivers_project_idx").on(table.projectId),
    drawIdx: index("lien_waivers_draw_idx").on(table.drawRequestId),
    orgIdx: index("lien_waivers_org_idx").on(table.organizationId),
    statusIdx: index("lien_waivers_status_idx").on(table.lienWaiverStatus),
    tenantIsolation: pgPolicy("lien_waivers_tenant_isolation", {
      for: "all",
      using: sql`
        ${table.organizationId} = current_setting('app.current_org_id', true)::uuid
        OR ${table.projectId} IN (
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
        ${table.organizationId} = current_setting('app.current_org_id', true)::uuid
        OR ${table.projectId} IN (
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
// Retainage releases
// -----------------------------------------------------------------------------

export const retainageReleases = pgTable(
  "retainage_releases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sovLineItemId: uuid("sov_line_item_id").references(() => sovLineItems.id, {
      onDelete: "set null",
    }),
    releaseStatus: retainageReleaseStatusEnum("retainage_release_status").default("held").notNull(),
    releaseAmountCents: integer("release_amount_cents").notNull(),
    totalRetainageHeldCents: integer("total_retainage_held_cents").notNull(),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    approvedByUserId: uuid("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvalNote: text("approval_note"),
    consumedByDrawRequestId: uuid("consumed_by_draw_request_id"),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    // Step 43: scheduled-release hook. The release's expected date comes
    // from (in priority order): releaseTriggerMilestoneId →
    // milestones.scheduledDate, else scheduledReleaseAt, else unknown.
    // Drives the "<30 days" filter on the Pending Financials card and
    // will feed the Step 68 Holdback Ledger report.
    scheduledReleaseAt: timestamp("scheduled_release_at", {
      withTimezone: true,
    }),
    // Nullable FK — milestones live in projects.ts; circular import is
    // avoided by declaring the column untyped and relying on the raw SQL
    // constraint added in migration 0022. (Same pattern as invitations
    // → projects in identity.ts.)
    releaseTriggerMilestoneId: uuid("release_trigger_milestone_id"),
    ...timestamps,
    ...retention("statutory_construction"),
  },
  (table) => ({
    projectIdx: index("retainage_releases_project_idx").on(table.projectId),
    statusIdx: index("retainage_releases_status_idx").on(table.releaseStatus),
    sovLineIdx: index("retainage_releases_sov_line_idx").on(table.sovLineItemId),
    consumedByIdx: index("retainage_releases_consumed_by_idx").on(
      table.consumedByDrawRequestId,
    ),
    scheduledReleaseIdx: index(
      "retainage_releases_scheduled_release_at_idx",
    ).on(table.scheduledReleaseAt),
    triggerMilestoneIdx: index(
      "retainage_releases_trigger_milestone_idx",
    ).on(table.releaseTriggerMilestoneId),
    // Explicit short-form name: long-form auto-name exceeds Postgres' 63-char
    // limit and gets truncated, which drizzle-kit re-proposes as drift.
    consumedByDrawRequestFk: foreignKey({
      columns: [table.consumedByDrawRequestId],
      foreignColumns: [drawRequests.id],
      name: "retainage_releases_consumed_by_draw_request_id_fk",
    }).onDelete("set null"),
    // RLS Slice A bucket 4b — project-scoped 2-clause hybrid.
    tenantIsolation: pgPolicy("retainage_releases_tenant_isolation", {
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
