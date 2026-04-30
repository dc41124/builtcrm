CREATE TABLE "r2_orphan_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"source_table" varchar(80) NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempted_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"last_error" text,
	CONSTRAINT "r2_orphan_queue_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "r2_orphan_queue_status_check" CHECK ("r2_orphan_queue"."status" in ('pending','deleted','failed_permanent'))
);
--> statement-breakpoint
CREATE INDEX "r2_orphan_queue_status_idx" ON "r2_orphan_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "r2_orphan_queue_queued_at_idx" ON "r2_orphan_queue" USING btree ("queued_at");--> statement-breakpoint

-- R2 orphan queue: trigger function + per-table triggers.
-- See src/db/schema/r2OrphanQueue.ts for the design rationale.
-- The function reads the column-name argument from TG_ARGV[0] and uses
-- row_to_json(OLD/NEW)->>col to access the storage-key column generically,
-- so one function serves all 7 tables.

CREATE OR REPLACE FUNCTION enqueue_r2_orphan_generic() RETURNS trigger AS $$
DECLARE
  col_name text := TG_ARGV[0];
  old_key text;
  new_key text;
BEGIN
  old_key := row_to_json(OLD)->>col_name;
  IF TG_OP = 'UPDATE' THEN
    new_key := row_to_json(NEW)->>col_name;
  END IF;

  -- Enqueue when:
  --   DELETE removes a row that had a key, OR
  --   UPDATE changes the key from non-null to a different value.
  IF (TG_OP = 'DELETE' AND old_key IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND old_key IS NOT NULL AND old_key IS DISTINCT FROM new_key) THEN
    INSERT INTO r2_orphan_queue (storage_key, source_table)
    VALUES (old_key, TG_TABLE_NAME || '.' || col_name)
    ON CONFLICT (storage_key) DO NOTHING;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER documents_r2_orphan_trg
AFTER DELETE OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION enqueue_r2_orphan_generic('storage_key');
--> statement-breakpoint

CREATE TRIGGER prequal_documents_r2_orphan_trg
AFTER DELETE OR UPDATE ON prequal_documents
FOR EACH ROW EXECUTE FUNCTION enqueue_r2_orphan_generic('storage_key');
--> statement-breakpoint

CREATE TRIGGER data_exports_r2_orphan_trg
AFTER DELETE OR UPDATE ON data_exports
FOR EACH ROW EXECUTE FUNCTION enqueue_r2_orphan_generic('storage_key');
--> statement-breakpoint

CREATE TRIGGER users_r2_orphan_trg
AFTER DELETE OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION enqueue_r2_orphan_generic('avatar_url');
--> statement-breakpoint

CREATE TRIGGER organizations_r2_orphan_trg
AFTER DELETE OR UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION enqueue_r2_orphan_generic('logo_storage_key');
--> statement-breakpoint

CREATE TRIGGER drawing_sets_r2_orphan_trg
AFTER DELETE OR UPDATE ON drawing_sets
FOR EACH ROW EXECUTE FUNCTION enqueue_r2_orphan_generic('source_file_key');
--> statement-breakpoint

CREATE TRIGGER drawing_sheets_r2_orphan_trg
AFTER DELETE OR UPDATE ON drawing_sheets
FOR EACH ROW EXECUTE FUNCTION enqueue_r2_orphan_generic('thumbnail_key');