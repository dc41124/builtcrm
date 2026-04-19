-- Migration: external reviewer invitations for submittals (Step 20.5)
-- Date: 2026-04-18
-- Context: Step 20 shipped with the `external_reviewer` portal_type enum
-- value as schema prep. This migration adds the last piece: generic
-- scope fields on the invitations table so a token can carry "this
-- invitation is for submittal X" rather than just a project. Reusing
-- the invitations table (vs. a new `submittal_invitations` table)
-- keeps invitation logic unified — the same shape will accept future
-- change-order / daily-log / RFI reviewer invites without bifurcating.
--
-- `scope_object_type` is free-form text (e.g. 'submittal') rather than
-- an enum so new object types don't need a schema migration to begin
-- using the scoped-invite flow. Enforcement happens at the API layer.
--
-- No data backfill needed. Existing invitations rows are project- or
-- org-scoped and these columns remain NULL for them — the "no scope
-- object" state means the existing accept flow applies verbatim.

ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "scope_object_type" varchar(64);

ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "scope_object_id" uuid;

CREATE INDEX IF NOT EXISTS "invitations_scope_idx"
  ON "invitations" ("scope_object_type", "scope_object_id");
