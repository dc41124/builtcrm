-- Migration: Stripe Billing infrastructure (Session 1 of Billing phase)
-- Date: 2026-04-17
-- Context: introduces platform subscription billing for contractor orgs.
-- Distinct from Stripe Connect (contractor payouts) and project_billing
-- (draws, SOV, lien waivers). Feature-gating logic lives in
-- src/domain/policies/plan.ts (PLAN_FEATURES registry); this schema only
-- captures pricing, Stripe identifiers, and numeric limits.

-- ─────────────────────────────────────────────────────────────────────
-- 1. subscription_plans — catalog of tiers
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "subscription_plans" (
  "id"                           uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug"                         varchar(40)  NOT NULL,
  "name"                         varchar(80)  NOT NULL,
  "price_monthly_cents"          integer,
  "price_annual_cents"           integer,
  "stripe_price_id_monthly"      varchar(120),
  "stripe_price_id_annual"       varchar(120),
  "project_limit"                integer,
  "team_limit"                   integer,
  "storage_limit_gb"             integer,
  "is_self_serve_purchasable"    boolean      DEFAULT true NOT NULL,
  "display_order"                integer      DEFAULT 0    NOT NULL,
  "active"                       boolean      DEFAULT true NOT NULL,
  "created_at"                   timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"                   timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscription_plans_slug_unique" UNIQUE ("slug")
);

COMMENT ON TABLE "subscription_plans" IS
  'Platform subscription tiers. Feature-gating lives in src/domain/policies/plan.ts (PLAN_FEATURES registry), not on this table — only pricing, Stripe price IDs, and numeric limits here.';

-- Seed the 3 tiers. Stripe price IDs left null; populated in Session 2 after
-- the Stripe dashboard products are created. Limits: null = unlimited.
-- Prices in cents USD.
INSERT INTO "subscription_plans"
  (slug, name, price_monthly_cents, price_annual_cents, project_limit, team_limit, storage_limit_gb, is_self_serve_purchasable, display_order)
VALUES
  ('starter',      'Starter',      14900,  11900,  5,    3,    5,    true,  10),
  ('professional', 'Professional', 39900,  31900,  NULL, 10,   50,   true,  20),
  ('enterprise',   'Enterprise',   NULL,   NULL,   NULL, NULL, NULL, false, 30)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 2. stripe_customers — contractor-org-to-Stripe-customer mapping
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "stripe_customers" (
  "organization_id"       uuid         PRIMARY KEY NOT NULL,
  "stripe_customer_id"    varchar(120) NOT NULL,
  "email"                 varchar(320) NOT NULL,
  "created_at"            timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"            timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "stripe_customers_stripe_customer_id_unique" UNIQUE ("stripe_customer_id"),
  CONSTRAINT "stripe_customers_organization_id_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────
-- 3. organization_subscriptions — single-row-per-org subscription state
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "organization_subscriptions" (
  "id"                         uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id"            uuid         NOT NULL,
  "plan_id"                    uuid         NOT NULL,
  "stripe_subscription_id"     varchar(120),
  "status"                     varchar(40)  NOT NULL,
  "billing_cycle"              varchar(20)  NOT NULL,
  "trial_end"                  timestamp with time zone,
  "current_period_start"       timestamp with time zone NOT NULL,
  "current_period_end"         timestamp with time zone NOT NULL,
  "cancel_at_period_end"       boolean      DEFAULT false NOT NULL,
  "canceled_at"                timestamp with time zone,
  "created_at"                 timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"                 timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_subscriptions_organization_id_unique" UNIQUE ("organization_id"),
  CONSTRAINT "organization_subscriptions_stripe_subscription_id_unique" UNIQUE ("stripe_subscription_id"),
  CONSTRAINT "organization_subscriptions_organization_id_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "organization_subscriptions_plan_id_fk" FOREIGN KEY ("plan_id")
    REFERENCES "subscription_plans"("id") ON DELETE RESTRICT,
  CONSTRAINT "organization_subscriptions_status_check"
    CHECK (status IN ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid')),
  CONSTRAINT "organization_subscriptions_billing_cycle_check"
    CHECK (billing_cycle IN ('monthly','annual'))
);

CREATE INDEX IF NOT EXISTS "organization_subscriptions_plan_idx"
  ON "organization_subscriptions" ("plan_id");
CREATE INDEX IF NOT EXISTS "organization_subscriptions_status_idx"
  ON "organization_subscriptions" ("status");

-- ─────────────────────────────────────────────────────────────────────
-- 4. subscription_invoices — per-subscription invoice log
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "subscription_invoices" (
  "id"                             uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_subscription_id"   uuid         NOT NULL,
  "stripe_invoice_id"              varchar(120) NOT NULL,
  "number"                         varchar(40),
  "amount_paid_cents"              integer      DEFAULT 0     NOT NULL,
  "currency"                       varchar(3)   DEFAULT 'usd' NOT NULL,
  "status"                         varchar(40)  NOT NULL,
  "period_start"                   timestamp with time zone NOT NULL,
  "period_end"                     timestamp with time zone NOT NULL,
  "hosted_invoice_url"             text,
  "invoice_pdf_url"                text,
  "paid_at"                        timestamp with time zone,
  "created_at"                     timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"                     timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscription_invoices_stripe_invoice_id_unique" UNIQUE ("stripe_invoice_id"),
  CONSTRAINT "subscription_invoices_subscription_id_fk" FOREIGN KEY ("organization_subscription_id")
    REFERENCES "organization_subscriptions"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "subscription_invoices_subscription_idx"
  ON "subscription_invoices" ("organization_subscription_id");

-- ─────────────────────────────────────────────────────────────────────
-- 5. Organizations denormalizations
-- ─────────────────────────────────────────────────────────────────────
-- current_plan_slug mirrors organization_subscriptions.plan.slug for fast
-- plan-gate reads. Usage counters enforce per-tier numeric limits; updated
-- by domain actions on create/soft-remove.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "current_plan_slug"     varchar(40),
  ADD COLUMN IF NOT EXISTS "usage_project_count"   integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "usage_team_count"      integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "usage_storage_bytes"   bigint  DEFAULT 0 NOT NULL;

COMMENT ON COLUMN "organizations"."current_plan_slug" IS
  'Denormalized plan slug from organization_subscriptions. Null for non-contractor orgs (subs + clients never pay). Kept in sync by the Stripe webhook processor.';

-- ─────────────────────────────────────────────────────────────────────
-- 6. Existing-contractor-org backfill
-- ─────────────────────────────────────────────────────────────────────
-- Per Neon-shared-dev memory (dev + testing on one DB, user OK clobbering):
-- every existing contractor org gets a synthetic Professional subscription at
-- status='active', stripe_subscription_id=NULL (signals legacy/manual — same
-- pattern Enterprise orgs will use). Non-contractor orgs are excluded.
-- Idempotent via the NOT EXISTS guard so reruns are safe.

DO $$
DECLARE
  pro_plan_id uuid;
BEGIN
  SELECT id INTO pro_plan_id FROM "subscription_plans" WHERE slug = 'professional';

  INSERT INTO "organization_subscriptions"
    (organization_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
  SELECT
    o.id,
    pro_plan_id,
    'active',
    'annual',
    now(),
    now() + INTERVAL '1 year'
  FROM "organizations" o
  WHERE o.organization_type = 'contractor'
    AND NOT EXISTS (
      SELECT 1 FROM "organization_subscriptions" s WHERE s.organization_id = o.id
    );

  UPDATE "organizations"
    SET current_plan_slug = 'professional'
    WHERE organization_type = 'contractor'
      AND current_plan_slug IS NULL;
END $$;
