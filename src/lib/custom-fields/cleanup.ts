// Step 61 — Custom-field value cleanup helper.
//
// The custom_field_values.entity_id column is intentionally polymorphic
// (no FK constraint — see customFields.ts comment). Any entity delete
// action MUST call this helper inside the same transaction so we don't
// orphan value rows. Missing the call is non-fatal (orphans don't break
// reads) but it does leave dangling rows.

import { and, eq, inArray } from "drizzle-orm";

import type { DB } from "@/db/client";
import { customFieldDefinitions, customFieldValues } from "@/db/schema";

import type { CustomFieldEntityType } from "./registry";

type DbOrTx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Delete every custom_field_values row attached to the given entity.
 *  We scope by both entity_id AND the parent definition's entity_type
 *  so a future bug that lets a UUID collide across tables doesn't
 *  delete the wrong row.
 *
 *  Pass `tx` if you're inside a transaction; otherwise it runs against
 *  the base client. RLS still applies — caller must already be in the
 *  correct tenant context. */
export async function deleteCustomFieldValuesForEntity(
  tx: DbOrTx,
  entityType: CustomFieldEntityType,
  entityId: string,
): Promise<number> {
  const defIds = await tx
    .select({ id: customFieldDefinitions.id })
    .from(customFieldDefinitions)
    .where(eq(customFieldDefinitions.entityType, entityType));
  if (defIds.length === 0) return 0;

  const result = await tx
    .delete(customFieldValues)
    .where(
      and(
        inArray(
          customFieldValues.definitionId,
          defIds.map((d) => d.id),
        ),
        eq(customFieldValues.entityId, entityId),
      ),
    )
    .returning({ id: customFieldValues.id });

  return result.length;
}
