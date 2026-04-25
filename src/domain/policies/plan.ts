// Plan-tier feature gating policy.
//
// Source of truth for "which tier does X require?". The schema stores only
// pricing + numeric limits; boolean feature flags live here so they're
// typesafe and deployable atomically with the code that reads them.
//
// Suspended orgs (subscription status not in {trialing, active}) fail every
// write-gate regardless of plan: writes blocked, reads allowed. Loaders
// that call `requireTier` / `requireFeature` should be gating *writes* only.

export type PlanTier = "starter" | "professional" | "enterprise";

const PLAN_TIER_ORDER: Record<PlanTier, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
};

// Features present in this registry require the named tier or higher.
// Features absent from the registry are available on ALL tiers, including
// the synthetic "trialing" state — this is deliberate: ACH draws, consumer
// SSO, compliance management, personal 2FA, email/iCal, QuickBooks push are
// all universal.
export type PlanFeatureKey =
  | "sso.saml"
  | "require_2fa_org"
  | "quickbooks.pull"
  | "xero_sage"
  | "stripe.cards"
  | "stripe.saved_methods"
  | "stripe.client_pays_selections"
  | "stripe.custom_payouts"
  | "stripe.multi_entity"
  | "receipts.org_branded"
  | "residential.selections_studio"
  | "approvals.workflows"
  | "import.csv_excel"
  | "data_exports.full_archive"
  | "audit.csv_export"
  | "api.access"
  | "api.webhooks_outbound"
  | "calendar.direct_oauth"
  | "migration.procore_buildertrend"
  | "support.priority_email"
  | "support.dedicated_manager"
  // Subcontractor prequalification (Step 49). Templates, intake, review,
  // badge, assignment hook, expiry sweep. Gated to Professional+ — sits
  // alongside other Professional features the SMB GC market expects.
  | "prequalification";

export const PLAN_FEATURES: Record<PlanFeatureKey, PlanTier> = {
  "sso.saml": "enterprise",
  "require_2fa_org": "professional",
  "quickbooks.pull": "professional",
  "xero_sage": "professional",
  "stripe.cards": "professional",
  "stripe.saved_methods": "professional",
  "stripe.client_pays_selections": "professional",
  "stripe.custom_payouts": "enterprise",
  "stripe.multi_entity": "enterprise",
  "receipts.org_branded": "professional",
  "residential.selections_studio": "professional",
  "approvals.workflows": "professional",
  "import.csv_excel": "professional",
  "data_exports.full_archive": "professional",
  "audit.csv_export": "enterprise",
  "api.access": "professional",
  "api.webhooks_outbound": "enterprise",
  "calendar.direct_oauth": "enterprise",
  "migration.procore_buildertrend": "enterprise",
  "support.priority_email": "professional",
  "support.dedicated_manager": "enterprise",
  "prequalification": "professional",
};

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

const ACTIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  "trialing",
  "active",
]);

// Minimal shape required to make a plan-gate decision. Loaders build this
// from `organization_subscriptions` joined with `subscription_plans`; a null
// `tier` means the org has no subscription row at all (unusual — only
// pre-backfill orgs or mid-signup pending orgs).
export type PlanContext = {
  tier: PlanTier | null;
  status: SubscriptionStatus | null;
};

export function isSuspended(ctx: PlanContext): boolean {
  if (!ctx.status) return true;
  return !ACTIVE_STATUSES.has(ctx.status);
}

export function hasTier(ctx: PlanContext, minTier: PlanTier): boolean {
  if (!ctx.tier) return false;
  if (isSuspended(ctx)) return false;
  return PLAN_TIER_ORDER[ctx.tier] >= PLAN_TIER_ORDER[minTier];
}

export function hasFeature(ctx: PlanContext, feature: PlanFeatureKey): boolean {
  if (!ctx.tier) return false;
  if (isSuspended(ctx)) return false;
  const required = PLAN_FEATURES[feature];
  return PLAN_TIER_ORDER[ctx.tier] >= PLAN_TIER_ORDER[required];
}

export class PlanGateError extends Error {
  constructor(
    public readonly reason: "insufficient_tier" | "suspended" | "no_subscription",
    public readonly required?: PlanTier | PlanFeatureKey,
  ) {
    super(
      `PlanGateError: ${reason}${required ? ` (requires ${required})` : ""}`,
    );
    this.name = "PlanGateError";
  }
}

export function requireTier(ctx: PlanContext, minTier: PlanTier): void {
  if (!ctx.tier) throw new PlanGateError("no_subscription");
  if (isSuspended(ctx)) throw new PlanGateError("suspended");
  if (PLAN_TIER_ORDER[ctx.tier] < PLAN_TIER_ORDER[minTier]) {
    throw new PlanGateError("insufficient_tier", minTier);
  }
}

export function requireFeature(
  ctx: PlanContext,
  feature: PlanFeatureKey,
): void {
  if (!ctx.tier) throw new PlanGateError("no_subscription");
  if (isSuspended(ctx)) throw new PlanGateError("suspended");
  const required = PLAN_FEATURES[feature];
  if (PLAN_TIER_ORDER[ctx.tier] < PLAN_TIER_ORDER[required]) {
    throw new PlanGateError("insufficient_tier", feature);
  }
}
