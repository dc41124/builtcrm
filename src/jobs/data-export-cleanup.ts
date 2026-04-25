import { randomUUID } from "node:crypto";

import { logger, schedules } from "@trigger.dev/sdk/v3";
import { and, eq, isNotNull, lt } from "drizzle-orm";

import { db } from "@/db/client";
import { dataExports } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { deleteObject } from "@/lib/storage";

// Daily cleanup for the GDPR data-export bundles. After expires_at
// passes, the R2 object should not be reachable; we also delete the
// dataExports row so the user's history doesn't carry expired entries
// indefinitely.
//
// Scoped to user_data_gdpr exports only. Other export kinds
// (projects_csv, full_archive, etc.) have their own retention story
// and are not affected by this job.
//
// Scheduled at 03:15 UTC daily (just after the 03:00 retention
// purges; before the 04:00+ purges that touch larger tables).
//
// See docs/specs/user_deletion_and_export_plan.md.

export const dataExportCleanup = schedules.task({
  id: "data-export-cleanup",
  cron: "15 3 * * *",
  maxDuration: 300,
  run: async (payload) => {
    const cutoff = payload.timestamp;

    const expired = await db
      .select({
        id: dataExports.id,
        storageKey: dataExports.storageKey,
      })
      .from(dataExports)
      .where(
        and(
          eq(dataExports.exportKind, "user_data_gdpr"),
          isNotNull(dataExports.expiresAt),
          lt(dataExports.expiresAt, cutoff),
        ),
      );

    let deletedRows = 0;
    let r2Deletes = 0;

    for (const row of expired) {
      if (row.storageKey) {
        try {
          await deleteObject(row.storageKey);
          r2Deletes++;
        } catch (err) {
          logger.warn("R2 delete failed during data-export cleanup", {
            exportId: row.id,
            error: (err as Error).message,
          });
        }
      }
      await db.delete(dataExports).where(eq(dataExports.id, row.id));
      deletedRows++;
    }

    await writeSystemAuditEvent({
      resourceType: "background_job",
      resourceId: randomUUID(),
      action: "data-export-cleanup.run_complete",
      details: {
        metadata: {
          jobId: "data-export-cleanup",
          cutoff: cutoff.toISOString(),
          deletedRowCount: deletedRows,
          r2DeleteCount: r2Deletes,
        },
      },
    });

    return { deletedRows, r2Deletes };
  },
});
