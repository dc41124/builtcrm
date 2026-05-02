import { and, count, desc, eq, gte, isNotNull, like, lt, or } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  activityFeedItems,
  auditEvents,
  dataExports,
  notifications,
  syncEvents,
  webhookEvents,
} from "@/db/schema";
import type { RetentionTier } from "@/db/schema/_shared";
import { TIER_META } from "@/lib/retention/tiers";

// Step 66.5 — Retention admin view.
//
// Currently read-only. The 6 hardcoded per-table purge jobs are the only
// scheduled deletion paths on this stack today; the unified retention-
// sweep job + project-closeout backfill arrives in Step 66.6.
//
// All queries use dbAdmin because retention is a cross-org operational
// concern. Authorization happens at the route layer (contractor_admin only).

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export type RetentionTierRow = {
  tier: RetentionTier;
  label: string;
  floorDescription: string;
  configurable: boolean;
  rationale: string;
};

export type ActivePurgeJob = {
  jobId: string;
  tableName: string;
  tier: RetentionTier;
  retentionDays: number;
  eligibleNow: number;
  underLegalHold: number;
};

export type RecentSweepRow = {
  jobId: string;
  ranAt: Date;
  deletedCount: number | null;
};

export type RetentionAdminView = {
  tiers: RetentionTierRow[];
  jobs: ActivePurgeJob[];
  recentSweeps: RecentSweepRow[];
};

