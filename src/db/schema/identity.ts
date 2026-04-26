import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";

// Declared here (not in prequal.ts) so the column on `organizations` can
// reference it without a circular import (identity ↔ prequal). prequal.ts
// re-exports it.
export const prequalEnforcementModeEnum = pgEnum("prequal_enforcement_mode", [
  "off",
  "warn",
  "block",
]);

// -----------------------------------------------------------------------------
// User-preference enums (used by users.theme / users.density and elsewhere)
// -----------------------------------------------------------------------------

export const themeModeEnum = pgEnum("theme_mode", [
  "light",
  "dark",
  "system",
]);

export const displayDensityEnum = pgEnum("display_density", [
  "comfortable",
  "compact",
]);

export const notificationPortalEnum = pgEnum("notification_portal", [
  "contractor",
  "subcontractor",
  "commercial",
  "residential",
]);

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const organizationTypeEnum = pgEnum("organization_type", [
  "contractor",
  "subcontractor",
  "client_company",
  "household",
  "internal_platform",
]);

export const portalTypeEnum = pgEnum("portal_type", [
  "contractor",
  "subcontractor",
  "client",
  // Schema prep for Step 20.5 (external reviewer portal). No rows use
  // this value yet; downstream switches treat it as inert.
  "external_reviewer",
]);

export const clientSubtypeEnum = pgEnum("client_subtype", [
  "commercial",
  "residential",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "invited",
  "active",
  "inactive",
  "removed",
]);

