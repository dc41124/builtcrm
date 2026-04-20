-- Migration: FK naming normalization to drizzle-kit's convention
-- Date: 2026-04-19
-- Context: Migrations 0001–0018 declared FKs anonymously inside CREATE
-- TABLE blocks (or with the team's own short `_fk` suffix), so Postgres
-- named them like `daily_logs_project_id_fk`. drizzle-kit's introspection
-- looks for the longer `{srcTable}_{srcCol}_{refTable}_{refCol}_fk`
-- pattern (e.g. `daily_logs_project_id_projects_id_fk`). When the names
-- don't match, drizzle thinks the FK is missing and `db:push` proposes
-- to add it — which would create a duplicate redundant constraint.
--
-- This migration walks every FK in the public schema and renames it to
-- drizzle's convention. Idempotent: re-runs find nothing to rename.
-- Pure RENAME CONSTRAINT, so FK enforcement is uninterrupted.
--
-- Composite FKs (multi-column) are skipped — none exist in the schema
-- today.
--
-- NAMEDATALEN edge case (PG default = 64 → 63 usable chars):
--   When the expected drizzle name exceeds 63 chars, Postgres silently
--   truncates on DDL parse. drizzle-kit's introspection hits the same
--   truncation, so an FK whose current name is already the 63-char
--   truncated form of the expected name is in fact aligned — we detect
--   that explicitly and skip rather than re-rename (which would no-op
--   or collide).
--
-- Per-row EXCEPTION: any unexpected duplicate-name collision is logged
-- and the loop continues, so one bad row doesn't abort the entire batch.
--
-- After this runs, future migrations should declare FKs with the
-- drizzle convention from the start.

DO $$
DECLARE
  rec RECORD;
  src_table TEXT;
  ref_table TEXT;
  expected_name TEXT;
  effective_name TEXT;  -- expected_name truncated to PG's NAMEDATALEN-1
  renamed_count INTEGER := 0;
  skipped_aligned INTEGER := 0;
  skipped_collision INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT
      c.conname,
      c.conrelid::regclass::text                  AS src_table_full,
      a_src.attname                               AS src_col,
      c.confrelid::regclass::text                 AS ref_table_full,
      a_ref.attname                               AS ref_col
    FROM pg_constraint c
    JOIN pg_attribute a_src
      ON a_src.attrelid = c.conrelid
     AND a_src.attnum  = ANY(c.conkey)
    JOIN pg_attribute a_ref
      ON a_ref.attrelid = c.confrelid
     AND a_ref.attnum  = ANY(c.confkey)
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
      AND array_length(c.conkey, 1) = 1
      AND array_length(c.confkey, 1) = 1
  LOOP
    -- Strip schema qualifier and quoting from regclass output.
    src_table := regexp_replace(rec.src_table_full, '^(public\.)?"?', '');
    src_table := regexp_replace(src_table, '"$', '');
    ref_table := regexp_replace(rec.ref_table_full, '^(public\.)?"?', '');
    ref_table := regexp_replace(ref_table, '"$', '');

    expected_name := src_table || '_' || rec.src_col || '_'
                     || ref_table || '_' || rec.ref_col || '_fk';
    -- PG truncates identifiers at NAMEDATALEN-1 = 63 bytes on parse.
    effective_name := substring(expected_name FROM 1 FOR 63);

    -- Already aligned (or already at the truncated form drizzle would
    -- introspect to) — nothing to do.
    IF rec.conname = effective_name THEN
      skipped_aligned := skipped_aligned + 1;
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format(
        'ALTER TABLE %I RENAME CONSTRAINT %I TO %I',
        src_table, rec.conname, effective_name
      );
      RAISE NOTICE 'Renamed %.% : % -> %',
        src_table, rec.src_col, rec.conname, effective_name;
      renamed_count := renamed_count + 1;
    EXCEPTION WHEN duplicate_object THEN
      RAISE NOTICE 'SKIPPED (collision on target name) %.% : % -> %',
        src_table, rec.src_col, rec.conname, effective_name;
      skipped_collision := skipped_collision + 1;
    END;
  END LOOP;

  RAISE NOTICE
    'FK rename complete: % renamed, % already aligned, % skipped (collision).',
    renamed_count, skipped_aligned, skipped_collision;
END $$;
