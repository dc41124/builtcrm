import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// -----------------------------------------------------------------------------
// R2 orphan queue — system-level housekeeping table.
//
// Populated by AFTER DELETE / AFTER UPDATE triggers on every table that holds
// an R2 storage key (documents, prequal_documents, data_exports, users,
// organizations, drawing_sets, drawing_sheets — see migration 0044). When a
// storage key vanishes (row deleted, or column UPDATEd to a different value),
// the trigger enqueues the OLD key here. The daily `r2-orphan-purge` job picks
// up `pending` rows in batches, calls R2 DeleteObjectCommand, and marks
// `deleted` on success or `failed_permanent` after MAX_ATTEMPTS retries.
//
// NOT RLS'd — this is a cross-org system table written exclusively by triggers
// and read exclusively by the purge job (which uses dbAdmin). Plays the same
// role as auditEvents in §6 "Tables intentionally NOT RLS'd".
//
// See docs/specs/security_posture.md §6 "R2 orphan cleanup" for the design
// rationale and the deferred path-5 (failed-upload) follow-up.
// -----------------------------------------------------------------------------

export const r2OrphanQueue = pgTable(
  "r2_orphan_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // The R2 object key to delete. Unique because the same key cannot
    // legitimately be referenced by two different rows (documents enforces
    // unique on storage_key; the other tables write fresh keys per upload).
    // ON CONFLICT DO NOTHING in the trigger handles the rare race.
    storageKey: text("storage_key").notNull().unique(),
    // "documents.storage_key" / "users.avatar_url" / etc. — diagnostic only.
    sourceTable: varchar("source_table", { length: 80 }).notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").default(0).notNull(),
    // 'pending' | 'deleted' | 'failed_permanent'.
    // 'deleted' rows are kept briefly (~7d) for observability before purge.
    status: varchar("status", { length: 24 }).default("pending").notNull(),
    lastError: text("last_error"),
  },
  (table) => ({
    statusIdx: index("r2_orphan_queue_status_idx").on(table.status),
    queuedAtIdx: index("r2_orphan_queue_queued_at_idx").on(table.queuedAt),
    statusCheck: check(
      "r2_orphan_queue_status_check",
      sql`${table.status} in ('pending','deleted','failed_permanent')`,
    ),
  }),
);
