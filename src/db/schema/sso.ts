import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestamps } from "./_shared";
import { organizations } from "./identity";

// -----------------------------------------------------------------------------
// SSO / SAML provider config per contractor org.
//
// One provider per organization — Enterprise customers typically have a
// single corporate IdP, and multi-provider support is future scope.
// Feature gating lives in src/domain/policies/plan.ts (`sso.saml` key —
// Enterprise only).
//
// certificate_pem stores the IdP signing certificate in PEM form. It's
// public material; plaintext storage matches how most SAML libraries expect
// to consume it. Cycling is a rare human event — no KMS overhead needed.
//
// RLS Phase 3b — Pattern A. The SSO callback in src/auth/sso-plugin.ts
// is pre-tenant (no session yet) and uses the admin pool (`dbAdmin`)
// to look up + update the provider row. The org-admin CRUD route
// (api/org/sso/providers) and the contractor settings page both
// already have a tenant context and go through `withTenant`. See
// docs/specs/rls_sprint_plan.md §3.3 + §3.4 and the
// organization_licenses precedent in identity.ts.
// -----------------------------------------------------------------------------

export const ssoProviders = pgTable(
  "sso_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    entityId: text("entity_id").notNull(),
    ssoUrl: text("sso_url").notNull(),
    certificatePem: text("certificate_pem").notNull(),
    // Emails outside this domain are rejected even if the IdP asserts them.
    // Defence-in-depth on top of any IdP-side domain restriction.
    allowedEmailDomain: varchar("allowed_email_domain", {
      length: 253,
    }).notNull(),
    status: text("status").notNull().default("active"),
    // Observability — set on every successful ACS handshake.
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    orgUnique: unique("sso_providers_organization_id_unique").on(
      table.organizationId,
    ),
    statusIdx: index("sso_providers_status_idx").on(table.status),
    statusCheck: check(
      "sso_providers_status_check",
      sql`${table.status} in ('active','disabled')`,
    ),
    tenantIsolation: pgPolicy("sso_providers_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();
