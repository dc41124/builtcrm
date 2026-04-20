-- Migration: Procurement / Purchase Orders module (Step 41 / 4D #41)
-- Date: 2026-04-19
-- Context: First-class procurement workflow for contractors. Four new tables
-- and one column on organizations.
--
--   1. `cost_codes` — per-org catalog of cost codes (CSI MasterFormat style
--      or contractor-custom). Scoped to organizationId, not global, so
--      different GCs can configure their own schemes. The UI offers a
--      first-run "populate with CSI division starter set" prompt that
--      seeds ~25 division-level codes; not auto-seeded on org creation.
--
--   2. `vendors` — per-org vendor catalog. Vendors persist across projects
--      (a GC's relationship with Acme Steel is long-term). Soft-state via
--      `active` boolean; never hard-delete because historical POs point
--      here.
--
--   3. `purchase_orders` — one PO per (org, project, vendor) with a
--      state machine (draft → issued → revised? → partially_received →
--      fully_received → invoiced → closed; any non-terminal → cancelled).
--      Money is NOT stored aggregated on this table: subtotal, tax
--      amount, and total are computed on read from line rows +
--      `tax_rate_percent`. Line immutability after issue (enforced at
--      the action layer) plus the `revised` state + document supersedes
--      chain for revision PDFs preserves historical accuracy without
--      stored aggregates.
--
--   4. `purchase_order_lines` — line items. Only `received_quantity`
--      persists as derived-but-stateful; `total_cost` is computed on
--      read (quantity × unit_cost_cents).
--
-- Organization addition: `default_tax_rate_percent` provides the per-org
-- default that seeds new POs at creation time. Contractor can override per
-- PO. Numeric(5,2) supports fractional rates like Quebec QST (9.975%).
--
-- All FKs use the drizzle-kit long form (see migration 0019 context).

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------

CREATE TYPE "public"."vendor_rating" AS ENUM (
  'preferred',
  'standard'
);

CREATE TYPE "public"."procurement_po_status" AS ENUM (
  'draft',
  'issued',
  'revised',
  'partially_received',
  'fully_received',
  'invoiced',
  'closed',
  'cancelled'
);

-- --------------------------------------------------------------------------
-- Column addition on organizations
-- --------------------------------------------------------------------------

ALTER TABLE "organizations"
  ADD COLUMN "default_tax_rate_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL;

-- --------------------------------------------------------------------------
-- cost_codes
-- --------------------------------------------------------------------------

CREATE TABLE "cost_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "code" varchar(40) NOT NULL,
  "description" varchar(255) NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cost_codes_org_code_unique" UNIQUE ("organization_id", "code"),
  CONSTRAINT "cost_codes_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX "cost_codes_org_active_idx" ON "cost_codes" ("organization_id", "active");

-- --------------------------------------------------------------------------
-- vendors
-- --------------------------------------------------------------------------

CREATE TABLE "vendors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "contact_name" varchar(200),
  "contact_email" varchar(320),
  "contact_phone" varchar(40),
  "address" text,
  "payment_terms" varchar(120),
  "rating" "vendor_rating" DEFAULT 'standard' NOT NULL,
  "notes" text,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "vendors_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX "vendors_org_name_idx" ON "vendors" ("organization_id", "name");
CREATE INDEX "vendors_org_active_idx" ON "vendors" ("organization_id", "active");

-- --------------------------------------------------------------------------
-- purchase_orders
-- --------------------------------------------------------------------------

CREATE TABLE "purchase_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "po_number" varchar(40) NOT NULL,
  "vendor_id" uuid NOT NULL,
  "cost_code_id" uuid,
  "status" "procurement_po_status" DEFAULT 'draft' NOT NULL,
  "ordered_at" timestamp with time zone,
  "ordered_by_user_id" uuid,
  "expected_delivery_at" timestamp with time zone,
  "tax_rate_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
  "notes" text,
  "revision_number" integer DEFAULT 1 NOT NULL,
  "last_revised_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "purchase_orders_org_po_number_unique" UNIQUE ("organization_id", "po_number"),
  CONSTRAINT "purchase_orders_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "purchase_orders_project_id_projects_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk"
    FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT,
  CONSTRAINT "purchase_orders_cost_code_id_cost_codes_id_fk"
    FOREIGN KEY ("cost_code_id") REFERENCES "cost_codes"("id") ON DELETE SET NULL,
  CONSTRAINT "purchase_orders_ordered_by_user_id_users_id_fk"
    FOREIGN KEY ("ordered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "purchase_orders_project_status_idx" ON "purchase_orders" ("project_id", "status");
CREATE INDEX "purchase_orders_org_status_idx" ON "purchase_orders" ("organization_id", "status");
CREATE INDEX "purchase_orders_vendor_idx" ON "purchase_orders" ("vendor_id");
CREATE INDEX "purchase_orders_cost_code_idx" ON "purchase_orders" ("cost_code_id");

-- --------------------------------------------------------------------------
-- purchase_order_lines
-- --------------------------------------------------------------------------

CREATE TABLE "purchase_order_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "purchase_order_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "description" text NOT NULL,
  "quantity" numeric(12, 3) DEFAULT '0.000' NOT NULL,
  "unit" varchar(32) DEFAULT 'ea' NOT NULL,
  "unit_cost_cents" integer DEFAULT 0 NOT NULL,
  "received_quantity" numeric(12, 3) DEFAULT '0.000' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE
);

CREATE INDEX "purchase_order_lines_po_idx" ON "purchase_order_lines" ("purchase_order_id");
