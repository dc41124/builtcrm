import { and, asc, eq, inArray } from "drizzle-orm";

import { withTenant } from "@/db/with-tenant";
import { customFieldDefinitions, customFieldValues } from "@/db/schema";

import type { CustomFieldEntityType } from "@/lib/custom-fields/registry";

// Step 61 — Custom field loaders.
//
// All reads go through `withTenant` so RLS is enforced; callers must be
// in a contractor / sub / client org context.

export type CustomFieldDefinitionRow = {
  id: string;
  organizationId: string;
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  description: string | null;
  fieldType: "text" | "number" | "date" | "select" | "multi_select" | "boolean";
  optionsJson: unknown;
  isRequired: boolean;
  orderIndex: number;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomFieldValueRow = {
  id: string;
  definitionId: string;
  entityId: string;
  valueJson: unknown;
  createdAt: Date;
  updatedAt: Date;
};

/** All definitions for an org, optionally narrowed to one entity type and
 *  optionally including archived rows. Default: active only, ordered by
 *  entity_type then order_index for stable group rendering. */
export async function listDefinitionsForOrg(
  orgId: string,
  options: {
    entityType?: CustomFieldEntityType;
    includeArchived?: boolean;
  } = {},
): Promise<CustomFieldDefinitionRow[]> {
  return withTenant(orgId, async (tx) => {
    const filters = [eq(customFieldDefinitions.organizationId, orgId)];
    if (options.entityType) {
      filters.push(eq(customFieldDefinitions.entityType, options.entityType));
    }
    if (!options.includeArchived) {
      filters.push(eq(customFieldDefinitions.isActive, true));
    }
    const rows = await tx
      .select()
      .from(customFieldDefinitions)
      .where(and(...filters))
      .orderBy(
        asc(customFieldDefinitions.entityType),
        asc(customFieldDefinitions.orderIndex),
      );
    return rows as CustomFieldDefinitionRow[];
  });
}

/** Active definitions for an entity type, ordered for form rendering. */
export async function listActiveDefinitionsForEntityType(
  orgId: string,
  entityType: CustomFieldEntityType,
): Promise<CustomFieldDefinitionRow[]> {
  return listDefinitionsForOrg(orgId, { entityType });
}

/** All custom-field values attached to a single entity row. The caller
 *  joins these to the definitions list to render. Returns [] when the
 *  entity has no custom values. */
export async function loadValuesForEntity(
  orgId: string,
  entityType: CustomFieldEntityType,
  entityId: string,
): Promise<CustomFieldValueRow[]> {
  return withTenant(orgId, async (tx) => {
    const defIds = await tx
      .select({ id: customFieldDefinitions.id })
      .from(customFieldDefinitions)
      .where(
        and(
          eq(customFieldDefinitions.organizationId, orgId),
          eq(customFieldDefinitions.entityType, entityType),
        ),
      );
    if (defIds.length === 0) return [];

    const rows = await tx
      .select()
      .from(customFieldValues)
      .where(
        and(
          inArray(
            customFieldValues.definitionId,
            defIds.map((d) => d.id),
          ),
          eq(customFieldValues.entityId, entityId),
        ),
      );
    return rows as CustomFieldValueRow[];
  });
}
