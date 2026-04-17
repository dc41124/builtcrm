import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
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
    ...timestamps,
  },
  (table) => ({
    nameIdx: index("organizations_name_idx").on(table.name),
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
