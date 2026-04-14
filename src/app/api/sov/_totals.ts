import { and, eq, sql } from "drizzle-orm";

import { scheduleOfValues, sovLineItems } from "@/db/schema";
import type { DB } from "@/db/client";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

// Recompute SOV totals from active line items and persist them back.
// Split into original-contract vs change-order buckets so the G702 engine
// can reference the netChangeOrders number later.
export async function recomputeSovTotals(tx: Tx, sovId: string): Promise<void> {
  const [row] = await tx
    .select({
      totalOriginal: sql<number>`coalesce(sum(case when ${sovLineItems.lineItemType} = 'original' then ${sovLineItems.scheduledValueCents} else 0 end), 0)`,
      totalChangeOrders: sql<number>`coalesce(sum(case when ${sovLineItems.lineItemType} = 'change_order' then ${sovLineItems.scheduledValueCents} else 0 end), 0)`,
    })
    .from(sovLineItems)
    .where(
      and(eq(sovLineItems.sovId, sovId), eq(sovLineItems.isActive, true)),
    );

  const totalOriginal = Number(row?.totalOriginal ?? 0);
  const totalChangeOrders = Number(row?.totalChangeOrders ?? 0);

  await tx
    .update(scheduleOfValues)
    .set({
      totalOriginalContractCents: totalOriginal,
      totalChangeOrdersCents: totalChangeOrders,
      totalScheduledValueCents: totalOriginal + totalChangeOrders,
    })
    .where(eq(scheduleOfValues.id, sovId));
}
