import { db, type DB } from "@/db/client";
import { activityFeedItems } from "@/db/schema";

import type { EffectiveContext } from "./context";

type DbOrTx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

type ActivityInsert = typeof activityFeedItems.$inferInsert;
type ActivityType = ActivityInsert["activityType"];
type SurfaceType = ActivityInsert["surfaceType"];
type VisibilityScope = ActivityInsert["visibilityScope"];

export type WriteActivityFeedItemInput = {
  activityType: ActivityType;
  projectId?: string;
  summary: string;
  body?: string | null;
  relatedObjectType: string;
  relatedObjectId: string;
  visibilityScope: VisibilityScope;
  surfaceType?: SurfaceType;
};

// Activity feed items drive the user-facing "Recent Activity" strips on
// project homes. Unlike audit events, these are scoped by visibility
// and rendered to end users, so keep titles human-readable. Pair every
// activity write with a `writeAuditEvent` for the same state change.
export async function writeActivityFeedItem(
  ctx: EffectiveContext,
  input: WriteActivityFeedItemInput,
  tx: DbOrTx = db,
): Promise<void> {
  await tx.insert(activityFeedItems).values({
    projectId: input.projectId ?? ctx.project.id,
    actorUserId: ctx.user.id,
    activityType: input.activityType,
    surfaceType: input.surfaceType ?? "feed_item",
    title: input.summary,
    body: input.body ?? null,
    relatedObjectType: input.relatedObjectType,
    relatedObjectId: input.relatedObjectId,
    visibilityScope: input.visibilityScope,
  });
}
