import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { retention, timestamps } from "./_shared";
import { organizations } from "./identity";

// -----------------------------------------------------------------------------
// Step 61 (Phase 8-lite.2 #61) — Custom fields on entities.
//
// Two tables:
//   custom_field_definitions — what the org allows on a given entity type
//   custom_field_values      — the actual filled-in value per entity row
//
// `entity_id` on the value table is intentionally polymorphic (no FK). The
// definition's `entity_type` plus `entity_id` together identify the parent
// row, but we don't add six separate value tables (one per entity type)
// because:
//   - We never join custom values across entity types — every read is "give
//     me the values for *this* RFI / *this* project". The entity type is
//     known from context.
//   - A six-fold duplication of helpers, loaders, actions, and migration
//     ceremony is much higher cost than the safety we'd gain.
//
// The cost: no DB-level cascade when an entity row is deleted. Mitigation:
// every entity's delete action MUST call deleteCustomFieldValuesForEntity()
// inside the same transaction. See src/lib/custom-fields/cleanup.ts. This
// is documented as a checklist item per entity; missing the call orphans
// rows but doesn't break anything (orphans are cleaned by the entity-type
// audit query in src/lib/custom-fields/cleanup.ts).
//
// Authorization summary (enforced at the action layer, not the schema):
//   - definitions: contractor_admin only manage; everyone in the org reads.
//   - values: anyone with edit-access to the parent entity.
// -----------------------------------------------------------------------------

export const customFieldEntityTypeEnum = pgEnum("custom_field_entity_type", [
  // V1 entities. Designed to grow — adding a new value here is a one-line
  // schema bump; the registry in src/lib/custom-fields/registry.ts wires
  // it into UIs.
  "project",
  "subcontractor",
  "document",
  "rfi",
]);

export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "number",
  "date",
  "select",
  "multi_select",
  "boolean",
]);

// -----------------------------------------------------------------------------
// custom_field_definitions
// -----------------------------------------------------------------------------

export const customFieldDefinitions = pgTable(
  "custom_field_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    entityType: customFieldEntityTypeEnum("entity_type").notNull(),
    // Slug, lowercased, snake_case. Generated from `label` if the admin
    // doesn't override it. Unique per (org, entity_type) so e.g. "color"
    // can exist on both projects and subs without collision.
    key: varchar("key", { length: 60 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    description: text("description"),
    fieldType: customFieldTypeEnum("field_type").notNull(),
    // Array of { value, label } for select / multi_select; null otherwise.
    // Stored as jsonb so we can validate per-type at read.
    optionsJson: jsonb("options_json"),
    isRequired: boolean("is_required").default(false).notNull(),
    orderIndex: integer("order_index").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    orgEntityIdx: index("custom_field_defs_org_entity_idx").on(
      table.organizationId,
      table.entityType,
      table.orderIndex,
    ),
    orgEntityKeyUnique: unique("custom_field_defs_org_entity_key_unique").on(
      table.organizationId,
      table.entityType,
      table.key,
    ),
    // Pattern A — direct org_id check. Same shape as vendors / api_keys.
    tenantIsolation: pgPolicy("custom_field_definitions_tenant_isolation", {
      for: "all",
      using: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.organizationId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();

// -----------------------------------------------------------------------------
// custom_field_values
//
// Note on FK naming: drizzle-kit's auto-name
//   custom_field_values_definition_id_custom_field_definitions_id_fk
// is 64 chars (over Postgres' 63-char identifier limit) and would be
// silently truncated on write but not on introspection — surfaces as
// permanent drift. We declare the FK explicitly with a short name. See
// CLAUDE.md "FK constraint naming" rule.
// -----------------------------------------------------------------------------

export const customFieldValues = pgTable(
  "custom_field_values",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    definitionId: uuid("definition_id").notNull(),
    // Polymorphic — combined with the definition's entity_type. NO FK
    // constraint. See the file-level comment for the tradeoff and
    // mitigation.
    entityId: uuid("entity_id").notNull(),
    // Normalized by field_type:
    //   text         → string
    //   number       → number
    //   date         → ISO-8601 string (YYYY-MM-DD)
    //   select       → string  (one of the option values)
    //   multi_select → string[]
    //   boolean      → boolean
    valueJson: jsonb("value_json").notNull(),
    ...timestamps,
    ...retention("project_record"),
  },
  (table) => ({
    defEntityUnique: unique("custom_field_values_def_entity_unique").on(
      table.definitionId,
      table.entityId,
    ),
    entityIdx: index("custom_field_values_entity_idx").on(table.entityId),
    definitionFk: foreignKey({
      columns: [table.definitionId],
      foreignColumns: [customFieldDefinitions.id],
      name: "custom_field_values_definition_id_fk",
    }).onDelete("cascade"),
    // RLS via the parent definition. EXISTS is the standard Pattern B —
    // the parent's tenant_isolation policy fires on the subquery, so we
    // don't need to repeat the org check.
    tenantIsolation: pgPolicy("custom_field_values_tenant_isolation", {
      for: "all",
      using: sql`EXISTS (
        SELECT 1 FROM custom_field_definitions
        WHERE custom_field_definitions.id = ${table.definitionId}
      )`,
      withCheck: sql`EXISTS (
        SELECT 1 FROM custom_field_definitions
        WHERE custom_field_definitions.id = ${table.definitionId}
      )`,
    }),
  }),
).enableRLS();
