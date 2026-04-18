import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";

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
    ...timestamps,
  },
  (table) => ({
    emailUnique: unique("users_email_unique").on(table.email),
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
    // Stored plaintext behind disk-level encryption + org-admin access policy.
    // See `settings wiring` section of phase_4plus_build_guide.md for the
    // encrypt-at-rest migration path if this ever needs hardening.
    taxId: varchar("tax_id", { length: 40 }),
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

    ...timestamps,
  },
  (table) => ({
    nameIdx: index("organizations_name_idx").on(table.name),
  }),
);

// License & credential entries per organization. Used by both contractor and
// subcontractor Organization settings tabs.
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
  }),
);

// Self-managed certifications (sub-only today, but the table is generic so
// contractors can adopt it without schema work).
// `issuedOn` and `expiresOn` are free-form strings because real-world certs
// have labels like "Various" or "Annual renewal" that don't fit a date column.
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
  }),
);

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
  }),
);

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
    token: varchar("token", { length: 255 }).notNull(),
    invitationStatus: invitationStatusEnum("invitation_status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    personalMessage: text("personal_message"),
    ...timestamps,
  },
  (table) => ({
    tokenUnique: unique("invitations_token_unique").on(table.token),
    emailIdx: index("invitations_email_idx").on(table.invitedEmail),
    projectIdx: index("invitations_project_idx").on(table.projectId),
    statusIdx: index("invitations_status_idx").on(table.invitationStatus),
  }),
);
