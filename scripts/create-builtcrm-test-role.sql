-- Create the builtcrm_test role used by the failure-mode RLS test suite
-- (tests/rls-failure-modes.test.ts). Mirrors builtcrm_app's least-privilege
-- shape so failure-mode tests run against the same enforcement surface as
-- the production runtime role.
--
-- This is the Phase 5 close-out test-role (RLS sprint plan §5). The 103-
-- test main suite still runs as the admin/BYPASSRLS role (TEST_DATABASE_URL
-- promoted to DATABASE_ADMIN_URL in tests/global-setup.ts). The new role
-- is opened by the failure-mode suite via a separate connection string
-- (TEST_NONBYPASS_DATABASE_URL in .env.test) so the two test bodies don't
-- interfere.
--
-- Apply via:
--   npx tsx --env-file=.env.local scripts/apply-sql.ts \
--     scripts/create-builtcrm-test-role.sql
--
-- The generated password is printed via RAISE NOTICE — copy it into
-- TEST_NONBYPASS_DATABASE_URL in .env.test immediately, it's not shown
-- again. Construct the URL by taking your existing TEST_DATABASE_URL
-- and substituting username + password (host/db/sslmode unchanged).
--
-- Idempotent: safe to re-run. If the role exists the CREATE block is
-- skipped and only the GRANTs + verification re-execute.

DO $$
DECLARE
  generated_password text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builtcrm_test') THEN
    RAISE NOTICE 'builtcrm_test already exists. Skipping CREATE; will re-apply GRANTs.';
  ELSE
    generated_password := encode(gen_random_bytes(24), 'hex');
    EXECUTE format(
      'CREATE ROLE builtcrm_test LOGIN PASSWORD %L '
      'NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS',
      generated_password
    );
    RAISE NOTICE '----------------------------------------------------------';
    RAISE NOTICE 'CREATED builtcrm_test with NOBYPASSRLS. Generated password:';
    RAISE NOTICE '  %', generated_password;
    RAISE NOTICE 'Copy this into TEST_NONBYPASS_DATABASE_URL in .env.test now';
    RAISE NOTICE '— it will not be shown again.';
    RAISE NOTICE '----------------------------------------------------------';
  END IF;
END
$$;

-- Connection + schema usage. Same as builtcrm_app.
GRANT CONNECT ON DATABASE neondb TO builtcrm_test;
GRANT USAGE ON SCHEMA public TO builtcrm_test;

-- Grant on existing tables + sequences. The failure-mode suite needs
-- both read and write to assert WITH CHECK denials on cross-tenant
-- INSERT.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ALL TABLES IN SCHEMA public
  TO builtcrm_test;
GRANT USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA public
  TO builtcrm_test;

-- Default privileges for any new tables created hereafter — mirrors
-- the builtcrm_app pattern so future migrations don't need a re-grant
-- step for builtcrm_test specifically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO builtcrm_test;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO builtcrm_test;

-- Sanity verification.
DO $$
DECLARE
  bypass boolean;
  table_grants integer;
BEGIN
  SELECT rolbypassrls INTO bypass FROM pg_roles WHERE rolname = 'builtcrm_test';
  IF bypass IS NULL THEN
    RAISE EXCEPTION 'builtcrm_test missing — CREATE ROLE block did not run';
  END IF;
  IF bypass THEN
    RAISE EXCEPTION 'builtcrm_test rolbypassrls=true after recreate — investigate';
  END IF;

  SELECT COUNT(*) INTO table_grants
  FROM information_schema.role_table_grants
  WHERE grantee = 'builtcrm_test' AND table_schema = 'public';
  IF table_grants = 0 THEN
    RAISE EXCEPTION 'No table grants on public for builtcrm_test — GRANT block failed';
  END IF;

  RAISE NOTICE 'OK: builtcrm_test rolbypassrls=false, % public-schema table-level grants in place.', table_grants;
END $$;
