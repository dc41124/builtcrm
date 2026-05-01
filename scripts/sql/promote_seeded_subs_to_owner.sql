-- Promote the two seeded subcontractor users (Marcus Chen, Siobhan Murphy)
-- from roleKey "lead" to "owner" so the time-tracking admin gate
-- (/owner|admin/i) lets them through. One-off — re-running the dev seed
-- after this is a no-op for these rows.
UPDATE role_assignments
SET role_key = 'owner'
WHERE portal_type = 'subcontractor'
  AND role_key = 'lead';
