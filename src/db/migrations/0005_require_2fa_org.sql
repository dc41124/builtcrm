-- Migration: Require-2FA org-wide preference (Session 4 of Billing phase)
-- Date: 2026-04-17
-- Context: Professional+ feature. Stores the org-admin's preference that all
-- members be 2FA-enrolled. Enforcement (block sign-in when not enrolled)
-- lives in a Better Auth hook that hasn't been wired yet — grouped with the
-- SSO phase since both touch src/auth/config.ts. The plan gate for writing
-- this column lives in src/domain/policies/plan.ts (requireFeature with
-- "require_2fa_org" key).
--
-- Idempotent via IF NOT EXISTS so reruns are safe.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "require_2fa_org" boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN "organizations"."require_2fa_org" IS
  'Org-admin preference: all members must have 2FA enrolled to sign in. Gated to Professional+ plans via src/domain/policies/plan.ts. Enforcement hook is deferred — preference persists but is not yet checked at login.';
