-- Migration: add Organization-settings fields + licenses/certifications tables
-- Date: 2026-04-17
-- Context: unblocks the contractor + subcontractor Organization settings tabs.
-- All new columns on organizations are nullable so existing rows are unaffected.
-- Run manually (e.g. `npm run db:migrate` once the drizzle journal is rebuilt,
-- or paste into the Neon console / psql directly).

-- ─────────────────────────────────────────────────────────────────────
-- 1. Extend organizations with settings-page columns
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "legal_name"              varchar(255),
  ADD COLUMN IF NOT EXISTS "tax_id"                  varchar(40),
  ADD COLUMN IF NOT EXISTS "website"                 varchar(500),
  ADD COLUMN IF NOT EXISTS "phone"                   varchar(40),
  ADD COLUMN IF NOT EXISTS "addr1"                   varchar(255),
  ADD COLUMN IF NOT EXISTS "addr2"                   varchar(120),
  ADD COLUMN IF NOT EXISTS "city"                    varchar(120),
  ADD COLUMN IF NOT EXISTS "state_region"            varchar(80),
  ADD COLUMN IF NOT EXISTS "postal_code"             varchar(20),
  ADD COLUMN IF NOT EXISTS "country"                 varchar(80),
  ADD COLUMN IF NOT EXISTS "primary_contact_name"    varchar(200),
  ADD COLUMN IF NOT EXISTS "primary_contact_title"   varchar(200),
  ADD COLUMN IF NOT EXISTS "primary_contact_email"   varchar(320),
  ADD COLUMN IF NOT EXISTS "primary_contact_phone"   varchar(40),
  ADD COLUMN IF NOT EXISTS "billing_contact_name"    varchar(200),
  ADD COLUMN IF NOT EXISTS "billing_email"           varchar(320),
  ADD COLUMN IF NOT EXISTS "logo_storage_key"        text,
  ADD COLUMN IF NOT EXISTS "primary_trade"           varchar(120),
  ADD COLUMN IF NOT EXISTS "secondary_trades"        text[],
  ADD COLUMN IF NOT EXISTS "years_in_business"       varchar(10),
  ADD COLUMN IF NOT EXISTS "crew_size"               varchar(10),
  ADD COLUMN IF NOT EXISTS "regions"                 text[];

COMMENT ON COLUMN "organizations"."tax_id" IS
  'Plaintext EIN. Protected via disk-level encryption (Neon) + org-admin access policy + audit redaction. See phase_4plus_build_guide.md for the encrypt-at-rest migration path if this ever needs hardening.';

-- ─────────────────────────────────────────────────────────────────────
-- 2. organization_licenses — trade licenses + state endorsements
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "organization_licenses" (
  "id"              uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid         NOT NULL,
  "kind"            varchar(200) NOT NULL,
  "license_number"  varchar(120) NOT NULL,
  "state_region"    varchar(80),
  "expires_on"      date,
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"      timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_licenses_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "organization_licenses_org_idx"
  ON "organization_licenses" ("organization_id");

-- ─────────────────────────────────────────────────────────────────────
-- 3. organization_certifications — self-managed credentials (sub-only today)
-- ─────────────────────────────────────────────────────────────────────
-- Note: issued_on and expires_on are varchar, not date, because real-world
-- cert metadata includes values like "Various", "Multiple", or "Annual
-- renewal" that don't fit a date column cleanly.

CREATE TABLE IF NOT EXISTS "organization_certifications" (
  "id"              uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid         NOT NULL,
  "kind"            varchar(200) NOT NULL,
  "holder"          varchar(200),
  "issued_on"       varchar(60),
  "expires_on"      varchar(60),
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"      timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_certifications_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "organization_certifications_org_idx"
  ON "organization_certifications" ("organization_id");
