// Step 66.5 — R2 object-key registry for the retention sweep.
//
// The sweep job's R2 cleanup phase reads from this list to know which
// columns hold object keys that need to be deleted from the bucket after
// a row is hard-deleted. Adding a new R2-backed table? Add it here.
//
// `prefix` is informational — the actual delete is keyed by the column
// value alone. Prefixes are surfaced in the admin UI so an operator can
// audit "what storage is in the sweep's blast radius."
//
// Columns NOT in this registry:
//   - Indirect references (documentId FK to documents.storageKey) are
//     handled transitively: deleting the parent `documents` row is what
//     drives R2 cleanup; child rows like daily_log_photos.documentId
//     don't need entries here.
//   - Reference-tier columns (organizations.logoStorageKey, users.avatarUrl)
//     are excluded — `users` uses tombstone-update, not deletion, and
//     organizations cascade with explicit org-deletion flow.

import {
  documents,
  dataExports,
  prequalDocuments,
  drawingSets,
  drawingSheets,
} from "@/db/schema";
import type { PgTable } from "drizzle-orm/pg-core";

export interface R2RegistryEntry {
  // Drizzle table reference, used by the sweep job to issue the actual delete.
  table: PgTable;
  // Human-readable name for the admin UI.
  tableName: string;
  // The column on `table` that holds the R2 object key.
  columnName: string;
  // R2 key prefix — informational, surfaced in the admin UI.
  prefix: string;
}

export const R2_REGISTRY: R2RegistryEntry[] = [
  {
    table: documents,
    tableName: "documents",
    columnName: "storage_key",
    prefix: "(varies by document category)",
  },
  {
    table: dataExports,
    tableName: "data_exports",
    columnName: "storage_key",
    prefix: "exports/",
  },
  {
    table: prequalDocuments,
    tableName: "prequal_documents",
    columnName: "storage_key",
    prefix: "prequal/",
  },
  {
    table: drawingSets,
    tableName: "drawing_sets",
    columnName: "source_file_key",
    prefix: "drawings/",
  },
  {
    table: drawingSheets,
    tableName: "drawing_sheets",
    columnName: "thumbnail_key",
    prefix: "drawings/thumbs/",
  },
];

// Orphan sweep targets the `tmp/` prefix — objects without any DB
// reference older than 7 days are deleted regardless of source.
export const R2_ORPHAN_PREFIX = "tmp/";
export const R2_ORPHAN_AGE_DAYS = 7;
