-- Migration: extend document_category enum (Step 21)
-- Date: 2026-04-18
-- Context: Step 20 shipped `document_category` with only ('submittal', 'other')
-- so submittal-package docs could be tagged. Step 21 extends the enum to the
-- full taxonomy.
--
-- IMPORTANT — Postgres enum constraint:
--   A freshly-added enum value cannot be used in the same transaction as the
--   ALTER TYPE that added it. Drizzle wraps each migration file in a single
--   transaction, so the data backfill lives in 0015_document_categories_backfill.sql
--   (runs as the next migration, therefore a separate transaction).
--
--   IF NOT EXISTS guards make this safely re-runnable on any environment.

ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'drawings';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'specifications';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'contracts';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'photos';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'permits';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'compliance';
ALTER TYPE "document_category" ADD VALUE IF NOT EXISTS 'billing_backup';
