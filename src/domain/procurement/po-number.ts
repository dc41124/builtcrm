import { eq, sql } from "drizzle-orm";

import type { DB } from "@/db/client";
import { purchaseOrders } from "@/db/schema";

// Allocates the next PO number for an org. Format: PO-{N} where N is a
// per-org monotonic integer. Walks the existing rows — not cached — to
// avoid a stored counter drifting from the actual set.
//
// Races: safe inside a transaction because the caller should hold
// enough locks (or retry the insert on unique-violation). The unique
// constraint `(organization_id, po_number)` is the final gate.
export async function allocateNextPoNumber(
  tx: DB | Parameters<Parameters<DB["transaction"]>[0]>[0],
  organizationId: string,
): Promise<string> {
  const [row] = await tx
    .select({
      // Extract the numeric suffix from po_number strings like "PO-1048".
      // Falls back to 1000 when no POs exist for the org (so the first
      // one starts at PO-1001 — matches the prototype's starting range
      // without leaving a visually obvious gap).
      maxNumber: sql<number>`
        coalesce(
          max(
            nullif(regexp_replace(${purchaseOrders.poNumber}, '[^0-9]', '', 'g'), '')::int
          ),
          1000
        )
      `,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.organizationId, organizationId));

  const next = (row?.maxNumber ?? 1000) + 1;
  return `PO-${next}`;
}
