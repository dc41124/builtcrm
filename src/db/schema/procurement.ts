import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  unique,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { organizations, users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const vendorRatingEnum = pgEnum("vendor_rating", [
  "preferred",
  "standard",
]);

// State machine:
//   draft → issued → (revised) → partially_received → fully_received
//                               → invoiced → closed
//   any non-terminal → cancelled
//
// `revised` is a post-issue state that persists (a PO that has been revised
// at least once). Receiving flows work from both `issued` and `revised`.
export const poStatusEnum = pgEnum("procurement_po_status", [
  "draft",
  "issued",
  "revised",
  "partially_received",
  "fully_received",
  "invoiced",
  "closed",
  "cancelled",
]);

// -----------------------------------------------------------------------------
// Cost codes
//
// Per-org catalog. Different GCs use different coding schemes (CSI MasterFormat,
// internal codes, customer-specific codes for government work), so the catalog
// is never global. Contractors opt into the 25-code CSI division starter set
// on first use, or add their own.
// -----------------------------------------------------------------------------

export const costCodes = pgTable(
  "cost_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 40 }).notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    active: boolean("active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (table) => ({
    orgCodeUnique: unique("cost_codes_org_code_unique").on(
      table.organizationId,
      table.code,
    ),
    orgActiveIdx: index("cost_codes_org_active_idx").on(
      table.organizationId,
      table.active,
    ),
  }),
);

// -----------------------------------------------------------------------------
// Vendors
//
// Scoped to the contractor's org, not the project. A GC carries their vendor
// relationships across projects. Soft-state via `active` boolean rather than
// hard-delete, since historical POs reference vendor rows.
// -----------------------------------------------------------------------------

// RLS Phase 3c — Pattern A. All call sites are tenant-scoped contractor
// procurement: the loadVendorListForOrg loader, the vendor CRUD routes
// (POST + PATCH), and the inline vendor lookups inside the PO routes.
// Each is wrapped in `withTenant`. See docs/specs/rls_sprint_plan.md.
export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    contactName: varchar("contact_name", { length: 200 }),
    contactEmail: varchar("contact_email", { length: 320 }),
    contactPhone: varchar("contact_phone", { length: 40 }),
    address: text("address"),
    paymentTerms: varchar("payment_terms", { length: 120 }),
    rating: vendorRatingEnum("rating").default("standard").notNull(),
    notes: text("notes"),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    orgNameIdx: index("vendors_org_name_idx").on(
      table.organizationId,
      table.name,
    ),
    orgActiveIdx: index("vendors_org_active_idx").on(
      table.organizationId,
      table.active,
    ),
    tenantIsolation: pgPolicy("vendors_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// Purchase orders
//
// Money is never stored aggregated on this table. Subtotal, tax amount, and
// total are all computed on read from line rows + `taxRatePercent`. Line
// immutability after issue (enforced in the action layer) plus the `revised`
// state + document supersedes chain for revision PDFs preserves historical
// accuracy without stored aggregates.
//
// `taxRatePercent` defaults from `organizations.defaultTaxRatePercent` at
// creation time (contractor can override per-PO).
// -----------------------------------------------------------------------------

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    poNumber: varchar("po_number", { length: 40 }).notNull(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    costCodeId: uuid("cost_code_id").references(() => costCodes.id, {
      onDelete: "set null",
    }),
    status: poStatusEnum("status").default("draft").notNull(),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    orderedByUserId: uuid("ordered_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    expectedDeliveryAt: timestamp("expected_delivery_at", {
      withTimezone: true,
    }),
    // Numeric(5,2): supports fractional tax rates like QST 9.975% / HST 13.00%.
    // Stored as string by drizzle; parseFloat at read time.
    taxRatePercent: numeric("tax_rate_percent", { precision: 5, scale: 2 })
      .default("0.00")
      .notNull(),
    notes: text("notes"),
    // Bumped each time the PO is revised post-issue. `1` = initial issue.
    revisionNumber: integer("revision_number").default(1).notNull(),
    lastRevisedAt: timestamp("last_revised_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    orgPoNumberUnique: unique("purchase_orders_org_po_number_unique").on(
      table.organizationId,
      table.poNumber,
    ),
    projectStatusIdx: index("purchase_orders_project_status_idx").on(
      table.projectId,
      table.status,
    ),
    orgStatusIdx: index("purchase_orders_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    vendorIdx: index("purchase_orders_vendor_idx").on(table.vendorId),
    costCodeIdx: index("purchase_orders_cost_code_idx").on(table.costCodeId),
  }),
);

// -----------------------------------------------------------------------------
// Purchase order line items
//
// Derived-on-read: `totalCost` is not stored — compute as quantity × unitCost.
// Only `receivedQuantity` persists because it represents real-world state
// (deliveries arriving over time), not a derivation.
//
// Lines are fully editable while parent PO is in `draft`. Once the PO is in
// `issued` / `revised` / any downstream state, only `receivedQuantity` is
// mutable (enforced in actions). Real line edits post-issue happen via the
// "Revise PO" flow, which re-issues with a new revision PDF.
// -----------------------------------------------------------------------------

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    description: text("description").notNull(),
    // Numeric(12,3): supports fractional units (e.g., 1250.5 lf of rebar).
    quantity: numeric("quantity", { precision: 12, scale: 3 })
      .default("0.000")
      .notNull(),
    unit: varchar("unit", { length: 32 }).default("ea").notNull(),
    // Unit cost stored as integer cents; line total computed on read.
    unitCostCents: integer("unit_cost_cents").default(0).notNull(),
    receivedQuantity: numeric("received_quantity", {
      precision: 12,
      scale: 3,
    })
      .default("0.000")
      .notNull(),
    ...timestamps,
  },
  (table) => ({
    poIdx: index("purchase_order_lines_po_idx").on(table.purchaseOrderId),
  }),
);