export const organizationMembershipTypeEnum = pgEnum("organization_membership_type", [
  "contractor",
  "subcontractor",
  "client",
  "consultant",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

// -----------------------------------------------------------------------------
// Users + organizations
// -----------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 320 }).notNull(),
    firstName: varchar("first_name", { length: 120 }),
    lastName: varchar("last_name", { length: 120 }),
    displayName: varchar("display_name", { length: 200 }),
    phone: varchar("phone", { length: 40 }),
    title: varchar("title", { length: 120 }),
    timezone: varchar("timezone", { length: 64 })
      .default("America/Los_Angeles")
      .notNull(),
    theme: themeModeEnum("theme").default("system").notNull(),
    density: displayDensityEnum("density").default("comfortable").notNull(),
    language: varchar("language", { length: 10 }).default("en").notNull(),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").default(true).notNull(),
    // Self-serve deletion lifecycle. See
    // docs/specs/user_deletion_and_export_plan.md.
    //   - pendingDeletionAt: when the grace window ends (now() + 30d at
    //     request time). NULL = no deletion in flight. While set, the
    //     user is signed out everywhere and login is blocked at the
    //     auth.session.create hook. Cleared by the tokenized cancel
    //     endpoint, or consumed by the anonymization sweep when reached.
    //   - deletedAt: when anonymization actually completed. NULL until
    //     the row has been scrubbed.
    pendingDeletionAt: timestamp("pending_deletion_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    // Hashed (SHA-256) cancel-deletion token. Plaintext goes out in the
    // confirmation email; the hash is what we compare against. Same
    // pattern as invitations.token.
    pendingDeletionTokenHash: text("pending_deletion_token_hash"),
    ...timestamps,
  },
  (table) => ({
    emailUnique: unique("users_email_unique").on(table.email),
    pendingDeletionIdx: index("users_pending_deletion_idx").on(
      table.pendingDeletionAt,
    ),
  }),
);

// -----------------------------------------------------------------------------
// Per-user notification preferences
//
// One row per (user, portal_type, event_id). Events are portal-scoped because
// a user who has both contractor and commercial-client access sees different
// event taxonomies per portal.
// -----------------------------------------------------------------------------

export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    portalType: notificationPortalEnum("portal_type").notNull(),
    eventId: varchar("event_id", { length: 120 }).notNull(),
    email: boolean("email").default(true).notNull(),
    inApp: boolean("in_app").default(true).notNull(),
    ...timestamps,
  },
  (table) => ({
    uniq: unique("user_notif_prefs_uniq").on(
      table.userId,
      table.portalType,
      table.eventId,
    ),
    userIdx: index("user_notif_prefs_user_idx").on(table.userId),
  }),
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    organizationType: organizationTypeEnum("organization_type").notNull(),

    // Settings-page fields (added 2026-04-17, portfolio Phase 4+ settings wire-up).
    // Nullable on all existing rows — populated via the Organization settings tab.
    // Shared across contractor and subcontractor portals; sub-specific fields are
    // flagged below.
    legalName: varchar("legal_name", { length: 255 }),
    // AES-256-GCM ciphertext (base64). Encrypted via TAX_ID_ENCRYPTION_KEY
    // through encryptTaxId() / decryptTaxId() in
    // src/lib/integrations/crypto.ts. Column is text (not varchar(N)) because
    // ciphertext for a 40-char plaintext is ~92 chars after base64. See
    // docs/specs/tax_id_encryption_plan.md for the masking + reveal flow and
    // backfill plan.
    taxId: text("tax_id"),
    website: varchar("website", { length: 500 }),
    phone: varchar("phone", { length: 40 }),

    // Business address (contractor + sub).
    addr1: varchar("addr1", { length: 255 }),
    addr2: varchar("addr2", { length: 120 }),
    city: varchar("city", { length: 120 }),
    stateRegion: varchar("state_region", { length: 80 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 80 }),

    // Contacts.
    primaryContactName: varchar("primary_contact_name", { length: 200 }),
    primaryContactTitle: varchar("primary_contact_title", { length: 200 }),
    primaryContactEmail: varchar("primary_contact_email", { length: 320 }),
    primaryContactPhone: varchar("primary_contact_phone", { length: 40 }),
    billingContactName: varchar("billing_contact_name", { length: 200 }),
    billingEmail: varchar("billing_email", { length: 320 }),

    // Logo (R2 storage key; presigned URLs rendered at read time).
    logoStorageKey: text("logo_storage_key"),

    // Sub-specific fields. Null on contractor rows.
    primaryTrade: varchar("primary_trade", { length: 120 }),
    secondaryTrades: text("secondary_trades").array(),
    yearsInBusiness: varchar("years_in_business", { length: 10 }),
    crewSize: varchar("crew_size", { length: 10 }),
    regions: text("regions").array(),

    // Org-security settings (added 2026-04-17, commit 5 of settings wire-up).
    // Domain lock: if non-null/non-empty, invitations to emails outside these
    // domains are rejected at the invitation-create route. Existing members
    // with other domains are unaffected.
    allowedEmailDomains: text("allowed_email_domains").array(),
    // Preference stored now; session-TTL enforcement is a follow-up since
    // Better Auth is configured globally and per-org TTL requires a session
    // lifecycle hook.
    sessionTimeoutMinutes: integer("session_timeout_minutes"),
    // Professional+ gated. Enforcement (block login when not enrolled) lives
    // in a Better Auth hook that hasn't been wired yet — the toggle persists
    // the preference and the UI is honest about "effective at next sign-in".
    // See Session 4 of the Billing phase for the gating wiring; enforcement
    // hook is grouped with the SSO phase since both touch src/auth/config.ts.
    requireTwoFactorOrg: boolean("require_2fa_org").default(false).notNull(),

    // Commercial-client-specific fields (commit 8). Null on other portals.
    industry: varchar("industry", { length: 120 }),
    companySize: varchar("company_size", { length: 40 }),
    invoiceDelivery: varchar("invoice_delivery", { length: 40 }),

    // Residential-client-specific fields (commit 8). Null on other portals.
    // `projectName` is the household's display label in the portal
    // ("Chen Residence"); distinct from `name` which holds the legal/display
    // name of the client org entity.
    projectName: varchar("project_name", { length: 255 }),
    preferredName: varchar("preferred_name", { length: 120 }),
    preferredChannel: varchar("preferred_channel", { length: 40 }),
    preferredTime: varchar("preferred_time", { length: 40 }),
    emergencyName: varchar("emergency_name", { length: 200 }),
    emergencyRelation: varchar("emergency_relation", { length: 80 }),
    emergencyPhone: varchar("emergency_phone", { length: 40 }),

    // Platform subscription billing (Session 1 of Billing phase, 2026-04-17).
    // `currentPlanSlug` is denormalized from organization_subscriptions.plan.slug
    // for fast plan-gate reads on the hot path. Kept in sync by the Stripe
    // webhook processor. Null for non-contractor orgs (subs + clients never pay).
    // Usage counters are maintained by domain actions on object create /
    // soft-remove; they enforce the per-tier limits in subscription_plans.
    currentPlanSlug: varchar("current_plan_slug", { length: 40 }),
    usageProjectCount: integer("usage_project_count").default(0).notNull(),
    usageTeamCount: integer("usage_team_count").default(0).notNull(),
    usageStorageBytes: bigint("usage_storage_bytes", { mode: "number" })
      .default(0)
      .notNull(),

    // Default sales-tax rate applied to new purchase orders (Step 41).
    // Per-PO override on purchase_orders.taxRatePercent. Decimals supported
    // (e.g. 9.975 for Quebec QST). 0.00 = no default (contractor enters per PO).
    defaultTaxRatePercent: numeric("default_tax_rate_percent", {
      precision: 5,
      scale: 2,
    })
      .default("0.00")
      .notNull(),

    // Subcontractor prequalification enforcement (Step 49). Reads at
    // sub-to-project assignment time. Default 'off' for migration safety;
    // new contractor orgs get 'warn' assigned by the org-creation server
    // action. Only meaningful for contractor-type orgs; sub + client orgs
    // ignore it.
    prequalEnforcementMode: prequalEnforcementModeEnum("prequal_enforcement_mode")
      .default("off")
      .notNull(),

    ...timestamps,
  },
  (table) => ({
    nameIdx: index("organizations_name_idx").on(table.name),
  }),
);

