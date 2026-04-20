-- Migration: Drop stale `purchase_order_status` enum
-- Date: 2026-04-19
-- Context: `src/db/schema/billing.ts` historically declared a
-- `purchaseOrderStatusEnum` pgEnum with pg type name
-- `purchase_order_status` that was never referenced by any table or
-- loader. An earlier `db:push` emitted the CREATE TYPE DDL, so the
-- type exists in the database even though no migration file ever
-- created it explicitly.
--
-- Step 41 (procurement) declared its own PO status enum under the
-- distinct pg type name `procurement_po_status` to avoid colliding
-- with the dead export. With that export now removed from
-- billing.ts, `purchase_order_status` is fully orphaned.
--
-- This migration drops it so `db:push` + fresh-seed environments
-- stay aligned with the source schema. Safe: `IF EXISTS` handles the
-- case where the type was never emitted in the first place (fresh
-- DBs provisioned from migrations only, not from push).

DROP TYPE IF EXISTS "public"."purchase_order_status";
