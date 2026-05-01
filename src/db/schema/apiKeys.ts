import {
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { timestamps } from "./_shared";
import { organizations, users } from "./identity";

// -----------------------------------------------------------------------------
// api_keys — per-org programmatic-access credentials.
//
// Step 58 (Phase 8-lite.1 #58). Authenticates inbound REST calls under
// /api/v1/* via the Authorization: Bearer header. Each key is scoped
// to one org with a coarse permission tier.
//
// Hash strategy: HMAC-SHA256(pepper, fullKey) — deterministic so the
// auth helper can do an indexed equality lookup on `key_hash`. Bcrypt
// is wrong for API keys — non-determinism would force a per-key scan
// on every request, and the threats bcrypt protects against don't
// apply to 32-char base62 secrets with 190 bits of entropy. The
// server-side pepper (env var API_KEY_PEPPER) means a stolen DB still
// can't reverse the hashes offline. Loss-of-pepper blast radius is
// the same as loss-of-BETTER_AUTH_SECRET — every key needs rotation.
//
// `key_prefix` is the first 16 chars of the full key (`bcrm_live_` +
// 6 chars of the random tail) for human-readable display. Stored
// separately so the list view doesn't need the hash.
//
// Scope tiers are a strict ordering: admin ⊃ write ⊃ read. The auth
// helper accepts a `requiredScope` arg and checks the granted scope
// is at-or-above. UI's create-modal enforces tier exclusivity (picking
// 'write' returns ['read', 'write']) but the column accepts any
// subset for forward-compat with future fine-grained scopes.

export const apiKeyScopeEnum = pgEnum("api_key_scope", [
  "read",
  "write",
  "admin",
]);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    // First 16 chars of the full key — `bcrm_live_` (10) + 6-char tail.
    // Displayed in lists; not sensitive on its own.
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    // HMAC-SHA256 hex digest = 64 chars. NOT a bcrypt hash — see
    // docstring above for why.
    keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
    scopes: apiKeyScopeEnum("scopes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::api_key_scope[]`),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    // Updated async-style — bumped on successful auth, sampled if we
    // ever want to skip very chatty keys.
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    revokeReason: text("revoke_reason"),
    // Step 59 — per-key rate-limit overrides. Both nullable; when null
    // the auth helper falls back to the platform defaults
    // (60/min, 1000/hr — see DEFAULT_API_KEY_RATE_LIMITS in
    // src/lib/ratelimit.ts). Letting the column live here means a
    // future "raise this customer's limits" admin action is a
    // single-row UPDATE with no migration.
    rateLimitPerMinute: integer("rate_limit_per_minute"),
    rateLimitPerHour: integer("rate_limit_per_hour"),
    ...timestamps,
  },
  (table) => ({
    orgCreatedIdx: index("api_keys_org_created_idx").on(
      table.orgId,
      table.createdAt,
    ),
    orgStatusIdx: index("api_keys_org_status_idx").on(
      table.orgId,
      table.revokedAt,
    ),
    // Note: keyHash already has a UNIQUE constraint which gives us a
    // btree index — no separate index needed for the auth-helper
    // lookup (`WHERE key_hash = $1 AND revoked_at IS NULL`).
    tenantIsolation: pgPolicy("api_keys_tenant_isolation", {
      for: "all",
      using: sql`${table.orgId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.orgId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();
