import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";

import { writeSystemAuditEvent } from "@/domain/audit";

// Step 66 — Nightly RBQ Open Data cache refresh.
//
// Today this is a no-op stub. The real implementation downloads the
// CSV diff from donneesquebec.ca, parses each record, and upserts
// rows into `rbq_license_cache`. See the production-hookup checklist
// at the top of `src/lib/integrations/rbq.ts`.
//
// Scheduled at 03:00 EST (08:00 UTC) per the prototype's "nightly job
// runs at 03:00 EST" copy. Intentionally outside the 03:15–04:45 UTC
// retention-purge window to avoid pool overlap.

export const rbqCacheRefresh = schedules.task({
  id: "rbq-cache-refresh",
  cron: "0 8 * * *",
  maxDuration: 600,
  run: async (payload) => {
    const startedAt = payload.timestamp;

    // PRODUCTION HOOKUP — replace this no-op block with:
    //   const diff = await downloadRbqOpenDataDiff();
    //   for await (const record of diff) {
    //     await dbAdmin.insert(rbqLicenseCache).values({...}).onConflictDoUpdate({...});
    //   }
    // Track via docs/specs/prod_cutover_prep.md.
    const upserted = 0;
    const skipped = 0;
    const sourceVersion = `RBQ Open Data ${startedAt.toISOString().slice(0, 10)} (stub)`;

    logger.info("rbq_license_cache refresh complete (stub)", {
      sourceVersion,
      upserted,
      skipped,
    });

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "rbq-cache-refresh.run_complete",
      details: {
        metadata: {
          jobId: "rbq-cache-refresh",
          sourceVersion,
          upserted,
          skipped,
          stub: true,
        },
      },
    });

    return { upserted, skipped, sourceVersion };
  },
});