export async function loadRetentionAdminView(): Promise<RetentionAdminView> {
  const tiers: RetentionTierRow[] = (
    Object.keys(TIER_META) as RetentionTier[]
  ).map((tier) => {
    const meta = TIER_META[tier];
    return {
      tier,
      label: meta.label,
      floorDescription: meta.floorDescription,
      configurable: meta.configurable,
      rationale: meta.rationale,
    };
  });

  const now = Date.now();
  const ninetyDayCutoff = new Date(now - NINETY_DAYS_MS);

  // Per-job pending + held counts. Each pair runs in parallel; the WHERE
  // clauses mirror the purge jobs' actual delete predicates so the numbers
  // reflect what the next sweep would touch.

  const [
    activityEligible,
    activityHeld,
    auditEligible,
    auditHeld,
    notifEligible,
    notifHeld,
    exportsEligible,
    exportsHeld,
    syncEligible,
    syncHeld,
    webhookEligible,
    webhookHeld,
  ] = await Promise.all([
    dbAdmin
      .select({ value: count() })
      .from(activityFeedItems)
      .where(
        and(
          lt(activityFeedItems.createdAt, ninetyDayCutoff),
          eq(activityFeedItems.legalHold, false),
        ),
      ),
    dbAdmin
      .select({ value: count() })
      .from(activityFeedItems)
      .where(eq(activityFeedItems.legalHold, true)),

    dbAdmin
      .select({ value: count() })
      .from(auditEvents)
      .where(
        and(
          lt(auditEvents.createdAt, ninetyDayCutoff),
          eq(auditEvents.legalHold, false),
        ),
      ),
    dbAdmin
      .select({ value: count() })
      .from(auditEvents)
      .where(eq(auditEvents.legalHold, true)),

    dbAdmin
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          isNotNull(notifications.readAt),
          lt(notifications.readAt, ninetyDayCutoff),
          eq(notifications.legalHold, false),
        ),
      ),
    dbAdmin
      .select({ value: count() })
      .from(notifications)
      .where(eq(notifications.legalHold, true)),

    dbAdmin
      .select({ value: count() })
      .from(dataExports)
      .where(
        and(
          eq(dataExports.exportKind, "user_data_gdpr"),
          isNotNull(dataExports.expiresAt),
          lt(dataExports.expiresAt, new Date(now)),
          eq(dataExports.legalHold, false),
        ),
      ),
    dbAdmin
      .select({ value: count() })
      .from(dataExports)
      .where(eq(dataExports.legalHold, true)),

    dbAdmin
      .select({ value: count() })
      .from(syncEvents)
      .where(
        and(
          eq(syncEvents.syncEventStatus, "succeeded"),
          lt(syncEvents.createdAt, ninetyDayCutoff),
          eq(syncEvents.legalHold, false),
        ),
      ),
    dbAdmin
      .select({ value: count() })
      .from(syncEvents)
      .where(eq(syncEvents.legalHold, true)),

    dbAdmin
      .select({ value: count() })
      .from(webhookEvents)
      .where(
        and(
          or(
            eq(webhookEvents.deliveryStatus, "processed"),
            eq(webhookEvents.deliveryStatus, "delivered"),
          ),
          lt(webhookEvents.createdAt, ninetyDayCutoff),
          eq(webhookEvents.legalHold, false),
        ),
      ),
    dbAdmin
      .select({ value: count() })
      .from(webhookEvents)
      .where(eq(webhookEvents.legalHold, true)),
  ]);

  const jobs: ActivePurgeJob[] = [
    {
      jobId: "activity-feed-purge",
      tableName: "activity_feed_items",
      tier: "operational",
      retentionDays: 90,
      eligibleNow: activityEligible[0]?.value ?? 0,
      underLegalHold: activityHeld[0]?.value ?? 0,
    },
    {
      jobId: "audit-event-purge",
      tableName: "audit_events",
      tier: "operational",
      retentionDays: 90,
      eligibleNow: auditEligible[0]?.value ?? 0,
      underLegalHold: auditHeld[0]?.value ?? 0,
    },
    {
      jobId: "notification-purge",
      tableName: "notifications",
      tier: "operational",
      retentionDays: 90,
      eligibleNow: notifEligible[0]?.value ?? 0,
      underLegalHold: notifHeld[0]?.value ?? 0,
    },
    {
      jobId: "data-export-cleanup",
      tableName: "data_exports",
      tier: "operational",
      retentionDays: 0,
      eligibleNow: exportsEligible[0]?.value ?? 0,
      underLegalHold: exportsHeld[0]?.value ?? 0,
    },
    {
      jobId: "integration-sync-event-cleanup",
      tableName: "sync_events",
      tier: "operational",
      retentionDays: 90,
      eligibleNow: syncEligible[0]?.value ?? 0,
      underLegalHold: syncHeld[0]?.value ?? 0,
    },
    {
      jobId: "webhook-payload-purge",
      tableName: "webhook_events",
      tier: "operational",
      retentionDays: 90,
      eligibleNow: webhookEligible[0]?.value ?? 0,
      underLegalHold: webhookHeld[0]?.value ?? 0,
    },
  ];

  // Recent sweep activity — last 14 days of *.run_complete events from
  // either the *-purge or *-cleanup naming patterns.
  const fourteenDaysAgo = new Date(now - FOURTEEN_DAYS_MS);
  const sweepRows = await dbAdmin
    .select({
      action: auditEvents.actionName,
      createdAt: auditEvents.createdAt,
      metadata: auditEvents.metadataJson,
    })
    .from(auditEvents)
    .where(
      and(
        or(
          like(auditEvents.actionName, "%-purge.run_complete"),
          like(auditEvents.actionName, "%-cleanup.run_complete"),
        ),
        gte(auditEvents.createdAt, fourteenDaysAgo),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(60);

  const recentSweeps: RecentSweepRow[] = sweepRows.map((row) => {
    const meta = (row.metadata ?? {}) as {
      deletedCount?: number;
      deletedRowCount?: number;
    };
    const jobId = row.action.replace(/\.run_complete$/, "");
    const deletedCount =
      typeof meta.deletedCount === "number"
        ? meta.deletedCount
        : typeof meta.deletedRowCount === "number"
          ? meta.deletedRowCount
          : null;
    return { jobId, ranAt: row.createdAt, deletedCount };
  });

  return { tiers, jobs, recentSweeps };
}
