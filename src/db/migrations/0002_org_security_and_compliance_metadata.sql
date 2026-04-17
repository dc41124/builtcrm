-- Migration: org-security settings + compliance detail metadata
-- Date: 2026-04-17
-- Context: commit 5 of the settings wire-up. Adds:
--   - organizations.allowed_email_domains (domain lock)
--   - organizations.session_timeout_minutes (preference; enforcement TBD)
--   - compliance_records.metadata_json (carrier/coverage detail strings)
-- All columns are nullable; safe to re-run via IF NOT EXISTS.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "allowed_email_domains"    text[],
  ADD COLUMN IF NOT EXISTS "session_timeout_minutes"  integer;

ALTER TABLE "compliance_records"
  ADD COLUMN IF NOT EXISTS "metadata_json"  jsonb;

COMMENT ON COLUMN "organizations"."allowed_email_domains" IS
  'If non-null/non-empty, the invitation-create route rejects emails whose domain is not in this list. Existing members are unaffected.';

COMMENT ON COLUMN "organizations"."session_timeout_minutes" IS
  'Org preference for session TTL. Storage-only today; Better Auth global TTL still applies until a per-org session lifecycle hook is added.';

COMMENT ON COLUMN "compliance_records"."metadata_json" IS
  'Presentation-layer detail for the sub settings compliance snapshot (carrier, coverage amount, policy detail). Schema-free — extend without a migration.';
