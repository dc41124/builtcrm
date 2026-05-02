import { randomUUID } from "node:crypto";

import { schedules } from "@trigger.dev/sdk/v3";
import { and, eq, isNotNull, lt } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { dataExports } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";

// Daily cleanup for the GDPR data-export bundles. After expires_at
// passes, we delete the dataExports row; the AFTER DELETE trigger on
// data_exports.storage_key enqueues the R2 object into r2_orphan_queue,
// and the r2-orphan-purge job (04:45 UTC) picks it up. Single source of
// truth for R2 cleanup — see docs/specs/security_posture.md §6
// "R2 orphan cleanup".
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

    // Cross-org sweep — use the admin pool so RLS doesn't silently
    // hide rows for orgs other than the (nonexistent) current GUC.
    // legal_hold = true overrides scheduled deletion (Step 66.5).
    const expired = await dbAdmin
      .select({ id: dataExports.id })
      .from(dataExports)
      .where(
        and(
          eq(dataExports.exportKind, "user_data_gdpr"),
          isNotNull(dataExports.expiresAt),
          lt(dataExports.expiresAt, cutoff),
          eq(dataExports.legalHold, false),
        ),
      );

    let deletedRows = 0;

    for (const row of expired) {
      // R2 cleanup happens via the AFTER DELETE trigger on data_exports
      // → r2_orphan_queue → r2-orphan-purge job. No explicit deleteObject
      // call here.
      await dbAdmin.delete(dataExports).where(eq(dataExports.id, row.id));
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
        },
      },
    });

    return { deletedRows };
  },
});
