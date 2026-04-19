-- Migration: backfill document.category for existing rows (Step 21)
-- Date: 2026-04-18
-- Context: Second-half of Step 21. The enum values were added in 0014; they
-- can now be used in UPDATE statements because this migration runs in a
-- fresh transaction.
--
-- Backfill intent — documented here so the audit trail shows why rows moved
-- off the `other` default:
--   drawing                              -> drawings
--   specification                        -> specifications
--   contract                             -> contracts
--   submittal, submittal_reviewer,
--     "submittals" (UI-typed plural)     -> submittal
--   photo_log, daily_log_photo,
--     punch_item_photo                   -> photos
--   permit, "permits" (UI-typed plural)  -> permits
--   compliance, insurance                -> compliance
--   lien_waiver                          -> billing_backup
--   owner_upload, message_attachment,
--     upload_request, general,
--     meeting_minutes, safety, closeout  -> other  (stays, explicit)
--
-- The guide's default was "everything to `other`" — we go further because
-- most documentType values have an obvious mapping and an empty Photos
-- bucket on day one is bad UX. Drawings and specifications seed rows get
-- re-categorized correctly. The ~3 seed rows typed as `specification` that
-- actually describe permits / compliance letters land under `specifications`
-- and are re-categorized manually via the UI as users encounter them.
--
-- WHERE "category" = 'other' scopes the update to untouched rows — if any
-- row was previously tagged (e.g. the Step 20 submittal tagging), this
-- won't overwrite it.

UPDATE "documents"
SET "category" = CASE lower("document_type")
    WHEN 'drawing'            THEN 'drawings'
    WHEN 'drawings'           THEN 'drawings'
    WHEN 'specification'      THEN 'specifications'
    WHEN 'specifications'     THEN 'specifications'
    WHEN 'contract'           THEN 'contracts'
    WHEN 'contracts'          THEN 'contracts'
    WHEN 'submittal'          THEN 'submittal'
    WHEN 'submittals'         THEN 'submittal'
    WHEN 'submittal_reviewer' THEN 'submittal'
    WHEN 'photo_log'          THEN 'photos'
    WHEN 'photos'             THEN 'photos'
    WHEN 'daily_log_photo'    THEN 'photos'
    WHEN 'punch_item_photo'   THEN 'photos'
    WHEN 'permit'             THEN 'permits'
    WHEN 'permits'            THEN 'permits'
    WHEN 'insurance'          THEN 'compliance'
    WHEN 'compliance'         THEN 'compliance'
    WHEN 'lien_waiver'        THEN 'billing_backup'
    WHEN 'billing_backup'     THEN 'billing_backup'
    ELSE 'other'
  END::document_category
WHERE "category" = 'other';
