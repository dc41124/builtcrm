import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { organizations } from "./identity";

// -----------------------------------------------------------------------------
// Platform subscription billing — contractor-only paid tiers.
//
// Distinct from Stripe Connect (contractor payouts to receive money from
// clients) and project_billing (draws, SOV, lien waivers). Only contractor
// orgs hit these tables; sub + client orgs never pay.
//
// Feature gating lives in `src/domain/policies/plan.ts` (PLAN_FEATURES
// registry). This schema only captures pricing, Stripe identifiers, and
// numeric limits.
// -----------------------------------------------------------------------------

export const subscriptionPlans = pgTable("subscription_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  // Prices in cents (USD). Null on Enterprise (custom quote, no self-serve).
  priceMonthlyCents: integer("price_monthly_cents"),
  priceAnnualCents: integer("price_annual_cents"),
  // Populated after Stripe dashboard products are created (Session 2).
  stripePriceIdMonthly: varchar("stripe_price_id_monthly", { length: 120 }),
  stripePriceIdAnnual: varchar("stripe_price_id_annual", { length: 120 }),
  // Null = unlimited.
  projectLimit: integer("project_limit"),
  teamLimit: integer("team_limit"),
  storageLimitGb: integer("storage_limit_gb"),
  isSelfServePurchasable: boolean("is_self_serve_purchasable")
    .default(true)
    .notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

// One row per contractor org that has ever hit the billing flow. Created on
// the first Stripe Checkout session; persists across subscription
// cancel/recreate so Stripe invoice history stays linkable.
//
// RLS deferred to Phase 3b: src/app/api/webhooks/stripe/route.ts looks
// rows up by `stripe_customer_id` BEFORE knowing which org the webhook
// is about. RLS would deny the lookup. Either run webhooks via the
// admin pool or refactor the flow.
export const stripeCustomers = pgTable("stripe_customers", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 120 })
    .notNull()
    .unique(),
  email: varchar("email", { length: 320 }).notNull(),
  ...timestamps,
});

// Single-row-per-org subscription state. Plan changes mutate this row; we do
// not keep historical subscription rows (Stripe does that via invoices +
// its own subscription history). `stripe_subscription_id` is nullable for
// manually provisioned Enterprise orgs and the existing-org backfill.
export const organizationSubscriptions = pgTable(
  "organization_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .unique()
      .references(() => organizations.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlans.id, { onDelete: "restrict" }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 120 })
      .unique(),
    status: varchar("status", { length: 40 }).notNull(),
    billingCycle: varchar("billing_cycle", { length: 20 }).notNull(),
    trialEnd: timestamp("trial_end", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
    }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end")
      .default(false)
      .notNull(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    statusCheck: check(
      "organization_subscriptions_status_check",
      sql`${table.status} in ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid')`,
    ),
    billingCycleCheck: check(
      "organization_subscriptions_billing_cycle_check",
      sql`${table.billingCycle} in ('monthly','annual')`,
    ),
    planIdx: index("organization_subscriptions_plan_idx").on(table.planId),
    statusIdx: index("organization_subscriptions_status_idx").on(table.status),
  }),
);
// RLS deferred to Phase 3b: src/app/api/webhooks/stripe/route.ts
// looks rows up by `stripe_subscription_id` BEFORE knowing which org
// the webhook is about. Same reason as stripe_customers above.

// Mirrors Stripe invoices 1:1 via webhook. Status + paidAt mutate over the
// invoice lifecycle (open → paid, or open → uncollectible); everything else
// is immutable.
export const subscriptionInvoices = pgTable(
  "subscription_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationSubscriptionId: uuid("organization_subscription_id").notNull(),
    stripeInvoiceId: varchar("stripe_invoice_id", { length: 120 })
      .notNull()
      .unique(),
    number: varchar("number", { length: 40 }),
    amountPaidCents: integer("amount_paid_cents").default(0).notNull(),
    currency: varchar("currency", { length: 3 }).default("usd").notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdfUrl: text("invoice_pdf_url"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    subscriptionIdx: index("subscription_invoices_subscription_idx").on(
      table.organizationSubscriptionId,
    ),
    // Explicit short-form name: long-form auto-name exceeds Postgres' 63-char
    // limit and gets truncated, which drizzle-kit re-proposes as drift.
    organizationSubscriptionFk: foreignKey({
      columns: [table.organizationSubscriptionId],
      foreignColumns: [organizationSubscriptions.id],
      name: "subscription_invoices_organization_subscription_id_fk",
    }).onDelete("cascade"),
  }),
);
