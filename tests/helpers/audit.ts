import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { auditEvents } from "@/db/schema";

export async function auditEventsFor(
  objectType: string,
  objectId: string,
): Promise<
  Array<{
    action: string;
    actorUserId: string;
    previousState: unknown;
    nextState: unknown;
  }>
> {
  const rows = await db
    .select({
      action: auditEvents.actionName,
      actorUserId: auditEvents.actorUserId,
      previousState: auditEvents.previousState,
      nextState: auditEvents.nextState,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(and(eq(auditEvents.objectType, objectType), eq(auditEvents.objectId, objectId)));
  rows.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  return rows.map(({ createdAt: _omit, ...r }) => r);
}
