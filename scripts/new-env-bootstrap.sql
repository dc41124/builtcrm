-- Fresh-env bootstrap. Run as the admin role (DATABASE_ADMIN_URL, e.g.
-- neondb_owner on Neon) BEFORE `npm run db:migrate` applies the baseline.
--
-- This script is self-sufficient: it creates the runtime role
-- `builtcrm_app` (idempotent) with explicit least-privilege attributes,
-- generates a random password, and configures the schema/grants the app
-- needs. Re-runs are safe.
--
-- IMPORTANT: do NOT create `builtcrm_app` via the Neon "Create role" UI.
-- The 2026-04-25 validation pass discovered that Neon's UI grants new
-- roles `neon_superuser` membership plus CREATEROLE/CREATEDB/REPLICATION/
-- BYPASSRLS — defeating the role split. Worse, neither `neondb_owner`
-- nor any SQL-accessible role can downgrade these privileges after the
-- fact (Neon's platform admin holds the ADMIN OPTION). The only way to
-- get a genuinely DML-only runtime role is to create it via SQL, as
-- this script does.
--
-- See docs/specs/security_posture.md §5 and docs/specs/bootstrap_new_env.md
-- for the full walkthrough.

-- pgcrypto is used by app code, by gen_random_bytes() below, and by
-- migrations for SHA-256 hashing of identifiers. Safe to enable
-- unconditionally.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create builtcrm_app with a generated password and explicit
-- least-privilege attributes. The generated password is printed via
-- RAISE NOTICE so the operator can copy it into DATABASE_URL. On
-- re-runs (role already exists), the password is NOT regenerated —
-- rotation is a separate, deliberate action (see security_posture.md §3).
DO $$
DECLARE
  generated_password text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'builtcrm_app') THEN
    generated_password := encode(gen_random_bytes(24), 'hex');
    EXECUTE format(
      'CREATE ROLE builtcrm_app LOGIN PASSWORD %L '
      'NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS',
      generated_password
    );
    RAISE NOTICE '----------------------------------------------------------';
    RAISE NOTICE 'CREATED builtcrm_app with generated password:';
    RAISE NOTICE '  %', generated_password;
    RAISE NOTICE 'Copy this into DATABASE_URL now — it will not be shown again.';
    RAISE NOTICE '----------------------------------------------------------';
  ELSE
    RAISE NOTICE 'builtcrm_app already exists, skipping role creation';
  END IF;
END
$$;

-- Connection + schema usage for the runtime role. On Neon these are
-- often already auto-granted to roles created in the same database;
-- the GRANT will emit a "no privileges were granted" warning if so —
-- expected and harmless.
GRANT CONNECT ON DATABASE neondb TO builtcrm_app;
GRANT USAGE ON SCHEMA public TO builtcrm_app;

-- Default privileges: after this runs, any table or sequence created
-- by the admin role in `public` automatically grants DML to builtcrm_app.
-- This is what makes the subsequent `db:migrate` self-sufficient — the
-- baseline creates ~80 tables and each one gets the right grants
-- without a follow-up GRANT step.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO builtcrm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO builtcrm_app;
