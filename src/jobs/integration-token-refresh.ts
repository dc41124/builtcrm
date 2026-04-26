import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, eq, isNotNull, lt } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { integrationConnections } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { refreshToken } from "@/lib/integrations/oauth";

// Every 30 minutes, find connections with tokens expiring in under 5 minutes
// and refresh them. Xero access tokens last 30 minutes so this cadence hits
// the refresh window on the second-ever run for a given connection; if we
// see expired tokens in production, tighten the cron to */15 or */10.
//
// Failures flip the connection to `needs_reauth` inside `refreshToken`.
// Per-refresh audit events (success + failure) are a known gap in
// src/lib/integrations/oauth.ts — backlog; this job writes a batch-level
// audit at run completion for compliance evidence.
//
// The job only touches `oauth2_code` flow connections. Stripe Connect is
// self-refreshing via the Stripe SDK and is skipped by refreshToken() itself.

export const integrationTokenRefresh = schedules.task({
  id: "integration-token-refresh",
  cron: "*/30 * * * *",
  maxDuration: 300,
  run: async (payload) => {
    const nowPlus5 = new Date(payload.timestamp.getTime() + 5 * 60 * 1000);

    // Cross-org sweep — admin pool to see every org's expiring tokens.
    const due = await dbAdmin
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.connectionStatus, "connected"),
          isNotNull(integrationConnections.refreshTokenEnc),
          isNotNull(integrationConnections.tokenExpiresAt),
          lt(integrationConnections.tokenExpiresAt, nowPlus5),
        ),
      );

    logger.info("integration tokens due for refresh", { count: due.length });

    if (due.length === 0) {
      return { checked: 0, refreshed: 0, failed: 0 };
    }

    let refreshed = 0;
    let failed = 0;

    for (const { id } of due) {
      try {
        const result = await refreshToken(id);
        if (result.ok) {
          refreshed += 1;
        } else {
          failed += 1;
          logger.warn("token refresh failed", { connectionId: id, error: result.error });
        }
      } catch (err) {
        // An unexpected throw (network, DB) — don't stop the batch; keep going.
        failed += 1;
        logger.error("token refresh threw", {
          connectionId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("token refresh batch done", {
      checked: due.length,
      refreshed,
      failed,
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "integration-token-refresh.run_complete",
      details: {
        metadata: {
          jobId: "integration-token-refresh",
          checked: due.length,
          refreshed,
          failed,
        },
      },
    });

    return { checked: due.length, refreshed, failed };
  },
});
