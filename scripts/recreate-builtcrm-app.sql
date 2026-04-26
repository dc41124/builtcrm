-- Re-create builtcrm_app with the declared least-privilege attributes
-- (NOBYPASSRLS) AFTER dropping it via the Neon Console / API.
--
-- Why this script exists separately from new-env-bootstrap.sql:
--   - The original bootstrap creates the role only on first-run; it
--     skips the CREATE if the role already exists. That makes it
--     unsafe to re-run for the "fix the attributes drift" use case.
--   - The bootstrap also doesn't re-grant on EXISTING tables — it
--     only sets default privileges for FUTURE tables. After a drop +
--     recreate the existing 396 public-schema tables need explicit
--     GRANTs so the new role can read/write them.
--
-- Prerequisite:
--   You must have already deleted the role via the Neon Console or API.
--   neondb_owner cannot DROP it via SQL — Postgres 16's CREATEROLE
--   rule requires admin_option on the target, which Neon doesn't
--   grant peer-to-peer between roles in `neon_superuser` membership.
--
-- Apply via:
--   npx tsx --env-file=.env.local scripts/apply-sql.ts \
--     scripts/recreate-builtcrm-app.sql
--
-- The generated password is printed via RAISE NOTICE — copy it into
-- DATABASE_URL in .env.local immediately, it's not shown again.
--
-- After this runs, verify:
--   1. Re-run a perf script (e.g. scripts/rls-perf-rfis.ts). The
--      "GUC = unrelated org" case should now return rows=0 (RLS
--      enforced) instead of the same rowcount as the contractor case.
--   2. Run `npm test` — the test suite should be unaffected because
--      tests promote TEST_DATABASE_URL → DATABASE_ADMIN_URL (admin pool).

DO $$
DECLARE
  generated_password text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builtcrm_app') THEN
    RAISE EXCEPTION 'builtcrm_app already exists. Drop it first via the Neon Console / API, then re-run this script.';
  END IF;

  generated_password := encode(gen_random_bytes(24), 'hex');
  EXECUTE format(
    'CREATE ROLE builtcrm_app LOGIN PASSWORD %L '
    'NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS',
    generated_password
  );
  RAISE NOTICE '----------------------------------------------------------';
  RAISE NOTICE 'CREATED builtcrm_app with NOBYPASSRLS. Generated password:';
  RAISE NOTICE '  %', generated_password;
  RAISE NOTICE 'Copy this into DATABASE_URL now — it will not be shown again.';
  RAISE NOTICE '----------------------------------------------------------';
END
$$;

-- Connection + schema usage.
GRANT CONNECT ON DATABASE neondb TO builtcrm_app;
GRANT USAGE ON SCHEMA public TO builtcrm_app;

-- Re-grant on EXISTING tables + sequences (the 396 already-migrated
-- tables in public). ALTER DEFAULT PRIVILEGES below covers FUTURE
-- tables; this block covers what already exists.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO builtcrm_app;
GRANT USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA public
  TO builtcrm_app;

-- Default privileges for any tables/sequences created by the admin
-- role hereafter — mirrors new-env-bootstrap.sql.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO builtcrm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO builtcrm_app;

-- Sanity verification: confirm the role's attributes are what we
-- expect. Fails loudly if anything drifted (e.g. cluster setting
-- forced BYPASSRLS back on, or grants didn't apply).
DO $$
DECLARE
  bypass boolean;
  table_grants integer;
BEGIN
  SELECT rolbypassrls INTO bypass FROM pg_roles WHERE rolname = 'builtcrm_app';
  IF bypass IS NULL THEN
    RAISE EXCEPTION 'builtcrm_app missing — CREATE ROLE block did not run';
  END IF;
  IF bypass THEN
    RAISE EXCEPTION 'builtcrm_app rolbypassrls=true after recreate — investigate';
  END IF;

  SELECT COUNT(*) INTO table_grants
  FROM information_schema.role_table_grants
  WHERE grantee = 'builtcrm_app' AND table_schema = 'public';
  IF table_grants = 0 THEN
    RAISE EXCEPTION 'No table grants on public for builtcrm_app — GRANT block failed';
  END IF;

  RAISE NOTICE 'OK: builtcrm_app rolbypassrls=false, % public-schema table-level grants in place.', table_grants;
END $$;
