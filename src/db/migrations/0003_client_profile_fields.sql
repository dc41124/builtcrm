-- Migration: client-portal profile fields (commit 8)
-- Date: 2026-04-17
-- Context: unblocks the CommercialCompanyTab (industry, company_size,
-- invoice_delivery) and ResidentialHouseholdTab (project_name, preferred
-- name/channel/time, emergency contact). All columns are nullable.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "industry"            varchar(120),
  ADD COLUMN IF NOT EXISTS "company_size"        varchar(40),
  ADD COLUMN IF NOT EXISTS "invoice_delivery"    varchar(40),
  ADD COLUMN IF NOT EXISTS "project_name"        varchar(255),
  ADD COLUMN IF NOT EXISTS "preferred_name"      varchar(120),
  ADD COLUMN IF NOT EXISTS "preferred_channel"   varchar(40),
  ADD COLUMN IF NOT EXISTS "preferred_time"      varchar(40),
  ADD COLUMN IF NOT EXISTS "emergency_name"      varchar(200),
  ADD COLUMN IF NOT EXISTS "emergency_relation"  varchar(80),
  ADD COLUMN IF NOT EXISTS "emergency_phone"     varchar(40);

COMMENT ON COLUMN "organizations"."project_name" IS
  'Residential household display label (e.g. "Chen Residence"). Distinct from `name` which holds the legal/display name of the client org entity.';