// License & credential entries per organization. Used by both contractor and
// subcontractor Organization settings tabs.
// RLS pilot table — Phase 2 of docs/specs/rls_sprint_plan.md.
// Pattern A (direct org_id check). Policy denies any read/write whose
// `app.current_org_id` GUC doesn't match the row's organization_id;
// when the GUC is unset (caller didn't go through withTenant),
// current_setting returns NULL and the comparison is falsy → row
// denied. The admin role (builtcrm_admin) has BYPASSRLS so migrations,
// seed, and admin tooling are unaffected.
export const organizationLicenses = pgTable(
  "organization_licenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 200 }).notNull(),
    licenseNumber: varchar("license_number", { length: 120 }).notNull(),
    stateRegion: varchar("state_region", { length: 80 }),
    expiresOn: date("expires_on"),
    ...timestamps,
  },
  (table) => ({
    orgIdx: index("organization_licenses_org_idx").on(table.organizationId),
    tenantIsolation: pgPolicy("organization_licenses_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// Self-managed certifications (sub-only today, but the table is generic so
// contractors can adopt it without schema work).
// `issuedOn` and `expiresOn` are free-form strings because real-world certs
// have labels like "Various" or "Annual renewal" that don't fit a date column.
// RLS Phase 3 — Pattern A. See docs/specs/rls_sprint_plan.md and
// the organization_licenses precedent above.
export const organizationCertifications = pgTable(
  "organization_certifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 200 }).notNull(),
    holder: varchar("holder", { length: 200 }),
    issuedOn: varchar("issued_on", { length: 60 }),
    expiresOn: varchar("expires_on", { length: 60 }),
    ...timestamps,
  },
  (table) => ({
    orgIdx: index("organization_certifications_org_idx").on(table.organizationId),
    tenantIsolation: pgPolicy("organization_certifications_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// RLS Phase 3b — Pattern A. Several call sites are intrinsically
// cross-org or pre-tenant and use the `dbAdmin` admin pool: the SSO
// callback (auth/sso-plugin.ts), signup-bootstrap (creates the org
// itself), GDPR user-export build (cross-org "what we hold on you"
// view), and the messages contractor participant picker (cross-org
// enumeration of project participants). The org-scoped sites
// (organization-members loader, org/members route, accept-invitation
// transaction) all use `withTenant`. See docs/specs/rls_sprint_plan.md.
export const organizationUsers = pgTable(
  "organization_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    membershipStatus: membershipStatusEnum("membership_status").default("active").notNull(),
    jobTitle: varchar("job_title", { length: 180 }),
    ...timestamps,
  },
  (table) => ({
    orgUserUnique: unique("organization_users_org_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    orgIdx: index("organization_users_org_idx").on(table.organizationId),
    userIdx: index("organization_users_user_idx").on(table.userId),
    tenantIsolation: pgPolicy("organization_users_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    portalType: portalTypeEnum("portal_type").notNull(),
    roleKey: varchar("role_key", { length: 120 }).notNull(),
    clientSubtype: clientSubtypeEnum("client_subtype"),
    isPrimary: boolean("is_primary").default(false).notNull(),
    ...timestamps,
  },
  (table) => ({
    clientSubtypePortalCheck: check(
      "role_assignments_client_subtype_check",
      sql`(
        (${table.portalType} = 'client' and ${table.clientSubtype} is not null)
        or
        (${table.portalType} <> 'client' and ${table.clientSubtype} is null)
      )`,
    ),
    userOrgIdx: index("role_assignments_user_org_idx").on(table.userId, table.organizationId),
    portalIdx: index("role_assignments_portal_idx").on(table.portalType),
  }),
);

// -----------------------------------------------------------------------------
// Invitations
// -----------------------------------------------------------------------------

// RLS Phase 3b — Pattern A. The token-based flows are pre-tenant by
// definition (token resolves to org) and use `dbAdmin`:
// loadInvitationByToken (loaders/invitations.ts), reviewer-auth.ts,
// the initial token lookup + expired-mark in api/invitations/accept,
// and the api/reviewer/[token]/decision transaction. Org-admin CRUD
// (api/invitations POST, api/org/invitations/[id], resend,
// submittals/[id]/invite-reviewer) and the listInvitationsForOrganization
// loader use `withTenant`. The accept transaction itself was already
// wrapped in withTenant in the organization_users slice.
// See docs/specs/rls_sprint_plan.md.
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    invitedEmail: varchar("invited_email", { length: 320 }).notNull(),
    invitedName: varchar("invited_name", { length: 200 }),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // projectId FK declared without typed reference to avoid circular import with projects.ts
    projectId: uuid("project_id"),
    portalType: varchar("portal_type", { length: 40 }).notNull(),
    clientSubtype: varchar("client_subtype", { length: 40 }),
    roleKey: varchar("role_key", { length: 120 }).notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    invitationStatus: invitationStatusEnum("invitation_status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    personalMessage: text("personal_message"),
    // Scoped-invitation fields. When set, the invitation grants access
    // to a specific object (e.g. a single submittal for an external
    // reviewer) rather than full project/org access. `scope_object_type`
    // is free-form text so future object types can opt in without a
    // schema migration; the API layer enforces valid values.
    scopeObjectType: varchar("scope_object_type", { length: 64 }),
    scopeObjectId: uuid("scope_object_id"),
    ...timestamps,
  },
  (table) => ({
    tokenHashUnique: unique("invitations_token_hash_unique").on(table.tokenHash),
    emailIdx: index("invitations_email_idx").on(table.invitedEmail),
    projectIdx: index("invitations_project_idx").on(table.projectId),
    statusIdx: index("invitations_status_idx").on(table.invitationStatus),
    scopeIdx: index("invitations_scope_idx").on(
      table.scopeObjectType,
      table.scopeObjectId,
    ),
    tenantIsolation: pgPolicy("invitations_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();
