-- Migration: project geocoded coordinates
-- Date: 2026-04-18
-- Context: enables weather autofill on daily logs (Open-Meteo needs
-- lat/lon). Populated lazily: the weather-prefill endpoint geocodes the
-- project's street address via Nominatim on first use and writes back.
-- Also useful later for map / nearest-crew features.

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "latitude" numeric(9, 6);

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "longitude" numeric(9, 6);

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "geocoded_at" timestamp with time zone;
